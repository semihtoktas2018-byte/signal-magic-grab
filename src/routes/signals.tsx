import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://hnzjvcwbcfgfwpnfyhiz.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhuemp2Y3diY2ZnZndwbmZ5aGl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NTQ5NzcsImV4cCI6MjA5NzQzMDk3N30.YnbumW8oXeycMd2DNLTA5Qui52sWqRlQgrWyaMwKulI"
);

export const Route = createFileRoute("/signals")({
  head: () => ({
    meta: [
      { title: "KELTOŞ — Sinyal Terminali" },
      {
        name: "description",
        content:
          "Canlı kripto sinyal terminali: radar, güncel fiyatlar, aktif sinyaller, hedef/stop, skor ve coin başına teknik detaylar.",
      },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
    ],
  }),
  component: SignalTerminal,
});

// Cron ile birebir aynı TP/SL oranları
const TP_PCT = 0.025;
const SL_PCT = 0.02;

interface Signal {
  id: string;
  coin: string;
  signal: "BUY" | "SELL";
  score: number;
  quality: string;
  price: number;
  result: "tuttu" | "tutmadi" | "bekliyor";
  created_at: string;
}
interface PriceRow {
  coin: string;
  bybit_price: number;
  okx_price: number;
  diff_pct: number;
  updated_at: string;
}
interface Indicators {
  rsi: number | null;
  emaTrend: "yukarı" | "aşağı" | "yatay";
  macd: "pozitif" | "negatif";
  bbPct: number | null;
  reason: string;
}

// ---------- göstergeler (cron ile aynı matematik, tarayıcıda canlı) ----------
function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0];
  out.push(prev);
  for (let i = 1; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}
function rsi(values: number[], period = 14): number | null {
  if (values.length <= period) return null;
  let gain = 0,
    loss = 0;
  for (let i = 1; i <= period; i++) {
    const ch = values[i] - values[i - 1];
    if (ch >= 0) gain += ch;
    else loss -= ch;
  }
  let ag = gain / period,
    al = loss / period;
  let r = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  for (let i = period + 1; i < values.length; i++) {
    const ch = values[i] - values[i - 1];
    const g = ch > 0 ? ch : 0;
    const l = ch < 0 ? -ch : 0;
    ag = (ag * (period - 1) + g) / period;
    al = (al * (period - 1) + l) / period;
    r = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  }
  return r;
}
function macdHist(values: number[]): number {
  const e12 = ema(values, 12),
    e26 = ema(values, 26);
  const line = values.map((_, i) => e12[i] - e26[i]);
  const sig = ema(line.slice(25), 9);
  return line[line.length - 1] - sig[sig.length - 1];
}
function bollingerPct(values: number[], period = 20, mult = 2): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
  const sd = Math.sqrt(variance);
  const upper = mean + mult * sd,
    lower = mean - mult * sd;
  const price = values[values.length - 1];
  return upper === lower ? 0.5 : (price - lower) / (upper - lower);
}

function computeIndicators(closes: number[]): Indicators {
  const r = rsi(closes);
  const e20 = ema(closes, 20);
  const e50 = ema(closes, 50);
  const last20 = e20[e20.length - 1];
  const last50 = e50[e50.length - 1];
  const diff = ((last20 - last50) / last50) * 100;
  const emaTrend = diff > 0.15 ? "yukarı" : diff < -0.15 ? "aşağı" : "yatay";
  const mh = macdHist(closes);
  const macd = mh >= 0 ? "pozitif" : "negatif";
  const bbPct = bollingerPct(closes);

  const parts: string[] = [];
  if (r != null) {
    if (r >= 70) parts.push("RSI aşırı alım bölgesinde");
    else if (r <= 30) parts.push("RSI aşırı satım bölgesinde");
    else parts.push("RSI nötr");
  }
  parts.push(`trend ${emaTrend}`);
  parts.push(`momentum ${macd}`);
  return { rsi: r, emaTrend, macd, bbPct, reason: parts.join(" · ") };
}

async function fetchCloses(symbol: string): Promise<number[]> {
  const url = `https://api.bybit.com/v5/market/kline?category=spot&symbol=${symbol}&interval=15&limit=120`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("kline");
  const j = await res.json();
  const list = (j.result?.list ?? []) as string[][];
  // Bybit yeni→eski döndürür; kronolojik sıraya çevir, kapanış (index 4)
  return list
    .slice()
    .reverse()
    .map((k) => parseFloat(k[4]))
    .filter((n) => !isNaN(n));
}

