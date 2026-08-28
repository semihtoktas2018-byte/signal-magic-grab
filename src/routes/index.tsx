import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";

const AISignalIntelligence = lazy(() => import("@/components/AISignalIntelligence"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "KELTOŞ PARAYA KOŞ — Profesyonel Kripto Sinyal Paneli" },
      { name: "description", content: "Kripto piyasasını senin yerine analiz eden profesyonel sinyal paneli. Canlı sinyaller, smart money, paper trade ve daha fazlası." },
      { property: "og:title", content: "KELTOŞ PARAYA KOŞ" },
      { property: "og:description", content: "Kripto piyasasını senin yerine analiz eden profesyonel sinyal paneli." },
      { property: "og:image", content: "/keltos-hero.png" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
    ],
  }),
  component: Landing,
    // KELTOŞ CANLI BYBIT OTOMASYON MOTORU
  loader: async () => {
    try {
    const res = await fetch('https://bybit.com');
      const json = await res.json();
      return { liveTickers: json?.result?.list || [] };
    } catch (e) {
      console.error("Bybit bağlantı hatası:", e);
      return { liveTickers: [] };
    }
  },

});

const WHATSAPP = "https://wa.me/905446452430";

const KPK_SB_URL = "https://hnzjvcwbcfgfwpnfyhiz.supabase.co";
const KPK_SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhuemp2Y3diY2ZnZndwbmZ5aGl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NTQ5NzcsImV4cCI6MjA5NzQzMDk3N30.YnbumW8oXeycMd2DNLTA5Qui52sWqRlQgrWyaMwKulI";

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

