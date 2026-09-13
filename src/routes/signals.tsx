import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://hnzjvcwbcfgfwpnfyhiz.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhuemp2Y3diY2ZnZndwbmZ5aGl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NTQ5NzcsImV4cCI6MjA5NzQzMDk3N30.YnbumW8oXeycMd2DNLTA5Qui52sWqRlQgrWyaMwKulI"
);

export const Route = createFileRoute("/signals")({
  head: () => ({
    meta: [
      { title: "KELTOŞ — Sinyal Terminali" },
      {
        name: "description",
        content:
          "Canlı kripto sinyal terminali: güncel fiyatlar, aktif sinyaller, hedef/stop ve skorlar.",
      },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
    ],
  }),
  component: SignalTerminal,
});

// Cron ile birebir aynı TP/SL oranları
const TP_PCT = 0.025; // +%2.5
const SL_PCT = 0.02; // -%2

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
  okx_price: number;
  diff_pct: number;
  updated_at: string;
}

function fmtNum(p: number): string {
  if (!p) return "0";
  if (p >= 100) return p.toFixed(2);
  if (p >= 1) return p.toFixed(4);
  return p.toFixed(6);
}

function coinShort(c: string): string {
  return c.replace("USDT", "");
}

function targetStop(signal: "BUY" | "SELL", entry: number) {
  const isBuy = signal === "BUY";
  const target = isBuy ? entry * (1 + TP_PCT) : entry * (1 - TP_PCT);
  const stop = isBuy ? entry * (1 - SL_PCT) : entry * (1 + SL_PCT);
  return { target, stop };
}

function resultLabel(r: Signal["result"]) {
  if (r === "tuttu") return { text: "✓ Tuttu", cls: "res-win" };
  if (r === "tutmadi") return { text: "✗ Tutmadı", cls: "res-loss" };
  return { text: "⏳ Bekliyor", cls: "res-wait" };
}

async function loadSignals(): Promise<Signal[]> {
  const { data } = await supabase
    .from("kpk_signals")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(40);
  return (data as Signal[]) || [];
}

async function loadPrices(): Promise<PriceRow[]> {
  const { data } = await supabase
    .from("exchange_prices")
    .select("*")
    .order("coin", { ascending: true });
  return (data as PriceRow[]) || [];
}

