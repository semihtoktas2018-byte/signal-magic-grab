import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

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

function readStats() {
  if (typeof window === "undefined") return { hit: "--", coins: 9 };
  try {
    const wins = JSON.parse(localStorage.getItem("kpk_wins") || "[]");
    const arr = Array.isArray(wins) ? wins : [];
    const w = arr.filter((x: any) => x?.result === "tuttu").length;
    const total = arr.filter((x: any) => x?.result === "tuttu" || x?.result === "tutmadi").length;
    const hit = total > 0 ? `${Math.round((w / total) * 100)}` : "--";
    const coinsRaw = JSON.parse(localStorage.getItem("kpk_coins") || "null");
    const coins = Array.isArray(coinsRaw) && coinsRaw.length ? coinsRaw.length : 9;
    return { hit, coins };
  } catch {
    return { hit: "--", coins: 9 };
  }
}

function Landing() {
  const ref = useReveal();
  const [stats, setStats] = useState<{ hit: string; coins: number }>({ hit: "--", coins: 9 });
  useEffect(() => {
    setStats(readStats());
    const id = setInterval(() => setStats(readStats()), 60000);
    return () => clearInterval(id);
  }, []);

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
        <div className="brand">KELTOŞ</div>
        <div className="nav-links">
          <a href="#features">Özellikler</a>
          <a href="#how">Nasıl</a>
          <a href="#pricing">Üyelik</a>
          <a href="/keltos.html" className="nav-cta">Panele Gir</a>
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
              <div><b>%87</b><span>İsabet</span></div>
              <div><b>24/7</b><span>Canlı</span></div>
              <div><b>50+</b><span>Coin</span></div>
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
              <a href={WHATSAPP} target="_blank" rel="noreferrer" className="btn btn-primary plan-cta">
                💬 WhatsApp ile Al
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
.brand{font-weight:900;letter-spacing:.18em;background:linear-gradient(135deg,var(--gold),var(--gold2));-webkit-background-clip:text;background-clip:text;color:transparent;font-size:18px}
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
`;