function dayKey(iso: string) {
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

interface MergedSignal {
  coin: string;
  signal: string;
  price: string;
  date: string;
  result: string;
  score?: number | null;
  src: "local" | "remote";
}

async function fetchMergedSignals(): Promise<MergedSignal[]> {
  let local: MergedSignal[] = [];
  try {
    const raw = JSON.parse(localStorage.getItem("kpk_wins") || "[]");
    if (Array.isArray(raw)) {
      local = raw.map((w: any) => ({ ...w, src: "local" as const }));
    }
  } catch {
    local = [];
  }

  let remote: MergedSignal[] = [];
  try {
    const res = await fetch(
      `${KPK_SB_URL}/rest/v1/kpk_signals?select=*&order=created_at.asc&limit=500`,
      { headers: { apikey: KPK_SB_KEY, Authorization: `Bearer ${KPK_SB_KEY}` } }
    );
    if (res.ok) {
      const rows = await res.json();
      remote = (rows || []).map((row: any) => ({
        coin: row.coin,
        signal: row.signal,
        price: String(row.price),
        date: row.created_at,
        result: row.result || "bekliyor",
        score: row.score,
        src: "remote" as const,
      }));
    }
  } catch {
    remote = [];
  }

  const seen = new Set(local.map((w) => `${w.coin}_${w.signal}_${dayKey(w.date)}`));
  const remoteFiltered = remote.filter((r) => !seen.has(`${r.coin}_${r.signal}_${dayKey(r.date)}`));
  return [...remoteFiltered, ...local].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function computeHitRate(signals: MergedSignal[]): string {
  const done = signals.filter((s) => s.result === "tuttu" || s.result === "tutmadi");
  if (done.length === 0) return "--";
  const wins = done.filter((s) => s.result === "tuttu").length;
  return String(Math.round((wins / done.length) * 100));
}

// Cron ile aynı TP/SL oranları
const TP_PCT = 0.025; // hedef +%2.5
const SL_PCT = 0.02;  // stop -%2

function fmtNum(p: number): string {
  if (!p) return "0";
  if (p >= 100) return p.toFixed(2);
  if (p >= 1) return p.toFixed(4);
  return p.toFixed(6);
}

// exchange_prices tablosundan güncel (neredeyse canlı) fiyatlar
async function fetchLivePrices(): Promise<Record<string, number>> {
  try {
    const res = await fetch(
      `${KPK_SB_URL}/rest/v1/exchange_prices?select=coin,bybit_price`,
      { headers: { apikey: KPK_SB_KEY, Authorization: `Bearer ${KPK_SB_KEY}` } }
    );
    if (!res.ok) return {};
    const rows = await res.json();
    const map: Record<string, number> = {};
    (rows || []).forEach((r: any) => {
      if (r.coin && r.bybit_price != null) map[r.coin] = Number(r.bybit_price);
    });
    return map;
  } catch {
    return {};
  }
}

// Açık sinyal için canlı kâr/zarar ve hedef/stop ilerlemesi
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
  const texts = ["KELTOŞ", "PARAYA KOŞ", "SİNYALE KOŞ"];
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
  const ref = useReveal();
  const [stats, setStats] = useState<{ hit: string; coins: number }>({ hit: "--", coins: 9 });
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifSignals, setNotifSignals] = useState<MergedSignal[]>([]);
  const [openSignals, setOpenSignals] = useState<MergedSignal[]>([]);
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const merged = await fetchMergedSignals();
      if (cancelled) return;

      const hit = computeHitRate(merged);
      let coins = 9;
      try {
        const coinsRaw = JSON.parse(localStorage.getItem("kpk_coins") || "null");
        if (Array.isArray(coinsRaw) && coinsRaw.length) coins = coinsRaw.length;
      } catch {
        coins = 9;
      }
      setStats({ hit, coins });
      setNotifSignals(merged.slice(-3).reverse());
      // Açık (bekleyen) sinyaller, en yeni önce, en fazla 6 tane
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

  // Canlı fiyatları yükle ve 60 sn'de bir yenile
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
    return "#f5b629";
  };
  const badgeText = (result?: string) => {
    if (result === "tuttu") return "Tuttu";
    if (result === "tutmadi") return "Tutmadı";
    return "Bekliyor";
  };
  const signalTypeColor = (type?: string) => {
    const t = (type || "").toUpperCase();
    if (t.includes("BUY")) return "#22c55e";
    if (t.includes("SELL")) return "#ef4444";
    return "#8a93a3";
  };

  const features = [
    { icon: "🧠", title: "Yapay Zeka Destekli Analiz", desc: "Piyasa verilerini saniyeler içinde analiz eder, en güçlü fırsatları senin için belirler." },
    { icon: "🎯", title: "Canlı Sinyal Takibi", desc: "Anlık üretilen yüksek isabetli sinyallerle kazanç fırsatlarını kaçırma." },
    { icon: "🛡️", title: "Risk Yönetimi", desc: "Otomatik stop-loss ve take-profit seviyeleriyle sermayeni koru." },
    { icon: "📈", title: "Kazanca Odaklı Strateji", desc: "Trendleri yakala, doğru zamanda giriş yap, kazanca koş!" },
  ];

  const steps = [
    { n: "1️⃣", t: "Panele Gir" },
    { n: "2️⃣", t: "Sinyali Gör" },
    { n: "3️⃣", t: "Tutanlar'a Kaydet" },
    { n: "4️⃣", t: "VIP ile Kazan" },
  ];

  const plans = [
    { name: "Ücretsiz", price: "0₺", tag: "Başla", features: ["Panel erişimi", "Temel sinyaller", "Paper trade"], highlight: false },
    { name: "VIP Günlük", price: "50₺", tag: "Popüler", features: ["Özel sinyaller", "Telegram kanalı", "Anlık uyarılar"], highlight: true },
    { name: "VIP Aylık", price: "499₺", tag: "En Avantajlı", features: ["Tüm özellikler", "Öncelikli destek", "1 ay sınırsız"], highlight: false },
  ];

  return (
    <div ref={ref} className="landing">
      <style>{css}</style>

      {/* NAV */}
      <nav className="nav">
        <div className="brand-logo">
          <span className="crown">♛</span> KELTOŞ
        </div>
        <div className="nav-links">
          <a href="/keltos.html">Sinyal Terminali</a>
          <a href="/performance">Performans</a>
          <a href="/whale">Whale Radar</a>
          <a href="/exchange">Borsa Karşılaştır</a>
          <a href="#pricing">Fiyatlandırma</a>
        </div>

        <div className="nav-right">
          <a href="/keltos.html" className="nav-login">Giriş Yap</a>
          <a href="/keltos.html" className="nav-cta">Paraya Koş ⚡</a>
          <div className="bell-wrap" ref={bellRef}>
            <button className="bell-btn" onClick={() => setNotifOpen((v) => !v)} aria-label="Bildirimler">
              <Bell size={20} />
              {notifSignals.length > 0 && <span className="bell-dot" />}
            </button>
            {notifOpen && (
              <div className="bell-dropdown">
                <div className="bell-header">Son Sinyaller</div>
                {notifSignals.length === 0 ? (
                  <div className="bell-empty">Henüz sinyal yok</div>
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
        </div>
      </nav>

      {/* HERO — kompakt tanıtım */}
      <section className="hero hero-compact">
        <div className="hero-bg" />
        <div className="hero-inner" data-reveal>
          <div className="hero-text">
            <div className="hero-head-row">
              <div>
                <span className="eyebrow">◆ PROFESYONEL KRİPTO SİNYAL</span>
                <h1 className="hero-title">KELTOŞ <span className="hero-title-gold">PARAYA KOŞ</span></h1>
              </div>
            </div>
            <p className="hero-sub">Balinalar hareket eder, <b>KELTOŞ önceden görür.</b> Kripto piyasasını yapay zeka destekli sinyal sistemiyle senin yerine analiz eder.</p>
            <div className="hero-cta">
              <a href="/keltos.html" className="btn btn-primary">⚡ SİNYAL TERMİNALİNE GİR</a>
              <a href="/performance" className="btn btn-ghost">📊 Performans</a>
            </div>
            <div className="hero-stats">
              <div><b>{stats.coins}</b><span>Coin Takip</span></div>
              <div><b>%{stats.hit}</b><span>İsabet</span></div>
              <div><b>Canlı</b><span>Bybit Verisi</span></div>
              <div><b>Şeffaf</b><span>Açık Geçmiş</span></div>
            </div>
          </div>
        </div>
      </section>


      {/* AI SIGNAL INTELLIGENCE CENTER */}
      <Suspense fallback={<div style={{ minHeight: 400 }} />}>
        <AISignalIntelligence />
      </Suspense>

      {/* FEATURES */}
      <section id="features" className="section">
        <div className="sec-head" data-reveal>
          <h2>KELTOŞ Nasıl Çalışır?</h2>
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

      {/* CANLI TAKİP */}
      <section id="live" className="section live-section" data-reveal>
        <div className="live-head-row">
          <span className="live-dot-lg"></span>
          <h2 className="live-h2">Canlı Sinyal Takibi</h2>
          <span className="live-count">{openSignals.length} açık pozisyon · özet</span>
        </div>
        {openSignals.length === 0 ? (
          <div className="live-empty">Şu an açık sinyal yok. Yeni sinyal geldiğinde canlı durumu burada görünecek.</div>
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
          <a href="/keltos.html" className="btn btn-primary">⚡ Tüm Sinyaller & Detaylar Terminalde →</a>
        </div>
      </section>

      {/* HOW / TRUST */}
      <section id="how" className="section">
        <div className="sec-head" data-reveal>
          <h2>Neden KELTOŞ?</h2>
          <p>Süslü rakamlar yok. Sadece şeffaflık.</p>
        </div>
        <div className="grid trust">
          <div className="card trust-card" data-reveal>
            <div className="t-icon">🔒</div>
            <h3>Verilerin Güvende</h3>
            <p>Sinyaller Supabase altyapısında saklanır, hesabın korunur.</p>
          </div>
          <div className="card trust-card" data-reveal style={{ transitionDelay: "60ms" }}>
            <div className="t-icon">📊</div>
            <h3>Şeffaf Geçmiş</h3>
            <p>Her sinyalin sonucu (tuttu/tutmadı) açıkça performans sayfasında.</p>
          </div>
          <div className="card trust-card" data-reveal style={{ transitionDelay: "120ms" }}>
            <div className="t-icon">⚡</div>
            <h3>Gerçek Veri</h3>
            <p>Fiyatlar Bybit'ten canlı çekilir. Uydurma sayı yok, spekülasyon yok.</p>
          </div>
        </div>
        <div className="disclaimer-bar" data-reveal>
          ⚠️ Bu panel otomatik işlem açmaz. Sadece teknik analiz ve sinyal sunar. Yatırım tavsiyesi değildir.
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="section">
        <div className="sec-head" data-reveal>
          <h2>Üyelik Planları</h2>
          <p>İhtiyacına göre seç, hemen başla. Kredi kartı gerekmez, istediğin zaman iptal et.</p>
        </div>
        <div className="grid pricing">
          {plans.map((p, i) => (
            <div key={i} className={`card plan ${p.highlight ? "plan-pop" : ""}`} data-reveal style={{ transitionDelay: `${i * 80}ms` }}>
              <div className="plan-tag">{p.tag}</div>
              <h3>{p.name}</h3>
              <div className="plan-price">{p.price}</div>
              <ul>
                {p.features.map((x, k) => <li key={k}>✓ {x}</li>)}
              </ul>
              <a href={
                p.name === "VIP Aylık" ? "https://www.shopier.com/bamironlinestore/48297662"
                : p.name === "VIP Günlük" ? "https://www.shopier.com/bamironlinestore/48843519"
                : "/keltos.html"
              }
                target={p.name === "Ücretsiz" ? "_self" : "_blank"} rel="noreferrer" className="btn btn-primary plan-cta"
              >
                {p.name === "Ücretsiz" ? "🚀 Ücretsiz Başla" : "💳 Hemen Satın Al"}
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="final-cta" data-reveal>
        <h2>Bugün Kazanmaya Başla</h2>
        <p>Balinaları önden gör, doğru zamanda giriş yap.</p>
        <a href="/keltos.html" className="btn btn-primary final-btn">⚡ HEMEN PANELE GİR</a>
      </section>

      <footer className="footer">
        <div className="shimmer">A BAMIR ONLINE STORE'S PRODUCTION</div>
        <div className="copy">© {new Date().getFullYear()} KELTOŞ · Tüm hakları saklıdır</div>
      </footer>
    </div>
  );
}

const css = `
.landing{--bg:#05070c;--bg2:#0a0e16;--gold:#f5b629;--gold2:#ffd76a;--gold3:#c8941a;--text:#f0f4fa;--muted:#8a93a3;--line:rgba(245,182,41,.18);--card:rgba(255,255,255,.03);background:var(--bg);color:var(--text);min-height:100vh;font-family:'Inter',system-ui,-apple-system,sans-serif;overflow-x:hidden;position:relative}
.landing::before{content:"";position:fixed;inset:0;background:radial-gradient(70% 55% at 60% 0%,rgba(245,182,41,.10),transparent 60%),radial-gradient(50% 40% at 15% 90%,rgba(245,182,41,.06),transparent 60%);pointer-events:none;z-index:0}
.landing>*{position:relative;z-index:1}
*{box-sizing:border-box}

.nav{position:sticky;top:0;z-index:50;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 32px;background:rgba(5,7,12,.82);backdrop-filter:blur(16px);border-bottom:1px solid var(--line)}
.brand-logo{font-size:24px;font-weight:900;letter-spacing:.04em;background:linear-gradient(135deg,var(--gold),var(--gold2));-webkit-background-clip:text;background-clip:text;color:transparent;display:flex;align-items:center;gap:6px;white-space:nowrap}
.crown{color:var(--gold);font-size:18px;-webkit-text-fill-color:var(--gold)}
.nav-links{display:flex;gap:22px;align-items:center}
.nav-links a{color:var(--muted);text-decoration:none;font-size:14px;font-weight:500;transition:color .2s;white-space:nowrap}
.nav-links a:hover{color:var(--gold)}
.nav-right{display:flex;align-items:center;gap:12px}
.nav-login{color:var(--text);text-decoration:none;font-size:14px;font-weight:600;padding:8px 16px;border:1px solid var(--line);border-radius:999px;transition:all .2s;white-space:nowrap}
.nav-login:hover{border-color:var(--gold);color:var(--gold)}
.nav-cta{background:linear-gradient(135deg,var(--gold),var(--gold2));color:#000!important;padding:9px 18px;border-radius:999px;font-weight:800;text-decoration:none;font-size:14px;white-space:nowrap;box-shadow:0 8px 24px -8px rgba(245,182,41,.6);transition:transform .2s}
.nav-cta:hover{transform:translateY(-2px)}
@media(max-width:1100px){.nav-links{display:none}}
@media(max-width:560px){.nav{padding:12px 16px;gap:10px}.nav-login{display:none}.brand-logo{font-size:20px}.nav-cta{padding:9px 14px;font-size:13px}}

.hero{position:relative;padding:70px 32px 50px;overflow:hidden}
.hero-bg{position:absolute;inset:0;background:radial-gradient(55% 50% at 65% 35%,rgba(245,182,41,.12),transparent 60%);pointer-events:none}
.hero-inner{position:relative;max-width:1320px;margin:0 auto;display:block}
.hero-compact{padding:30px 28px 26px}
.hero-head-row{display:flex;align-items:center;gap:18px;margin-bottom:14px}
.eyebrow{display:inline-block;font-size:11px;letter-spacing:.18em;color:var(--gold);padding:5px 12px;border:1px solid var(--line);border-radius:999px;margin:0;font-weight:700}
.hero-title{font-size:clamp(26px,4.4vw,46px);line-height:1.05;font-weight:900;margin:6px 0 0;letter-spacing:-.02em;color:#fff}
.hero-title-gold{background:linear-gradient(135deg,var(--gold) 0%,var(--gold2) 50%,var(--gold3) 100%);-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:0 0 60px rgba(245,182,41,.3)}
.hero-slogan{font-size:clamp(18px,2.2vw,24px);color:var(--text);line-height:1.4;margin:0 0 16px}
.hero-slogan b{color:var(--gold)}
.hero-sub{font-size:clamp(13.5px,1.4vw,15.5px);color:var(--muted);max-width:720px;line-height:1.6;margin:0 0 18px}
.hero-sub b{color:var(--gold)}
.hero-cta{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:22px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:14px 28px;border-radius:14px;font-weight:800;font-size:15px;text-decoration:none;cursor:pointer;border:none;transition:transform .2s,box-shadow .2s;white-space:nowrap}
.btn-primary{background:linear-gradient(135deg,var(--gold),var(--gold2));color:#000;box-shadow:0 12px 32px -10px rgba(245,182,41,.6)}
.btn-primary:hover{transform:translateY(-2px);box-shadow:0 16px 40px -10px rgba(245,182,41,.7)}
.btn-ghost{background:rgba(255,255,255,.04);color:var(--text);border:1px solid var(--line)}
.btn-ghost:hover{border-color:var(--gold);color:var(--gold);transform:translateY(-2px)}
.hero-stats{display:flex;gap:28px;flex-wrap:wrap}
.hero-stats div{display:flex;flex-direction:column;gap:3px}
.hero-stats b{font-size:22px;color:var(--gold);font-weight:900}
.hero-stats span{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em}
@media(max-width:900px){.hero-compact{padding:22px 16px 20px}.hero-head-row{gap:12px}.hero-mark{width:58px;height:58px;border-radius:14px}.hero-stats{gap:14px}}
@media(max-width:640px){
  .hero-compact{padding:14px 14px 14px}
  .hero-mark{display:none}
  .hero-head-row{margin-bottom:10px;gap:0}
  .eyebrow{font-size:10px;padding:4px 10px;letter-spacing:.14em}
  .hero-title{font-size:26px;margin-top:8px}
  .hero-sub{font-size:13px;line-height:1.5;margin:0 0 12px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
  .hero-cta{gap:8px;margin-bottom:14px}
  .hero-cta .btn-primary{flex:1 1 100%;padding:13px 16px;font-size:14px}
  .hero-cta .btn-ghost{flex:0 0 auto;padding:9px 14px;font-size:12.5px;border-radius:10px}
  .hero-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;text-align:center}
  .hero-stats div{gap:1px;align-items:center}
  .hero-stats b{font-size:16px}
  .hero-stats span{font-size:9px;letter-spacing:.06em}
}


.section{max-width:1320px;margin:0 auto;padding:44px 28px}
@media(max-width:640px){.section{padding:26px 14px}.sec-head{margin-bottom:18px}.sec-head h2{font-size:22px}.sec-head p{font-size:13px}}
.sec-head{text-align:center;margin-bottom:40px}
.sec-head h2{font-size:clamp(26px,4vw,40px);font-weight:900;margin:0 0 10px;background:linear-gradient(135deg,var(--gold),var(--gold2));-webkit-background-clip:text;background-clip:text;color:transparent}
.sec-head p{color:var(--muted);font-size:15px;margin:0}
.grid{display:grid;gap:16px}
.card{background:var(--card);border:1px solid var(--line);border-radius:20px;transition:transform .25s,border-color .25s,box-shadow .25s}
.card:hover{transform:translateY(-4px);border-color:rgba(245,182,41,.4);box-shadow:0 20px 50px -20px rgba(245,182,41,.3)}

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
.plan-pop{border-color:rgba(245,182,41,.5);background:linear-gradient(180deg,rgba(245,182,41,.08),var(--card));box-shadow:0 20px 60px -25px rgba(245,182,41,.5)}
.plan-tag{display:inline-block;font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--gold);background:rgba(245,182,41,.12);padding:5px 14px;border-radius:999px;margin-bottom:14px}
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
.shimmer{font-weight:900;letter-spacing:.2em;font-size:clamp(13px,2vw,16px);background:linear-gradient(90deg,var(--gold3) 0%,var(--gold2) 25%,#fff 50%,var(--gold2) 75%,var(--gold3) 100%);background-size:200% auto;-webkit-background-clip:text;background-clip:text;color:transparent;animation:shimmer 4s linear infinite;margin-bottom:10px}
@keyframes shimmer{to{background-position:200% center}}
.copy{color:var(--muted);font-size:12px;letter-spacing:.1em}

[data-reveal]{opacity:0;transform:translateY(24px);transition:opacity .6s ease,transform .6s ease}
[data-reveal].is-visible{opacity:1;transform:translateY(0)}

.bell-wrap{position:relative}
.bell-btn{background:transparent;border:none;color:var(--gold);cursor:pointer;padding:6px;border-radius:999px;display:grid;place-items:center;transition:background .2s ease;position:relative}
.bell-btn:hover{background:rgba(245,182,41,.12)}
.bell-dot{position:absolute;top:4px;right:4px;width:8px;height:8px;background:#ef4444;border-radius:999px;box-shadow:0 0 6px rgba(239,68,68,.8)}
.bell-dropdown{position:absolute;top:calc(100% + 10px);right:0;width:260px;background:linear-gradient(180deg,rgba(10,15,23,.98),rgba(5,8,13,.98));border:1px solid var(--line);border-radius:16px;padding:10px 0;box-shadow:0 20px 50px -10px rgba(0,0,0,.6);z-index:60;animation:bellIn .25s ease}
@keyframes bellIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
.bell-header{padding:0 14px 8px;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);border-bottom:1px solid var(--line);margin-bottom:4px}
.bell-empty{padding:18px 14px;text-align:center;color:var(--muted);font-size:13px}
.bell-item{padding:10px 14px;display:flex;align-items:center;justify-content:space-between;gap:8px;transition:background .15s ease}
.bell-item:hover{background:rgba(245,182,41,.06)}
.bell-row{display:flex;align-items:center;gap:8px}
.bell-coin{font-weight:700;font-size:13px;color:var(--text)}
.bell-type{font-size:11px;font-weight:700;letter-spacing:.06em}
.bell-badge{font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;letter-spacing:.04em;white-space:nowrap}
@media(max-width:640px){.bell-dropdown{width:220px;right:-40px}}
`;
