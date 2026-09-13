import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
const supabase = createClient("https://hnzjvcwbcfgfwpnfyhiz.supabase.co","eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhuemp2Y3diY2ZnZndwbmZ5aGl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NTQ5NzcsImV4cCI6MjA5NzQzMDk3N30.YnbumW8oXeycMd2DNLTA5Qui52sWqRlQgrWyaMwKulI");
export const Route = createFileRoute("/performance")({
  head: () => ({
    meta: [
      { title: "KELTOŞ — Performans & İsabet Oranı" },
      { name: "description", content: "Sinyal performansı, isabet oranı, beklenen getiri (EV) ve coin bazında başarı — her sinyalin tıklanabilir açıklamasıyla." },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
    ],
  }),
  component: Performance,
});

interface SignalComponents {
  rsi?: number | null;
  ema20?: number | null;
  ema50?: number | null;
  emaTrend?: string | null;
  macdHist?: number | null;
  bbPct?: number | null;
  volRatio?: number | null;
  whaleBuyUsd?: number | null;
  whaleSellUsd?: number | null;
  v2Score?: number | null;
}
interface Signal {
  id: string;
  coin: string;
  signal: "BUY" | "SELL";
  score: number;
  quality: string;
  price: number;
  result: "tuttu" | "tutmadi" | "bekliyor";
  created_at: string;
  closed_at?: string | null;
  components?: SignalComponents | null;
  entry_snapshot?: number | null;
  score_band?: string | null;
}
interface CoinStat {
  coin: string; total: number; tuttu: number; tutmadi: number; bekliyor: number; rate: number; closed: number;
}

const TP_PCT = 0.025;
const SL_PCT = 0.02;
// Az örneklem eşiği: bunun altında oranlar "güvenilir değil" uyarısı gösterir
const MIN_SAMPLE = 20;

function fmtNum(p: number): string {
  if (!p) return "0";
  if (p >= 100) return p.toFixed(2);
  if (p >= 1) return p.toFixed(4);
  return p.toFixed(6);
}
function coinShort(c: string) { return c.replace("USDT", ""); }
function levels(signal: "BUY" | "SELL", entry: number) {
  const isBuy = signal === "BUY";
  return {
    target: isBuy ? entry * (1 + TP_PCT) : entry * (1 - TP_PCT),
    stop: isBuy ? entry * (1 - SL_PCT) : entry * (1 + SL_PCT),
  };
}
function durationText(from: string, to?: string | null): string {
  if (!to) return "—";
  const mins = Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000));
  if (mins >= 1440) return `${Math.floor(mins / 1440)}g ${Math.floor((mins % 1440) / 60)}s`;
  if (mins >= 60) return `${Math.floor(mins / 60)}s ${mins % 60}dk`;
  return `${mins}dk`;
}

async function fetchLivePrices(): Promise<Record<string, number>> {
  try {
    const { data } = await supabase.from("exchange_prices").select("coin, bybit_price");
    const map: Record<string, number> = {};
    (data || []).forEach((r: any) => { if (r.coin && r.bybit_price != null) map[r.coin] = Number(r.bybit_price); });
    return map;
  } catch { return {}; }
}

function computeLive(signal: Signal, curPrice: number) {
  const entry = Number(signal.price);
  if (!entry || !curPrice) return null;
  const isBuy = signal.signal === "BUY";
  const pnlPct = isBuy ? ((curPrice - entry) / entry) * 100 : ((entry - curPrice) / entry) * 100;
  const { target, stop } = levels(signal.signal, entry);
  const lo = Math.min(stop, target), hi = Math.max(stop, target);
  let progress = ((curPrice - lo) / (hi - lo)) * 100;
  progress = Math.max(0, Math.min(100, progress));
  return { pnlPct, target, stop, progress: isBuy ? progress : 100 - progress };
}

async function loadSignals(since: Date): Promise<Signal[]> {
  const { data } = await supabase.from("kpk_signals").select("*")
    .gte("created_at", since.toISOString()).order("created_at", { ascending: false });
  return (data as Signal[]) || [];
}

