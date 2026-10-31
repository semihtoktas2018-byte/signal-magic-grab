import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { translations, getLang, setLangStorage, type LangCode } from "../i18n";

export const Route = createFileRoute("/exchange")({
  head: () => ({
    meta: [
      { title: "Borsa Karşılaştırma — KELTOŞ" },
      { name: "description", content: "Bybit ve OKX arasındaki anlık fiyat farkını canlı takip et." },
    ],
  }),
  component: ExchangeCompare,
});

const KPK_SB_URL = "https://gmwlkkebwpenocatlmty.supabase.co";
const KPK_SB_KEY = "sb_publishable_vxLxplUzQw9qNSaZjX4ucA_LZ1NW3a1";

interface ExchangePrice {
  coin: string;
  bybit_price: number;
  okx_price: number;
  diff_pct: number;
  updated_at: string;
}

async function fetchExchangePrices(): Promise<ExchangePrice[]> {
  try {
    const res = await fetch(
      `${KPK_SB_URL}/rest/v1/exchange_prices?select=*&order=coin.asc`,
      { headers: { apikey: KPK_SB_KEY, Authorization: `Bearer ${KPK_SB_KEY}` } }
    );
    if (!res.ok) return [];
    return (await res.json()) as ExchangePrice[];
  } catch {
    return [];
  }
}

function fmtPrice(p: number): string {
  if (p >= 100) return p.toFixed(2);
  if (p >= 1) return p.toFixed(4);
  return p.toFixed(6);
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "az önce";
  if (mins < 60) return `${mins} dk önce`;
  const hrs = Math.floor(mins / 60);
  return `${hrs} sa önce`;
}

