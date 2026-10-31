import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { translations, getLang, setLangStorage, type LangCode } from "../i18n";

const supabase = createClient("https://gmwlkkebwpenocatlmty.supabase.co","sb_publishable_vxLxplUzQw9qNSaZjX4ucA_LZ1NW3a1");
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

const LIVE_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "ADAUSDT", "DOGEUSDT", "AVAXUSDT", "LINKUSDT"];
const LIVE_HOSTS = ["https://api.binance.com", "https://data-api.binance.vision"];

async function fetchLivePrices(): Promise<Record<string, number>> {
  const q = encodeURIComponent(JSON.stringify(LIVE_SYMBOLS));
  for (const host of LIVE_HOSTS) {
    try {
      const res = await fetch(`${host}/api/v3/ticker/24hr?symbols=${q}`);
      if (!res.ok) continue;
      const rows = (await res.json()) as Array<{ symbol: string; lastPrice: string }>;
      const map: Record<string, number> = {};
      (rows || []).forEach((r) => {
        if (!r.symbol || r.lastPrice == null) return;
        const price = Number(r.lastPrice);
        map[r.symbol] = price;
        map[r.symbol.replace("USDT", "")] = price;
      });
      return map;
    } catch {
    }
  }
  return {};
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
  const [lang, setLang] = useState<LangCode>(getLang());

  const t = (key: string) => translations[key]?.[lang] || key;

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

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
    const id = setInterval(() => { if (document.visibilityState === "visible") void load(); }, 60000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const closed = signals.filter((s) => s.result !== "bekliyor");
  const tuttu = signals.filter((s) => s.result === "tuttu").length;
  const tutmadi = signals.filter((s) => s.result === "tutmadi").length;
  const bekliyor = signals.filter((s) => s.result === "bekliyor").length;
  const rate = closed.length > 0 ? Math.round((tuttu / closed.length) * 100) : 0;
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

  const ktStyles = `
    
    .kt-page-shell {
      --kt-bg: #05070b;
      --kt-bg-strong: #090d15;
      --kt-panel: rgba(15, 19, 28, 0.72);
      --kt-panel-strong: rgba(11, 14, 22, 0.96);
      --kt-gold: #f5b629;
      --kt-gold-soft: #ffe39a;
      --kt-line: rgba(245, 182, 41, 0.2);
      --kt-text: #f5f2eb;
      --kt-muted: #a2a9b5;
      --kt-success: #34d399;
      --kt-danger: #f87171;
      --kt-warn: #fbbf24;
      position: relative;
      isolation: isolate;
      min-height: 100vh;
      overflow: hidden;
      background:
        radial-gradient(circle at 20% 10%, rgba(245, 182, 41, 0.12), transparent 26%),
        radial-gradient(circle at 83% 74%, rgba(168, 113, 20, 0.12), transparent 30%),
        linear-gradient(135deg, var(--kt-bg) 0%, var(--kt-bg-strong) 52%, #050609 100%);
      color: var(--kt-text);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .kt-page-shell .kt-grid {
      position: absolute;
      inset: 0;
      z-index: 0;
      opacity: 0.18;
      background-image:
        linear-gradient(rgba(245, 182, 41, 0.07) 1px, transparent 1px),
        linear-gradient(90deg, rgba(245, 182, 41, 0.07) 1px, transparent 1px);
      background-size: 64px 64px;
      mask-image: radial-gradient(ellipse at center, #000 0%, transparent 78%);
    }
    .kt-page-shell .kt-orb {
      position: absolute;
      z-index: 0;
      width: 440px;
      height: 440px;
      border-radius: 50%;
      filter:none;opacity:.45;
      pointer-events: none;
    }
    .kt-page-shell .kt-orb-one { top: -200px; left: -140px; background: rgba(245, 182, 41, 0.12); }
    .kt-page-shell .kt-orb-two { right: -160px; bottom: -220px; background: rgba(170, 118, 25, 0.12); }
    .kt-page-shell .perf-nav {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 18px 16px;
      background: rgba(7, 12, 18, 0.78);
      backdrop-filter: none;
      border-bottom: 1px solid var(--kt-line);
    }
    .kt-page-shell .perf-title {
      background: linear-gradient(135deg, var(--kt-gold) 0%, var(--kt-gold-soft) 100%);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      font-size: 1rem;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      font-weight: 800;
    }
    .kt-page-shell .perf-back {
      color: var(--kt-gold);
      text-decoration: none;
      font-size: 0.76rem;
      font-weight: 700;
      border: 1px solid var(--kt-line);
      background: rgba(255,255,255,0.02);
      border-radius: 999px;
      padding: 0.6rem 0.9rem;
    }
    .kt-page-shell .container {
      position: relative;
      z-index: 1;
      max-width: 1080px;
      margin: 0 auto;
      padding: 24px 16px 0;
    }
    .kt-page-shell .banner,
    .kt-page-shell .stat-card,
    .kt-page-shell .ev-card,
    .kt-page-shell .type-card,
    .kt-page-shell .coin-card,
    .kt-page-shell .signal-card,
    .kt-page-shell .live-card,
    .kt-page-shell .empty {
      background: rgba(15, 19, 28, 0.72);
      border: 1px solid rgba(245, 182, 41, 0.18);
      box-shadow: 0 16px 28px -24px rgba(0,0,0,0.9);
      backdrop-filter: none;
    }
    .kt-page-shell .stat-card,
    .kt-page-shell .ev-card,
    .kt-page-shell .type-card,
    .kt-page-shell .coin-card,
    .kt-page-shell .signal-card,
    .kt-page-shell .live-card,
    .kt-page-shell .banner,
    .kt-page-shell .empty {
      border-radius: 18px;
    }
    .kt-page-shell .banner {
      padding: 14px 16px;
      color: #fef3c7;
      border-color: rgba(245,182,41,0.28);
      background: rgba(245,182,41,0.08);
    }
    .kt-page-shell .period-btn,
    .kt-page-shell .filter-btn,
    .kt-page-shell select {
      border-radius: 999px;
      border: 1px solid var(--kt-line);
      background: rgba(255,255,255,0.02);
      color: var(--kt-muted);
      font-weight: 700;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      padding: 0.6rem 0.9rem;
      cursor: pointer;
    }
    .kt-page-shell .period-btn.active,
    .kt-page-shell .filter-btn.active {
      background: rgba(245, 182, 41, 0.1);
      color: var(--kt-gold);
      border-color: rgba(245, 182, 41, 0.52);
    }
    .kt-page-shell .stat-grid,
    .kt-page-shell .ev-row,
    .kt-page-shell .live-grid,
    .kt-page-shell .type-row,
    .kt-page-shell .coin-grid {
      display: grid;
      gap: 12px;
    }
    .kt-page-shell .stat-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .kt-page-shell .ev-row { grid-template-columns: 1fr 1fr; }
    .kt-page-shell .live-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .kt-page-shell .type-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .kt-page-shell .coin-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .kt-page-shell .stat-card,
    .kt-page-shell .ev-card,
    .kt-page-shell .type-card,
    .kt-page-shell .coin-card,
    .kt-page-shell .live-card,
    .kt-page-shell .signal-card { padding: 16px; }
    .kt-page-shell .stat-label,
    .kt-page-shell .ev-k,
    .kt-page-shell .coin-sub,
    .kt-page-shell .d-lv-k,
    .kt-page-shell .sig-mid,
    .kt-page-shell .d-meta,
    .kt-page-shell .live-meta,
    .kt-page-shell .stat-sub {
      color: var(--kt-muted);
    }
    .kt-page-shell .stat-label,
    .kt-page-shell .ev-k,
    .kt-page-shell .d-lv-k {
      font-size: 0.66rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .kt-page-shell .stat-val,
    .kt-page-shell .ev-v,
    .kt-page-shell .rate-badge,
    .kt-page-shell .sig-score {
      font-weight: 900;
      letter-spacing: -0.04em;
    }
    .kt-page-shell .sig-type,
    .kt-page-shell .sig-result {
      border-radius: 999px;
      padding: 0.35rem 0.6rem;
      font-size: 0.68rem;
      font-weight: 800;
    }
    .kt-page-shell .signal-card { overflow: hidden; }
    .kt-page-shell .signal-row { display: grid; grid-template-columns: auto auto 1fr auto auto; gap: 12px; align-items: center; padding: 14px 16px; }
    .kt-page-shell .sig-coin, .kt-page-shell .coin-name { font-weight: 800; }
    .kt-page-shell .sig-mid { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .kt-page-shell .detail { background: rgba(8, 12, 18, 0.78); border-top: 1px solid rgba(245, 182, 41, 0.18); padding: 14px 16px; }
    .kt-page-shell .d-what { border-left: 2px solid var(--kt-gold); padding: 10px 12px; background: rgba(245,182,41,0.06); border-radius: 0 10px 10px 0; line-height: 1.5; }
    .kt-page-shell .d-levels { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin: 12px 0; }
    .kt-page-shell .d-lv { background: rgba(255,255,255,0.02); border: 1px solid rgba(245,182,41,0.08); border-radius: 12px; padding: 10px; text-align: center; }
    .kt-page-shell .d-lv-v { font-weight: 800; }
    .kt-page-shell .d-chip { display: inline-flex; align-items: center; border: 1px solid var(--kt-line); border-radius: 999px; padding: 0.35rem 0.65rem; font-size: 0.68rem; color: var(--kt-text); background: rgba(255,255,255,0.02); }
    .kt-page-shell .empty { padding: 28px 16px; }
    @media (max-width: 760px) {
      .kt-page-shell .stat-grid, .kt-page-shell .coin-grid, .kt-page-shell .live-grid, .kt-page-shell .ev-row, .kt-page-shell .type-row { grid-template-columns: 1fr; }
      .kt-page-shell .signal-row { grid-template-columns: auto 1fr auto; }
      .kt-page-shell .sig-mid { grid-column: 1 / -1; }
      .kt-page-shell .perf-nav { padding-inline: 14px; }
      .kt-page-shell .perf-title { font-size: 0.82rem; }
    }
  
/* Unified KELTOS premium performance layer */
.kt-page-shell{background:radial-gradient(ellipse at 50% -12%,rgba(245,182,41,.13),transparent 55%),#05070b}
.kt-page-shell .perf-nav{padding:15px clamp(14px,3vw,34px);background:rgba(5,7,11,.9);border-bottom:1px solid rgba(245,182,41,.2);box-shadow:0 12px 36px rgba(0,0,0,.2);backdrop-filter:blur(18px)}
.kt-page-shell .perf-title{letter-spacing:.12em;font-size:15px}.kt-page-shell .perf-back{border-radius:10px;padding:8px 14px}
.kt-page-shell .container{max-width:1160px;padding:28px 18px}
.kt-page-shell .stat-card,.kt-page-shell .ev-card,.kt-page-shell .live-card,.kt-page-shell .coin-card,.kt-page-shell .signal-card,.kt-page-shell .type-card{background:linear-gradient(145deg,rgba(255,255,255,.052),rgba(255,255,255,.016));border:1px solid rgba(255,255,255,.085);box-shadow:inset 0 1px rgba(255,255,255,.035)}
.kt-page-shell .stat-card{border-radius:16px;padding:20px 16px}.kt-page-shell .stat-val{font-size:clamp(25px,3vw,34px)}
.kt-page-shell .stat-label,.kt-page-shell .ev-k{letter-spacing:.1em}.kt-page-shell .ev-card,.kt-page-shell .live-card{border-radius:16px;padding:18px}
.kt-page-shell .section-title{color:#f0c568;letter-spacing:.06em}.kt-page-shell .signal-card{border-radius:14px}
.kt-page-shell .signal-row{padding:16px 18px}.kt-page-shell .detail{background:rgba(0,0,0,.22)}
.kt-page-shell .period-btn,.kt-page-shell .filter-btn{border-radius:10px;padding:8px 14px}
.kt-page-shell .empty{background:rgba(255,255,255,.025);border-color:rgba(245,182,41,.2);border-radius:14px}
@media(max-width:640px){.kt-page-shell .perf-nav{padding:13px 14px;gap:10px;flex-wrap:wrap}.kt-page-shell .perf-title{font-size:13px}.kt-page-shell .container{padding:18px 12px}.kt-page-shell .period-row{flex-wrap:wrap}.kt-page-shell .signal-row{padding:13px 12px}}
`;

  return (
    <div className="kt-page-shell" dir={lang === "ar" ? "rtl" : "ltr"}>
      <div className="kt-grid" />
      <div className="kt-orb kt-orb-one" />
      <div className="kt-orb kt-orb-two" />
      <style>{ktStyles}</style>
      <nav className="perf-nav">
        <span className="perf-title">📊 {t("performance")}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <a href="/signals" className="perf-back">← {t("signalTerminal")}</a>
          <select
            value={lang}
            onChange={(e) => {
              const next = e.target.value as LangCode;
              setLang(next);
              setLangStorage(next);
            }}
            aria-label="Language"
            style={{ background: "transparent", border: "1px solid rgba(245,182,41,.25)", color: "#f5b629", borderRadius: 999, padding: "6px 10px" }}
          >
            <option value="tr">TR</option>
            <option value="en">EN</option>
            <option value="de">DE</option>
            <option value="fr">FR</option>
            <option value="ar">AR</option>
          </select>
        </div>
      </nav>

      {loading ? (
        <div className="empty" style={{ maxWidth: 540, margin: "32px auto 0" }}>⏳ {t("loading")}...</div>
      ) : (
        <div className="container">
          <div className="period-row">
            <span className="period-label">{t("period")}</span>
            {([7, 30] as const).map((d) => (
              <button key={d} className={`period-btn ${days === d ? "active" : ""}`} onClick={() => setDays(d)}>{t("lastDays").replace("{n}", String(d))}</button>
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
              <div className="stat-label">{t("accuracyRate")}</div>
              <div className="stat-sub">{closed.length} {t("noData")}</div>
            </div>
            <div className="stat-card">
              <div className="stat-val" style={{ color: "#e8eef7" }}>{signals.length}</div>
              <div className="stat-label">{t("totalSignals")}</div>
              <div className="stat-sub">{bekliyor} {t("waiting")}</div>
            </div>
            <div className="stat-card">
              <div className="stat-val" style={{ color: "#22c55e" }}>{tuttu}</div>
              <div className="stat-label">{t("hitYes")}</div>
            </div>
            <div className="stat-card">
              <div className="stat-val" style={{ color: "#ef4444" }}>{tutmadi}</div>
              <div className="stat-label">{t("missedNo")}</div>
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
            <div className="empty">{t("noOpenSignals")}</div>
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
            <div className="empty">{t("noSignalYet")}</div>
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
