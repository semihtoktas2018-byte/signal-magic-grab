import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import {
  Activity,
  Brain,
  Cpu,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  Shield,
  Flame,
  Zap,
  BarChart3,
  Gauge,
  Waves,
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";

/* ============================================================
 * AI SIGNAL INTELLIGENCE CENTER
 * Self-contained premium dashboard (glassmorphism + gold)
 * Uses only demo data; does not touch existing logic.
 * ============================================================ */

type Trend = "Bullish" | "Bearish" | "Neutral";
type Vol = "Low" | "Medium" | "High";
type Mom = "Weak" | "Normal" | "Strong";
type Status = "OPEN" | "HIT TP" | "STOP" | "WAITING";

interface PulseRow {
  coin: string;
  trend: Trend;
  confidence: number;
  volatility: Vol;
  momentum: Mom;
}

interface LiveSignal {
  coin: string;
  dir: "LONG" | "SHORT";
  entry: number;
  tp: number;
  sl: number;
  risk: "Low" | "Med" | "High";
  confidence: number;
  status: Status;
}

interface WhaleTx {
  side: "Buy" | "Sell";
  coin: string;
  amount: string;
  ago: string;
}

const PULSE: PulseRow[] = [
  { coin: "BTC", trend: "Bullish", confidence: 92, volatility: "Medium", momentum: "Strong" },
  { coin: "ETH", trend: "Bullish", confidence: 84, volatility: "Medium", momentum: "Normal" },
  { coin: "SOL", trend: "Bullish", confidence: 88, volatility: "High", momentum: "Strong" },
  { coin: "BNB", trend: "Neutral", confidence: 61, volatility: "Low", momentum: "Normal" },
  { coin: "XRP", trend: "Bearish", confidence: 47, volatility: "Medium", momentum: "Weak" },
];

const SIGNALS: LiveSignal[] = [
  { coin: "BTCUSDT", dir: "LONG", entry: 68420, tp: 71800, sl: 66900, risk: "Low", confidence: 92, status: "OPEN" },
  { coin: "ETHUSDT", dir: "LONG", entry: 3542, tp: 3720, sl: 3465, risk: "Med", confidence: 84, status: "HIT TP" },
  { coin: "SOLUSDT", dir: "LONG", entry: 168.2, tp: 178.5, sl: 163.1, risk: "Med", confidence: 88, status: "OPEN" },
  { coin: "BNBUSDT", dir: "SHORT", entry: 612.4, tp: 592.0, sl: 622.9, risk: "Low", confidence: 71, status: "WAITING" },
  { coin: "LINKUSDT", dir: "LONG", entry: 15.42, tp: 16.9, sl: 14.85, risk: "Med", confidence: 79, status: "OPEN" },
  { coin: "AVAXUSDT", dir: "SHORT", entry: 34.2, tp: 32.5, sl: 35.4, risk: "High", confidence: 66, status: "STOP" },
  { coin: "DOGEUSDT", dir: "LONG", entry: 0.164, tp: 0.178, sl: 0.157, risk: "High", confidence: 58, status: "WAITING" },
  { coin: "XRPUSDT", dir: "SHORT", entry: 0.612, tp: 0.585, sl: 0.628, risk: "Med", confidence: 62, status: "OPEN" },
  { coin: "ADAUSDT", dir: "LONG", entry: 0.482, tp: 0.512, sl: 0.468, risk: "Low", confidence: 74, status: "HIT TP" },
  { coin: "MATICUSDT", dir: "LONG", entry: 0.712, tp: 0.755, sl: 0.688, risk: "Med", confidence: 69, status: "OPEN" },
];

const WHALES: WhaleTx[] = [
  { side: "Buy", coin: "BTC", amount: "+18.4M", ago: "2 dk önce" },
  { side: "Sell", coin: "ETH", amount: "-9.1M", ago: "5 dk önce" },
  { side: "Buy", coin: "SOL", amount: "+6.3M", ago: "11 dk önce" },
  { side: "Buy", coin: "LINK", amount: "+2.8M", ago: "17 dk önce" },
  { side: "Sell", coin: "AVAX", amount: "-4.2M", ago: "24 dk önce" },
];

const AI_ANALYSIS = [
  "Bitcoin momentum remains bullish.",
  "RSI continues above 60.",
  "Whale accumulation detected.",
  "Funding rates remain healthy.",
  "Expected upside: +4.8%",
  "Confidence: 91%",
];

/* ---------- helpers ---------- */
function trendColor(t: Trend) {
  return t === "Bullish" ? "#22c55e" : t === "Bearish" ? "#ef4444" : "#f5b629";
}
function TrendIcon({ t }: { t: Trend }) {
  const c = trendColor(t);
  if (t === "Bullish") return <TrendingUp size={14} color={c} />;
  if (t === "Bearish") return <TrendingDown size={14} color={c} />;
  return <Minus size={14} color={c} />;
}
function statusColor(s: Status) {
  if (s === "OPEN") return "#22c55e";
  if (s === "HIT TP") return "#f5b629";
  if (s === "STOP") return "#ef4444";
  return "#8a93a3";
}
function statusIcon(s: Status) {
  const c = statusColor(s);
  if (s === "OPEN") return <Activity size={12} color={c} />;
  if (s === "HIT TP") return <CheckCircle2 size={12} color={c} />;
  if (s === "STOP") return <XCircle size={12} color={c} />;
  return <Clock size={12} color={c} />;
}
function riskColor(r: LiveSignal["risk"]) {
  return r === "Low" ? "#22c55e" : r === "Med" ? "#f5b629" : "#ef4444";
}
function fmt(n: number) {
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 1 });
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(4);
}

