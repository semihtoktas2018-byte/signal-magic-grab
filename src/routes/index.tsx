// Force rebuild for i18n

import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Bell, Menu, X } from "lucide-react";
import { translations, getLang, setLangStorage, type LangCode } from "../i18n";
import { supabase } from "@/integrations/supabase/client";
import { useBranding } from "../branding";

const AISignalIntelligence = lazy(() => import("@/components/AISignalIntelligence"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Market Analysis Terminal" },
      { name: "description", content: "Teknik göstergeler, kripto sinyalleri, piyasa karşılaştırması ve geçmiş sinyal sonuçlarını izleme paneli." },
      { property: "og:title", content: "Market Analysis Terminal" },
      { property: "og:description", content: "Teknik göstergeler ve sinyal geçmişini izlemek için kripto analiz paneli." },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
    ],
  }),
  component: Landing,
});

const WHATSAPP = "https://wa.me/905446452430";
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const els = root.querySelectorAll<HTMLElement>("[data-reveal]");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return ref;
}

interface MergedSignal {
  coin: string;
  signal: string;
  price: string;
  date: string;
  result: string;
  score?: number | null;
}

async function fetchMergedSignals(): Promise<MergedSignal[]> {
  try {
    const { data, error } = await supabase
      .from("kpk_signals")
      .select("coin,signal,price,created_at,result,score")
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) return [];
    return (data ?? []).map((row) => ({
      coin: row.coin,
      signal: row.signal,
      price: String(row.price),
      date: row.created_at,
      result: row.result || "bekliyor",
      score: row.score,
    }));
  } catch {
    return [];
  }
}

const TP_PCT = 0.025;
const SL_PCT = 0.02;

function fmtNum(p: number): string {
  if (!p) return "0";
  if (p >= 100) return p.toFixed(2);
  if (p >= 1) return p.toFixed(4);
  return p.toFixed(6);
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

function computeLive(sig: MergedSignal, curPrice: number) {
  const entry = parseFloat(sig.price);
  if (!entry || !curPrice) return null;
  const isBuy = sig.signal === "BUY";
  const pnlPct = isBuy ? ((curPrice - entry) / entry) * 100 : ((entry - curPrice) / entry) * 100;
  const target = isBuy ? entry * (1 + TP_PCT) : entry * (1 - TP_PCT);
  const stop = isBuy ? entry * (1 - SL_PCT) : entry * (1 + SL_PCT);
  const lo = Math.min(stop, target), hi = Math.max(stop, target);
  let progress = ((curPrice - lo) / (hi - lo)) * 100;
  progress = Math.max(0, Math.min(100, progress));
  const toTarget = isBuy ? progress : 100 - progress;
  return { pnlPct, target, stop, progress: toTarget, entry };
}

function AnimatedBrand() {
  const texts = ["MARKET ANALYSIS", "SIGNAL TERMINAL"];
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % texts.length), 2500);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="brand">
      {texts.map((t, i) => (
        <span key={t} className={i === index ? "brand-text brand-text-active" : "brand-text"}>
          {t}
        </span>
      ))}
    </div>
  );
}