function Performance() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"hepsi" | "BUY" | "SELL">("hepsi");
  const [days, setDays] = useState<7 | 30>(30);
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    loadSignals(since).then((loaded) => { if (!cancelled) { setSignals(loaded); setLoading(false); } });
    return () => { cancelled = true; };
  }, [days]);

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
  // Beklenen getiri (EV): TP +2.5 / SL -2 sabit olduğundan orandan türer
  const ev = closed.length > 0 ? (rate / 100) * TP_PCT * 100 - (1 - rate / 100) * SL_PCT * 100 : 0;
  const smallSample = closed.length < MIN_SAMPLE;

  const openSignals = signals.filter((s) => s.result === "bekliyor")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const buySignals = signals.filter((s) => s.signal === "BUY");
  const sellSignals = signals.filter((s) => s.signal === "SELL");
  const buyClosed = buySignals.filter((s) => s.result !== "bekliyor");
  const sellClosed = sellSignals.filter((s) => s.result !== "bekliyor");
  const buyRate = buyClosed.length > 0 ? Math.round((buySignals.filter((s) => s.result === "tuttu").length / buyClosed.length) * 100) : 0;
  const sellRate = sellClosed.length > 0 ? Math.round((sellSignals.filter((s) => s.result === "tuttu").length / sellClosed.length) * 100) : 0;

  const coinMap = new Map<string, CoinStat>();
  signals.forEach((s) => {
    const e = coinMap.get(s.coin) || { coin: s.coin, total: 0, tuttu: 0, tutmadi: 0, bekliyor: 0, rate: 0, closed: 0 };
    e.total++;
    if (s.result === "tuttu") e.tuttu++;
    else if (s.result === "tutmadi") e.tutmadi++;
    else e.bekliyor++;
    e.closed = e.tuttu + e.tutmadi;
    e.rate = e.closed > 0 ? Math.round((e.tuttu / e.closed) * 100) : 0;
    coinMap.set(s.coin, e);
  });
  const coinStats = Array.from(coinMap.values()).sort((a, b) => b.total - a.total);

  const filtered = filter === "hepsi" ? signals : signals.filter((s) => s.signal === filter);

  const rateColor = (r: number) => r >= 70 ? "#22c55e" : r >= 45 ? "#f5b629" : "#ef4444";
  const resultBg = (r: string) => r === "tuttu" ? "rgba(34,197,94,.15)" : r === "tutmadi" ? "rgba(239,68,68,.15)" : "rgba(245,182,41,.1)";
  const resultColor = (r: string) => r === "tuttu" ? "#22c55e" : r === "tutmadi" ? "#ef4444" : "#f5b629";
  const resultText = (r: string) => r === "tuttu" ? "✅ Tuttu" : r === "tutmadi" ? "❌ Tutmadı" : "⏳ Bekliyor";

  // Bir sinyal için düz Türkçe açıklama üretir
  function explain(s: Signal): { what: string; why: string[] } {
    const entry = Number(s.price);
    const { target, stop } = levels(s.signal, entry);
    let what = "";
    if (s.result === "tuttu") what = `Fiyat hedefe (${fmtNum(target)}) ulaştı — ${durationText(s.created_at, s.closed_at)} içinde. Kazanç +%2.5.`;
    else if (s.result === "tutmadi") what = `Fiyat stop seviyesine (${fmtNum(stop)}) ulaştı — ${durationText(s.created_at, s.closed_at)} içinde. Kayıp -%2.`;
    else {
      const cur = livePrices[s.coin];
      const live = cur ? computeLive(s, cur) : null;
      what = live
        ? `Henüz ne hedefe ne stopa ulaştı. Şu an ${live.pnlPct >= 0 ? "+" : ""}${live.pnlPct.toFixed(2)}% konumda.`
        : "Henüz ne hedefe ne stopa ulaştı (fiyat verisi bekleniyor).";
    }
    const why: string[] = [];
    const c = s.components;
    if (c && (c.rsi != null || c.emaTrend || c.macdHist != null)) {
      if (c.rsi != null) why.push(`RSI ${Math.round(c.rsi)}${c.rsi >= 70 ? " (aşırı alım)" : c.rsi <= 30 ? " (aşırı satım)" : ""}`);
      if (c.emaTrend) why.push(`trend ${c.emaTrend === "up" ? "yukarı" : "aşağı"}`);
      if (c.macdHist != null) why.push(`momentum ${c.macdHist >= 0 ? "pozitif" : "negatif"}`);
      if (c.bbPct != null) why.push(`Bollinger %${Math.round(c.bbPct * 100)}`);
      if (c.whaleBuyUsd != null && c.whaleSellUsd != null && (c.whaleBuyUsd > 0 || c.whaleSellUsd > 0))
        why.push(`whale ${c.whaleBuyUsd >= c.whaleSellUsd ? "alım" : "satım"} baskılı`);
    }
    return { what, why };
  }

  return (
    <div style={{ background: "#05080d", minHeight: "100vh", color: "#e8eef7", fontFamily: "'Inter',system-ui,sans-serif", padding: "0 0 60px" }}>
      <style>{`
        * { box-sizing: border-box; }
        .perf-nav { display:flex; align-items:center; justify-content:space-between; padding:14px 20px; background:rgba(5,8,13,.85); backdrop-filter:blur(14px); border-bottom:1px solid rgba(245,182,41,.18); position:sticky; top:0; z-index:50; }
        .perf-title { font-weight:900; font-size:17px; letter-spacing:.08em; background:linear-gradient(135deg,#f5b629,#ffd76a); -webkit-background-clip:text; background-clip:text; color:transparent; }
        .perf-back { color:#f5b629; text-decoration:none; font-size:13px; font-weight:600; padding:6px 14px; border:1px solid rgba(245,182,41,.3); border-radius:999px; }
        .container { max-width:1080px; margin:0 auto; padding:22px 14px; }
        .period-row { display:flex; align-items:center; gap:10px; margin-bottom:16px; }
        .period-label { font-size:12px; color:#8a93a3; letter-spacing:.08em; text-transform:uppercase; }
        .period-btn, .filter-btn { padding:6px 16px; border-radius:999px; border:1px solid rgba(245,182,41,.25); background:transparent; color:#8a93a3; font-size:13px; font-weight:600; cursor:pointer; }
        .period-btn.active, .filter-btn.active { background:rgba(245,182,41,.15); color:#f5b629; border-color:rgba(245,182,41,.5); }
        .banner { background:rgba(245,182,41,.08); border:1px solid rgba(245,182,41,.3); border-radius:12px; padding:12px 16px; font-size:13px; color:#f5d98a; margin-bottom:20px; line-height:1.5; }
        .stat-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:14px; }
        @media(max-width:720px){ .stat-grid { grid-template-columns:repeat(2,1fr); } }
        .stat-card { background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.01)); border:1px solid rgba(245,182,41,.18); border-radius:16px; padding:16px; text-align:center; }
        .stat-val { font-size:30px; font-weight:900; margin-bottom:2px; }
        .stat-label { font-size:11px; color:#8a93a3; letter-spacing:.08em; text-transform:uppercase; }
        .stat-sub { font-size:11px; color:#8a93a3; margin-top:4px; }
        .ev-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:26px; }
        @media(max-width:720px){ .ev-row { grid-template-columns:1fr; } }
        .ev-card { background:rgba(255,255,255,.03); border:1px solid rgba(245,182,41,.15); border-radius:14px; padding:16px; }
        .ev-k { font-size:12px; color:#8a93a3; text-transform:uppercase; letter-spacing:.06em; }
        .ev-v { font-size:22px; font-weight:900; margin-top:4px; }
        .ev-note { font-size:11px; color:#8a93a3; margin-top:6px; line-height:1.4; }
        .section-title { font-size:16px; font-weight:800; margin:24px 0 12px; color:#f5b629; letter-spacing:.04em; }
        .live-head { display:flex; align-items:center; gap:10px; margin:8px 0 14px; }
        .live-dot { width:9px; height:9px; border-radius:50%; background:#22c55e; animation:lp 1.6s infinite; }
        @keyframes lp { 0%{box-shadow:0 0 0 0 rgba(34,197,94,.5)} 70%{box-shadow:0 0 0 8px rgba(34,197,94,0)} 100%{box-shadow:0 0 0 0 rgba(34,197,94,0)} }
        .live-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:12px; margin-bottom:20px; }
        @media(max-width:700px){ .live-grid { grid-template-columns:1fr; } }
        .live-card { background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.01)); border:1px solid rgba(245,182,41,.18); border-radius:16px; padding:14px 16px; }
        .live-top { display:flex; align-items:center; gap:10px; margin-bottom:10px; }
        .live-coin { font-weight:800; font-size:15px; }
        .live-side { font-size:11px; font-weight:700; padding:3px 10px; border-radius:999px; }
        .live-pnl { margin-left:auto; font-size:18px; font-weight:900; }
        .live-bar-wrap { position:relative; height:8px; border-radius:999px; background:rgba(255,255,255,.06); overflow:hidden; margin:8px 0; }
        .live-bar { position:absolute; top:0; left:0; height:100%; border-radius:999px; transition:width .4s; }
        .live-meta { display:flex; justify-content:space-between; font-size:11px; color:#8a93a3; gap:6px; }
        .empty { text-align:center; padding:28px; color:#8a93a3; font-size:14px; background:rgba(255,255,255,.02); border:1px dashed rgba(245,182,41,.15); border-radius:16px; margin-bottom:20px; }
        .type-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:8px; }
        .type-card { background:rgba(255,255,255,.03); border-radius:14px; padding:16px; text-align:center; }
        .coin-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
        @media(max-width:700px){ .coin-grid { grid-template-columns:repeat(2,1fr); } }
        .coin-card { background:rgba(255,255,255,.03); border:1px solid rgba(245,182,41,.12); border-radius:14px; padding:12px 14px; display:flex; align-items:center; justify-content:space-between; }
        .coin-name { font-weight:800; font-size:14px; }
        .coin-sub { font-size:11px; color:#8a93a3; margin-top:2px; }
        .rate-badge { font-size:18px; font-weight:900; }
        .filter-row { display:flex; gap:8px; margin-bottom:14px; flex-wrap:wrap; }
        .signal-list { display:flex; flex-direction:column; gap:8px; }
        .signal-card { background:rgba(255,255,255,.03); border:1px solid rgba(245,182,41,.1); border-radius:14px; overflow:hidden; }
        .signal-row { padding:13px 16px; display:grid; grid-template-columns:auto auto 1fr auto auto; gap:12px; align-items:center; cursor:pointer; }
        @media(max-width:640px){ .signal-row { grid-template-columns:auto 1fr auto; row-gap:8px; } }
        .sig-coin { font-weight:800; font-size:15px; }
        .sig-type { font-size:11px; font-weight:700; padding:3px 9px; border-radius:999px; white-space:nowrap; }
        .sig-mid { display:flex; gap:10px; align-items:center; font-size:12px; color:#8a93a3; flex-wrap:wrap; }
        @media(max-width:640px){ .sig-mid { grid-column:1/-1; } }
        .sig-score { font-weight:700; color:#f5b629; }
        .sig-result { font-size:12px; font-weight:700; padding:3px 10px; border-radius:999px; white-space:nowrap; }
        .sig-caret { color:#8a93a3; font-size:12px; }
        .detail { padding:14px 16px; border-top:1px solid rgba(245,182,41,.1); background:rgba(0,0,0,.22); }
        .d-what { font-size:13px; color:#e8eef7; background:rgba(245,182,41,.06); border-left:2px solid #f5b629; padding:9px 12px; border-radius:0 8px 8px 0; margin-bottom:12px; line-height:1.5; }
        .d-levels { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:12px; }
        .d-lv { background:rgba(255,255,255,.03); border-radius:10px; padding:9px; text-align:center; }
        .d-lv-k { font-size:10px; color:#8a93a3; text-transform:uppercase; }
        .d-lv-v { font-size:13px; font-weight:700; margin-top:2px; }
        .d-why { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:8px; }
        .d-chip { font-size:11px; background:rgba(255,255,255,.05); border:1px solid rgba(245,182,41,.15); border-radius:999px; padding:3px 10px; color:#c7cfdb; }
        .d-meta { font-size:11px; color:#8a93a3; }
        .loading { text-align:center; padding:80px; color:#f5b629; font-size:18px; }
      `}</style>

      <nav className="perf-nav">
        <span className="perf-title">📊 PERFORMANS</span>
        <a href="/signals" className="perf-back">← Terminal</a>
      </nav>

      {loading ? (
        <div className="loading">⏳ Yükleniyor...</div>
      ) : (
        <div className="container">
          <div className="period-row">
            <span className="period-label">Dönem:</span>
            {([7, 30] as const).map((d) => (
              <button key={d} className={`period-btn ${days === d ? "active" : ""}`} onClick={() => setDays(d)}>Son {d} Gün</button>
            ))}
          </div>

          {closed.length === 0 ? (
            <div className="banner">
              Bu dönemde henüz <b>kapanmış sinyal yok</b> — sinyaller hedefe (+%2.5) ya da stopa (-%2) ulaşınca sonuçlanır.
              İsabet oranı, kapanmış sinyaller birikince anlamlı olacak.
            </div>
          ) : smallSample ? (
            <div className="banner">
              ⚠️ <b>Örneklem küçük ({closed.length} kapalı sinyal).</b> Aşağıdaki oranlar henüz istatistiksel olarak güvenilir değil —
              anlamlı bir değerlendirme için en az {MIN_SAMPLE} kapalı sinyal gerekir. Sayı arttıkça oran netleşir.
            </div>
          ) : null}

          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-val" style={{ color: rateColor(rate) }}>{closed.length > 0 ? `${rate}%` : "—"}</div>
              <div className="stat-label">İsabet Oranı</div>
              <div className="stat-sub">{closed.length} kapalı sinyalde</div>
            </div>
            <div className="stat-card">
              <div className="stat-val" style={{ color: "#e8eef7" }}>{signals.length}</div>
              <div className="stat-label">Toplam Sinyal</div>
              <div className="stat-sub">{bekliyor} bekliyor</div>
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

          <div className="ev-row">
            <div className="ev-card">
              <div className="ev-k">Sinyal başına beklenen getiri (EV)</div>
              <div className="ev-v" style={{ color: closed.length === 0 ? "#8a93a3" : ev >= 0 ? "#22c55e" : "#ef4444" }}>
                {closed.length === 0 ? "—" : `${ev >= 0 ? "+" : ""}${ev.toFixed(2)}%`}
              </div>
              <div className="ev-note">
                TP +%2.5 / SL −%2 ile hesaplanır. Kârlılık için isabet oranının <b>%44.4</b> üstünde olması gerekir (başabaş noktası).
                {closed.length > 0 && ev < 0 && " Şu an başabaşın altında."}
              </div>
            </div>
            <div className="ev-card">
              <div className="ev-k">Ort. kazanç / kayıp</div>
              <div className="ev-v" style={{ color: "#e8eef7" }}>
                <span style={{ color: "#22c55e" }}>+2.5%</span> / <span style={{ color: "#ef4444" }}>−2%</span>
              </div>
              <div className="ev-note">Hedef ve stop sabit olduğu için ortalama kazanç/kayıp bu değerlerde. Sistemin kârlılığı isabet oranına bağlı.</div>
            </div>
          </div>

          <div className="live-head">
            <span className="live-dot"></span>
            <span className="section-title" style={{ margin: 0 }}>Canlı Sinyal Takibi</span>
            <span style={{ fontSize: 12, color: "#8a93a3", marginLeft: "auto" }}>{openSignals.length} açık</span>
          </div>
          {openSignals.length === 0 ? (
            <div className="empty">Şu an açık sinyal yok.</div>
          ) : (
            <div className="live-grid">
              {openSignals.slice(0, 8).map((s) => {
                const cur = livePrices[s.coin];
                const live = cur ? computeLive(s, cur) : null;
                const isBuy = s.signal === "BUY";
                const pnl = live?.pnlPct ?? 0;
                const pnlColor = pnl >= 0 ? "#22c55e" : "#ef4444";
                return (
                  <div key={s.id} className="live-card">
                    <div className="live-top">
                      <span className="live-coin">{coinShort(s.coin)}/USDT</span>
                      <span className="live-side" style={{ background: isBuy ? "rgba(34,197,94,.15)" : "rgba(239,68,68,.15)", color: isBuy ? "#22c55e" : "#ef4444" }}>
                        {isBuy ? "🟢 BUY" : "🔴 SELL"}
                      </span>
                      {live ? <span className="live-pnl" style={{ color: pnlColor }}>{pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}%</span>
                        : <span className="live-pnl" style={{ color: "#8a93a3", fontSize: 13 }}>fiyat bekleniyor</span>}
                    </div>
                    {live && (
                      <>
                        <div className="live-bar-wrap"><div className="live-bar" style={{ width: `${live.progress}%`, background: pnlColor }}></div></div>
                        <div className="live-meta"><span>🛑 {fmtNum(live.stop)}</span><span>Giriş {fmtNum(Number(s.price))}</span><span>🎯 {fmtNum(live.target)}</span></div>
                      </>
                    )}
                    <div className="live-meta" style={{ marginTop: 8 }}>
                      <span>⭐ Skor {s.score} · {s.quality}</span>
                      <span>{new Date(s.created_at).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="type-row">
            <div className="type-card" style={{ border: "1px solid rgba(34,197,94,.25)" }}>
              <div style={{ fontSize: 26, fontWeight: 900, color: "#22c55e" }}>{buyClosed.length > 0 ? `${buyRate}%` : "—"}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#22c55e", margin: "4px 0 6px" }}>🟢 BUY İsabet</div>
              <div style={{ fontSize: 12, color: "#8a93a3" }}>{buyClosed.length} kapalı · {buySignals.filter(s => s.result === "tuttu").length} tuttu · {buySignals.length} toplam</div>
            </div>
            <div className="type-card" style={{ border: "1px solid rgba(239,68,68,.25)" }}>
              <div style={{ fontSize: 26, fontWeight: 900, color: "#ef4444" }}>{sellClosed.length > 0 ? `${sellRate}%` : "—"}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#ef4444", margin: "4px 0 6px" }}>🔴 SELL İsabet</div>
              <div style={{ fontSize: 12, color: "#8a93a3" }}>{sellClosed.length} kapalı · {sellSignals.filter(s => s.result === "tuttu").length} tuttu · {sellSignals.length} toplam</div>
            </div>
          </div>

          {coinStats.length > 0 && (
            <>
              <div className="section-title">Coin Bazında Başarı</div>
              <div className="coin-grid">
                {coinStats.map((c) => (
                  <div key={c.coin} className="coin-card">
                    <div>
                      <div className="coin-name">{coinShort(c.coin)}</div>
                      <div className="coin-sub">{c.closed} kapalı · {c.tuttu}✅ {c.tutmadi}❌ · {c.bekliyor}⏳</div>
                    </div>
                    <div className="rate-badge" style={{ color: c.closed > 0 ? rateColor(c.rate) : "#8a93a3" }}>{c.closed > 0 ? `${c.rate}%` : "—"}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="section-title">Sinyaller ({days} gün) — tıkla, detayını gör</div>
          <div className="filter-row">
            {(["hepsi", "BUY", "SELL"] as const).map((f) => (
              <button key={f} className={`filter-btn ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
                {f === "hepsi" ? "Hepsi" : f === "BUY" ? "🟢 BUY" : "🔴 SELL"}
              </button>
            ))}
            <span style={{ marginLeft: "auto", fontSize: 12, color: "#8a93a3", alignSelf: "center" }}>{filtered.length} sinyal</span>
          </div>

          {filtered.length === 0 ? (
            <div className="empty">Henüz sinyal yok.</div>
          ) : (
            <div className="signal-list">
              {filtered.map((s) => {
                const entry = Number(s.price);
                const { target, stop } = levels(s.signal, entry);
                const isOpen = openId === s.id;
                const info = isOpen ? explain(s) : null;
                return (
                  <div key={s.id} className="signal-card">
                    <div className="signal-row" onClick={() => setOpenId(isOpen ? null : s.id)}>
                      <span className="sig-coin">{coinShort(s.coin)}</span>
                      <span className="sig-type" style={{ background: s.signal === "BUY" ? "rgba(34,197,94,.15)" : "rgba(239,68,68,.15)", color: s.signal === "BUY" ? "#22c55e" : "#ef4444" }}>
                        {s.signal === "BUY" ? "🟢 BUY" : "🔴 SELL"}
                      </span>
                      <span className="sig-mid">
                        <span className="sig-score">⭐ {s.score}</span>
                        <span>{s.quality}</span>
                        <span>Giriş {fmtNum(entry)}</span>
                      </span>
                      <span className="sig-result" style={{ background: resultBg(s.result), color: resultColor(s.result) }}>{resultText(s.result)}</span>
                      <span className="sig-caret">{isOpen ? "▲" : "▼"}</span>
                    </div>
                    {isOpen && info && (
                      <div className="detail">
                        <div className="d-what">{info.what}</div>
                        <div className="d-levels">
                          <div className="d-lv"><div className="d-lv-k">Giriş</div><div className="d-lv-v">{fmtNum(entry)}</div></div>
                          <div className="d-lv"><div className="d-lv-k">Hedef</div><div className="d-lv-v" style={{ color: "#22c55e" }}>{fmtNum(target)}</div></div>
                          <div className="d-lv"><div className="d-lv-k">Stop</div><div className="d-lv-v" style={{ color: "#ef4444" }}>{fmtNum(stop)}</div></div>
                        </div>
                        {info.why.length > 0 ? (
                          <div className="d-why">
                            <span style={{ fontSize: 11, color: "#8a93a3", alignSelf: "center" }}>Sinyal anında:</span>
                            {info.why.map((w, i) => <span key={i} className="d-chip">{w}</span>)}
                          </div>
                        ) : (
                          <div className="d-meta" style={{ marginBottom: 6 }}>Bu sinyal için gösterge detayı kayıtlı değil (eski sinyal — yeni sinyallerde RSI/EMA/MACD görünecek).</div>
                        )}
                        <div className="d-meta">
                          Skor bandı: {s.score_band || "—"} · Sinyal zamanı: {new Date(s.created_at).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          {s.closed_at ? ` · Kapanış: ${new Date(s.closed_at).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : ""}
                          {s.entry_snapshot != null ? ` · Gerçek giriş: ${fmtNum(Number(s.entry_snapshot))}` : ""}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ marginTop: 24, fontSize: 11, color: "#6b7280", textAlign: "center", lineHeight: 1.5 }}>
            Tüm veriler gerçek kaynaklardan gelir; gerçekleşmemiş sinyaller kazanç/kayıp sayılmaz.
            Bu panel yatırım tavsiyesi değildir; geçmiş performans gelecek getiriyi garanti etmez.
          </div>
          <div style={{ textAlign: "center", marginTop: 16, fontSize: 11, letterSpacing: ".08em", color: "#0f7a4d", fontWeight: 600 }}>
            A BAMIR ONLINE STORE'S PRODUCTION
          </div>
        </div>
      )}
    </div>
  );
}
