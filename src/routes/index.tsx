import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";

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
    };

    load();
    const id = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
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
    { icon: "⚡", title: "Canlı Sinyal", desc: "RSI + EMA + MACD + Bollinger analizi" },
    { icon: "🐋", title: "Smart Money", desc: "Whale activity ve funding rate" },
    { icon: "📊", title: "Fear & Greed", desc: "Gerçek zamanlı endeks" },
    { icon: "🎯", title: "Risk Yönetimi", desc: "Otomatik TP/SL hesabı" },
    { icon: "📈", title: "Paper Trade", desc: "Risksiz strateji testi" },
    { icon: "🏆", title: "Tutanlar", desc: "30 günlük isabet oranı" },
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

      <nav className="nav">
        <AnimatedBrand />
        <div className="nav-links">
          <a href="#features">Özellikler</a>
          <a href="#how">Nasıl</a>
          <a href="#pricing">Üyelik</a>
          <a href="/whale">🐋 Whale Radar</a>
          <a href="/keltos.html" className="nav-cta">Panele Gir</a>
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

      {/* HERO */}
      <section className="hero">
        <div className="hero-bg" />
        <div className="hero-inner" data-reveal>
          <div className="hero-text">
            <span className="eyebrow">PROFESYONEL KRİPTO SİNYAL</span>
            <h1 className="hero-title">KELTOŞ<br/>PARAYA KOŞ</h1>
            <p className="hero-sub">Kripto piyasasını senin yerine analiz eden profesyonel sinyal paneli.</p>
            <div className="hero-cta">
              <a href="/keltos.html" className="btn btn-primary">🚀 Panele Gir</a>
              <a href={WHATSAPP} target="_blank" rel="noreferrer" className="btn btn-ghost">💬 VIP Üyelik</a>
            </div>
            <div className="hero-stats">
              <div><b>%{stats.hit}</b><span>İsabet</span></div>
              <div><b>24/7</b><span>Canlı</span></div>
              <div><b>{stats.coins}+</b><span>Coin</span></div>
            </div>
          </div>
          <div className="hero-img">
            <img src="/keltos-hero.png" alt="Keltoş Paraya Koş" loading="eager" />
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="section">
        <div className="sec-head" data-reveal>
          <h2>Neler Yapabilirsin?</h2>
          <p>Tek bir panelde profesyonel kripto analiz cephaneliği.</p>
        </div>
        <div className="grid features">
          {features.map((f, i) => (
            <div key={i} className="card feature-card" data-reveal style={{ transitionDelay: `${i * 60}ms` }}>
              <div className="f-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW */}
      <section id="how" className="section">
        <div className="sec-head" data-reveal>
          <h2>Nasıl Kullanılır?</h2>
          <p>4 adımda kazanmaya başla.</p>
        </div>
        <div className="timeline" data-reveal>
          {steps.map((s, i) => (
            <div key={i} className="step">
              <div className="step-num">{s.n}</div>
              <div className="step-title">{s.t}</div>
              {i < steps.length - 1 && <div className="step-arrow">→</div>}
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="section">
        <div className="sec-head" data-reveal>
          <h2>Üyelik Planları</h2>
          <p>İhtiyacına göre seç, hemen başla.</p>
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
             <a href={p.name === "VIP Aylık" ? "https://www.shopier.com/bamironlinestore/48297662" : WHATSAPP}
                target="_blank" rel="noreferrer" className="btn btn-primary plan-cta"
              >
                {p.name === "VIP Aylık" ? "💳 Hemen Satın Al" : "💬 WhatsApp ile Al"}
              </a>
            </div>
          ))}
        </div>
      </section>

      <footer className="footer">
        <a href="/keltos.html" className="btn btn-primary footer-cta">🚀 Panele Git</a>
        <div className="shimmer">A BAMIR ONLINE STORE'S PRODUCTION</div>
        <div className="copy">© {new Date().getFullYear()} KELTOŞ · Tüm hakları saklıdır</div>
      </footer>
    </div>
  );
}

const css = `
.landing{--bg:#05080d;--bg2:#0a0f17;--gold:#f5b629;--gold2:#ffd76a;--text:#e8eef7;--muted:#8a93a3;--line:rgba(245,182,41,.18);background:var(--bg);color:var(--text);min-height:100vh;font-family:'Inter',system-ui,-apple-system,sans-serif;overflow-x:hidden}
.landing *{box-sizing:border-box}
[data-reveal]{opacity:0;transform:translateY(24px);transition:opacity .8s ease,transform .8s ease}
[data-reveal].is-visible{opacity:1;transform:none}

.nav{position:sticky;top:0;z-index:50;display:flex;align-items:center;justify-content:space-between;padding:14px 24px;background:rgba(5,8,13,.75);backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}
.brand{display:inline-grid;place-items:center;font-weight:900;letter-spacing:.18em;font-size:18px;cursor:pointer;transition:transform .3s ease,filter .3s ease;animation:brandGlow 3s ease-in-out infinite;position:relative}
.brand:hover{transform:scale(1.06);animation:none;filter:drop-shadow(0 0 18px rgba(245,182,41,.7))}
.brand-text{grid-area:1/1;opacity:0;transform:translateY(6px);transition:opacity 400ms ease,transform 400ms ease;white-space:nowrap;background:linear-gradient(135deg,var(--gold),var(--gold2));-webkit-background-clip:text;background-clip:text;color:transparent}
.brand-text-active{opacity:1;transform:translateY(0)}
@keyframes brandGlow{0%,100%{filter:drop-shadow(0 0 6px rgba(245,182,41,.35))}50%{filter:drop-shadow(0 0 14px rgba(245,182,41,.55))}}
.nav-links{display:flex;gap:18px;align-items:center}
.nav-links a{color:var(--muted);text-decoration:none;font-size:14px;font-weight:500}
.nav-links a:hover{color:var(--gold)}
.nav-cta{background:linear-gradient(135deg,var(--gold),var(--gold2));color:#000!important;padding:8px 16px;border-radius:999px;font-weight:700}
@media(max-width:640px){.nav-links a:not(.nav-cta){display:none}}

.hero{position:relative;padding:80px 24px 60px;overflow:hidden}
.hero-bg{position:absolute;inset:0;background:radial-gradient(60% 50% at 70% 30%,rgba(245,182,41,.18),transparent 60%),radial-gradient(50% 40% at 20% 80%,rgba(120,80,255,.12),transparent 60%);pointer-events:none}
.hero-inner{position:relative;max-width:1200px;margin:0 auto;display:grid;grid-template-columns:1.1fr 1fr;gap:48px;align-items:center}
.eyebrow{display:inline-block;font-size:12px;letter-spacing:.25em;color:var(--gold);padding:6px 12px;border:1px solid var(--line);border-radius:999px;margin-bottom:20px}
.hero-title{font-size:clamp(40px,7vw,82px);line-height:.95;font-weight:900;margin:0 0 18px;background:linear-gradient(135deg,#f5b629 0%,#ffd76a 50%,#f5b629 100%);-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:0 0 60px rgba(245,182,41,.25);letter-spacing:-.02em}
.hero-sub{font-size:clamp(15px,1.6vw,18px);color:var(--muted);max-width:520px;line-height:1.6;margin:0 0 28px}
.hero-cta{display:flex;gap:12px;flex-wrap:wrap}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:14px 24px;border-radius:14px;font-weight:700;text-decoration:none;font-size:15px;transition:transform .2s ease,box-shadow .2s ease;border:none;cursor:pointer}
.btn-primary{background:linear-gradient(135deg,var(--gold),var(--gold2));color:#000;box-shadow:0 10px 30px -10px rgba(245,182,41,.6)}
.btn-primary:hover{transform:translateY(-2px);box-shadow:0 16px 40px -10px rgba(245,182,41,.8)}
.btn-ghost{background:rgba(255,255,255,.04);color:var(--text);border:1px solid var(--line)}
.btn-ghost:hover{background:rgba(245,182,41,.08);border-color:var(--gold)}
.hero-stats{display:flex;gap:28px;margin-top:36px}
.hero-stats div{display:flex;flex-direction:column}
.hero-stats b{font-size:22px;color:var(--gold);font-weight:800}
.hero-stats span{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.15em}
.hero-img{position:relative}
.hero-img img{width:100%;height:auto;border-radius:24px;filter:drop-shadow(0 30px 60px rgba(245,182,41,.25))}
@media(max-width:860px){.hero{padding:48px 18px 32px}.hero-inner{grid-template-columns:1fr;gap:32px}.hero-img{order:-1;max-width:380px;margin:0 auto}}

.section{max-width:1200px;margin:0 auto;padding:80px 24px}
.sec-head{text-align:center;margin-bottom:48px}
.sec-head h2{font-size:clamp(28px,4vw,42px);margin:0 0 12px;font-weight:800;letter-spacing:-.01em}
.sec-head p{color:var(--muted);margin:0;font-size:16px}

.grid{display:grid;gap:18px}
.features{grid-template-columns:repeat(3,1fr)}
@media(max-width:860px){.features{grid-template-columns:repeat(2,1fr)}}
@media(max-width:520px){.features{grid-template-columns:1fr}}

.card{background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.01));border:1px solid var(--line);border-radius:20px;padding:24px;transition:transform .3s ease,border-color .3s ease,box-shadow .3s ease}
.card:hover{transform:translateY(-4px);border-color:rgba(245,182,41,.4);box-shadow:0 20px 40px -20px rgba(245,182,41,.3)}
.f-icon{font-size:32px;margin-bottom:12px}
.feature-card h3{margin:0 0 6px;font-size:18px;font-weight:700;color:var(--gold)}
.feature-card p{margin:0;color:var(--muted);font-size:14px;line-height:1.5}

.timeline{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;max-width:1000px;margin:0 auto}
.step{display:flex;align-items:center;gap:8px}
.step-num{width:56px;height:56px;border-radius:16px;display:grid;place-items:center;font-size:22px;background:linear-gradient(135deg,rgba(245,182,41,.15),rgba(245,182,41,.05));border:1px solid var(--line)}
.step-title{font-weight:700;color:var(--text);font-size:15px}
.step-arrow{color:var(--gold);font-size:22px;margin:0 12px;opacity:.6}
@media(max-width:680px){.timeline{flex-direction:column;align-items:stretch}.step{justify-content:flex-start;padding:12px;background:rgba(255,255,255,.02);border:1px solid var(--line);border-radius:14px}.step-arrow{display:none}}

.pricing{grid-template-columns:repeat(3,1fr)}
@media(max-width:860px){.pricing{grid-template-columns:1fr;max-width:420px;margin:0 auto}}
.plan{position:relative;display:flex;flex-direction:column}
.plan-tag{position:absolute;top:-10px;right:18px;background:#0a0f17;border:1px solid var(--line);color:var(--gold);font-size:11px;letter-spacing:.15em;padding:4px 10px;border-radius:999px;text-transform:uppercase;font-weight:700}
.plan h3{margin:6px 0 4px;font-size:20px}
.plan-price{font-size:42px;font-weight:900;background:linear-gradient(135deg,var(--gold),var(--gold2));-webkit-background-clip:text;background-clip:text;color:transparent;margin:8px 0 18px}
.plan ul{list-style:none;padding:0;margin:0 0 22px;display:flex;flex-direction:column;gap:8px;flex:1}
.plan li{color:var(--muted);font-size:14px}
.plan-cta{width:100%}
.plan-pop{border-color:rgba(245,182,41,.55);box-shadow:0 20px 50px -20px rgba(245,182,41,.4);background:linear-gradient(180deg,rgba(245,182,41,.08),rgba(245,182,41,.02))}

.footer{padding:60px 24px 40px;text-align:center;border-top:1px solid var(--line);margin-top:40px;background:linear-gradient(180deg,transparent,rgba(245,182,41,.03))}
.footer-cta{margin-bottom:24px}
.shimmer{font-weight:900;letter-spacing:.2em;font-size:clamp(14px,2vw,18px);background:linear-gradient(90deg,#3b82f6 0%,#8b5cf6 25%,#ec4899 50%,#8b5cf6 75%,#3b82f6 100%);background-size:200% auto;-webkit-background-clip:text;background-clip:text;color:transparent;animation:shimmer 4s linear infinite;margin-bottom:10px}
@keyframes shimmer{to{background-position:200% center}}
.copy{color:var(--muted);font-size:12px;letter-spacing:.1em}

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
