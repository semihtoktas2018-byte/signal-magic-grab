import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import {
  Activity,
  Brain,
  Cpu,
  TrendingUp,
  Target,
  Shield,
  Flame,
  Zap,
  BarChart3,
  Waves,
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";

/* ============================================================
 * AI SIGNAL INTELLIGENCE CENTER
 * Tüm veriler gerçek kaynaklardan gelir:
 *  - exchange_prices  (canlı Bybit/OKX fiyatları)
 *  - kpk_signals      (üretilmiş gerçek sinyaller + sonuçları)
 *  - whale_events     (gerçek balina işlemleri)
 * Gerçek kaynağı olmayan hiçbir kutuda uydurma değer gösterilmez.
 * Sinyal motoru, skorlama ve trading mantığı bu dosyada YOKTUR.
 * ============================================================ */

interface SignalRow {
  id: string;
  coin: string;
  signal: string;
  score: number;
  quality: string | null;
  price: number;
  result: string;
  created_at: string;
}
interface PriceRow {
  coin: string;
  bybit_price: number;
  okx_price: number;
  diff_pct: number;
  updated_at: string;
}
interface WhaleRow {
  id: string;
  coin: string;
  side: string;
  amount_usd: number;
  created_at: string;
}

/* TP/SL oranları cron (sinyal motoru) ile aynıdır — türetilmiş, uydurma değil */
const TP_PCT = 0.025;
const SL_PCT = 0.02;

/* ---------- helpers ---------- */
function fmt(n: number) {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 1 });
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(4);
}
function statusColor(s: string) {
  if (s === "tuttu") return "#22c55e";
  if (s === "tutmadi") return "#ef4444";
  return "#8a93a3";
}
function statusIcon(s: string) {
  const c = statusColor(s);
  if (s === "tuttu") return <CheckCircle2 size={12} color={c} />;
  if (s === "tutmadi") return <XCircle size={12} color={c} />;
  return <Clock size={12} color={c} />;
}
function statusText(s: string) {
  if (s === "tuttu") return "HEDEF";
  if (s === "tutmadi") return "STOP";
  return "BEKLİYOR";
}
function timeAgo(iso: string) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "az önce";
  if (m < 60) return `${m} dk önce`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} sa önce`;
  return `${Math.round(h / 24)} gün önce`;
}
function stamp(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/* ---------- boş durum ---------- */
function NoData({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: "22px 16px",
        textAlign: "center",
        fontSize: 12.5,
        lineHeight: 1.6,
        color: "#8a93a3",
        background: "rgba(255,255,255,.02)",
        border: "1px dashed rgba(245,182,41,.18)",
        borderRadius: 12,
      }}
    >
      {text}
    </div>
  );
}

/* ---------- gerçek veri yükleyici ---------- */
function useRealData() {
  const [prices, setPrices] = useState<PriceRow[] | null>(null);
  const [signals, setSignals] = useState<SignalRow[] | null>(null);
  const [whales, setWhales] = useState<WhaleRow[] | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [p, s, w] = await Promise.all([
        supabase.from("exchange_prices").select("coin,bybit_price,okx_price,diff_pct,updated_at"),
        supabase
          .from("kpk_signals")
          .select("id,coin,signal,score,quality,price,result,created_at")
          .order("created_at", { ascending: false })
          .limit(300),
        supabase
          .from("whale_events")
          .select("id,coin,side,amount_usd,created_at")
          .order("created_at", { ascending: false })
          .limit(8),
      ]);
      if (cancelled) return;
      setPrices((p.data as PriceRow[] | null) ?? []);
      setSignals((s.data as SignalRow[] | null) ?? []);
      setWhales((w.data as WhaleRow[] | null) ?? []);
      setLoaded(true);
    };
    load();
    const id = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return { prices, signals, whales, loaded };
}

/* ---------- Performance chart: gerçek kapanmış sinyallerden kümülatif net ---------- */
function PerfChart({ series }: { series: number[] }) {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const points = useMemo(() => {
    const raw = series;
    const w = 800, h = 220, pad = 20;
    const min = Math.min(...raw), max = Math.max(...raw);
    const dx = (w - pad * 2) / Math.max(1, raw.length - 1);
    return raw.map((v, i) => {
      const x = pad + i * dx;
      const y = h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2);
      return [x, y] as const;
    });
  }, [series]);
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
  const { prices, signals, whales, loaded } = useRealData();

  const priceRows = (prices ?? []).slice().sort((a, b) => Math.abs(Number(b.diff_pct)) - Math.abs(Number(a.diff_pct)));
  const lastPriceUpdate = priceRows.length
    ? priceRows.reduce((m, r) => (r.updated_at > m ? r.updated_at : m), priceRows[0].updated_at)
    : null;

  const allSignals = signals ?? [];
  const recentSignals = allSignals.slice(0, 10);
  const lastSignalAt = allSignals.length ? allSignals[0].created_at : null;

  /* Bugünkü performans — sadece kayıtlı gerçek sinyaller */
  const todayKey = new Date().toISOString().slice(0, 10);
  const today = allSignals.filter((s) => s.created_at.slice(0, 10) === todayKey);
  const tWin = today.filter((s) => s.result === "tuttu").length;
  const tLoss = today.filter((s) => s.result === "tutmadi").length;
  const tWait = today.filter((s) => s.result === "bekliyor").length;
  const tClosed = tWin + tLoss;

  /* Kümülatif net (tuttu -1/+1) — gerçek kapanmış sinyallerden */
  const closedAsc = allSignals
    .filter((s) => s.result === "tuttu" || s.result === "tutmadi")
    .slice()
    .reverse();
  const series = useMemo(() => {
    let acc = 0;
    return [0, ...closedAsc.map((s) => (acc += s.result === "tuttu" ? 1 : -1))];
  }, [closedAsc.length]);

  const whaleRows = whales ?? [];

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
          <p>Tüm veriler gerçek kaynaklardan gelir. Veri yoksa kutu boş kalır — tahmini sayı gösterilmez.</p>
        </motion.div>

        {/* Top grid: canlı fiyatlar / sinyaller / analiz */}
        <div className="aic-top">
          {/* Canlı borsa fiyatları (exchange_prices) */}
          <motion.div
            className="glass aic-pulse"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={fadeUp}
          >
            <div className="aic-title">
              <Waves size={16} /> Canlı Fiyat / Fark
              {priceRows.length > 0 && <span className="aic-live"><span className="aic-live-dot" /> LIVE</span>}
            </div>
            {!loaded ? (
              <NoData text="Yükleniyor..." />
            ) : priceRows.length === 0 ? (
              <NoData text="Veri mevcut değil — borsa fiyat kaydı bulunamadı." />
            ) : (
              <>
                <div className="aic-pulse-list">
                  {priceRows.slice(0, 6).map((p, i) => {
                    const diff = Number(p.diff_pct);
                    const col = diff >= 0 ? "#22c55e" : "#ef4444";
                    return (
                      <div key={p.coin} className="aic-pulse-row">
                        <div className="aic-pulse-coin">{p.coin.replace("USDT", "")}</div>
                        <div className="aic-pulse-trend" style={{ color: "#f0f4fa" }}>
                          Bybit {fmt(Number(p.bybit_price))}
                        </div>
                        <div className="aic-pulse-conf">
                          <span style={{ color: "#8a93a3", minWidth: 0 }}>OKX {fmt(Number(p.okx_price))}</span>
                        </div>
                        <div className="aic-chip" style={{ color: col, background: col + "1f", borderColor: col + "4d" }}>
                          {diff >= 0 ? "+" : ""}{diff.toFixed(2)}%
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="aic-sent-foot" style={{ marginTop: 10, paddingTop: 10 }}>
                  Son güncelleme: {stamp(lastPriceUpdate)}
                </div>
              </>
            )}
          </motion.div>

          {/* Kayıtlı sinyaller (kpk_signals) */}
          <motion.div
            className="glass aic-signals"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
            variants={fadeUp}
          >
            <div className="aic-title">
              <Zap size={16} /> Kayıtlı Sinyaller
              {recentSignals.length > 0 && <span className="aic-live"><span className="aic-live-dot" /> DB</span>}
            </div>
            {!loaded ? (
              <NoData text="Yükleniyor..." />
            ) : recentSignals.length === 0 ? (
              <NoData text="Veri mevcut değil — kayıtlı sinyal bulunamadı." />
            ) : (
              <>
                <div className="aic-table-scroll">
                  <table className="aic-table">
                    <thead>
                      <tr>
                        <th>Coin</th>
                        <th>Yön</th>
                        <th>Giriş</th>
                        <th>Hedef</th>
                        <th>Stop</th>
                        <th>Skor</th>
                        <th>Durum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentSignals.map((s, i) => {
                        const isBuy = s.signal === "BUY";
                        const entry = Number(s.price);
                        const tp = isBuy ? entry * (1 + TP_PCT) : entry * (1 - TP_PCT);
                        const sl = isBuy ? entry * (1 - SL_PCT) : entry * (1 + SL_PCT);
                        return (
                          <tr key={s.id}>
                            <td className="aic-td-coin" data-label="Coin">
                              {s.coin.replace("USDT", "")}<span className="aic-td-quote">/USDT</span>
                            </td>
                            <td data-label="Yön">
                              <span className="aic-dir" style={{
                                background: isBuy ? "rgba(34,197,94,.15)" : "rgba(239,68,68,.15)",
                                color: isBuy ? "#22c55e" : "#ef4444",
                              }}>{s.signal}</span>
                            </td>
                            <td data-label="Giriş">{fmt(entry)}</td>
                            <td data-label="Hedef" style={{ color: "#22c55e" }}>{fmt(tp)}</td>
                            <td data-label="Stop" style={{ color: "#ef4444" }}>{fmt(sl)}</td>
                            <td data-label="Skor">
                              <div className="aic-conf-mini">
                                <div className="aic-conf-mini-fill" style={{ width: `${Math.min(100, s.score)}%` }} />
                                <span>{s.score}</span>
                              </div>
                            </td>
                            <td data-label="Durum">
                              <span className="aic-status" style={{ color: statusColor(s.result), borderColor: statusColor(s.result) + "44", background: statusColor(s.result) + "18" }}>
                                {statusIcon(s.result)} {statusText(s.result)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="aic-sent-foot" style={{ marginTop: 8, paddingTop: 10 }}>
                  En son sinyal: {stamp(lastSignalAt)}
                </div>
              </>
            )}
          </motion.div>

        </div>

        {/* Bugünkü performans — sadece kayıtlı sinyaller */}
        <motion.div
          className="aic-perf-head"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={fadeUp}
        >
          <BarChart3 size={16} /> Bugünkü Performans
        </motion.div>
        {!loaded ? (
          <div style={{ marginBottom: 22 }}><NoData text="Yükleniyor..." /></div>
        ) : today.length === 0 ? (
          <div style={{ marginBottom: 22 }}>
            <NoData text="Bugün kayıtlı sinyal yok — performans hesaplanamaz." />
          </div>
        ) : (
          <div className="aic-perf-grid">
            {[
              { icon: <Activity size={16} />, label: "Bugünkü Sinyal", value: String(today.length), color: "#f5b629" },
              { icon: <CheckCircle2 size={16} />, label: "Hedefe Ulaşan", value: String(tWin), color: "#22c55e" },
              { icon: <XCircle size={16} />, label: "Stop Olan", value: String(tLoss), color: "#ef4444" },
              { icon: <Clock size={16} />, label: "Bekleyen", value: String(tWait), color: "#8a93a3" },
              { icon: <Target size={16} />, label: "Sonuçlanan", value: String(tClosed), color: "#8b5cf6" },
              {
                icon: <TrendingUp size={16} />,
                label: "İsabet Oranı",
                value: tClosed > 0 ? `${Math.round((tWin / tClosed) * 100)}%` : "Yetersiz veri",
                color: tClosed > 0 ? "#22c55e" : "#8a93a3",
              },
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
                  <div className="aic-stat-val" style={{ color: s.color, fontSize: s.value === "Yetersiz veri" ? 13 : undefined }}>{s.value}</div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Kümülatif sonuç grafiği */}
        <motion.div
          className="glass aic-chart-card"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          variants={fadeUp}
        >
          <div className="aic-title">
            <Cpu size={16} /> Kümülatif Sinyal Sonucu
          </div>
          {!loaded ? (
            <NoData text="Yükleniyor..." />
          ) : closedAsc.length < 3 ? (
            <NoData text="Yetersiz veri — grafik için en az 3 sonuçlanmış sinyal gerekiyor." />
          ) : (
            <>
              <PerfChart series={series} />
              <div className="aic-chart-foot">
                <span>{closedAsc.length} sonuçlanmış sinyal · net {series[series.length - 1] >= 0 ? "+" : ""}{series[series.length - 1]}</span>
              </div>
            </>
          )}
        </motion.div>

        {/* Balina hareketleri + sentiment */}
        <div className="aic-bottom">
          <motion.div
            className="glass aic-whales"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={fadeUp}
          >
            <div className="aic-title">
              <Flame size={16} /> Balina Hareketleri
              {whaleRows.length > 0 && <span className="aic-live"><span className="aic-live-dot" /> DB</span>}
            </div>
            {!loaded ? (
              <NoData text="Yükleniyor..." />
            ) : whaleRows.length === 0 ? (
              <NoData text="Gerçek whale verisi bağlantısı mevcut değil." />
            ) : (
              <div className="aic-whale-list">
                {whaleRows.map((w, i) => {
                  const buy = String(w.side).toUpperCase().startsWith("B") || String(w.side).toLowerCase() === "alım";
                  const amt = Number(w.amount_usd);
                  const amtTxt = `${buy ? "+" : "-"}${(Math.abs(amt) / 1_000_000).toFixed(2)}M`;
                  return (
                    <div key={w.id} className="aic-whale">
                      <span className="aic-whale-emoji">🐋</span>
                      <div className="aic-whale-txt">
                        <div className="aic-whale-line">
                          <b style={{ color: buy ? "#22c55e" : "#ef4444" }}>
                            Balina {buy ? "Alımı" : "Satışı"}
                          </b>
                          <span className="aic-whale-coin">{w.coin.replace("USDT", "")}</span>
                        </div>
                        <div className="aic-whale-sub">{timeAgo(w.created_at)} · {stamp(w.created_at)}</div>
                      </div>
                      <div className="aic-whale-amt" style={{ color: buy ? "#22c55e" : "#ef4444" }}>
                        {amtTxt}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>

          <motion.div
            className="glass aic-sentiment"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={fadeUp}
          >
            <div className="aic-title">
              <Shield size={16} /> Piyasa Duyarlılığı
            </div>
            <NoData text="Gerçek veri bağlantısı yok — duyarlılık endeksi kaynağı bağlı değil. Canlı Korku & Hırs endeksi sinyal terminalinde görüntülenir." />
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
.aic{position:relative;padding:28px 24px 60px;overflow:hidden}
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

/* ===== mobile polish: less vertical space, no overflow ===== */
@media(max-width:640px){
  .aic{padding:8px 14px 34px}
  .aic-head{margin-bottom:14px;text-align:left}
  .aic-eyebrow{margin-bottom:8px;font-size:10px;padding:4px 10px}
  .aic-head h2{font-size:21px;margin-bottom:6px}
  .aic-head p{font-size:12.5px;line-height:1.5;margin-inline:0}
  .aic-top{gap:12px;margin-bottom:14px}
  .glass{padding:13px;border-radius:16px}
  .glass::before{border-radius:16px}
  .glass:hover{transform:none}
  .aic-title{margin-bottom:10px;font-size:11.5px}
  .aic-pulse-list{gap:6px}
  .aic-pulse-row{padding:9px 10px}
  .aic-perf-head{margin:2px 2px 10px}
  .aic-perf-grid{gap:10px;margin-bottom:14px}
  .aic-stat{padding:11px;gap:10px}
  .aic-stat-icon{width:30px;height:30px}
  .aic-stat-val{font-size:17px}
  .aic-chart-card{margin-bottom:14px}
  .aic-chart{height:170px}
  .aic-bottom{gap:12px}
  .aic-analysis-val{font-size:17px}
  .aic-gauge-val{font-size:30px}
}
/* Live Signals: table -> card list on small screens */
@media(max-width:600px){
  .aic-table-scroll{overflow:visible;margin:0;padding:0}
  .aic-table{display:block;min-width:0;border-spacing:0;font-size:12px}
  .aic-table thead{display:none}
  .aic-table tbody{display:block}
  .aic-table tbody tr{display:grid;grid-template-columns:1fr 1fr;gap:6px 10px;padding:10px 11px;margin-bottom:8px;border:1px solid rgba(255,255,255,.06);border-radius:12px}
  .aic-table tbody tr:hover{transform:none;box-shadow:none;background:rgba(245,182,41,.05)}
  .aic-table tbody td{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0;border:0;border-radius:0;min-width:0}
  .aic-table tbody td::before{content:attr(data-label);font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#8a93a3;font-weight:800;flex:none}
  .aic-table tbody td:first-child,.aic-table tbody td:last-child{grid-column:1 / -1}
  .aic-conf-mini{min-width:64px;flex:1}
}
`;