function SignalTerminal() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"hepsi" | "BUY" | "SELL">("hepsi");
  const [lastUpdate, setLastUpdate] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      Promise.all([loadSignals(), loadPrices()]).then(([s, p]) => {
        if (cancelled) return;
        setSignals(s);
        setPrices(p);
        setLoading(false);
        setLastUpdate(
          new Date().toLocaleTimeString("tr-TR", {
            hour: "2-digit",
            minute: "2-digit",
          })
        );
      });
    };
    load();
    const t = setInterval(load, 30000); // 30 sn'de bir yenile
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const shown =
    filter === "hepsi" ? signals : signals.filter((s) => s.signal === filter);
  const openCount = signals.filter((s) => s.result === "bekliyor").length;

  return (
    <div className="term">
      <style>{`
        .term{background:#05070c;min-height:100vh;color:#f0f4fa;font-family:'Inter',system-ui,-apple-system,sans-serif;padding:0 0 60px}
        .term-nav{display:flex;align-items:center;justify-content:space-between;padding:14px 24px;background:rgba(5,7,12,.85);backdrop-filter:blur(14px);border-bottom:1px solid rgba(245,182,41,.18);position:sticky;top:0;z-index:50;flex-wrap:wrap;gap:10px}
        .term-title{font-weight:900;font-size:18px;letter-spacing:.1em;background:linear-gradient(135deg,#f5b629,#ffd76a);-webkit-background-clip:text;background-clip:text;color:transparent}
        .term-nav-links{display:flex;gap:18px;flex-wrap:wrap}
        .term-nav-links a{color:#8a93a3;text-decoration:none;font-size:14px;font-weight:600}
        .term-nav-links a:hover,.term-nav-links a.active{color:#f5b629}
        .wrap{max-width:1100px;margin:0 auto;padding:24px 16px 0}
        .sec-head{display:flex;align-items:center;gap:10px;margin:26px 0 12px}
        .sec-title{font-size:15px;font-weight:800;letter-spacing:.06em;color:#f5b629;text-transform:uppercase}
        .live-dot{width:9px;height:9px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 0 rgba(34,197,94,.6);animation:lp 1.6s infinite}
        @keyframes lp{0%{box-shadow:0 0 0 0 rgba(34,197,94,.5)}70%{box-shadow:0 0 0 8px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}
        .price-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}
        .price-card{background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.01));border:1px solid rgba(245,182,41,.18);border-radius:12px;padding:12px 14px;display:flex;align-items:center;justify-content:space-between;gap:8px}
        .pc-coin{font-weight:800;font-size:14px}
        .pc-px{font-size:12px;color:#8a93a3}
        .pc-diff{font-size:12px;font-weight:700;padding:2px 8px;border-radius:999px}
        .diff-pos{color:#22c55e;background:rgba(34,197,94,.12)}
        .diff-neg{color:#ef4444;background:rgba(239,68,68,.12)}
        .filters{display:flex;gap:8px;margin:4px 0 14px}
        .fbtn{padding:6px 16px;border-radius:999px;border:1px solid rgba(245,182,41,.25);background:transparent;color:#8a93a3;font-size:13px;font-weight:700;cursor:pointer;transition:all .2s}
        .fbtn.active{background:rgba(245,182,41,.15);color:#f5b629;border-color:rgba(245,182,41,.5)}
        .tbl{width:100%;border-collapse:separate;border-spacing:0 8px}
        .tbl th{text-align:left;font-size:11px;letter-spacing:.08em;color:#8a93a3;font-weight:700;padding:0 12px 4px;text-transform:uppercase}
        .tbl td{background:rgba(255,255,255,.03);border-top:1px solid rgba(245,182,41,.1);border-bottom:1px solid rgba(245,182,41,.1);padding:12px;font-size:13px;vertical-align:middle}
        .tbl td:first-child{border-left:1px solid rgba(245,182,41,.1);border-radius:12px 0 0 12px}
        .tbl td:last-child{border-right:1px solid rgba(245,182,41,.1);border-radius:0 12px 12px 0}
        .cell-coin{font-weight:800}
        .badge{font-size:11px;font-weight:800;padding:3px 10px;border-radius:999px}
        .b-buy{color:#22c55e;background:rgba(34,197,94,.14)}
        .b-sell{color:#ef4444;background:rgba(239,68,68,.14)}
        .mono{font-variant-numeric:tabular-nums}
        .c-target{color:#22c55e}
        .c-stop{color:#ef4444}
        .score-wrap{display:inline-block;min-width:42px;text-align:center;font-weight:800;padding:3px 8px;border-radius:8px;background:linear-gradient(135deg,rgba(245,182,41,.25),rgba(245,182,41,.08));color:#ffd76a}
        .res-win{color:#22c55e;font-weight:700}
        .res-loss{color:#ef4444;font-weight:700}
        .res-wait{color:#f5b629;font-weight:700}
        .empty{text-align:center;padding:40px 20px;color:#8a93a3;font-size:14px;background:rgba(255,255,255,.02);border:1px dashed rgba(245,182,41,.15);border-radius:16px}
        .loading{text-align:center;padding:60px;color:#8a93a3}
        .meta{font-size:12px;color:#8a93a3}
        .sig{text-align:center;margin-top:40px;font-size:11px;letter-spacing:.08em;color:#0f7a4d;font-weight:600}
        .disc{margin-top:20px;font-size:11px;color:#6b7280;text-align:center;line-height:1.5}
        @media(max-width:640px){.tbl th:nth-child(4),.tbl td:nth-child(4),.tbl th:nth-child(5),.tbl td:nth-child(5){display:none}}
      `}</style>

      <nav className="term-nav">
        <span className="term-title">⚡ SİNYAL TERMİNALİ</span>
        <div className="term-nav-links">
          <a href="/">Ana Sayfa</a>
          <a href="/signals" className="active">Sinyaller</a>
          <a href="/performance">Performans</a>
          <a href="/whale">Whale Radar</a>
          <a href="/exchange">Borsa Karşılaştır</a>
        </div>
      </nav>

      {loading ? (
        <div className="loading">⏳ Yükleniyor...</div>
      ) : (
        <div className="wrap">
          {/* Canlı fiyat / fark */}
          <div className="sec-head">
            <span className="live-dot"></span>
            <span className="sec-title">Canlı Fiyat / Fark</span>
            {lastUpdate && (
              <span className="meta" style={{ marginLeft: "auto" }}>
                Son güncelleme: {lastUpdate}
              </span>
            )}
          </div>
          {prices.length === 0 ? (
            <div className="empty">Fiyat verisi bekleniyor…</div>
          ) : (
            <div className="price-grid">
              {prices.map((p) => (
                <div className="price-card" key={p.coin}>
                  <div>
                    <div className="pc-coin">{coinShort(p.coin)}</div>
                    <div className="pc-px">
                      Bybit {fmtNum(Number(p.bybit_price))}
                    </div>
                  </div>
                  <span
                    className={`pc-diff ${
                      Number(p.diff_pct) >= 0 ? "diff-pos" : "diff-neg"
                    }`}
                  >
                    {Number(p.diff_pct) >= 0 ? "+" : ""}
                    {Number(p.diff_pct).toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Sinyaller */}
          <div className="sec-head">
            <span className="sec-title">Sinyaller</span>
            <span className="meta" style={{ marginLeft: "auto" }}>
              {openCount} açık · {signals.length} toplam
            </span>
          </div>

          <div className="filters">
            {(["hepsi", "BUY", "SELL"] as const).map((f) => (
              <button
                key={f}
                className={`fbtn ${filter === f ? "active" : ""}`}
                onClick={() => setFilter(f)}
              >
                {f === "hepsi" ? "Hepsi" : f}
              </button>
            ))}
          </div>

          {shown.length === 0 ? (
            <div className="empty">
              Şu an gösterilecek sinyal yok. Yeni sinyaller geldikçe burada
              listelenecek.
            </div>
          ) : (
            <table className="tbl">
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
                {shown.map((s) => {
                  const entry = Number(s.price);
                  const { target, stop } = targetStop(s.signal, entry);
                  const res = resultLabel(s.result);
                  return (
                    <tr key={s.id}>
                      <td className="cell-coin">{coinShort(s.coin)}</td>
                      <td>
                        <span
                          className={`badge ${
                            s.signal === "BUY" ? "b-buy" : "b-sell"
                          }`}
                        >
                          {s.signal}
                        </span>
                      </td>
                      <td className="mono">{fmtNum(entry)}</td>
                      <td className="mono c-target">{fmtNum(target)}</td>
                      <td className="mono c-stop">{fmtNum(stop)}</td>
                      <td>
                        <span className="score-wrap">{s.score}</span>
                      </td>
                      <td className={res.cls}>{res.text}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <div className="disc">
            Bu panel otomatik işlem açmaz; yalnızca teknik analiz ve sinyal
            gösterir. Yatırım tavsiyesi değildir.
          </div>
          <div className="sig">A BAMIR ONLINE STORE'S PRODUCTION</div>
        </div>
      )}
    </div>
  );
}
