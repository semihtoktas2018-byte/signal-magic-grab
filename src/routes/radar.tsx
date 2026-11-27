import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

export const Route = createFileRoute("/radar")({
  head: () => ({
    meta: [
      { title: "Piyasa Röntgeni | KELTOŞ" },
      { name: "description", content: "Bybit açık pozisyon, fonlama, long/short hesap oranı ve emir defteri görünümü." },
    ],
  }),
  component: MarketXRay,
});

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "ADAUSDT", "DOGEUSDT", "AVAXUSDT", "LINKUSDT"] as const;
type SymbolCode = (typeof SYMBOLS)[number];

type ApiEnvelope<T> = { retCode: number; retMsg?: string; result?: T; time?: number };
type Ticker = {
  lastPrice?: string; price24hPcnt?: string; openInterest?: string;
  openInterestValue?: string; fundingRate?: string; nextFundingTime?: string;
};
type OIItem = { openInterest?: string; timestamp?: string };
type RatioItem = { buyRatio?: string; sellRatio?: string; timestamp?: string };
type BookLevel = [string, string];
type Book = { b?: BookLevel[]; a?: BookLevel[]; ts?: number; u?: number };

interface MarketSnapshot {
  symbol: SymbolCode;
  fetchedAt: string;
  ticker: Ticker | null;
  oi: OIItem[];
  ratio: RatioItem | null;
  book: Book | null;
  errors: string[];
}

