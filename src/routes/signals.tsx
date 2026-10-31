import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { translations, getLang, setLangStorage, type LangCode } from "../i18n";

const supabase = createClient(
  "https://gmwlkkebwpenocatlmty.supabase.co",
  "sb_publishable_vxLxplUzQw9qNSaZjX4ucA_LZ1NW3a1"
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
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
    ],
  }),
  component: SignalTerminal,
});

const TP_PCT = 0.025;
const SL_PCT = 0.02;

const COIN_LOGO_URLS: Record<string, string> = {
  BTC: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png",
  ETH: "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
  SOL: "https://assets.coingecko.com/coins/images/4128/large/solana.png",
  BNB: "https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png",
  XRP: "https://assets.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png",
  ADA: "https://assets.coingecko.com/coins/images/975/large/cardano.png",
  DOGE: "https://assets.coingecko.com/coins/images/5/large/dogecoin.png",
  AVAX: "https://assets.coingecko.com/coins/images/12559/large/Avalanche_Circle_RedWhite_Trans.png",
  LINK: "https://assets.coingecko.com/coins/images/877/large/chainlink-new-logo.png",
};

function getCoinLogo(coin: string): string | null {
  const symbol = coin.replace(/USDT$/, "").toUpperCase();
  return COIN_LOGO_URLS[symbol] || null;
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
}

interface PriceRow {
  coin: string;
  bybit_price: number;
  price24hPcnt: number;
}

interface Indicators {
  rsi: number | null;
  emaTrend: "yukarı" | "aşağı" | "yatay";
  macd: "pozitif" | "negatif";
  bbPct: number | null;
  reason: string;
}

function ema(values: number[], period: number): number[] {
  if (values.length === 0) return [];
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
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const ch = values[i] - values[i - 1];
    if (ch >= 0) gain += ch;
    else loss -= ch;
  }
  let ag = gain / period;
  let al = loss / period;
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
  const e12 = ema(values, 12);
  const e26 = ema(values, 26);
  const line = values.map((_, i) => e12[i] - e26[i]);
  const sig = ema(line.slice(25), 9);
  if (line.length === 0 || sig.length === 0) return 0;
  return line[line.length - 1] - sig[sig.length - 1];
}

function bollingerPct(values: number[], period = 20, mult = 2): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
  const sd = Math.sqrt(variance);
  const upper = mean + mult * sd;
  const lower = mean - mult * sd;
  const price = values[values.length - 1];
  return upper === lower ? 0.5 : (price - lower) / (upper - lower);
}