function fmtNum(p: number): string {
  if (!p) return "0";
  if (p >= 100) return p.toFixed(2);
  if (p >= 1) return p.toFixed(4);
  return p.toFixed(6);
}
function coinShort(c: string): string {
  return c.replace("USDT", "");
}
function targetStop(signal: "BUY" | "SELL", entry: number) {
  const isBuy = signal === "BUY";
  return {
    target: isBuy ? entry * (1 + TP_PCT) : entry * (1 - TP_PCT),
    stop: isBuy ? entry * (1 - SL_PCT) : entry * (1 + SL_PCT),
  };
}
function resultLabel(r: Signal["result"]) {
  if (r === "tuttu") return { text: "✓ Tuttu", cls: "res-win" };
  if (r === "tutmadi") return { text: "✗ Tutmadı", cls: "res-loss" };
  return { text: "⏳ Bekliyor", cls: "res-wait" };
}

async function loadSignals(): Promise<Signal[]> {
  const { data } = await supabase
    .from("kpk_signals")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(60);
  return (data as Signal[]) || [];
}
async function loadPrices(): Promise<PriceRow[]> {
  const { data } = await supabase
    .from("exchange_prices")
    .select("*")
    .order("coin", { ascending: true });
  return (data as PriceRow[]) || [];
}