/* ---------- Typing analysis ---------- */
function useTypingLines(lines: string[]) {
  const [rendered, setRendered] = useState<string[]>([]);
  const [current, setCurrent] = useState("");
  useEffect(() => {
    let li = 0;
    let ci = 0;
    let localRendered: string[] = [];
    let raf: number;
    const tick = () => {
      if (li >= lines.length) return;
      const line = lines[li];
      ci++;
      setCurrent(line.slice(0, ci));
      if (ci >= line.length) {
        localRendered = [...localRendered, line];
        setRendered(localRendered);
        setCurrent("");
        li++;
        ci = 0;
        raf = window.setTimeout(tick, 380) as unknown as number;
      } else {
        raf = window.setTimeout(tick, 28) as unknown as number;
      }
    };
    raf = window.setTimeout(tick, 400) as unknown as number;
    return () => window.clearTimeout(raf);
  }, [lines]);
  return { rendered, current };
}

/* ---------- Performance chart (SVG stroke draw) ---------- */
function PerfChart() {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const points = useMemo(() => {
    // demo cumulative ROI
    const raw = [0, 1.2, 2.4, 2.1, 3.5, 4.8, 4.2, 5.6, 7.1, 6.8, 8.2, 9.5, 9.1, 10.6, 12.1, 11.7, 13.4, 14.8];
    const w = 800, h = 220, pad = 20;
    const min = Math.min(...raw), max = Math.max(...raw);
    const dx = (w - pad * 2) / (raw.length - 1);
    return raw.map((v, i) => {
      const x = pad + i * dx;
      const y = h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2);
      return [x, y] as const;
    });
  }, []);
  const d = points.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(" ");
  const area = `${d} L${points[points.length - 1][0]},220 L${points[0][0]},220 Z`;
  return (
    <svg ref={ref} viewBox="0 0 800 220" className="aic-chart" preserveAspectRatio="none">
      <defs>
        <linearGradient id="aic-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f5b629" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#f5b629" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="aic-stroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ffd76a" />
          <stop offset="100%" stopColor="#f5b629" />
        </linearGradient>
      </defs>
      {[40, 90, 140, 190].map((y) => (
        <line key={y} x1="0" x2="800" y1={y} y2={y} stroke="rgba(255,255,255,0.05)" />
      ))}
      <path d={area} fill="url(#aic-fill)" style={{ opacity: inView ? 1 : 0, transition: "opacity 1.4s ease 0.6s" }} />
      <path
        d={d}
        fill="none"
        stroke="url(#aic-stroke)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          strokeDasharray: 2400,
          strokeDashoffset: inView ? 0 : 2400,
          transition: "stroke-dashoffset 2.2s cubic-bezier(.6,.05,.2,1)",
          filter: "drop-shadow(0 0 8px rgba(245,182,41,.5))",
        }}
      />
      {inView && points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.5" fill="#ffd76a" style={{ opacity: 0, animation: `aicDot .4s ease ${1.6 + i * 0.06}s forwards` }} />
      ))}
    </svg>
  );
}