function computeIndicators(closes: number[]): Indicators {
  const r = rsi(closes);
  const e20 = ema(closes, 20);
  const e50 = ema(closes, 50);
  const last20 = e20[e20.length - 1];
  const last50 = e50[e50.length - 1];
  const diff =
    Number.isFinite(last50) && last50 !== 0
      ? ((last20 - last50) / last50) * 100
      : 0;
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
  try {
    const normalized = symbol.trim().toUpperCase();
    const marketSymbol = normalized.endsWith("USDT") ? normalized : `${normalized}USDT`;
    const url = `https://api.bybit.com/v5/market/kline?category=spot&symbol=${encodeURIComponent(marketSymbol)}&interval=15&limit=120`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Bybit mum verisi HTTP ${res.status}`);
    const json = await res.json();
    if (json.retCode !== 0 || !Array.isArray(json.result?.list)) throw new Error(json.retMsg || "Bybit mum verisi alınamadı.");
    return (json.result.list as string[][]).slice().reverse().map((k) => Number(k[4])).filter((n) => Number.isFinite(n) && n > 0);
  } catch (error) {
    console.error("Teknik gösterge verisi alınamadı:", error);
    throw error;
  }
}

function fmtNum(p: number): string {
  if (!Number.isFinite(p) || p <= 0) return "—";
  if (p >= 100) return p.toFixed(2);
  if (p >= 1) return p.toFixed(4);
  return p.toFixed(6);
}

function coinShort(c: string): string {
  return c.replace(/USDT$/, "");
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
  try {
    const { data, error } = await supabase.from("kpk_signals").select("*").order("created_at", { ascending: false }).limit(60);
    if (error) return [];
    const allSignals = (data as Signal[]) || [];
    const latestByCoin: Record<string, Signal> = {};
    allSignals.forEach((s) => {
      if (!latestByCoin[s.coin]) {
        latestByCoin[s.coin] = s;
      }
    });
    return Object.values(latestByCoin);
  } catch (error) {
    return [];
  }
}

async function loadPrices(): Promise<PriceRow[]> {
  try {
    const { data, error } = await supabase.from("exchange_prices").select("*");
    if (error) return [];
    if (!data) return [];
    return data.map((row: any) => ({
      coin: row.coin,
      bybit_price: Number(row.bybit_price),
      price24hPcnt: Number(row.diff_pct) || 0,
    }));
  } catch (error) {
    return [];
  }
}

function TradingViewWidget({ symbol }: { symbol: string }) {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.async = true;
    script.onload = () => {
      if (typeof (window as any).TradingView !== "undefined") {
        new (window as any).TradingView.widget({
          width: "100%",
          height: 300,
          symbol: `BYBIT:${symbol.replace("USDT", "")}USDT`,
          interval: "15",
          timezone: "Europe/Istanbul",
          theme: "dark",
          style: "1",
          locale: "tr",
          toolbar_bg: "#05070c",
          enable_publishing: false,
          hide_side_toolbar: false,
          allow_symbol_change: false,
          container_id: `tradingview_${symbol}`,
        });
      }
    };
    document.head.appendChild(script);

    return () => {
      const existingScript = document.querySelector('script[src="https://s3.tradingview.com/tv.js"]');
      if (existingScript) existingScript.remove();
    };
  }, [symbol]);

  return <div id={`tradingview_${symbol}`} style={{ height: "300px", width: "100%" }} />;
}

function SignalTerminal() {
  const navigate = useNavigate();
  const [signals, setSignals] = useState<Signal[]>([]);
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"hepsi" | "BUY" | "SELL">("hepsi");
  const [openId, setOpenId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, Indicators | "loading" | "error">>({});
  const [chartCoin, setChartCoin] = useState<string>("BTCUSDT");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [lang, setLang] = useState<LangCode>(getLang());

  const t = (key: string) => translations[key]?.[lang] || key;

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate({ to: "/login" });
      }
    });
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  useEffect(() => {
    let cancelled = false;
    let running = false;

    const load = async () => {
      if (running || cancelled) return;
      running = true;
      try {
        const s = await loadSignals();
        if (cancelled) return;
        setSignals(s);
        const p = await loadPrices();
        if (cancelled) return;
        setPrices(p);
      } catch (error) {
        if (!cancelled) setPrices([]);
      } finally {
        running = false;
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    const timer = setInterval(() => { void load(); }, 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const priceMap: Record<string, number> = {};
  prices.forEach((p) => {
    if (p.coin && Number.isFinite(p.bybit_price)) {
      priceMap[p.coin] = p.bybit_price;
    }
  });

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
    if (openId === s.id) { setOpenId(null); return; }
    setOpenId(s.id);
    if (!details[s.id]) {
      setDetails((d) => ({ ...d, [s.id]: "loading" }));
      fetchCloses(s.coin)
        .then((closes) => {
          if (closes.length < 50) throw new Error("Yetersiz mum verisi");
          setDetails((d) => ({ ...d, [s.id]: computeIndicators(closes) }));
        })
        .catch(() => { setDetails((d) => ({ ...d, [s.id]: "error" })); });
    }
  }

  const ktStyles = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Manrope:wght@400;500;600;700;800&display=swap');
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
        radial-gradient(circle at 18% 10%, rgba(245, 182, 41, 0.13), transparent 26%),
        radial-gradient(circle at 82% 70%, rgba(189, 128, 28, 0.12), transparent 30%),
        linear-gradient(135deg, var(--kt-bg) 0%, var(--kt-bg-strong) 52%, #050609 100%);
      color: var(--kt-text);
      font-family: 'DM Sans', sans-serif;
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
      filter: blur(100px);
      pointer-events: none;
    }
    .kt-page-shell .kt-orb-one { top: -180px; left: -120px; background: rgba(245, 182, 41, 0.12); }
    .kt-page-shell .kt-orb-two { right: -160px; bottom: -220px; background: rgba(170, 118, 25, 0.12); }
    .kt-page-shell .term-nav {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 18px 16px;
      background: rgba(7, 12, 18, 0.78);
      backdrop-filter: blur(16px);
      border-bottom: 1px solid var(--kt-line);
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
    }
    .kt-page-shell .term-brand {
      font-size: 1.05rem;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      background: linear-gradient(135deg, var(--kt-gold) 0%, var(--kt-gold-soft) 100%);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
    .kt-page-shell .term-links {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .kt-page-shell .term-links a {
      color: var(--kt-muted);
      text-decoration: none;
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      transition: color 0.2s ease;
    }
    .kt-page-shell .term-links a:hover,
    .kt-page-shell .term-links a.active {
      color: var(--kt-gold);
    }
    .kt-page-shell .theme-btn,
    .kt-page-shell .logout-btn,
    .kt-page-shell .lang-select,
    .kt-page-shell .fbtn,
    .kt-page-shell .detail-btn {
      font-family: 'DM Sans', sans-serif;
    }
    .kt-page-shell .theme-btn,
    .kt-page-shell .lang-select,
    .kt-page-shell .logout-btn {
      border-radius: 999px;
      border: 1px solid var(--kt-line);
      background: rgba(255,255,255,0.02);
      color: var(--kt-gold);
      font-weight: 700;
      font-size: 0.72rem;
      padding: 0.55rem 0.8rem;
      cursor: pointer;
      transition: transform 0.2s ease, border-color 0.2s ease;
    }
    .kt-page-shell .theme-btn:hover,
    .kt-page-shell .lang-select:hover,
    .kt-page-shell .logout-btn:hover {
      transform: translateY(-1px);
      border-color: rgba(245, 182, 41, 0.5);
    }
    .kt-page-shell .logout-btn {
      color: #fda4af;
      border-color: rgba(248, 113, 113, 0.28);
    }
    .kt-page-shell .wrap {
      position: relative;
      z-index: 1;
      max-width: 1100px;
      margin: 0 auto;
      padding: 24px 16px 0;
    }
    .kt-page-shell .card,
    .kt-page-shell .sig-card,
    .kt-page-shell .chart-panel,
    .kt-page-shell .pchip,
    .kt-page-shell .detail,
    .kt-page-shell .empty,
    .kt-page-shell .sig-list,
    .kt-page-shell .loading {
      background: rgba(15, 19, 28, 0.72);
      border: 1px solid rgba(245, 182, 41, 0.18);
      box-shadow: 0 16px 28px -24px rgba(0, 0, 0, 0.9);
      backdrop-filter: blur(16px);
    }
    .kt-page-shell .card,
    .kt-page-shell .chart-panel,
    .kt-page-shell .sig-card,
    .kt-page-shell .empty,
    .kt-page-shell .loading {
      border-radius: 18px;
    }
    .kt-page-shell .card {
      padding: 18px 16px;
    }
    .kt-page-shell .card-h,
    .kt-page-shell .sec-t {
      color: var(--kt-gold);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      font-size: 0.7rem;
      font-weight: 800;
    }
    .kt-page-shell .mood {
      font-size: clamp(1.8rem, 4vw, 2.8rem);
      font-weight: 900;
      margin-top: 10px;
      letter-spacing: -0.04em;
    }
    .kt-page-shell .mood-sub,
    .kt-page-shell .meta,
    .kt-page-shell .radar-k,
    .kt-page-shell .lv-k,
    .kt-page-shell .ind-k,
    .kt-page-shell .d-meta,
    .kt-page-shell .disc {
      color: var(--kt-muted);
    }
    .kt-page-shell .mood-bar {
      background: rgba(255,255,255,0.06);
      border-radius: 999px;
      overflow: hidden;
      margin-top: 14px;
      height: 10px;
    }
    .kt-page-shell .mood-fill {
      background: linear-gradient(90deg, #22c55e, #f5b629, #f59e0b);
      border-radius: 999px;
      height: 100%;
    }
    .kt-page-shell .radar-box {
      display: flex;
      align-items: center;
      gap: 18px;
    }
    .kt-page-shell .radar {
      position: relative;
      width: 100px;
      height: 100px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(52, 211, 153, 0.12), rgba(245, 182, 41, 0.04) 60%, transparent 72%);
      border: 1px solid rgba(52, 211, 153, 0.35);
      box-shadow: inset 0 0 22px rgba(52, 211, 153, 0.12);
    }
    .kt-page-shell .radar::before {
      content: "";
      position: absolute;
      inset: 8px;
      border-radius: 50%;
      border: 1px solid rgba(245, 182, 41, 0.18);
    }
    .kt-page-shell .radar::after {
      content: "";
      position: absolute;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--kt-success);
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      box-shadow: 0 0 18px rgba(52, 211, 153, 0.7);
    }
    .kt-page-shell .price-strip {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 10px;
      margin-top: 12px;
    }
    .kt-page-shell .pchip {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      border-radius: 12px;
      padding: 10px 12px;
      cursor: pointer;
      transition: border-color 0.2s ease, transform 0.2s ease;
    }
    .kt-page-shell .pchip:hover,
    .kt-page-shell .pchip.active {
      border-color: rgba(245, 182, 41, 0.52);
      transform: translateY(-1px);
    }
    .kt-page-shell .pchip .c { font-weight: 800; }
    .kt-page-shell .pchip .p { color: var(--kt-muted); font-size: 0.7rem; }
    .kt-page-shell .diff {
      border-radius: 999px;
      padding: 4px 8px;
      font-size: 0.7rem;
      font-weight: 800;
    }
    .kt-page-shell .dpos { color: var(--kt-success); background: rgba(52, 211, 153, 0.12); }
    .kt-page-shell .dneg { color: #fca5a5; background: rgba(248, 113, 113, 0.12); }
    .kt-page-shell .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
      margin-bottom: 14px;
    }
    .kt-page-shell .fbtn {
      padding: 0.5rem 1rem;
      border-radius: 999px;
      border: 1px solid var(--kt-line);
      background: rgba(255,255,255,0.02);
      color: var(--kt-muted);
      font-size: 0.76rem;
      font-weight: 800;
      letter-spacing: 0.04em;
      cursor: pointer;
    }
    .kt-page-shell .fbtn.active {
      background: rgba(245, 182, 41, 0.1);
      border-color: rgba(245, 182, 41, 0.5);
      color: var(--kt-gold);
    }
    .kt-page-shell .sig-main {
      display: grid;
      grid-template-columns: auto auto 1fr auto auto;
      gap: 12px;
      align-items: center;
      padding: 14px 16px;
    }
    .kt-page-shell .badge {
      border-radius: 999px;
      font-weight: 800;
      font-size: 0.7rem;
      padding: 5px 10px;
    }
    .kt-page-shell .b-buy { background: rgba(52, 211, 153, 0.12); color: var(--kt-success); }
    .kt-page-shell .b-sell { background: rgba(248, 113, 113, 0.12); color: var(--kt-danger); }
    .kt-page-shell .coin-name { font-size: 0.96rem; font-weight: 800; }
    .kt-page-shell .levels {
      display: flex;
      gap: 14px;
      align-items: flex-start;
      flex-wrap: wrap;
    }
    .kt-page-shell .mono { font-variant-numeric: tabular-nums; }
    .kt-page-shell .score {
      min-width: 42px;
      text-align: center;
      padding: 0.4rem 0.6rem;
      border-radius: 8px;
      background: rgba(245, 182, 41, 0.12);
      color: var(--kt-gold-soft);
      font-weight: 800;
    }
    .kt-page-shell .pnl {
      font-size: 0.85rem;
      font-weight: 800;
      margin-bottom: 4px;
    }
    .kt-page-shell .res-win,
    .kt-page-shell .res-loss,
    .kt-page-shell .res-wait {
      font-size: 0.72rem;
      font-weight: 800;
    }
    .kt-page-shell .res-win { color: var(--kt-success); }
    .kt-page-shell .res-loss { color: var(--kt-danger); }
    .kt-page-shell .res-wait { color: var(--kt-warn); }
    .kt-page-shell .detail-btn {
      width: 100%;
      border: 0;
      background: rgba(245, 182, 41, 0.08);
      color: var(--kt-gold);
      font-size: 0.76rem;
      font-weight: 800;
      letter-spacing: 0.04em;
      padding: 0.8rem 1rem;
      cursor: pointer;
      border-top: 1px solid rgba(245, 182, 41, 0.12);
    }
    .kt-page-shell .detail {
      padding: 14px 16px;
      border-top: 1px solid rgba(245, 182, 41, 0.12);
      border-radius: 0 0 18px 18px;
    }
    .kt-page-shell .ind-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 10px;
    }
    .kt-page-shell .ind {
      padding: 10px 12px;
      background: rgba(255,255,255,0.02);
      border-radius: 12px;
      border: 1px solid rgba(245, 182, 41, 0.08);
    }
    .kt-page-shell .ind-v {
      font-weight: 800;
      margin-top: 3px;
    }
    .kt-page-shell .reason {
      margin-top: 12px;
      border-left: 2px solid var(--kt-gold);
      background: rgba(245, 182, 41, 0.06);
      color: #dfeaf8;
      padding: 9px 10px;
      border-radius: 0 10px 10px 0;
      line-height: 1.5;
      font-size: 0.8rem;
    }
    .kt-page-shell .empty,
    .kt-page-shell .loading {
      padding: 30px 16px;
      color: var(--kt-muted);
      text-align: center;
      font-size: 0.82rem;
      border-style: dashed;
      border-color: rgba(245, 182, 41, 0.2);
    }
    .kt-page-shell .disc {
      margin-top: 24px;
      text-align: center;
      color: var(--kt-muted);
      font-size: 0.68rem;
      line-height: 1.5;
    }
    .kt-page-shell .sig-foot {
      text-align: center;
      margin-top: 18px;
      letter-spacing: 0.12em;
      color: #7dd3fc;
      font-size: 0.68rem;
      font-weight: 800;
      text-transform: uppercase;
    }
    .kt-page-shell .chart-panel {
      padding: 12px 12px 0;
      margin: 18px 0 8px;
    }
    .kt-page-shell .chart-panel .card-h {
      padding: 0 4px 10px;
      display: block;
    }
    @media (max-width: 760px) {
      .kt-page-shell .top-grid { grid-template-columns: 1fr; }
      .kt-page-shell .sig-main { grid-template-columns: auto 1fr auto; }
      .kt-page-shell .levels { grid-column: 1 / -1; }
      .kt-page-shell .term-nav { padding-inline: 14px; }
      .kt-page-shell .term-links { gap: 8px; }
    }
  
/* Unified KELTOS premium terminal layer */
.kt-page-shell.term{background:radial-gradient(ellipse at 50% -12%,rgba(245,182,41,.13),transparent 55%),#05070b}
.kt-page-shell .term-nav{padding:15px clamp(14px,3vw,34px);background:rgba(5,7,11,.9);border-bottom:1px solid rgba(245,182,41,.2);box-shadow:0 12px 36px rgba(0,0,0,.2);backdrop-filter:blur(18px)}
.kt-page-shell .term-brand{letter-spacing:.11em;font-size:15px}
.kt-page-shell .term-links{gap:clamp(8px,1.5vw,18px)}
.kt-page-shell .term-links a{font-size:12px;transition:color .2s,border-color .2s}
.kt-page-shell .wrap{max-width:1160px;padding:26px 18px 0}
.kt-page-shell .card,.kt-page-shell .sig-card,.kt-page-shell .chart-panel{background:linear-gradient(145deg,rgba(255,255,255,.052),rgba(255,255,255,.016));border:1px solid rgba(255,255,255,.085);border-radius:16px;box-shadow:inset 0 1px rgba(255,255,255,.035)}
.kt-page-shell .card{padding:20px}.kt-page-shell .card-h,.kt-page-shell .sec-t{color:#f0c568;letter-spacing:.1em}
.kt-page-shell .pchip{background:rgba(255,255,255,.035);border-color:rgba(255,255,255,.09);border-radius:12px;padding:11px 12px}
.kt-page-shell .pchip.active{border-color:rgba(245,182,41,.65);background:rgba(245,182,41,.1)}
.kt-page-shell .sig-card{overflow:hidden}.kt-page-shell .sig-main{padding:16px 18px;gap:14px}
.kt-page-shell .detail{background:rgba(0,0,0,.22);border-top-color:rgba(245,182,41,.16)}
.kt-page-shell .detail-btn{background:rgba(245,182,41,.055);padding:11px}.kt-page-shell .chart-panel{padding:16px}
.kt-page-shell .fbtn,.kt-page-shell .theme-btn,.kt-page-shell .lang-select,.kt-page-shell .logout-btn{border-radius:10px}
.kt-page-shell .empty{background:rgba(255,255,255,.025);border-color:rgba(245,182,41,.2);border-radius:14px}
@media(max-width:760px){.kt-page-shell .term-nav{align-items:flex-start;gap:10px;flex-wrap:wrap}.kt-page-shell .term-links{width:100%;overflow-x:auto;flex-wrap:nowrap;padding:4px 0}.kt-page-shell .term-links a{white-space:nowrap}.kt-page-shell .wrap{padding:18px 12px 0}}
@media(max-width:640px){.kt-page-shell .sig-main{grid-template-columns:auto 1fr;gap:10px;padding:14px}.kt-page-shell .levels{grid-column:1/-1;justify-content:space-between}.kt-page-shell .score{justify-self:start}.kt-page-shell .term-brand{font-size:13px}.kt-page-shell .card{padding:16px}}
`;

  return (
    <div className={`kt-page-shell term ${theme === "light" ? "light-mode" : ""}`} dir={lang === "ar" ? "rtl" : "ltr"}>
      <div className="kt-grid" />
      <div className="kt-orb kt-orb-one" />
      <div className="kt-orb kt-orb-two" />
      <style>{ktStyles}</style>
      <style>{`
        .term.light-mode { background: rgba(255,255,255,0.04); }
        .term.light-mode .card, .term.light-mode .sig-card, .term.light-mode .pchip, .term.light-mode .chart-panel { background: rgba(255,255,255,0.06); }
      `}</style>
      <nav className="term-nav">
        <span className="term-brand">⚡ KELTOŞ SİNYAL TERMİNALİ</span>
        <div className="term-links">
          <a href="/">{t("home")}</a>
          <a href="/signals" className="active">{t("signalTerminal")}</a>
          <a href="/performance">{t("performance")}</a>
          <a href="/whale">{t("whaleRadar")}</a>
          <a href="/exchange">{t("exchangeCompare")}</a>
          <button className="theme-btn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          <select
            className="lang-select"
            value={lang}
            onChange={(e) => {
              const next = e.target.value as LangCode;
              setLang(next);
              setLangStorage(next);
            }}
          >
            <option value="tr">TR</option>
            <option value="en">EN</option>
            <option value="de">DE</option>
            <option value="fr">FR</option>
            <option value="ar">AR</option>
          </select>
          <button className="logout-btn" onClick={handleLogout}>{t("logout")}</button>
        </div>
      </nav>

      {loading ? (
        <div className="loading">⏳ {t("loading")}...</div>
      ) : (
        <div className="wrap">
          <div className="top-grid">
            <div className="card">
              <div className="card-h">{t("marketStatus")}</div>
              <div className={`mood ${moodCls}`}>{mood}</div>
              <div className="mood-sub">{t("signalDirection").replace("{value}", String(bullPct)).replace("{buy}", String(buyN)).replace("{sell}", String(sellN))}</div>
              <div className="mood-bar">
                <div className="mood-fill" style={{ width: `${bullPct}%` }} />
              </div>
            </div>

            <div className="card">
              <div className="card-h">{t("keltosRadar")}</div>
              <div className="radar-box">
                <div className="radar" />
                <div className="radar-stats">
                  <div>
                    <div className="radar-k">{t("trackedCoins")}</div>
                    <div className="radar-v rv-gold">{prices.length || "—"}</div>
                  </div>
                  <div>
                    <div className="radar-k">{t("openSignal")}</div>
                    <div className="radar-v rv-green">{openCount}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="sec-h">
            <span className="live-dot" />
            <span className="sec-t">{t("livePrice")}</span>
          </div>

          {prices.length === 0 ? (
            <div className="empty">{t("priceWaiting")}</div>
          ) : (
            <div className="price-strip">
              {prices.map((p) => {
                const logo = getCoinLogo(p.coin);
                return (
                  <div
                    className={`pchip ${chartCoin === p.coin ? "active" : ""}`}
                    key={p.coin}
                    onClick={() => setChartCoin(p.coin)}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      {logo && <img src={logo} alt={p.coin} className="coin-logo" />}
                      <div>
                        <div className="c">{coinShort(p.coin)}</div>
                        <div className="p">Bybit {fmtNum(p.bybit_price)}</div>
                      </div>
                    </div>
                    <span className={`diff ${p.price24hPcnt >= 0 ? "dpos" : "dneg"}`}>
                      {p.price24hPcnt >= 0 ? "+" : ""}
                      {p.price24hPcnt.toFixed(2)}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="chart-panel">
            <div className="card-h">📈 {t("livePrice")} — {coinShort(chartCoin)}</div>
            <TradingViewWidget symbol={chartCoin} />
          </div>

          <div className="sec-h">
            <span className="sec-t">{t("signals")}</span>
            <span className="meta" style={{ marginLeft: "auto" }}>{openCount} {t("open")} · {signals.length} {t("total")}</span>
          </div>

          <div className="filters">
            {(["hepsi", "BUY", "SELL"] as const).map((f) => (
              <button key={f} className={`fbtn ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
                {f === "hepsi" ? t("all") : f}
              </button>
            ))}
          </div>

          {shown.length === 0 ? (
            <div className="empty">{t("noSignalsAvailable")}</div>
          ) : (
            <div className="sig-list">
              {shown.map((s) => {
                const entry = Number(s.price);
                const { target, stop } = targetStop(s.signal, entry);
                const res = resultLabel(s.result);
                const cur = priceMap[s.coin];
                const logo = getCoinLogo(s.coin);
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
                      <span className="coin-name">
                        {logo && <img src={logo} alt={s.coin} className="coin-logo" />}
                        {coinShort(s.coin)}
                      </span>
                      <div className="levels">
                        <div>
                          <div className="lv-k">{t("entry")}</div>
                          <div className="mono">{fmtNum(entry)}</div>
                        </div>
                        <div>
                          <div className="lv-k">{t("target")}</div>
                          <div className="mono c-t">{fmtNum(target)}</div>
                        </div>
                        <div>
                          <div className="lv-k">{t("stop")}</div>
                          <div className="mono c-s">{fmtNum(stop)}</div>
                        </div>
                      </div>
                      <span className="score">{s.score}</span>
                      <div style={{ textAlign: "right" }}>
                        {pnl != null && (
                          <div className="pnl" style={{ color: pnl >= 0 ? "#22c55e" : "#ef4444" }}>
                            {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}%
                          </div>
                        )}
                        <div className={res.cls}>{res.text}</div>
                      </div>
                    </div>

                    <button className="detail-btn" onClick={() => toggleDetail(s)}>
                      {isOpen ? `▲ ${t("hideDetail")}` : `▼ ${t("detail")}`}
                    </button>

                    {isOpen && (
                      <div className="detail">
                        {det === "loading" && <div className="meta">{t("indicatorsLoading")}</div>}
                        {det === "error" && <div className="meta">{t("detailDataError")}</div>}
                        {det && det !== "loading" && det !== "error" && (
                          <>
                            <div className="ind-grid">
                              <div className="ind"><div className="ind-k">RSI (14)</div><div className="ind-v">{det.rsi != null ? det.rsi.toFixed(0) : "—"}</div></div>
                              <div className="ind"><div className="ind-k">EMA Trend</div><div className="ind-v">{det.emaTrend}</div></div>
                              <div className="ind"><div className="ind-k">MACD</div><div className="ind-v">{det.macd}</div></div>
                              <div className="ind"><div className="ind-k">Bollinger</div><div className="ind-v">{det.bbPct != null ? `%${Math.round(det.bbPct * 100)}` : "—"}</div></div>
                              <div className="ind"><div className="ind-k">{t("score")}</div><div className="ind-v">{s.score}/100</div></div>
                            </div>
                            <div className="reason">{coinShort(s.coin)} için {s.signal} · {det.reason}. Hedef {fmtNum(target)}, stop {fmtNum(stop)}.</div>
                          </>
                        )}
                        <div className="meta" style={{ marginTop: 8 }}>
                          {t("signalTime")}: {new Date(s.created_at).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="disc">{t("panelDisclaimer")}</div>
          <div className="sig-foot">A BAMIR ONLINE STORE'S PRODUCTION</div>
        </div>
      )}
    </div>
  );
}