function ExchangeCompare() {
  const [prices, setPrices] = useState<ExchangePrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<LangCode>(getLang());

  const t = (key: string) => translations[key]?.[lang] || key;

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const data = await fetchExchangePrices();
      if (!cancelled) {
        setPrices(data);
        setLoading(false);
      }
    };
    load();
    const id = setInterval(() => { if (document.visibilityState === "visible") void load(); }, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const biggestGap = prices.length
    ? prices.reduce((a, b) => (Math.abs(a.diff_pct) > Math.abs(b.diff_pct) ? a : b))
    : null;

  const ktStyles = `
    
    .kt-page-shell {
      --kt-bg: #05070b;
      --kt-bg-strong: #090d15;
      --kt-panel: rgba(15, 19, 28, 0.72);
      --kt-gold: #f5b629;
      --kt-gold-soft: #ffe39a;
      --kt-line: rgba(245, 182, 41, 0.2);
      --kt-text: #f5f2eb;
      --kt-muted: #a2a9b5;
      --kt-success: #34d399;
      --kt-danger: #f87171;
      position: relative;
      isolation: isolate;
      min-height: 100vh;
      overflow: hidden;
      background:
        radial-gradient(circle at 18% 10%, rgba(245, 182, 41, 0.12), transparent 26%),
        radial-gradient(circle at 82% 72%, rgba(185, 125, 25, 0.12), transparent 30%),
        linear-gradient(135deg, var(--kt-bg) 0%, var(--kt-bg-strong) 52%, #050609 100%);
      color: var(--kt-text);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      padding: 24px;
    }
    .kt-page-shell .kt-grid { position:absolute; inset:0; opacity:.18; background-image:linear-gradient(rgba(245,182,41,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(245,182,41,.07) 1px, transparent 1px); background-size:64px 64px; mask-image:radial-gradient(ellipse at center, #000 0%, transparent 78%); }
    .kt-page-shell .kt-orb { position:absolute; width:440px; height:440px; border-radius:50%; filter:none;opacity:.45; pointer-events:none; }
    .kt-page-shell .kt-orb-one { top:-180px; left:-120px; background:rgba(245,182,41,.12); }
    .kt-page-shell .kt-orb-two { right:-180px; bottom:-220px; background:rgba(170,118,25,.12); }
    .kt-page-shell .panel { position:relative; z-index: 1; max-width:920px; margin:0 auto; }
    .kt-page-shell .topbar { display:flex; justify-content:space-between; gap:12px; align-items:center; margin-bottom:18px; }
    .kt-page-shell .back-link { color: var(--kt-muted); text-decoration:none; font-size:0.8rem; font-weight:700; }
    .kt-page-shell .lang-select { appearance:none; background: rgba(255,255,255,0.02); border:1px solid var(--kt-line); color: var(--kt-gold); border-radius:999px; padding:0.6rem 0.9rem; font-weight:700; font-family:'DM Sans', sans-serif; }
    .kt-page-shell .headline { display:flex; align-items:center; gap:12px; margin:12px 0 8px; }
    .kt-page-shell h1 { margin:0; font-size:clamp(2rem,4vw,2.6rem); letter-spacing:-0.05em; background:linear-gradient(135deg, var(--kt-gold) 0%, var(--kt-gold-soft) 100%); -webkit-background-clip:text; background-clip:text; color:transparent; font-weight:900; }
    .kt-page-shell .subtitle { color: var(--kt-muted); font-size:0.92rem; line-height:1.7; margin:0 0 24px; max-width:760px; }
    .kt-page-shell .gap-card { padding:16px 18px; border-radius:16px; background: rgba(245,182,41,0.08); border:1px solid rgba(245,182,41,0.28); margin-bottom:24px; }
    .kt-page-shell .gap-label { color: var(--kt-muted); font-size:0.72rem; letter-spacing:0.08em; text-transform:uppercase; }
    .kt-page-shell .gap-value { margin-top:8px; font-size:1.4rem; font-weight:900; color: var(--kt-gold); }
    .kt-page-shell .list { display:flex; flex-direction:column; gap:10px; }
    .kt-page-shell .item {
      display:flex; align-items:center; justify-content:space-between; gap:12px; padding:14px 16px; border-radius:14px; border:1px solid var(--kt-line); background: rgba(15, 19, 28, 0.72); backdrop-filter:none;
    }
    .kt-page-shell .pair { font-size:0.95rem; font-weight:800; }
    .kt-page-shell .meta { color:var(--kt-muted); font-size:0.7rem; margin-top:2px; }
    .kt-page-shell .spread { font-weight:900; font-size:1.12rem; letter-spacing:-0.04em; }
    .kt-page-shell .empty-state { text-align:center; padding:40px 16px; border-radius:16px; color: var(--kt-muted); background: rgba(15,19,28,0.72); border:1px dashed rgba(245,182,41,0.25); }
    .kt-page-shell .promo { display:flex; align-items:center; gap:16px; padding:16px 18px; margin-top:28px; border-radius:18px; background: linear-gradient(135deg, rgba(56,189,248,.12), rgba(34,197,94,.10)); border:1px solid rgba(125,211,252,0.22); }
    .kt-page-shell .promo-text { flex:1; }
    .kt-page-shell .promo-title { font-weight:800; font-size:0.96rem; margin-bottom:2px; }
    .kt-page-shell .promo-sub { color: var(--kt-muted); font-size:0.78rem; line-height:1.5; }
    .kt-page-shell .promo-btn { background: linear-gradient(135deg, #7dd3fc, #4ade80); color: #04121f; text-decoration:none; font-weight:900; border-radius:12px; padding:0.85rem 1.1rem; white-space:nowrap; }
    .kt-page-shell .footer-mark { margin-top:24px; text-align:center; font-size:0.66rem; letter-spacing:0.12em; text-transform:uppercase; font-weight:800; color:#7dd3fc; }
    @media (max-width:620px) {
      .kt-page-shell { padding:16px; }
      .kt-page-shell .promo { flex-direction:column; align-items:flex-start; }
      .kt-page-shell .promo-btn { width:100%; text-align:center; }
    }
  
/* Unified KELTOS premium exchange comparison layer */
.kt-page-shell{background:radial-gradient(ellipse at 50% -12%,rgba(245,182,41,.13),transparent 55%),#05070b}
.kt-page-shell .panel{max-width:1000px;margin:34px auto;padding:clamp(18px,3vw,32px);border:1px solid rgba(245,182,41,.16);border-radius:22px;background:linear-gradient(145deg,rgba(255,255,255,.045),rgba(255,255,255,.012));box-shadow:0 24px 80px rgba(0,0,0,.28)}
.kt-page-shell .topbar{padding-bottom:18px;border-bottom:1px solid rgba(255,255,255,.07)}
.kt-page-shell .headline{gap:14px;margin:28px 0 8px}.kt-page-shell .headline h1{font-size:clamp(25px,4vw,36px);letter-spacing:-.035em}
.kt-page-shell .gap-card{margin:24px 0;padding:22px;border-radius:16px;border:1px solid rgba(245,182,41,.24);background:linear-gradient(145deg,rgba(245,182,41,.09),rgba(255,255,255,.02))}
.kt-page-shell .item{border-radius:13px!important;background:rgba(255,255,255,.025);padding:16px 18px;margin-bottom:10px}
.kt-page-shell .empty-state{border:1px dashed rgba(245,182,41,.24);border-radius:14px;background:rgba(255,255,255,.02);padding:28px}
.kt-page-shell .promo{margin-top:28px;border:1px solid rgba(245,182,41,.18);border-radius:16px;background:rgba(245,182,41,.045);padding:18px}
@media(max-width:600px){.kt-page-shell .panel{margin:10px;padding:16px;border-radius:16px}.kt-page-shell .headline{margin-top:20px}.kt-page-shell .item{padding:13px 12px}.kt-page-shell .promo{flex-direction:column;align-items:flex-start}.kt-page-shell .promo-btn{width:100%;text-align:center}}
`;

  return (
    <div className="kt-page-shell" dir={lang === "ar" ? "rtl" : "ltr"}>
      <div className="kt-grid" />
      <div className="kt-orb kt-orb-one" />
      <div className="kt-orb kt-orb-two" />
      <style>{ktStyles}</style>
      <div className="panel">
        <div className="topbar">
          <a href="/" className="back-link">← {t("home")}</a>
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
        </div>

        <div className="headline">
          <span style={{ fontSize: 32 }}>⚖️</span>
          <h1>{t("exchangeCompare")}</h1>
        </div>
        <p className="subtitle">{t("exchangeDescription")}</p>

        {biggestGap && (
          <div className="gap-card">
            <div className="gap-label">{t("largestGap")}</div>
            <div className="gap-value">{biggestGap.coin.replace(/USDT$/, "")}: {biggestGap.diff_pct.toFixed(3)}%</div>
          </div>
        )}

        {loading ? (
          <div className="empty-state">{t("loading")}...</div>
        ) : prices.length === 0 ? (
          <div className="empty-state">{t("noData")}. {t("refreshInSeconds")}.</div>
        ) : (
          <div className="list">
            {prices.map((p) => {
              const up = p.diff_pct >= 0;
              const color = up ? "#34d399" : "#f87171";
              return (
                <div key={p.coin} className="item" style={{ borderColor: `${color}66` }}>
                  <div>
                    <div className="pair">{p.coin.replace(/USDT$/, "")}</div>
                    <div className="meta">Bybit: {fmtPrice(p.bybit_price)} · OKX: {fmtPrice(p.okx_price)} · {timeAgo(p.updated_at)}</div>
                  </div>
                  <div className="spread" style={{ color }}>{up ? "+" : ""}{p.diff_pct.toFixed(3)}%</div>
                </div>
              );
            })}
          </div>
        )}

        <div className="promo">
          <div style={{ fontSize: 30 }}>🛍️</div>
          <div className="promo-text">
            <div className="promo-title">E-ticaret / Dropshipping mi yapıyorsun?</div>
            <div className="promo-sub">KHELL AI ile ürün analizi, rakip mağaza takibi ve kâr hesabını tek panelde yap.</div>
          </div>
          <a href="https://khell-profit-wizard.lovable.app" target="_blank" rel="noreferrer" className="promo-btn">KHELL AI'ya Göz At →</a>
        </div>

        <div className="footer-mark">A BAMIR ONLINE STORE'S PRODUCTION</div>
      </div>
    </div>
  );
}
