import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
const supabase = createClient("https://hnzjvcwbcfgfwpnfyhiz.supabase.co","eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhuemp2Y3diY2ZnZndwbmZ5aGl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NTQ5NzcsImV4cCI6MjA5NzQzMDk3N30.YnbumW8oXeycMd2DNLTA5Qui52sWqRlQgrWyaMwKulI");
export const Route = createFileRoute("/performance")({
  head: () => ({
    meta: [
      { title: "KELTOŞ — Performans & İsabet Oranı" },
      { name: "description", content: "Son 30 günlük sinyal performansı, isabet oranı ve coin bazında başarı istatistikleri." },
    ],
  }),
  component: Performance,
});

interface Signal {
  id: string;
  coin: string;
  signal: "BUY" | "SELL";
  score: number;
  quality: string;
  price: number;
  result: "tuttu" | "tutmadi" | "bekliyor";
  created_at: string;
  closed_at?: string;
}

interface CoinStat {
  coin: string;
  total: number;
  tuttu: number;
  tutmadi: number;
  bekliyor: number;
  rate: number;
}

function dayKey(iso: string) {
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function qualityFromScore(score: number): string {
  if (score >= 90) return "ULTRA";
  if (score >= 70) return "GÜÇLÜ";
  if (score >= 50) return "ORTA";
  return "ZAYIF";
}

// Cron ile aynı TP/SL oranları
const TP_PCT = 0.025; // hedef +%2.5
const SL_PCT = 0.02;  // stop -%2

// Fiyatı okunur formatta göster
function fmtNum(p: number): string {
  if (!p) return "0";
  if (p >= 100) return p.toFixed(2);
  if (p >= 1) return p.toFixed(4);
  return p.toFixed(6);
}

// exchange_prices tablosundan güncel (neredeyse canlı) fiyatları çeker
async function fetchLivePrices(): Promise<Record<string, number>> {
  try {
    const { data } = await supabase
      .from("exchange_prices")
      .select("coin, bybit_price");
    const map: Record<string, number> = {};
    (data || []).forEach((r: any) => {
      if (r.coin && r.bybit_price != null) map[r.coin] = Number(r.bybit_price);
    });
    return map;
  } catch {
    return {};
  }
}

// Açık bir sinyal için canlı kâr/zarar ve hedef/stop uzaklığını hesaplar
function computeLive(signal: Signal, curPrice: number) {
  const entry = Number(signal.price);
  if (!entry || !curPrice) return null;
  const isBuy = signal.signal === "BUY";
  // Anlık kâr/zarar yüzdesi (yön dikkate alınarak)
  const pnlPct = isBuy
    ? ((curPrice - entry) / entry) * 100
    : ((entry - curPrice) / entry) * 100;
  // Hedef ve stop fiyatları
  const target = isBuy ? entry * (1 + TP_PCT) : entry * (1 - TP_PCT);
  const stop = isBuy ? entry * (1 - SL_PCT) : entry * (1 + SL_PCT);
  // İlerleme: stop (0) -> hedef (100) arası konum
  const lo = Math.min(stop, target);
  const hi = Math.max(stop, target);
  let progress = ((curPrice - lo) / (hi - lo)) * 100;
  progress = Math.max(0, Math.min(100, progress));
  // BUY'da hedef üstte, SELL'de hedef altta olduğu için ilerlemeyi yöne göre çevir
  const toTarget = isBuy ? progress : 100 - progress;
  return { pnlPct, target, stop, progress: toTarget };
}

async function loadMergedSignals(thirtyDaysAgo: Date): Promise<Signal[]> {
  const { data } = await supabase
    .from("kpk_signals")
    .select("*")
    .gte("created_at", thirtyDaysAgo.toISOString())
    .order("created_at", { ascending: false });
  const remote: Signal[] = (data as Signal[]) || [];

  let local: Signal[] = [];
  try {
    const raw = JSON.parse(localStorage.getItem("kpk_wins") || "[]");
    if (Array.isArray(raw)) {
      local = raw
        .filter((w: any) => {
          const t = new Date(w.date).getTime();
          return Number.isFinite(t) && t >= thirtyDaysAgo.getTime();
        })
        .map((w: any, i: number) => ({
          id: `local-${w.coin}-${w.signal}-${w.date}-${i}`,
          coin: w.coin,
          signal: (w.signal || "BUY") as "BUY" | "SELL",
          score: w.score ?? 0,
          quality: qualityFromScore(w.score ?? 0),
          price: parseFloat(w.price) || 0,
          result: (w.result || "bekliyor") as "tuttu" | "tutmadi" | "bekliyor",
          created_at: w.date,
        }));
    }
  } catch {
    local = [];
  }

  const seen = new Set(local.map((w) => `${w.coin}_${w.signal}_${dayKey(w.created_at)}`));
  const remoteFiltered = remote.filter((r) => !seen.has(`${r.coin}_${r.signal}_${dayKey(r.created_at)}`));

  return [...local, ...remoteFiltered].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

function Performance() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"hepsi" | "BUY" | "SELL">("hepsi");
  const [days, setDays] = useState<7 | 30>(7);
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    loadMergedSignals(since).then((merged) => {
      if (cancelled) return;
      setSignals(merged);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [days]);

  // Canlı fiyatları yükle ve 60 saniyede bir yenile
  useEffect(() => {
    let cancelled = false;
    const load = () => fetchLivePrices().then((p) => { if (!cancelled) setLivePrices(p); });
    load();
    const id = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const closed = signals.filter((s) => s.result !== "bekliyor");
  const tuttu = signals.filter((s) => s.result === "tuttu").length;
  const tutmadi = signals.filter((s) => s.result === "tutmadi").length;
  const bekliyor = signals.filter((s) => s.result === "bekliyor").length;
  const rate = closed.length > 0 ? Math.round((tuttu / closed.length) * 100) : 0;

  // Canlı takip: açık (bekleyen) sinyaller, en yeni önce
  const openSignals = signals
    .filter((s) => s.result === "bekliyor")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const buySignals = signals.filter((s) => s.signal === "BUY");
  const sellSignals = signals.filter((s) => s.signal === "SELL");
  const buyClosed = buySignals.filter((s) => s.result !== "bekliyor");
  const sellClosed = sellSignals.filter((s) => s.result !== "bekliyor");
  const buyRate = buyClosed.length > 0 ? Math.round((buySignals.filter((s) => s.result === "tuttu").length / buyClosed.length) * 100) : 0;
  const sellRate = sellClosed.length > 0 ? Math.round((sellSignals.filter((s) => s.result === "tuttu").length / sellClosed.length) * 100) : 0;

  const coinMap = new Map<string, CoinStat>();
  signals.forEach((s) => {
    const existing = coinMap.get(s.coin) || { coin: s.coin, total: 0, tuttu: 0, tutmadi: 0, bekliyor: 0, rate: 0 };
    existing.total++;
    if (s.result === "tuttu") existing.tuttu++;
    else if (s.result === "tutmadi") existing.tutmadi++;
    else existing.bekliyor++;
    const c = existing.tuttu + existing.tutmadi;
    existing.rate = c > 0 ? Math.round((existing.tuttu / c) * 100) : 0;
    coinMap.set(s.coin, existing);
  });
  const coinStats = Array.from(coinMap.values()).sort((a, b) => b.total - a.total);

  const filtered = filter === "hepsi" ? signals : signals.filter((s) => s.signal === filter);

  const rateColor = (r: number) => r >= 70 ? "#22c55e" : r >= 50 ? "#f5b629" : "#ef4444";
  const resultBg = (r: string) => r === "tuttu" ? "rgba(34,197,94,.15)" : r === "tutmadi" ? "rgba(239,68,68,.15)" : "rgba(245,182,41,.1)";
  const resultColor = (r: string) => r === "tuttu" ? "#22c55e" : r === "tutmadi" ? "#ef4444" : "#f5b629";
  const resultText = (r: string) => r === "tuttu" ? "✅ Tuttu" : r === "tutmadi" ? "❌ Tutmadı" : "⏳ Bekliyor";

  return (
    <div style={{ background: "#05080d", minHeight: "100vh", color: "#e8eef7", fontFamily: "'Inter',system-ui,sans-serif", padding: "0 0 60px" }}>
      <style>{`
        * { box-sizing: border-box; }
        .perf-nav { display:flex; align-items:center; justify-content:space-between; padding:14px 24px; background:rgba(5,8,13,.85); backdrop-filter:blur(14px); border-bottom:1px solid rgba(245,182,41,.18); position:sticky; top:0; z-index:50; }
        .perf-title { font-weight:900; font-size:18px; letter-spacing:.1em; background:linear-gradient(135deg,#f5b629,#ffd76a); -webkit-background-clip:text; background-clip:text; color:transparent; }
        .perf-back { color:#f5b629; text-decoration:none; font-size:13px; font-weight:600; padding:6px 14px; border:1px solid rgba(245,182,41,.3); border-radius:999px; transition:all .2s; }
        .perf-back:hover { background:rgba(245,182,41,.1); }
        .container { max-width:1100px; margin:0 auto; padding:32px 20px; }
        .stat-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:32px; }
        .period-row { display:flex; align-items:center; gap:10px; margin-bottom:20px; }
        .period-label { font-size:12px; color:#8a93a3; letter-spacing:.08em; text-transform:uppercase; }
        .period-btn { padding:6px 18px; border-radius:999px; border:1px solid rgba(245,182,41,.25); background:transparent; color:#8a93a3; font-size:13px; font-weight:600; cursor:pointer; transition:all .2s; }
        .period-btn.active { background:rgba(245,182,41,.15); color:#f5b629; border-color:rgba(245,182,41,.5); }
        .live-head { display:flex; align-items:center; gap:10px; margin:8px 0 16px; }
        .live-dot { width:9px; height:9px; border-radius:50%; background:#22c55e; box-shadow:0 0 0 0 rgba(34,197,94,.6); animation:livepulse 1.6s infinite; }
        @keyframes livepulse { 0%{box-shadow:0 0 0 0 rgba(34,197,94,.5)} 70%{box-shadow:0 0 0 8px rgba(34,197,94,0)} 100%{box-shadow:0 0 0 0 rgba(34,197,94,0)} }
        .live-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:12px; margin-bottom:32px; }
        @media(max-width:700px){ .live-grid { grid-template-columns:1fr; } }
        .live-card { background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.01)); border:1px solid rgba(245,182,41,.18); border-radius:16px; padding:16px 18px; }
        .live-top { display:flex; align-items:center; gap:10px; margin-bottom:12px; }
        .live-coin { font-weight:800; font-size:15px; }
        .live-side { font-size:11px; font-weight:700; padding:3px 10px; border-radius:999px; }
        .live-pnl { margin-left:auto; font-size:18px; font-weight:900; }
        .live-bar-wrap { position:relative; height:8px; border-radius:999px; background:rgba(255,255,255,.06); overflow:hidden; margin:10px 0 8px; }
        .live-bar { position:absolute; top:0; left:0; height:100%; border-radius:999px; transition:width .4s ease; }
        .live-meta { display:flex; justify-content:space-between; font-size:11px; color:#8a93a3; }
        .live-empty { text-align:center; padding:28px; color:#8a93a3; font-size:14px; background:rgba(255,255,255,.02); border:1px dashed rgba(245,182,41,.15); border-radius:16px; margin-bottom:32px; }
        @media(max-width:700px){ .stat-grid { grid-template-columns:repeat(2,1fr); } }
        .stat-card { background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.01)); border:1px solid rgba(245,182,41,.18); border-radius:18px; padding:20px; text-align:center; }
        .stat-val { font-size:36px; font-weight:900; margin-bottom:4px; }
        .stat-label { font-size:12px; color:#8a93a3; letter-spacing:.12em; text-transform:uppercase; }
        .section-title { font-size:18px; font-weight:800; margin:0 0 16px; color:#f5b629; letter-spacing:.05em; }
        .coin-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:32px; }
        @media(max-width:700px){ .coin-grid { grid-template-columns:repeat(2,1fr); } }
        .coin-card { background:rgba(255,255,255,.03); border:1px solid rgba(245,182,41,.12); border-radius:14px; padding:14px 16px; display:flex; align-items:center; justify-content:space-between; }
        .coin-name { font-weight:800; font-size:14px; }
        .coin-sub { font-size:11px; color:#8a93a3; margin-top:2px; }
        .rate-badge { font-size:20px; font-weight:900; }
        .filter-row { display:flex; gap:8px; margin-bottom:16px; }
        .filter-btn { padding:6px 18px; border-radius:999px; border:1px solid rgba(245,182,41,.25); background:transparent; color:#8a93a3; font-size:13px; font-weight:600; cursor:pointer; transition:all .2s; }
        .filter-btn.active { background:rgba(245,182,41,.15); color:#f5b629; border-color:rgba(245,182,41,.5); }
        .signal-list { display:flex; flex-direction:column; gap:8px; }
        .signal-row { background:rgba(255,255,255,.03); border:1px solid rgba(245,182,41,.1); border-radius:14px; padding:14px 18px; display:flex; align-items:center; gap:14px; flex-wrap:wrap; }
        .sig-coin { font-weight:800; font-size:15px; min-width:100px; }
        .sig-type { font-size:12px; font-weight:700; padding:3px 10px; border-radius:999px; }
        .sig-quality { font-size:11px; color:#8a93a3; }
        .sig-score { font-size:13px; font-weight:700; color:#f5b629; }
        .sig-price { font-size:12px; color:#8a93a3; }
        .sig-result { font-size:12px; font-weight:700; padding:3px 10px; border-radius:999px; margin-left:auto; }
        .sig-date { font-size:11px; color:#8a93a3; }
        .empty { text-align:center; padding:48px; color:#8a93a3; font-size:15px; }
        .loading { text-align:center; padding:80px; color:#f5b629; font-size:18px; }
        .type-row { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:32px; }
        .type-card { background:rgba(255,255,255,.03); border-radius:16px; padding:20px; text-align:center; }
      `}</style>

      <nav className="perf-nav">
        <span className="perf-title">📊 PERFORMANS</span>
        <a href="/" className="perf-back">← Ana Sayfa</a>
      </nav>

      {loading ? (
        <div className="loading">⏳ Yükleniyor...</div>
      ) : (
        <div className="container">

          <div className="period-row">
            <span className="period-label">Dönem:</span>
            {([7, 30] as const).map((d) => (
              <button
                key={d}
                className={`period-btn ${days === d ? "active" : ""}`}
                onClick={() => setDays(d)}
              >
                Son {d} Gün
              </button>
            ))}
          </div>

          <div className="live-head">
            <span className="live-dot"></span>
            <span className="section-title" style={{ margin: 0 }}>Canlı Sinyal Takibi</span>
            <span style={{ fontSize: 12, color: "#8a93a3", marginLeft: "auto" }}>{openSignals.length} açık pozisyon</span>
          </div>

          {openSignals.length === 0 ? (
            <div className="live-empty">Şu an açık sinyal yok. Yeni sinyal geldiğinde canlı durumu burada görünecek.</div>
          ) : (
            <div className="live-grid">
              {openSignals.map((s) => {
                const cur = livePrices[s.coin];
                const live = cur ? computeLive(s, cur) : null;
                const isBuy = s.signal === "BUY";
                const pnl = live?.pnlPct ?? 0;
                const pnlColor = pnl >= 0 ? "#22c55e" : "#ef4444";
                const barColor = pnl >= 0 ? "#22c55e" : "#ef4444";
                return (
                  <div key={s.id} className="live-card">
                    <div className="live-top">
                      <span className="live-coin">{s.coin.replace("USDT", "")}/USDT</span>
                      <span className="live-side" style={{
                        background: isBuy ? "rgba(34,197,94,.15)" : "rgba(239,68,68,.15)",
                        color: isBuy ? "#22c55e" : "#ef4444",
                        border: `1px solid ${isBuy ? "rgba(34,197,94,.3)" : "rgba(239,68,68,.3)"}`,
                      }}>
                        {isBuy ? "🟢 BUY" : "🔴 SELL"}
                      </span>
                      {live ? (
                        <span className="live-pnl" style={{ color: pnlColor }}>
                          {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}%
                        </span>
                      ) : (
                        <span className="live-pnl" style={{ color: "#8a93a3", fontSize: 13 }}>fiyat bekleniyor</span>
                      )}
                    </div>

                    {live && (
                      <>
                        <div className="live-bar-wrap">
                          <div className="live-bar" style={{ width: `${live.progress}%`, background: barColor }}></div>
                        </div>
                        <div className="live-meta">
                          <span>🛑 Stop: ${fmtNum(live.stop)}</span>
                          <span>Giriş: ${fmtNum(Number(s.price))}</span>
                          <span>🎯 Hedef: ${fmtNum(live.target)}</span>
                        </div>
                      </>
                    )}

                    <div className="live-meta" style={{ marginTop: 8 }}>
                      <span>⭐ Skor {s.score}/100 · {s.quality}</span>
                      <span>{new Date(s.created_at).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-val" style={{ color: rateColor(rate) }}>{rate}%</div>
              <div className="stat-label">İsabet Oranı</div>
            </div>
            <div className="stat-card">
              <div className="stat-val" style={{ color: "#e8eef7" }}>{signals.length}</div>
              <div className="stat-label">Toplam Sinyal</div>
            </div>
            <div className="stat-card">
              <div className="stat-val" style={{ color: "#22c55e" }}>{tuttu}</div>
              <div className="stat-label">Tuttu ✅</div>
            </div>
            <div className="stat-card">
              <div className="stat-val" style={{ color: "#ef4444" }}>{tutmadi}</div>
              <div className="stat-label">Tutmadı ❌</div>
            </div>
          </div>

          <div className="type-row">
            <div className="type-card" style={{ border: "1px solid rgba(34,197,94,.25)" }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#22c55e", marginBottom: 4 }}>{buyRate}%</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#22c55e", marginBottom: 8 }}>🟢 BUY İsabet</div>
              <div style={{ fontSize: 12, color: "#8a93a3" }}>{buySignals.length} sinyal · {buySignals.filter(s => s.result === "tuttu").length} tuttu</div>
            </div>
            <div className="type-card" style={{ border: "1px solid rgba(239,68,68,.25)" }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#ef4444", marginBottom: 4 }}>{sellRate}%</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#ef4444", marginBottom: 8 }}>🔴 SELL İsabet</div>
              <div style={{ fontSize: 12, color: "#8a93a3" }}>{sellSignals.length} sinyal · {sellSignals.filter(s => s.result === "tuttu").length} tuttu</div>
            </div>
          </div>

          {coinStats.length > 0 && (
            <>
              <div className="section-title">Coin Bazında Başarı</div>
              <div className="coin-grid">
                {coinStats.map((c) => (
                  <div key={c.coin} className="coin-card">
                    <div>
                      <div className="coin-name">{c.coin.replace("USDT", "")}</div>
                      <div className="coin-sub">{c.total} sinyal · {c.tuttu}✅ {c.tutmadi}❌ {c.bekliyor}⏳</div>
                    </div>
                    <div className="rate-badge" style={{ color: rateColor(c.rate) }}>
                      {c.tuttu + c.tutmadi > 0 ? `${c.rate}%` : "—"}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="section-title">Son Sinyaller ({days} Gün)</div>
          <div className="filter-row">
            {(["hepsi", "BUY", "SELL"] as const).map((f) => (
              <button key={f} className={`filter-btn ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
                {f === "hepsi" ? "Hepsi" : f === "BUY" ? "🟢 BUY" : "🔴 SELL"}
              </button>
            ))}
            <span style={{ marginLeft: "auto", fontSize: 12, color: "#8a93a3", alignSelf: "center" }}>
              {filtered.length} sinyal · {bekliyor} bekliyor
            </span>
          </div>

          {filtered.length === 0 ? (
            <div className="empty">Henüz sinyal yok.</div>
          ) : (
            <div className="signal-list">
              {filtered.map((s) => (
                <div key={s.id} className="signal-row">
                  <div className="sig-coin">{s.coin.replace("USDT", "")}/USDT</div>
                  <span className="sig-type" style={{
                    background: s.signal === "BUY" ? "rgba(34,197,94,.15)" : "rgba(239,68,68,.15)",
                    color: s.signal === "BUY" ? "#22c55e" : "#ef4444",
                    border: `1px solid ${s.signal === "BUY" ? "rgba(34,197,94,.3)" : "rgba(239,68,68,.3)"}`,
                  }}>
                    {s.signal === "BUY" ? "🟢 BUY" : "🔴 SELL"}
                  </span>
                  <span className="sig-quality">{s.quality}</span>
                  <span className="sig-score">⭐ {s.score}/100</span>
                  <span className="sig-price">${typeof s.price === "number" ? s.price.toFixed(s.price >= 100 ? 2 : 4) : s.price}</span>
                  <span className="sig-date">{new Date(s.created_at).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  <span className="sig-result" style={{ background: resultBg(s.result), color: resultColor(s.result), border: `1px solid ${resultColor(s.result)}44` }}>
                    {resultText(s.result)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