/* ---------- Sentiment gauge ---------- */
function SentimentGauge({ value }: { value: number }) {
  // value 0..100
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const from = 0;
    const dur = 1600;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  const angle = -90 + (display / 100) * 180;
  const label = display < 33 ? "Fear" : display < 66 ? "Neutral" : "Greed";
  const labelColor = display < 33 ? "#ef4444" : display < 66 ? "#f5b629" : "#22c55e";
  return (
    <div className="aic-gauge">
      <svg viewBox="0 0 220 130" className="aic-gauge-svg">
        <defs>
          <linearGradient id="aic-gauge-arc" x1="0" x2="1">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="50%" stopColor="#f5b629" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
        </defs>
        <path d="M20 110 A90 90 0 0 1 200 110" fill="none" stroke="url(#aic-gauge-arc)" strokeWidth="14" strokeLinecap="round" />
        <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: "110px 110px", transition: "transform .12s linear" }}>
          <line x1="110" y1="110" x2="110" y2="34" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
          <circle cx="110" cy="110" r="7" fill="#f5b629" stroke="#000" strokeWidth="2" />
        </g>
        <text x="30" y="128" fill="#8a93a3" fontSize="10" fontWeight="700">FEAR</text>
        <text x="102" y="16" fill="#8a93a3" fontSize="10" fontWeight="700">NEUTRAL</text>
        <text x="168" y="128" fill="#8a93a3" fontSize="10" fontWeight="700">GREED</text>
      </svg>
      <div className="aic-gauge-val">{display}</div>
      <div className="aic-gauge-lbl" style={{ color: labelColor }}>{label}</div>
    </div>
  );
}

/* ---------- Section wrapper animation ---------- */
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.2, 0.7, 0.2, 1] as const, delay: i * 0.06 },
  }),
};