function Landing() {
  const brand = useBranding();
  const ref = useReveal();
  const [notifOpen, setNotifOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifSignals, setNotifSignals] = useState<MergedSignal[]>([]);
  const [openSignals, setOpenSignals] = useState<MergedSignal[]>([]);
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const bellRef = useRef<HTMLDivElement>(null);
  const [lang, setLang] = useState<LangCode>(getLang());
  const [isAdmin, setIsAdmin] = useState(false);
  const t = (key: string) => translations[key]?.[lang] || key;

  useEffect(() => {
    let active = true;
    const syncAdmin = async () => {
      const { data } = await supabase.auth.getUser();
      if (active) setIsAdmin(data.user?.app_metadata?.role === "admin");
    };
    void syncAdmin();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setIsAdmin(session?.user?.app_metadata?.role === "admin");
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const merged = await fetchMergedSignals();
      if (cancelled) return;

      setNotifSignals(merged.slice(-3).reverse());
      const open = merged
        .filter((s) => (s.result || "bekliyor") === "bekliyor")
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 3);
      setOpenSignals(open);
    };

    load();
    const id = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = () => fetchLivePrices().then((p) => { if (!cancelled) setLivePrices(p); });
    load();
    const id = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  useEffect(() => {
    if (!notifOpen) return;
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [notifOpen]);

  const badgeColor = (result?: string) => {
    if (result === "tuttu") return "#22c55e";
    if (result === "tutmadi") return "#ef4444";
    if (result === "suresi_doldu") return "#94a3b8";
    return "#f5b629";
  };
  const badgeText = (result?: string) => {
    if (result === "tuttu") return "Tuttu";
    if (result === "tutmadi") return "Tutmadı";
    if (result === "suresi_doldu") return "Süresi doldu";
    return "Bekliyor";
  };
  const signalTypeColor = (type?: string) => {
    const t = (type || "").toUpperCase();
    if (t.includes("BUY")) return "#22c55e";
    if (t.includes("SELL")) return "#ef4444";
    return "#8a93a3";
  };

  const features = [
    { icon: "📊", title: "Teknik Gösterge Analizi", desc: "EMA, RSI, MACD ve Bollinger göstergeleriyle piyasa koşullarını inceler." },
    { icon: "🎯", title: "Sinyal Takibi", desc: "BUY ve SELL sinyallerini giriş fiyatı, hedef ve stop seviyeleriyle listeler." },
    { icon: "🔎", title: "Piyasa Karşılaştırması", desc: "Kodda tanımlı Bybit ve OKX fiyat karşılaştırma akışını sunar; canlı erişim kurulumda doğrulanmalıdır." },
    { icon: "📈", title: "Geçmiş Sonuçlar", desc: "Kaydedilen sinyallerin hedef/stop sonuçlarını ve teorik performans metriklerini görüntüler." },
  ];

  const steps = [
    { n: "1", t: "Piyasa verisini incele" },
    { n: "2", t: "Sinyal ve teknik detayları görüntüle" },
    { n: "3", t: "Hedef ve stop seviyelerini takip et" },
    { n: "4", t: "Geçmiş sonuçları performans ekranında değerlendir" },
  ];

  return (
    <div ref={ref} className="landing" dir={lang === "ar" ? "rtl" : "ltr"}>
      <style>{css}</style>

      <nav className="nav">
        <div className="brand-logo">
          <span className="crown">♛</span> {brand.logo_url ? <img src={brand.logo_url} alt={brand.brand_name || "Brand"} style={{ maxHeight: 36, maxWidth: 160, objectFit: "contain" }} /> : (brand.brand_name || "Market Analysis Terminal")}
        </div>
        <div className="nav-links">
          <a href="/" className="nav-active">{t("home")}</a>
          <a href="/signals">{t("signalTerminal")}</a>
          <a href="/performance">{t("performance")}</a>
          <a href="/whale">{t("whaleRadar")}</a>
          <a href="/exchange">{t("exchangeCompare")}</a>
          {isAdmin && <a href="/branding">Marka ayarları</a>}
          <a href="#pricing">{t("pricing")}</a>
        </div>

        <div className="nav-right">
          <select
            value={lang}
            onChange={(e) => {
              const next = e.target.value as LangCode;
              setLang(next);
              setLangStorage(next);
            }}
            aria-label="Language"
            style={{ background: "transparent", border: "1px solid rgba(245,182,41,.25)", color: "#f5b629", borderRadius: 999, padding: "8px 10px", fontWeight: 700 }}
          >
            <option value="tr">TR</option>
            <option value="en">EN</option>
            <option value="de">DE</option>
            <option value="fr">FR</option>
            <option value="ar">AR</option>
          </select>
          <a href="/signals" className="nav-cta">Sinyal terminali</a>
          <div className="bell-wrap" ref={bellRef}>
            <button className="bell-btn" onClick={() => setNotifOpen((v) => !v)} aria-label="Bildirimler">
              <Bell size={20} />
              {notifSignals.length > 0 && <span className="bell-dot" />}
            </button>
            {notifOpen && (
              <div className="bell-dropdown">
                <div className="bell-header">{t("latestSignals")}</div>
                {notifSignals.length === 0 ? (
                  <div className="bell-empty">{t("noSignals")}</div>
                ) : (
                  notifSignals.map((s, i) => (
                    <div key={i} className="bell-item">
                      <div className="bell-row">
                        <span className="bell-coin">{s.coin || "—"}</span>
                        <span className="bell-type" style={{ color: signalTypeColor(s.signal) }}>
                          {(s.signal || "—").toUpperCase()}
                        </span>
                      </div>
                      <span className="bell-badge" style={{ background: badgeColor(s.result) + "22", color: badgeColor(s.result), border: "1px solid " + badgeColor(s.result) + "44" }}>
                        {badgeText(s.result)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          <button
            className="menu-btn"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menü"
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        {menuOpen && (
          <div className="mobile-menu">
            <a href="/" onClick={() => setMenuOpen(false)}>{t("home")}</a>
            <a href="/signals" onClick={() => setMenuOpen(false)}>{t("signalTerminal")}</a>
            <a href="/performance" onClick={() => setMenuOpen(false)}>{t("performance")}</a>
            <a href="/whale" onClick={() => setMenuOpen(false)}>{t("whaleRadar")}</a>
            <a href="/exchange" onClick={() => setMenuOpen(false)}>{t("exchangeCompare")}</a>
            <a href="#pricing" onClick={() => setMenuOpen(false)}>{t("pricing")}</a>
          </div>
        )}
      </nav>

      <section className="hero hero-compact">
        <div className="hero-bg" />
        <div className="hero-inner" data-reveal>
          <div className="hero-text">
            <div className="hero-head-row">
              <div>
                <span className="eyebrow">◆ Kripto analiz ve sinyal paneli</span>
                <h1 className="hero-title">{t("keltosBrand")} <span className="hero-title-gold">Kripto Analiz Paneli</span></h1>
              </div>
            </div>
            <p className="hero-sub">
              <b>{t("keltosBrand")}</b> teknik göstergeler, kayıtlı sinyaller ve piyasa verilerini tek panelde sunar.
            </p>
            <div className="hero-cta">
              <a href="/signals" className="btn btn-primary">{t("enterSignalTerminal")}</a>
              <a href="/performance" className="btn btn-ghost">📊 {t("performanceShort")}</a>
            </div>
            <div className="hero-stats">
              <div><b>EMA · RSI</b><span>Teknik göstergeler</span></div>
              <div><b>BUY / SELL</b><span>Sinyal yönü</span></div>
              <div><b>TP / SL</b><span>Hedef ve stop seviyeleri</span></div>
              <div><b>Geçmiş</b><span>Kaydedilmiş sinyal sonuçları</span></div>
            </div>
          </div>
        </div>
      </section>

      <Suspense fallback={<div style={{ minHeight: 400 }} />}>
        <AISignalIntelligence />
      </Suspense>

      <section id="live" className="section live-section" data-reveal>
        <div className="live-head-row">
          <span className="live-dot-lg"></span>
          <h2 className="live-h2">Canlı Sinyal Takibi</h2>
          <span className="live-count">{openSignals.length} açık pozisyon · özet</span>
        </div>
        <p className="live-source-note">Referans fiyatı Binance spot verisidir; sinyal giriş fiyatı Bybit kaynaklıdır. Farklı borsalar nedeniyle gösterilen yüzde yaklaşık karşılaştırmadır, gerçekleşmiş getiri değildir.</p>
        {openSignals.length === 0 ? (
          <div className="live-empty">{t("noOpenSignals")}</div>
        ) : (
          <div className="live-grid-l">
            {openSignals.map((s, i) => {
              const cur = livePrices[s.coin];
              const live = cur ? computeLive(s, cur) : null;
              const isBuy = s.signal === "BUY";
              const pnl = live?.pnlPct ?? 0;
              const pnlColor = pnl >= 0 ? "#22c55e" : "#ef4444";
              return (
                <div key={`${s.coin}-${s.date}-${i}`} className="live-card-l">
                  <div className="live-top-l">
                    <span className="live-coin-l">{s.coin.replace("USDT", "")}/USDT</span>
                    <span className="live-side-l" style={{
                      background: isBuy ? "rgba(34,197,94,.15)" : "rgba(239,68,68,.15)",
                      color: isBuy ? "#22c55e" : "#ef4444",
                    }}>
                      {isBuy ? "LONG" : "SHORT"}
                    </span>
                    {live ? (
                      <span className="live-pnl-l" style={{ color: pnlColor }}>
                        {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}%
                      </span>
                    ) : (
                      <span className="live-pnl-l" style={{ color: "#8a93a3", fontSize: 12 }}>—</span>
                    )}
                  </div>
                  {live && (
                    <>
                      <div className="live-bar-wrap-l">
                        <div className="live-bar-l" style={{ width: `${live.progress}%`, background: pnlColor }}></div>
                      </div>
                      <div className="live-meta-l">
                        <span>GİRİŞ {fmtNum(live.entry)}</span>
                        <span>🎯 {fmtNum(live.target)}</span>
                        <span>🛑 {fmtNum(live.stop)}</span>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div className="live-foot">
          <a href="/signals" className="btn btn-primary">⚡ Tüm Sinyaller & Detaylar Terminalde →</a>
        </div>
      </section>

      <section id="features" className="section">
        <div className="sec-head" data-reveal>
          <h2>Nasıl Çalışır?</h2>
          <p>Tek bir panelde profesyonel kripto analiz cephaneliği.</p>
        </div>
        <div className="grid features">
          {features.map((f, i) => (
            <div key={i} className="card feature-card" data-reveal style={{ transitionDelay: `${i * 60}ms` }}>
              <div className="f-icon">{f.icon}</div>
              <div className="f-body">
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="section">
        <div className="sec-head" data-reveal>
          <h2>Neden Bu Panel?</h2>
          <p>Süslü rakamlar yok. Sadece şeffaflık.</p>
        </div>
        <div className="grid trust">
          <div className="card trust-card" data-reveal>
            <div className="t-icon">🔒</div>
            <h3>Verilerin Güvende</h3>
            <p>Sinyal kayıtları mevcut Supabase projesinde tutulur. Erişim ve güvenlik ayarları alıcı kurulumunda ayrıca doğrulanmalıdır.</p>
          </div>
          <div className="card trust-card" data-reveal style={{ transitionDelay: "60ms" }}>
            <div className="t-icon">📊</div>
            <h3>Şeffaf Geçmiş</h3>
            <p>Kaydedilen sinyallerin sonuç durumları performans sayfasında listelenir.</p>
          </div>
          <div className="card trust-card" data-reveal style={{ transitionDelay: "120ms" }}>
            <div className="t-icon">⚡</div>
            <h3>Gerçek Veri</h3>
            <p>Ana sayfadaki canlı fiyat bileşeni Binance piyasa verisini kullanır. Diğer veri akışları kurulumda ayrıca doğrulanmalıdır.</p>
          </div>
        </div>
        <div className="disclaimer-bar" data-reveal>
          ⚠️ Bu panel otomatik işlem açmaz. Sadece teknik analiz ve sinyal sunar. Yatırım tavsiyesi değildir.
        </div>
      </section>

      <section id="pricing" className="section">
        <div className="sec-head" data-reveal>
          <h2>Lisans ve Kurulum Bilgisi</h2>
          <p>Kaynak kod, kurulum kapsamı ve alıcıya özel yapılandırma için iletişime geçin.</p>
        </div>
        <div className="grid pricing">
          {[{ name: "Analiz Paneli", price: "Lisans / devir", tag: "Ürün teslimi", features: ["Web paneli kaynak kodu", "Supabase ve Edge Function kurulum dokümanları", "Alıcıya özel yapılandırma kapsamı ayrıca belirlenir"], highlight: true }].map((p, i) => (
            <div key={i} className={`card plan ${p.highlight ? "plan-pop" : ""}`} data-reveal style={{ transitionDelay: `${i * 80}ms` }}>
              <div className="plan-tag">{p.tag}</div>
              <h3>{p.name}</h3>
              <div className="plan-price">{p.price}</div>
              <ul>
                {p.features.map((x, k) => <li key={k}>✓ {x}</li>)}
              </ul>
              <a href={
                WHATSAPP
              }
                target={p.name === "Market Analysis Paneli" ? "_blank" : "_self"} rel="noreferrer" className="btn btn-primary plan-cta"
              >
                {p.name === "Market Analysis Paneli" ? "Lisans için iletişime geç" : "Panele gir"}
              </a>
            </div>
          ))}
        </div>
      </section>

      <section className="final-cta" data-reveal>
        <h2>{brand.brand_name || "Kripto Analiz Paneli"}</h2>
        <p>Teknik analiz ve sinyal takibi için web tabanlı panel. Otomatik emir göndermez; yatırım tavsiyesi veya kârlılık garantisi sunmaz.</p>
        <a href={WHATSAPP} target="_blank" rel="noreferrer" className="btn btn-primary final-btn">Lisans ve kurulum için iletişim</a>
      </section>

      <footer className="footer">
        <div className="shimmer">{brand.footer_text || brand.brand_name || ""}</div>
        <div className="copy">© {new Date().getFullYear()} {brand.brand_name || "Market Analysis Terminal"}</div>
      </footer>
    </div>
  );
}

const css = `
.landing{--bg:#05070c;--bg2:#0a0e16;--gold:var(--brand-accent,#f5b629);--gold2:#ffd76a;--gold3:#c8941a;--text:#f0f4fa;--muted:#8a93a3;--line:rgba(245,182,41,.18);--card:rgba(255,255,255,.03);background:var(--bg);color:var(--text)}
.landing::before{content:"";position:fixed;inset:0;background:radial-gradient(70% 55% at 60% 0%,rgba(245,182,41,.10),transparent 60%),radial-gradient(50% 40% at 15% 90%,rgba(245,182,41,.06),transparent 60%);pointer-events:none}
.landing>*{position:relative;z-index:1}
*{box-sizing:border-box}
.nav{position:sticky;top:0;z-index:50;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 32px;background:rgba(5,7,12,.82);backdrop-filter:blur(16px);border-bottom:1px solid rgba(245,182,41,.12)}
.brand-logo{font-size:24px;font-weight:900;letter-spacing:.04em;background:linear-gradient(135deg,var(--gold),var(--gold2));-webkit-background-clip:text;background-clip:text;color:transparent;display:flex;align-items:center;gap:8px}
.crown{color:var(--gold);font-size:18px;-webkit-text-fill-color:var(--gold)}
.nav-links{display:flex;gap:22px;align-items:center}
.nav-links a{color:var(--muted);text-decoration:none;font-size:14px;font-weight:500;transition:color .2s;white-space:nowrap}
.nav-links a:hover{color:var(--gold)}
.nav-right{display:flex;align-items:center;gap:12px}
.nav-cta{background:linear-gradient(135deg,var(--gold),var(--gold2));color:#000!important;padding:9px 18px;border-radius:999px;font-weight:800;text-decoration:none;font-size:14px;white-space:nowrap}
.nav-cta:hover{transform:translateY(-2px)}
.nav-links a.nav-active{color:var(--gold);position:relative}
.nav-links a.nav-active::after{content:"";position:absolute;left:0;right:0;bottom:-6px;height:2px;border-radius:2px;background:var(--gold)}
.menu-btn{display:none;background:rgba(255,255,255,.04);border:1px solid var(--line);color:var(--gold);border-radius:10px;padding:7px;cursor:pointer;place-items:center}
.mobile-menu{display:none}
@media(max-width:1100px){.nav-links{display:none}.nav{flex-wrap:wrap}.menu-btn{display:grid}.mobile-menu{display:flex;flex-direction:column;width:100%;gap:2px;padding:8px 0 4px;border-top:1px solid var(--line)}}
@media(max-width:560px){.nav{padding:12px 14px;gap:8px}.brand-logo{font-size:19px}.nav-cta{padding:8px 12px;font-size:12.5px}}
.hero{position:relative;padding:70px 32px 50px;overflow:hidden}
.hero-bg{position:absolute;inset:0;background:radial-gradient(55% 50% at 65% 35%,rgba(245,182,41,.12),transparent 60%);pointer-events:none}
.hero-inner{position:relative;max-width:1320px;margin:0 auto;display:block}
.hero-compact{padding:30px 28px 26px}
.hero-head-row{display:flex;align-items:center;gap:18px;margin-bottom:14px}
.eyebrow{display:inline-block;font-size:11px;letter-spacing:.18em;color:var(--gold);padding:5px 12px;border:1px solid var(--line);border-radius:999px;margin:0;font-weight:700}
.hero-title{font-size:clamp(26px,4.4vw,46px);line-height:1.05;font-weight:900;margin:6px 0 0;letter-spacing:-.02em;color:#fff}
.hero-title-gold{background:linear-gradient(135deg,var(--gold) 0%,var(--gold2) 50%,var(--gold3) 100%);-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:0 0 28px rgba(245,182,41,.16)}
.hero-sub{font-size:clamp(13.5px,1.4vw,15.5px);color:var(--muted);max-width:720px;line-height:1.6;margin:0 0 18px}
.hero-sub b{color:var(--gold)}
.hero-cta{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:22px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:14px 28px;border-radius:14px;font-weight:800;font-size:15px;text-decoration:none;cursor:pointer;border:none;transition:transform .2s ease,border-color .2s ease,box-shadow .2s ease}
.btn-primary{background:linear-gradient(135deg,var(--gold),var(--gold2));color:#000;box-shadow:0 6px 18px -10px rgba(245,182,41,.4)}
.btn-primary:hover{transform:translateY(-2px);box-shadow:0 10px 24px -10px rgba(245,182,41,.5)}
.btn-ghost{background:rgba(255,255,255,.04);color:var(--text);border:1px solid var(--line)}
.btn-ghost:hover{border-color:var(--gold);color:var(--gold);transform:translateY(-2px)}
.hero-stats{display:flex;gap:28px;flex-wrap:wrap}
.hero-stats div{display:flex;flex-direction:column;gap:3px}
.hero-stats b{font-size:22px;color:var(--gold);font-weight:900}
.hero-stats span{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em}
@media(max-width:900px){.hero-compact{padding:22px 16px 20px}.hero-head-row{gap:12px}.hero-stats{gap:14px}}
@media(max-width:640px){.hero-compact{padding:12px 14px 10px}.hero-head-row{margin-bottom:8px;gap:0}.eyebrow{font-size:10px;padding:4px 10px;letter-spacing:.14em}.hero-title{font-size:24px;margin:0}.hero-sub{font-size:13px}}
.section{max-width:1320px;margin:0 auto;padding:44px 28px}
@media(max-width:640px){.section{padding:26px 14px}.sec-head{margin-bottom:18px}.sec-head h2{font-size:22px}.sec-head p{font-size:13px}}
.sec-head{text-align:center;margin-bottom:40px}
.sec-head h2{font-size:clamp(26px,4vw,40px);font-weight:900;margin:0 0 10px;background:linear-gradient(135deg,var(--gold),var(--gold2));-webkit-background-clip:text;background-clip:text;color:transparent}
.sec-head p{color:var(--muted);font-size:15px;margin:0}
.grid{display:grid;gap:16px}
.card{background:var(--card);border:1px solid var(--line);border-radius:20px;transition:transform .25s,border-color .25s,box-shadow .25s}
.card:hover{transform:translateY(-4px);border-color:rgba(245,182,41,.4);box-shadow:0 10px 26px -20px rgba(245,182,41,.22)}
.features{grid-template-columns:repeat(2,1fr)}
@media(max-width:760px){.features{grid-template-columns:1fr}}
.feature-card{padding:24px;display:flex;gap:16px;align-items:flex-start}
.f-icon{font-size:30px;flex:none;width:56px;height:56px;display:grid;place-items:center;background:linear-gradient(135deg,rgba(245,182,41,.15),rgba(245,182,41,.04));border:1px solid var(--line);border-radius:16px}
.f-body h3{margin:0 0 6px;font-size:17px;color:var(--gold);font-weight:800}
.f-body p{margin:0;color:var(--muted);font-size:14px;line-height:1.55}
.live-section{max-width:1320px}
.live-head-row{display:flex;align-items:center;gap:12px;margin-bottom:22px}
.live-dot-lg{width:11px;height:11px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 0 rgba(34,197,94,.6);animation:livepulse 1.6s infinite;flex:none}
@keyframes livepulse{0%{box-shadow:0 0 0 0 rgba(34,197,94,.5)}70%{box-shadow:0 0 0 9px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}
.live-h2{font-size:clamp(20px,3vw,28px);font-weight:900;margin:0;color:var(--gold);letter-spacing:-.01em}
.live-count{margin-left:auto;font-size:12px;color:var(--muted);letter-spacing:.06em}
.live-grid-l{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
@media(max-width:860px){.live-grid-l{grid-template-columns:repeat(2,1fr)}}
@media(max-width:560px){.live-grid-l{grid-template-columns:1fr}}
.live-card-l{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:15px 16px}
.live-top-l{display:flex;align-items:center;gap:9px;margin-bottom:11px}
.live-coin-l{font-weight:800;font-size:14px;color:var(--text)}
.live-side-l{font-size:10px;font-weight:800;padding:3px 9px;border-radius:6px;letter-spacing:.04em}
.live-pnl-l{margin-left:auto;font-size:17px;font-weight:900}
.live-bar-wrap-l{position:relative;height:7px;border-radius:999px;background:rgba(255,255,255,.06);overflow:hidden;margin:8px 0 7px}
.live-bar-l{position:absolute;top:0;left:0;height:100%;border-radius:999px;transition:width .4s ease}
.live-meta-l{display:flex;justify-content:space-between;font-size:10.5px;color:var(--muted)}
.live-empty{text-align:center;padding:28px;color:var(--muted);font-size:14px;background:rgba(255,255,255,.02);border:1px dashed rgba(245,182,41,.15);border-radius:16px}
.live-foot{text-align:center;margin-top:24px}
.trust{grid-template-columns:repeat(3,1fr)}
@media(max-width:760px){.trust{grid-template-columns:1fr}}
.trust-card{padding:26px;text-align:center}
.t-icon{font-size:32px;margin-bottom:14px}
.trust-card h3{margin:0 0 8px;font-size:17px;color:var(--gold);font-weight:800}
.trust-card p{margin:0;color:var(--muted);font-size:14px;line-height:1.55}
.disclaimer-bar{margin-top:28px;text-align:center;padding:16px 20px;background:rgba(245,182,41,.06);border:1px solid var(--line);border-radius:14px;color:var(--muted);font-size:13px;line-height:1.5}
.pricing{grid-template-columns:repeat(3,1fr)}
@media(max-width:820px){.pricing{grid-template-columns:1fr;max-width:420px;margin:0 auto}}
.plan{padding:28px 24px;text-align:center;position:relative}
.plan-pop{border-color:rgba(245,182,41,.5);background:linear-gradient(180deg,rgba(245,182,41,.08),var(--card));box-shadow:0 12px 32px -25px rgba(245,182,41,.35)}
.plan-tag{display:inline-block;font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--gold);background:rgba(245,182,41,.12);padding:5px 14px;border-radius:999px;margin-bottom:10px}
.plan h3{margin:0 0 4px;font-size:19px;color:var(--text);font-weight:800}
.plan-price{font-size:44px;font-weight:900;background:linear-gradient(135deg,var(--gold),var(--gold2));-webkit-background-clip:text;background-clip:text;color:transparent;margin-bottom:18px}
.plan ul{list-style:none;padding:0;margin:0 0 22px;display:flex;flex-direction:column;gap:9px}
.plan li{color:var(--muted);font-size:14px}
.plan-cta{width:100%}
.final-cta{max-width:900px;margin:20px auto 0;padding:56px 32px;text-align:center;background:linear-gradient(135deg,rgba(245,182,41,.10),rgba(245,182,41,.03));border:1px solid var(--line);border-radius:28px}
.final-cta h2{font-size:clamp(26px,4vw,38px);font-weight:900;margin:0 0 10px;background:linear-gradient(135deg,var(--gold),var(--gold2));-webkit-background-clip:text;background-clip:text;color:transparent}
.final-cta p{color:var(--muted);margin:0 0 26px;font-size:16px}
.final-btn{font-size:17px;padding:16px 40px}
.footer{text-align:center;padding:44px 24px 34px;border-top:1px solid var(--line);margin-top:40px}
.shimmer{font-weight:900;letter-spacing:.2em;font-size:clamp(13px,2vw,16px);background:linear-gradient(90deg,var(--gold3) 0%,var(--gold2) 25%,#fff 50%,var(--gold2) 75%,var(--gold3) 100%);background-size:200% auto;-webkit-background-clip:text;background-clip:text;color:transparent;animation:shimmer 2.8s linear infinite}
@keyframes shimmer{to{background-position:200% center}}
.copy{color:var(--muted);font-size:12px;letter-spacing:.1em}
[data-reveal]{opacity:0;transform:translateY(24px);transition:opacity .6s ease,transform .6s ease}[data-reveal].is-visible{opacity:1;transform:translateY(0)}
.bell-wrap{position:relative}.bell-btn{background:transparent;border:none;color:var(--gold);cursor:pointer;padding:6px;border-radius:999px;display:grid;place-items:center;transition:background .2s ease}.bell-btn:hover{background:rgba(245,182,41,.08)}
.bell-dot{position:absolute;top:4px;right:4px;width:8px;height:8px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 4px rgba(34,197,94,.12)}
.bell-dropdown{position:absolute;right:0;top:calc(100% + 12px);width:240px;background:rgba(9,12,18,.96);border:1px solid var(--line);border-radius:14px;padding:10px;box-shadow:0 16px 30px -18px rgba(245,182,41,.3)}
.bell-header{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);padding:6px 8px 10px}
.bell-item{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 6px;border-bottom:1px solid rgba(255,255,255,.05)}
.bell-item:last-child{border-bottom:none}
.bell-row{display:flex;flex-direction:column;gap:5px;min-width:0}
.bell-coin{font-weight:800;color:#fff}
.bell-type{font-size:10px;font-weight:800;letter-spacing:.08em;padding:3px 6px;border-radius:6px}
.bell-badge{font-size:10px;font-weight:800;padding:4px 7px;border-radius:999px;white-space:nowrap}
.bell-empty{color:var(--muted);padding:10px 8px;font-size:12px}
`;

export default Landing;
