import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/exchange")({
  head: () => ({
    meta: [
      { title: "Borsa Karşılaştırma — KELTOŞ" },
      { name: "description", content: "Bybit ve OKX arasındaki anlık fiyat farkını canlı takip et." },
    ],
  }),
  component: ExchangeCompare,
});

const KPK_SB_URL = "https://hnzjvcwbcfgfwpnfyhiz.supabase.co";
const KPK_SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhuemp2Y3diY2ZnZndwbmZ5aGl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NTQ5NzcsImV4cCI6MjA5NzQzMDk3N30.YnbumW8oXeycMd2DNLTA5Qui52sWqRlQgrWyaMwKulI";

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
    const id = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const biggestGap = prices.length
    ? prices.reduce((a, b) => (Math.abs(a.diff_pct) > Math.abs(b.diff_pct) ? a : b))
    : null;

  return (
    <div style={{ minHeight: "100vh", background: "#05080d", color: "#e8eef7", fontFamily: "'Inter',system-ui,sans-serif", padding: "24px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <a href="/" style={{ color: "#8a93a3", fontSize: 13, textDecoration: "none" }}>← Ana Sayfa</a>

        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "16px 0 4px" }}>
          <span style={{ fontSize: 32 }}>⚖️</span>
          <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, background: "linear-gradient(135deg,#f5b629,#ffd76a)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
            Borsa Karşılaştırma
          </h1>
        </div>
        <p style={{ color: "#8a93a3", fontSize: 14, margin: "0 0 24px" }}>
          Bybit ve OKX arasındaki anlık fiyat farkını gösterir. Referans amaçlıdır, milisaniyeler içinde değişebilir.
        </p>

        {biggestGap && (
          <div style={{ background: "rgba(245,182,41,.08)", border: "1px solid rgba(245,182,41,.3)", borderRadius: 14, padding: "14px 18px", marginBottom: 24 }}>
            <div style={{ fontSize: 12, color: "#8a93a3" }}>En Büyük Fark</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#f5b629" }}>
              {biggestGap.coin.replace(/USDT$/, "")}: {biggestGap.diff_pct.toFixed(3)}%
            </div>
          </div>
        )}

        {loading ? (
          <p style={{ color: "#8a93a3", textAlign: "center", padding: 40 }}>Yükleniyor...</p>
        ) : prices.length === 0 ? (
          <p style={{ color: "#8a93a3", textAlign: "center", padding: 40 }}>Henüz veri yok. Sayfa 30 saniyede bir otomatik yenilenir.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {prices.map((p) => {
              const up = p.diff_pct >= 0;
              const color = up ? "#22c55e" : "#ef4444";
              return (
                <div key={p.coin} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: "rgba(255,255,255,.03)", border: `1px solid ${color}33`,
                  borderRadius: 12, padding: "12px 16px",
                }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{p.coin.replace(/USDT$/, "")}</div>
                    <div style={{ fontSize: 11, color: "#8a93a3" }}>
                      Bybit: {fmtPrice(p.bybit_price)} · OKX: {fmtPrice(p.okx_price)} · {timeAgo(p.updated_at)}
                    </div>
                  </div>
                  <div style={{ fontWeight: 900, fontSize: 18, color }}>
                    {up ? "+" : ""}{p.diff_pct.toFixed(3)}%
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <a href="https://khell-profit-wizard.lovable.app" target="_blank" rel="noreferrer" style={{
          display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", marginTop: 32,
          borderRadius: 18, textDecoration: "none",
          background: "linear-gradient(135deg, rgba(56,189,248,.14), rgba(34,197,94,.10))",
          border: "1px solid rgba(56,189,248,.30)",
        }}>
          <div style={{ fontSize: 30, flexShrink: 0 }}>🛍️</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: "#fff", marginBottom: 3 }}>E-ticaret / Dropshipping mi yapıyorsun?</div>
            <div style={{ fontSize: 12, color: "#9db3c9", lineHeight: 1.4 }}>KHELL AI ile ürün analizi, rakip mağaza takibi ve kâr hesabını tek panelde yap.</div>
          </div>
          <div style={{
            flexShrink: 0, padding: "10px 18px", borderRadius: 12, fontSize: 12, fontWeight: 900,
            whiteSpace: "nowrap", color: "#04121f", background: "linear-gradient(135deg,#7dd3fc,#4ade80)",
          }}>KHELL AI'ya Göz At →</div>
        </a>

        <div style={{ textAlign: "center", marginTop: 24 }}>
          <style>{`
            @keyframes exShine { to { background-position: 200% center; } }
            @keyframes exPulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.4); opacity: .5; } }
          `}</style>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            fontSize: 11, fontWeight: 800, letterSpacing: "2px", textTransform: "uppercase",
            background: "linear-gradient(90deg,#7dd3fc,#a78bfa,#7dd3fc)", backgroundSize: "200% auto",
            WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent",
            animation: "exShine 4s linear infinite",
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%", background: "#22c55e",
              boxShadow: "0 0 8px #22c55e", animation: "exPulse 1.6s infinite", flexShrink: 0,
            }} />
            A BAMIR ONLINE STORE'S PRODUCTION
          </span>
        </div>
      </div>
    </div>
  );
}