export default function AISignalIntelligence() {
  const { rendered, current } = useTypingLines(AI_ANALYSIS);

  const perf = {
    signals: 42,
    wins: 31,
    losses: 8,
    avgRR: "1 : 2.4",
    success: "79%",
    roi: "+18.6%",
  };

  return (
    <section className="aic" aria-label="AI Signal Intelligence Center">
      <style>{aicCss}</style>
      <div className="aic-bg" aria-hidden />
      <div className="aic-wrap">
        <motion.div
          className="aic-head"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={fadeUp}
        >
          <span className="aic-eyebrow">
            <Sparkles size={12} /> AI SIGNAL INTELLIGENCE CENTER
          </span>
          <h2>Yapay Zeka Destekli Piyasa Kontrol Merkezi</h2>
          <p>Canlı sinyaller, akıllı para akışı, momentum ve balina hareketleri tek bir premium terminalde.</p>
        </motion.div>

        {/* Top grid: pulse / signals / analysis */}
        <div className="aic-top">
          {/* Market Pulse */}
          <motion.div
            className="glass aic-pulse"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={fadeUp}
          >
            <div className="aic-title">
              <Waves size={16} /> Market Pulse
              <span className="aic-live"><span className="aic-live-dot" /> LIVE</span>
            </div>
            <div className="aic-pulse-list">
              {PULSE.map((p, i) => (
                <motion.div
                  key={p.coin}
                  className="aic-pulse-row"
                  custom={i}
                  variants={fadeUp}
                >
                  <div className="aic-pulse-coin">{p.coin}</div>
                  <div className="aic-pulse-trend" style={{ color: trendColor(p.trend) }}>
                    <TrendIcon t={p.trend} /> {p.trend}
                  </div>
                  <div className="aic-pulse-conf">
                    <div className="aic-conf-bar">
                      <div className="aic-conf-fill" style={{ width: `${p.confidence}%` }} />
                    </div>
                    <span>{p.confidence}%</span>
                  </div>
                  <div className={`aic-chip vol-${p.volatility.toLowerCase()}`}>{p.volatility}</div>
                  <div className={`aic-chip mom-${p.momentum.toLowerCase()}`}>{p.momentum}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Live Signals table */}
          <motion.div
            className="glass aic-signals"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
            variants={fadeUp}
          >
            <div className="aic-title">
              <Zap size={16} /> Live Signals
              <span className="aic-live"><span className="aic-live-dot" /> STREAMING</span>
            </div>
            <div className="aic-table-scroll">
              <table className="aic-table">
                <thead>
                  <tr>
                    <th>Coin</th>
                    <th>Dir</th>
                    <th>Entry</th>
                    <th>TP</th>
                    <th>SL</th>
                    <th>Risk</th>
                    <th>Conf</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {SIGNALS.map((s, i) => (
                    <motion.tr key={s.coin + i} custom={i} variants={fadeUp}>
                      <td className="aic-td-coin" data-label="Coin">{s.coin.replace("USDT", "")}<span className="aic-td-quote">/USDT</span></td>
                      <td data-label="Dir">
                        <span className="aic-dir" style={{
                          background: s.dir === "LONG" ? "rgba(34,197,94,.15)" : "rgba(239,68,68,.15)",
                          color: s.dir === "LONG" ? "#22c55e" : "#ef4444",
                        }}>{s.dir}</span>
                      </td>
                      <td data-label="Entry">{fmt(s.entry)}</td>
                      <td data-label="TP" style={{ color: "#22c55e" }}>{fmt(s.tp)}</td>
                      <td data-label="SL" style={{ color: "#ef4444" }}>{fmt(s.sl)}</td>
                      <td data-label="Risk"><span className="aic-risk" style={{ color: riskColor(s.risk) }}>{s.risk}</span></td>
                      <td data-label="Conf">
                        <div className="aic-conf-mini">
                          <div className="aic-conf-mini-fill" style={{ width: `${s.confidence}%` }} />
                          <span>{s.confidence}%</span>
                        </div>
                      </td>
                      <td data-label="Status">
                        <span className="aic-status" style={{ color: statusColor(s.status), borderColor: statusColor(s.status) + "44", background: statusColor(s.status) + "18" }}>
                          {statusIcon(s.status)} {s.status}
                        </span>
                      </td>

                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* AI Market Analysis */}
          <motion.div
            className="glass aic-analysis"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={fadeUp}
          >
            <div className="aic-title">
              <Brain size={16} /> AI Market Analysis
              <span className="aic-live"><span className="aic-live-dot" /> AI</span>
            </div>
            <div className="aic-analysis-body">
              {rendered.map((l, i) => (
                <div key={i} className="aic-line">
                  <span className="aic-line-dot" /> {l}
                </div>
              ))}
              {current && (
                <div className="aic-line">
                  <span className="aic-line-dot" /> {current}
                  <span className="aic-caret">▍</span>
                </div>
              )}
              <div className="aic-analysis-foot">
                <div>
                  <span className="aic-analysis-lbl">Expected Upside</span>
                  <span className="aic-analysis-val up">+4.8%</span>
                </div>
                <div>
                  <span className="aic-analysis-lbl">Confidence</span>
                  <span className="aic-analysis-val gold">91%</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Today's Performance */}
        <motion.div
          className="aic-perf-head"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={fadeUp}
        >
          <BarChart3 size={16} /> Today's Performance
        </motion.div>
        <div className="aic-perf-grid">
          {[
            { icon: <Activity size={16} />, label: "Today's Signals", value: perf.signals, color: "#f5b629" },
            { icon: <CheckCircle2 size={16} />, label: "Winning Trades", value: perf.wins, color: "#22c55e" },
            { icon: <XCircle size={16} />, label: "Losing Trades", value: perf.losses, color: "#ef4444" },
            { icon: <Target size={16} />, label: "Average RR", value: perf.avgRR, color: "#8b5cf6" },
            { icon: <Gauge size={16} />, label: "Success Rate", value: perf.success, color: "#22c55e" },
            { icon: <TrendingUp size={16} />, label: "Net ROI", value: perf.roi, color: "#f5b629" },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              className="glass aic-stat"
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={fadeUp}
            >
              <span className="aic-stat-icon" style={{ color: s.color, background: s.color + "18", borderColor: s.color + "33" }}>
                {s.icon}
              </span>
              <div className="aic-stat-txt">
                <div className="aic-stat-lbl">{s.label}</div>
                <div className="aic-stat-val" style={{ color: s.color }}>{s.value}</div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Performance Chart */}
        <motion.div
          className="glass aic-chart-card"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          variants={fadeUp}
        >
          <div className="aic-title">
            <Cpu size={16} /> Performance Chart
            <span className="aic-live"><span className="aic-live-dot" /> LIVE</span>
          </div>
          <PerfChart />
          <div className="aic-chart-foot">
            <span>7D</span><span>1M</span><span className="on">3M</span><span>YTD</span><span>ALL</span>
          </div>
        </motion.div>

        {/* Bottom: whales + sentiment */}
        <div className="aic-bottom">
          <motion.div
            className="glass aic-whales"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={fadeUp}
          >
            <div className="aic-title">
              <Flame size={16} /> Whale Activity
              <span className="aic-live"><span className="aic-live-dot" /> LIVE</span>
            </div>
            <div className="aic-whale-list">
              {WHALES.map((w, i) => (
                <motion.div key={i} className="aic-whale" custom={i} variants={fadeUp}>
                  <span className="aic-whale-emoji">🐋</span>
                  <div className="aic-whale-txt">
                    <div className="aic-whale-line">
                      <b style={{ color: w.side === "Buy" ? "#22c55e" : "#ef4444" }}>
                        Whale {w.side}
                      </b>
                      <span className="aic-whale-coin">{w.coin}</span>
                    </div>
                    <div className="aic-whale-sub">{w.ago}</div>
                  </div>
                  <div className="aic-whale-amt" style={{ color: w.side === "Buy" ? "#22c55e" : "#ef4444" }}>
                    {w.amount}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            className="glass aic-sentiment"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={fadeUp}
          >
            <div className="aic-title">
              <Shield size={16} /> AI Market Sentiment
              <span className="aic-live"><span className="aic-live-dot" /> LIVE</span>
            </div>
            <SentimentGauge value={72} />
            <div className="aic-sent-foot">
              Piyasa şu an <b style={{ color: "#22c55e" }}>Greed</b> bölgesinde. AI temkinli iyimser.
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
 * Scoped CSS — gold + glass premium
 * ============================================================ */
const aicCss = `
.aic{position:relative;padding:60px 24px 72px;overflow:hidden}
.aic *{box-sizing:border-box}
.aic-bg{position:absolute;inset:0;pointer-events:none;background:
  radial-gradient(45% 40% at 15% 20%,rgba(245,182,41,.10),transparent 60%),
  radial-gradient(40% 35% at 85% 60%,rgba(139,92,246,.08),transparent 60%),
  radial-gradient(60% 40% at 50% 100%,rgba(34,197,94,.06),transparent 60%);}
.aic-wrap{position:relative;max-width:1320px;margin:0 auto}

.aic-eyebrow{display:inline-flex;align-items:center;gap:6px;font-size:11px;letter-spacing:.22em;color:#f5b629;padding:6px 14px;border:1px solid rgba(245,182,41,.25);border-radius:999px;background:rgba(245,182,41,.06);font-weight:800;margin-bottom:14px}
.aic-head{text-align:center;margin-bottom:34px}
.aic-head h2{font-size:clamp(24px,3.6vw,38px);margin:0 0 8px;font-weight:900;background:linear-gradient(135deg,#f5b629,#ffd76a);-webkit-background-clip:text;background-clip:text;color:transparent}
.aic-head p{color:#8a93a3;margin:0;font-size:14px;max-width:640px;margin-inline:auto}

.glass{position:relative;background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.02));border:1px solid rgba(245,182,41,.18);border-radius:20px;padding:18px;backdrop-filter:blur(14px) saturate(140%);-webkit-backdrop-filter:blur(14px) saturate(140%);box-shadow:0 20px 50px -30px rgba(245,182,41,.35),inset 0 1px 0 rgba(255,255,255,.05);transition:border-color .3s,box-shadow .3s,transform .3s}
.glass::before{content:"";position:absolute;inset:0;border-radius:20px;padding:1px;background:linear-gradient(135deg,rgba(245,182,41,.35),transparent 40%,transparent 60%,rgba(245,182,41,.2));-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none;opacity:.6}
.glass:hover{border-color:rgba(245,182,41,.4);box-shadow:0 30px 70px -30px rgba(245,182,41,.55),inset 0 1px 0 rgba(255,255,255,.06)}

.aic-title{display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#f5b629;margin-bottom:14px}
.aic-live{margin-left:auto;display:inline-flex;align-items:center;gap:6px;font-size:9.5px;letter-spacing:.15em;color:#8a93a3;padding:3px 8px;border:1px solid rgba(255,255,255,.08);border-radius:999px;background:rgba(255,255,255,.03)}
.aic-live-dot{width:6px;height:6px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 0 rgba(34,197,94,.6);animation:aicPulse 1.6s infinite}
@keyframes aicPulse{0%{box-shadow:0 0 0 0 rgba(34,197,94,.55)}70%{box-shadow:0 0 0 7px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}

/* top grid */
.aic-top{display:grid;grid-template-columns:1fr 1.35fr 1fr;gap:18px;margin-bottom:26px}
@media(max-width:1080px){.aic-top{grid-template-columns:1fr 1fr}.aic-analysis{grid-column:span 2}}
@media(max-width:720px){.aic-top{grid-template-columns:1fr}.aic-analysis{grid-column:auto}}

/* pulse */
.aic-pulse-list{display:flex;flex-direction:column;gap:8px}
.aic-pulse-row{display:grid;grid-template-columns:44px 1fr 1.4fr auto auto;gap:10px;align-items:center;padding:10px 12px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.05);border-radius:12px;transition:background .2s,border-color .2s,transform .2s}
.aic-pulse-row:hover{background:rgba(245,182,41,.06);border-color:rgba(245,182,41,.35);transform:translateX(2px)}
.aic-pulse-coin{font-weight:900;font-size:13px;color:#f0f4fa;letter-spacing:.03em}
.aic-pulse-trend{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:800}
.aic-pulse-conf{display:flex;align-items:center;gap:8px;min-width:0}
.aic-pulse-conf span{font-size:11px;font-weight:800;color:#f5b629;min-width:32px;text-align:right}
@media(max-width:560px){.aic-pulse-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px}.aic-pulse-coin{min-width:46px}.aic-pulse-conf{order:3;flex:1 1 100%}}
.aic-conf-bar{position:relative;flex:1;height:6px;border-radius:999px;background:rgba(255,255,255,.06);overflow:hidden}
.aic-conf-fill{position:absolute;left:0;top:0;height:100%;background:linear-gradient(90deg,#f5b629,#ffd76a);box-shadow:0 0 8px rgba(245,182,41,.6)}
.aic-chip{font-size:10px;font-weight:800;padding:3px 8px;border-radius:6px;letter-spacing:.04em;border:1px solid transparent;white-space:nowrap}
.vol-low{color:#22c55e;background:rgba(34,197,94,.12);border-color:rgba(34,197,94,.3)}
.vol-medium{color:#f5b629;background:rgba(245,182,41,.12);border-color:rgba(245,182,41,.3)}
.vol-high{color:#ef4444;background:rgba(239,68,68,.12);border-color:rgba(239,68,68,.3)}
.mom-weak{color:#8a93a3;background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.1)}
.mom-normal{color:#60a5fa;background:rgba(96,165,250,.12);border-color:rgba(96,165,250,.3)}
.mom-strong{color:#22c55e;background:rgba(34,197,94,.12);border-color:rgba(34,197,94,.3)}

/* signals table */
.aic-signals{min-width:0}
.aic-table-scroll{overflow-x:auto;margin:0 -6px;padding:0 6px}
.aic-table{width:100%;border-collapse:separate;border-spacing:0 4px;font-size:12.5px;min-width:640px}
.aic-table thead th{text-align:left;padding:8px 10px;font-size:10.5px;letter-spacing:.14em;color:#8a93a3;font-weight:800;text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,.06)}
.aic-table tbody tr{background:rgba(255,255,255,.02);transition:background .2s,box-shadow .2s,transform .2s}
.aic-table tbody tr:hover{background:rgba(245,182,41,.07);box-shadow:0 8px 24px -12px rgba(245,182,41,.55),inset 0 0 0 1px rgba(245,182,41,.35);transform:translateX(2px)}
.aic-table tbody td{padding:10px;font-weight:700;color:#f0f4fa;border-top:1px solid rgba(255,255,255,.04);border-bottom:1px solid rgba(255,255,255,.04)}
.aic-table tbody td:first-child{border-left:1px solid rgba(255,255,255,.04);border-radius:10px 0 0 10px}
.aic-table tbody td:last-child{border-right:1px solid rgba(255,255,255,.04);border-radius:0 10px 10px 0}
.aic-td-coin{font-weight:900}
.aic-td-quote{color:#8a93a3;font-weight:600;font-size:11px}
.aic-dir{font-size:10.5px;font-weight:800;padding:3px 8px;border-radius:6px;letter-spacing:.04em}
.aic-risk{font-size:11.5px;font-weight:800}
.aic-conf-mini{display:flex;align-items:center;gap:6px;min-width:80px}
.aic-conf-mini{position:relative;height:16px;border-radius:6px;background:rgba(255,255,255,.05);overflow:hidden;padding:0 6px}
.aic-conf-mini-fill{position:absolute;left:0;top:0;height:100%;background:linear-gradient(90deg,rgba(245,182,41,.35),rgba(245,182,41,.15));border-right:1px solid rgba(245,182,41,.6)}
.aic-conf-mini span{position:relative;font-size:10.5px;font-weight:800;color:#f5b629;line-height:16px}
.aic-status{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:800;padding:3px 8px;border-radius:999px;border:1px solid;letter-spacing:.04em;white-space:nowrap}

/* analysis */
.aic-analysis-body{display:flex;flex-direction:column;gap:10px}
.aic-line{display:flex;align-items:flex-start;gap:8px;font-size:13px;color:#dfe4ec;line-height:1.5;font-family:'JetBrains Mono',ui-monospace,monospace}
.aic-line-dot{width:6px;height:6px;border-radius:50%;background:#f5b629;box-shadow:0 0 6px rgba(245,182,41,.7);margin-top:6px;flex:none}
.aic-caret{color:#f5b629;animation:aicCaret 1s steps(1) infinite;margin-left:2px}
@keyframes aicCaret{50%{opacity:0}}
.aic-analysis-foot{margin-top:6px;padding-top:12px;border-top:1px dashed rgba(245,182,41,.2);display:grid;grid-template-columns:1fr 1fr;gap:10px}
.aic-analysis-foot>div{display:flex;flex-direction:column;gap:2px}
.aic-analysis-lbl{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#8a93a3;font-weight:700}
.aic-analysis-val{font-size:20px;font-weight:900}
.aic-analysis-val.up{color:#22c55e}
.aic-analysis-val.gold{color:#f5b629}

/* perf */
.aic-perf-head{display:inline-flex;align-items:center;gap:8px;font-size:12.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#f5b629;margin:6px 4px 12px}
.aic-perf-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-bottom:22px}
@media(max-width:980px){.aic-perf-grid{grid-template-columns:repeat(3,1fr)}}
@media(max-width:560px){.aic-perf-grid{grid-template-columns:repeat(2,1fr)}}
.aic-stat{display:flex;align-items:center;gap:12px;padding:14px}
.aic-stat-icon{display:grid;place-items:center;width:36px;height:36px;border-radius:10px;border:1px solid}
.aic-stat-txt{min-width:0}
.aic-stat-lbl{font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:#8a93a3;font-weight:700}
.aic-stat-val{font-size:20px;font-weight:900;margin-top:2px}

/* chart card */
.aic-chart-card{margin-bottom:26px}
.aic-chart{display:block;width:100%;height:220px}
.aic-chart-foot{display:flex;justify-content:flex-end;gap:14px;margin-top:6px;font-size:11px;color:#8a93a3;font-weight:700;letter-spacing:.08em}
.aic-chart-foot .on{color:#f5b629}
@keyframes aicDot{to{opacity:1}}

/* bottom */
.aic-bottom{display:grid;grid-template-columns:1.4fr 1fr;gap:18px}
@media(max-width:820px){.aic-bottom{grid-template-columns:1fr}}
.aic-whale-list{display:flex;flex-direction:column;gap:8px}
.aic-whale{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;padding:10px 12px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.05);border-radius:12px;transition:background .2s,transform .2s,border-color .2s}
.aic-whale:hover{background:rgba(245,182,41,.06);border-color:rgba(245,182,41,.35);transform:translateX(2px)}
.aic-whale-emoji{font-size:20px;filter:drop-shadow(0 0 6px rgba(96,165,250,.5))}
.aic-whale-line{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:800}
.aic-whale-coin{color:#f0f4fa;background:rgba(245,182,41,.1);border:1px solid rgba(245,182,41,.3);padding:1px 8px;border-radius:6px;font-size:11px}
.aic-whale-sub{font-size:11px;color:#8a93a3;margin-top:2px}
.aic-whale-amt{font-size:15px;font-weight:900;font-family:'JetBrains Mono',ui-monospace,monospace}

/* gauge */
.aic-gauge{position:relative;display:flex;flex-direction:column;align-items:center;padding:8px 0 4px}
.aic-gauge-svg{width:100%;max-width:280px;height:auto}
.aic-gauge-val{font-size:36px;font-weight:900;background:linear-gradient(135deg,#f5b629,#ffd76a);-webkit-background-clip:text;background-clip:text;color:transparent;margin-top:-14px}
.aic-gauge-lbl{font-size:11.5px;letter-spacing:.18em;font-weight:800;text-transform:uppercase;margin-top:2px}
.aic-sent-foot{margin-top:12px;padding-top:12px;border-top:1px dashed rgba(245,182,41,.2);font-size:12.5px;color:#8a93a3;text-align:center}
`;