function SignalTerminal() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"hepsi" | "BUY" | "SELL">("hepsi");
  const [lastUpdate, setLastUpdate] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, Indicators | "loading" | "error">>({});

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      Promise.all([loadSignals(), loadPrices()]).then(([s, p]) => {
        if (cancelled) return;
        setSignals(s);
        setPrices(p);
        setLoading(false);
        setLastUpdate(
          new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
        );
      });
    };
    load();
    const t = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const priceMap: Record<string, number> = {};
  prices.forEach((p) => {
    if (p.coin && p.bybit_price != null) priceMap[p.coin] = Number(p.bybit_price);
  });

  // Piyasa eğilimi: en güncel sinyallerdeki BUY/SELL dağılımından (gerçek veri)
  const latestByCoin: Record<string, Signal> = {};
  signals.forEach((s) => {
    if (!latestByCoin[s.coin]) latestByCoin[s.coin] = s;
  });
  const latest = Object.values(latestByCoin);
  const buyN = latest.filter((s) => s.signal === "BUY").length;
  const sellN = latest.filter((s) => s.signal === "SELL").length;
  const decided = buyN + sellN;
  const bullPct = decided ? Math.round((buyN / decided) * 100) : 50;
  const mood = bullPct >= 55 ? "YÜKSELİŞ" : bullPct <= 45 ? "DÜŞÜŞ" : "KARARSIZ";
  const moodCls = bullPct >= 55 ? "mood-up" : bullPct <= 45 ? "mood-down" : "mood-flat";

  const openCount = signals.filter((s) => s.result === "bekliyor").length;
  const shown = filter === "hepsi" ? signals : signals.filter((s) => s.signal === filter);

  function toggleDetail(s: Signal) {
    if (openId === s.id) {
      setOpenId(null);
      return;
    }
    setOpenId(s.id);
    if (!details[s.id]) {
      setDetails((d) => ({ ...d, [s.id]: "loading" }));
      fetchCloses(s.coin)
        .then((closes) => {
          if (closes.length < 50) throw new Error("yetersiz veri");
          setDetails((d) => ({ ...d, [s.id]: computeIndicators(closes) }));
        })
        .catch(() => setDetails((d) => ({ ...d, [s.id]: "error" })));
    }
  }

  return (
    <div className="term">
      <style>{`
        .term{background:#05070c;min-height:100vh;color:#f0f4fa;font-family:'Inter',system-ui,-apple-system,sans-serif;padding:0 0 60px}
        .term-nav{display:flex;align-items:center;justify-content:space-between;padding:12px 18px;background:rgba(5,7,12,.9);backdrop-filter:blur(14px);border-bottom:1px solid rgba(245,182,41,.18);position:sticky;top:0;z-index:50;gap:10px;flex-wrap:wrap}
        .term-brand{font-weight:900;font-size:17px;letter-spacing:.06em;background:linear-gradient(135deg,#f5b629,#ffd76a);-webkit-background-clip:text;background-clip:text;color:transparent}
        .term-links{display:flex;gap:14px;flex-wrap:wrap}
        .term-links a{color:#8a93a3;text-decoration:none;font-size:13px;font-weight:600}
        .term-links a:hover,.term-links a.active{color:#f5b629}
        .wrap{max-width:1080px;margin:0 auto;padding:18px 14px 0}
        .top-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px}
        @media(max-width:720px){.top-grid{grid-template-columns:1fr}}
        .card{background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.01));border:1px solid rgba(245,182,41,.18);border-radius:16px;padding:16px}
        .card-h{font-size:12px;letter-spacing:.08em;color:#f5b629;font-weight:800;text-transform:uppercase;margin-bottom:12px}
        .mood{font-size:30px;font-weight:900;letter-spacing:.02em}
        .mood-up{color:#22c55e}.mood-down{color:#ef4444}.mood-flat{color:#f5b629}
        .mood-sub{font-size:12px;color:#8a93a3;margin-top:2px}
        .mood-bar{height:8px;border-radius:999px;background:rgba(239,68,68,.25);overflow:hidden;margin-top:12px}
        .mood-fill{height:100%;background:linear-gradient(90deg,#22c55e,#4ade80)}
        .radar-box{display:flex;align-items:center;gap:16px}
        .radar{position:relative;width:96px;height:96px;border-radius:50%;border:1px solid rgba(34,197,94,.35);background:radial-gradient(circle,rgba(34,197,94,.08),transparent 70%);flex-shrink:0;overflow:hidden}
        .radar::before{content:"";position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 0deg,rgba(34,197,94,.5),transparent 25%);animation:sweep 3s linear infinite}
        .radar::after{content:"";position:absolute;top:50%;left:50%;width:6px;height:6px;border-radius:50%;background:#22c55e;transform:translate(-50%,-50%);box-shadow:0 0 8px #22c55e}
        @keyframes sweep{to{transform:rotate(360deg)}}
        .radar-stats div{margin-bottom:8px}
        .radar-k{font-size:11px;color:#8a93a3}.radar-v{font-size:20px;font-weight:800}
        .rv-green{color:#22c55e}.rv-gold{color:#f5b629}
        .sec-h{display:flex;align-items:center;gap:10px;margin:22px 0 10px;flex-wrap:wrap}
        .sec-t{font-size:14px;font-weight:800;letter-spacing:.05em;color:#f5b629;text-transform:uppercase}
        .live-dot{width:9px;height:9px;border-radius:50%;background:#22c55e;animation:lp 1.6s infinite}
        @keyframes lp{0%{box-shadow:0 0 0 0 rgba(34,197,94,.5)}70%{box-shadow:0 0 0 8px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}
        .meta{font-size:12px;color:#8a93a3}
        .price-strip{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
        .pchip{background:rgba(255,255,255,.03);border:1px solid rgba(245,182,41,.14);border-radius:10px;padding:9px 11px;display:flex;justify-content:space-between;align-items:center;gap:6px}
        .pchip .c{font-weight:800;font-size:13px}.pchip .p{font-size:11px;color:#8a93a3}
        .diff{font-size:11px;font-weight:700;padding:2px 7px;border-radius:999px}
        .dpos{color:#22c55e;background:rgba(34,197,94,.12)}.dneg{color:#ef4444;background:rgba(239,68,68,.12)}
        .filters{display:flex;gap:8px;margin:2px 0 12px}
        .fbtn{padding:6px 16px;border-radius:999px;border:1px solid rgba(245,182,41,.25);background:transparent;color:#8a93a3;font-size:13px;font-weight:700;cursor:pointer}
        .fbtn.active{background:rgba(245,182,41,.15);color:#f5b629;border-color:rgba(245,182,41,.5)}
        .sig-list{display:flex;flex-direction:column;gap:10px}
        .sig-card{background:rgba(255,255,255,.03);border:1px solid rgba(245,182,41,.12);border-radius:14px;overflow:hidden}
        .sig-main{display:grid;grid-template-columns:auto auto 1fr auto auto;gap:12px;align-items:center;padding:14px 16px}
        @media(max-width:640px){.sig-main{grid-template-columns:auto 1fr auto;row-gap:10px}}
        .badge{font-size:11px;font-weight:800;padding:3px 10px;border-radius:999px;white-space:nowrap}
        .b-buy{color:#22c55e;background:rgba(34,197,94,.14)}.b-sell{color:#ef4444;background:rgba(239,68,68,.14)}
        .coin-name{font-weight:800;font-size:15px}
        .mono{font-variant-numeric:tabular-nums}
        .levels{display:flex;gap:14px;font-size:12px}
        @media(max-width:640px){.levels{grid-column:1/-1;justify-content:space-between}}
        .lv-k{color:#8a93a3;font-size:10px;text-transform:uppercase;letter-spacing:.05em}
        .c-t{color:#22c55e}.c-s{color:#ef4444}
        .score{min-width:40px;text-align:center;font-weight:800;padding:4px 8px;border-radius:8px;background:linear-gradient(135deg,rgba(245,182,41,.28),rgba(245,182,41,.08));color:#ffd76a}
        .pnl{font-size:13px;font-weight:800}
        .res-win{color:#22c55e;font-weight:700;font-size:12px}.res-loss{color:#ef4444;font-weight:700;font-size:12px}.res-wait{color:#f5b629;font-weight:700;font-size:12px}
        .detail-btn{grid-column:1/-1;background:rgba(245,182,41,.08);border:none;border-top:1px solid rgba(245,182,41,.1);color:#f5b629;font-size:12px;font-weight:700;padding:9px;cursor:pointer;width:100%}
        .detail{padding:14px 16px;border-top:1px solid rgba(245,182,41,.1);background:rgba(0,0,0,.2)}
        .ind-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:10px}
        .ind{background:rgba(255,255,255,.03);border-radius:10px;padding:10px}
        .ind-k{font-size:10px;color:#8a93a3;text-transform:uppercase;letter-spacing:.05em}
        .ind-v{font-size:15px;font-weight:800;margin-top:3px}
        .reason{font-size:12px;color:#c7cfdb;background:rgba(245,182,41,.06);border-left:2px solid #f5b629;padding:8px 10px;border-radius:0 8px 8px 0}
        .empty{text-align:center;padding:40px 20px;color:#8a93a3;font-size:14px;background:rgba(255,255,255,.02);border:1px dashed rgba(245,182,41,.15);border-radius:16px}
        .loading{text-align:center;padding:60px;color:#8a93a3}
        .disc{margin-top:22px;font-size:11px;color:#6b7280;text-align:center;line-height:1.5}
        .sig-foot{text-align:center;margin-top:36px;font-size:11px;letter-spacing:.08em;color:#0f7a4d;font-weight:600}
      `}</style>

      <nav className="term-nav">
        <span className="term-brand">⚡ KELTOŞ SİNYAL TERMİNALİ</span>
        <div className="term-links">
          <a href="/">Ana Sayfa</a>
          <a href="/signals" className="active">Terminal</a>
          <a href="/performance">Performans</a>
          <a href="/whale">Whale Radar</a>
          <a href="/exchange">Borsa Karşılaştır</a>
        </div>
      </nav>

      {loading ? (
        <div className="loading">⏳ Yükleniyor...</div>
      ) : (
        <div className="wrap">
          <div className="top-grid">
            <div className="card">
              <div className="card-h">Piyasa Durumu</div>
              <div className={`mood ${moodCls}`}>{mood}</div>
              <div className="mood-sub">
                Sinyallerin %{bullPct}'i AL yönünde ({buyN} AL · {sellN} SAT)
              </div>
              <div className="mood-bar">
                <div className="mood-fill" style={{ width: `${bullPct}%` }} />
              </div>
            </div>
            <div className="card">
              <div className="card-h">KELTOŞ Radar</div>
              <div className="radar-box">
                <div className="radar" />
                <div className="radar-stats">
                  <div>
                    <div className="radar-k">İzlenen coin</div>
                    <div className="radar-v rv-gold">{prices.length || "—"}</div>
                  </div>
                  <div>
                    <div className="radar-k">Açık sinyal</div>
                    <div className="radar-v rv-green">{openCount}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Canlı fiyat */}
          <div className="sec-h">
            <span className="live-dot" />
            <span className="sec-t">Canlı Fiyat / Fark</span>
            {lastUpdate && <span className="meta" style={{ marginLeft: "auto" }}>Son güncelleme: {lastUpdate}</span>}
          </div>
          {prices.length === 0 ? (
            <div className="empty">Fiyat verisi bekleniyor…</div>
          ) : (
            <div className="price-strip">
              {prices.map((p) => (
                <div className="pchip" key={p.coin}>
                  <div>
                    <div className="c">{coinShort(p.coin)}</div>
                    <div className="p">Bybit {fmtNum(Number(p.bybit_price))}</div>
                  </div>
                  <span className={`diff ${Number(p.diff_pct) >= 0 ? "dpos" : "dneg"}`}>
                    {Number(p.diff_pct) >= 0 ? "+" : ""}
                    {Number(p.diff_pct).toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Sinyaller */}
          <div className="sec-h">
            <span className="sec-t">Sinyaller</span>
            <span className="meta" style={{ marginLeft: "auto" }}>
              {openCount} açık · {signals.length} toplam
            </span>
          </div>
          <div className="filters">
            {(["hepsi", "BUY", "SELL"] as const).map((f) => (
              <button key={f} className={`fbtn ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
                {f === "hepsi" ? "Hepsi" : f}
              </button>
            ))}
          </div>

          {shown.length === 0 ? (
            <div className="empty">Şu an gösterilecek sinyal yok. Yeni sinyaller geldikçe burada listelenecek.</div>
          ) : (
            <div className="sig-list">
              {shown.map((s) => {
                const entry = Number(s.price);
                const { target, stop } = targetStop(s.signal, entry);
                const res = resultLabel(s.result);
                const cur = priceMap[s.coin];
                let pnl: number | null = null;
                if (cur && entry) {
                  pnl = s.signal === "BUY" ? ((cur - entry) / entry) * 100 : ((entry - cur) / entry) * 100;
                }
                const det = details[s.id];
                const isOpen = openId === s.id;
                return (
                  <div className="sig-card" key={s.id}>
                    <div className="sig-main">
                      <span className={`badge ${s.signal === "BUY" ? "b-buy" : "b-sell"}`}>{s.signal}</span>
                      <span className="coin-name">{coinShort(s.coin)}</span>
                      <div className="levels">
                        <div>
                          <div className="lv-k">Giriş</div>
                          <div className="mono">{fmtNum(entry)}</div>
                        </div>
                        <div>
                          <div className="lv-k">Hedef</div>
                          <div className="mono c-t">{fmtNum(target)}</div>
                        </div>
                        <div>
                          <div className="lv-k">Stop</div>
                          <div className="mono c-s">{fmtNum(stop)}</div>
                        </div>
                      </div>
                      <span className="score">{s.score}</span>
                      <div style={{ textAlign: "right" }}>
                        {pnl != null && (
                          <div className="pnl" style={{ color: pnl >= 0 ? "#22c55e" : "#ef4444" }}>
                            {pnl >= 0 ? "+" : ""}
                            {pnl.toFixed(2)}%
                          </div>
                        )}
                        <div className={res.cls}>{res.text}</div>
                      </div>
                    </div>
                    <button className="detail-btn" onClick={() => toggleDetail(s)}>
                      {isOpen ? "▲ Detayları gizle" : "▼ Detay"}
                    </button>
                    {isOpen && (
                      <div className="detail">
                        {det === "loading" && <div className="meta">Göstergeler hesaplanıyor…</div>}
                        {det === "error" && <div className="meta">Detay verisi şu an alınamadı.</div>}
                        {det && det !== "loading" && det !== "error" && (
                          <>
                            <div className="ind-grid">
                              <div className="ind">
                                <div className="ind-k">RSI (14)</div>
                                <div className="ind-v">{det.rsi != null ? det.rsi.toFixed(0) : "—"}</div>
                              </div>
                              <div className="ind">
                                <div className="ind-k">EMA Trend</div>
                                <div className="ind-v">{det.emaTrend}</div>
                              </div>
                              <div className="ind">
                                <div className="ind-k">MACD</div>
                                <div className="ind-v">{det.macd}</div>
                              </div>
                              <div className="ind">
                                <div className="ind-k">Bollinger</div>
                                <div className="ind-v">
                                  {det.bbPct != null ? `%${Math.round(det.bbPct * 100)}` : "—"}
                                </div>
                              </div>
                              <div className="ind">
                                <div className="ind-k">Kalite</div>
                                <div className="ind-v">{s.quality}</div>
                              </div>
                              <div className="ind">
                                <div className="ind-k">Skor</div>
                                <div className="ind-v">{s.score}/100</div>
                              </div>
                            </div>
                            <div className="reason">
                              {coinShort(s.coin)} için {s.signal} · {det.reason}. Hedef{" "}
                              {fmtNum(target)}, stop {fmtNum(stop)}.
                            </div>
                          </>
                        )}
                        <div className="meta" style={{ marginTop: 8 }}>
                          Sinyal zamanı:{" "}
                          {new Date(s.created_at).toLocaleString("tr-TR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="disc">
            Bu panel otomatik işlem açmaz; yalnızca teknik analiz ve sinyal gösterir. Yatırım tavsiyesi değildir.
          </div>
          <div className="sig-foot">A BAMIR ONLINE STORE'S PRODUCTION</div>
        </div>
      )}
    </div>
  );
}