async function bybit<T>(path: string): Promise<ApiEnvelope<T>> {
  const response = await fetch(`https://api.bybit.com${path}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = (await response.json()) as ApiEnvelope<T>;
  if (body.retCode !== 0) throw new Error(body.retMsg || `Bybit retCode ${body.retCode}`);
  return body;
}

async function loadSnapshot(symbol: SymbolCode): Promise<MarketSnapshot> {
  const paths = [
    `/v5/market/tickers?category=linear&symbol=${symbol}`,
    `/v5/market/open-interest?category=linear&symbol=${symbol}&intervalTime=5min&limit=2`,
    `/v5/market/account-ratio?category=linear&symbol=${symbol}&period=5min&limit=1`,
    `/v5/market/orderbook?category=linear&symbol=${symbol}&limit=50`,
  ];
  const settled = await Promise.allSettled(paths.map((path) => bybit<any>(path)));
  const errors: string[] = [];
  const values = settled.map((item, index) => {
    if (item.status === "fulfilled") return item.value.result;
    const labels = ["Ticker / fonlama", "Açık pozisyon", "Long / Short oranı", "Emir defteri"];
    errors.push(`${labels[index]}: ${item.reason instanceof Error ? item.reason.message : "veri alınamadı"}`);
    return null;
  });
  return {
    symbol,
    fetchedAt: new Date().toISOString(),
    ticker: values[0]?.list?.[0] ?? null,
    oi: values[1]?.list ?? [],
    ratio: values[2]?.list?.[0] ?? null,
    book: values[3] ?? null,
    errors,
  };
}

function numberOrNull(value?: string | number | null): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function compact(value: number | null, digits = 2): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: digits }).format(value);
}
function money(value: number | null): string {
  if (value == null) return "—";
  return `${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(value)} USDT`;
}
function depthUsd(levels: BookLevel[] | undefined): number {
  return (levels ?? []).reduce((sum, level) => {
    const price = Number(level[0]);
    const size = Number(level[1]);
    return Number.isFinite(price) && Number.isFinite(size) ? sum + price * size : sum;
  }, 0);
}
function formatTime(value?: string | number | null): string {
  if (value == null) return "Zaman bilgisi yok";
  const date = new Date(Number(value));
  return Number.isFinite(date.getTime()) ? date.toLocaleString("tr-TR") : "Zaman bilgisi yok";
}

function MarketXRay() {
  const [symbol, setSymbol] = useState<SymbolCode>("BTCUSDT");
  const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const refresh = useCallback(async (selected: SymbolCode, initial = false) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    setLastError(null);
    try {
      const data = await loadSnapshot(selected);
      setSnapshot(data);
      if (data.errors.length === 4) setLastError("Bybit verileri alınamadı. Biraz sonra tekrar deneyin.");
    } catch (error) {
      setLastError(error instanceof Error ? error.message : "Veri alınamadı.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh(symbol, true);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh(symbol);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [symbol, refresh]);

  const ticker = snapshot?.ticker;
  const oiLatest = numberOrNull(snapshot?.oi[0]?.openInterest);
  const oiPrevious = numberOrNull(snapshot?.oi[1]?.openInterest);
  const oiChange = oiLatest != null && oiPrevious != null && oiPrevious !== 0
    ? ((oiLatest - oiPrevious) / oiPrevious) * 100
    : null;
  const buyRatio = numberOrNull(snapshot?.ratio?.buyRatio);
  const sellRatio = numberOrNull(snapshot?.ratio?.sellRatio);
  const longShare = buyRatio != null && sellRatio != null && buyRatio + sellRatio > 0
    ? (buyRatio / (buyRatio + sellRatio)) * 100
    : null;
  const shortShare = longShare == null ? null : 100 - longShare;
  const bidsUsd = depthUsd(snapshot?.book?.b);
  const asksUsd = depthUsd(snapshot?.book?.a);
  const totalDepth = bidsUsd + asksUsd;
  const bidShare = totalDepth > 0 ? (bidsUsd / totalDepth) * 100 : null;
  const funding = numberOrNull(ticker?.fundingRate);
  const priceChange = numberOrNull(ticker?.price24hPcnt);

  return (
    <main className="xray-shell">
      <style>{`
        .xray-shell{min-height:100vh;background:radial-gradient(ellipse at 50% -15%,rgba(245,182,41,.14),transparent 52%),#07090e;color:#f5f2eb;padding:24px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
        .xray-wrap{max-width:1180px;margin:0 auto}.xray-nav{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:8px 0 20px;border-bottom:1px solid rgba(245,182,41,.2);flex-wrap:wrap}
        .xray-brand{font-weight:900;letter-spacing:.12em;color:#f5b629}.xray-links{display:flex;gap:16px;flex-wrap:wrap}.xray-links a{color:#aeb6c4;text-decoration:none;font-size:13px}.xray-links a:hover,.xray-links .active{color:#f5b629}
        .xray-head{display:flex;justify-content:space-between;align-items:flex-end;gap:18px;margin:30px 0 22px;flex-wrap:wrap}.xray-eyebrow{color:#f5b629;font-size:11px;letter-spacing:.18em;font-weight:800}.xray-head h1{font-size:clamp(28px,4vw,42px);margin:8px 0;color:#fff}.xray-head p{margin:0;color:#9ba5b5;max-width:720px;line-height:1.6;font-size:14px}
        .xray-controls{display:flex;gap:10px;align-items:center}.xray-controls select,.xray-controls button{background:#111722;border:1px solid rgba(245,182,41,.32);color:#f5c75e;padding:11px 14px;border-radius:10px;font-weight:700}.xray-controls button{cursor:pointer}.xray-controls button:disabled{opacity:.55;cursor:wait}
        .xray-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.xray-card{background:linear-gradient(145deg,rgba(255,255,255,.06),rgba(255,255,255,.018));border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:18px;min-width:0}.xray-label{font-size:11px;color:#9ba5b5;letter-spacing:.08em;text-transform:uppercase}.xray-value{font-size:clamp(20px,2.5vw,28px);font-weight:850;margin:10px 0 6px;overflow-wrap:anywhere}.xray-sub{font-size:12px;color:#9ba5b5;line-height:1.5}.xray-positive{color:#34d399}.xray-negative{color:#fb7185}.xray-neutral{color:#f5c75e}
        .xray-section{margin-top:18px}.xray-section h2{font-size:17px;margin:0 0 12px;color:#f5c75e}.xray-depth{height:12px;background:#283140;border-radius:99px;overflow:hidden;display:flex;margin:12px 0}.xray-depth-buy{background:#34d399}.xray-depth-sell{background:#fb7185}.xray-split{display:flex;justify-content:space-between;gap:12px;color:#cbd5e1;font-size:13px}.xray-status{margin:16px 0;padding:12px 14px;border-radius:10px;background:rgba(245,182,41,.07);border:1px solid rgba(245,182,41,.18);color:#d7c08a;font-size:12px;line-height:1.55}.xray-error{background:rgba(248,113,113,.08);border-color:rgba(248,113,113,.25);color:#fecaca}.xray-foot{margin-top:24px;color:#7f8a9b;font-size:11px;line-height:1.6}
        @media(max-width:900px){.xray-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){.xray-shell{padding:15px}.xray-grid{grid-template-columns:1fr}.xray-links{gap:10px}.xray-head{align-items:flex-start}.xray-controls{width:100%}.xray-controls select{flex:1}}
      `}</style>
      <div className="xray-wrap">
        <nav className="xray-nav">
          <a className="xray-brand" href="/">KELTOŞ · MARKET INTELLIGENCE</a>
          <div className="xray-links">
            <a href="/">Ana Sayfa</a><a href="/signals">Sinyal Terminali</a><a href="/performance">Performans</a><a href="/whale">Whale Radar</a><a href="/exchange">Borsa Karşılaştır</a><a className="active" href="/radar">Piyasa Röntgeni</a>
          </div>
        </nav>
        <header className="xray-head">
          <div>
            <div className="xray-eyebrow">BYBIT LINEAR · PUBLIC MARKET DATA</div>
            <h1>Piyasa Röntgeni</h1>
            <p>Fiyatın arkasındaki pozisyonlanmayı incele: açık pozisyon, fonlama, long/short hesap oranı ve emir defteri dengesi. Bu veriler piyasa bağlamı sağlar; tek başına yön veya işlem sinyali değildir.</p>
          </div>
          <div className="xray-controls">
            <select value={symbol} onChange={(event) => setSymbol(event.target.value as SymbolCode)} aria-label="Coin seç">
              {SYMBOLS.map((item) => <option key={item} value={item}>{item.replace("USDT", "")}/USDT</option>)}
            </select>
            <button type="button" onClick={() => void refresh(symbol)} disabled={refreshing}>{refreshing ? "Yenileniyor…" : "↻ Yenile"}</button>
          </div>
        </header>

        {loading ? <div className="xray-status">Bybit piyasa verileri yükleniyor…</div> : null}
        {lastError ? <div className="xray-status xray-error">{lastError}</div> : null}
        {snapshot ? (
          <>
            <section className="xray-grid" aria-label="Piyasa göstergeleri">
              <article className="xray-card">
                <div className="xray-label">Son fiyat · 24 saat</div>
                <div className="xray-value">{money(numberOrNull(ticker?.lastPrice))}</div>
                <div className={priceChange == null ? "xray-sub" : priceChange >= 0 ? "xray-positive xray-sub" : "xray-negative xray-sub"}>{priceChange == null ? "24s değişim alınamadı" : `${priceChange >= 0 ? "+" : ""}${compact(priceChange * 100, 2)}% · Bybit Linear`}</div>
              </article>
              <article className="xray-card">
                <div className="xray-label">Açık pozisyon (OI)</div>
                <div className="xray-value">{oiLatest == null ? "—" : `${compact(oiLatest, 3)} ${symbol.replace("USDT", "")}`}</div>
                <div className={oiChange == null ? "xray-sub" : oiChange >= 0 ? "xray-positive xray-sub" : "xray-negative xray-sub"}>{oiChange == null ? "5 dk karşılaştırması yok" : `${oiChange >= 0 ? "+" : ""}${compact(oiChange, 2)}% · önceki 5 dk ölçümüne göre`}</div>
              </article>
              <article className="xray-card">
                <div className="xray-label">Fonlama oranı</div>
                <div className="xray-value">{funding == null ? "—" : `${compact(funding * 100, 4)}%`}</div>
                <div className="xray-sub">Sonraki fonlama: {ticker?.nextFundingTime ? formatTime(ticker.nextFundingTime) : "—"}</div>
              </article>
              <article className="xray-card">
                <div className="xray-label">Long / Short hesap oranı</div>
                <div className="xray-value">{longShare == null ? "—" : `L ${compact(longShare, 1)}% / S ${compact(shortShare, 1)}%`}</div>
                <div className="xray-sub">{buyRatio == null || sellRatio == null ? "Hesap oranı alınamadı" : `Long/Short: ${compact(buyRatio / (sellRatio || 1), 2)} · 5 dk`}</div>
              </article>
            </section>

            <section className="xray-section">
              <h2>Emir defteri dengesi · ilk 50 seviye</h2>
              <div className="xray-card">
                {bidShare == null ? <div className="xray-sub">Emir defteri verisi alınamadı.</div> : (
                  <>
                    <div className="xray-split"><span className="xray-positive">Alış tarafı {compact(bidShare, 1)}% · {money(bidsUsd)}</span><span className="xray-negative">Satış tarafı {compact(100 - bidShare, 1)}% · {money(asksUsd)}</span></div>
                    <div className="xray-depth"><div className="xray-depth-buy" style={{ width: `${bidShare}%` }} /><div className="xray-depth-sell" style={{ width: `${100 - bidShare}%` }} /></div>
                    <div className="xray-sub">Alış/satış derinliği, ilk 50 fiyat seviyesindeki fiyat × miktar toplamıdır. Tüm emir havuzunu veya gerçekleşmiş işlemleri temsil etmez.</div>
                  </>
                )}
              </div>
            </section>
            <div className="xray-status">
              Kaynak: Bybit V5 public API · Kategori: Linear · Son istemci kontrolü: {new Date(snapshot.fetchedAt).toLocaleString("tr-TR")} · Otomatik yenileme: 60 saniye.
              {snapshot.oi[0]?.timestamp ? ` OI veri zamanı: ${formatTime(snapshot.oi[0].timestamp)}.` : ""}
              {snapshot.book?.ts ? ` Emir defteri zamanı: ${formatTime(snapshot.book.ts)}.` : ""}
            </div>
            {snapshot.errors.length > 0 ? <div className="xray-status xray-error">Bazı veriler eksik: {snapshot.errors.join(" · ")}</div> : null}
          </>
        ) : null}

        <footer className="xray-foot">
          Bu ekran Bybit'in herkese açık piyasa verilerini kullanır; API anahtarı veya ücretli veri servisi gerektirmez. Long/Short oranı hesap adedine dayalıdır, pozisyon büyüklüğünü göstermez. Emir defteri anlık görüntüdür ve iptal edilebilir emirleri içerir. Gecikme, eksik veri ve API limitleri olabilir. Yatırım tavsiyesi değildir.
        </footer>
      </div>
    </main>
  );
}
