import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/whale")({
  head: () => ({
    meta: [
      { title: "Whale Radar — KELTOŞ" },
      { name: "description", content: "Kripto piyasasında büyük cüzdan hareketlerini canlı takip et." },
    ],
  }),
  component: WhaleRadar,
});

const KPK_SB_URL = "https://hnzjvcwbcfgfwpnfyhiz.supabase.co";
const KPK_SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhuemp2Y3diY2ZnZndwbmZ5aGl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NTQ5NzcsImV4cCI6MjA5NzQzMDk3N30.YnbumW8oXeycMd2DNLTA5Qui52sWqRlQgrWyaMwKulI";

interface WhaleEvent {
  id: string;
  coin: string;
  side: "BUY" | "SELL";
  amount_usd: number;
  price: number;
  created_at: string;
}

async function fetchWhaleEvents(): Promise<WhaleEvent[]> {
  try {
    const res = await fetch(
      `${KPK_SB_URL}/rest/v1/whale_events?select=*&order=created_at.desc&limit=100`,
      { headers: { apikey: KPK_SB_KEY, Authorization: `Bearer ${KPK_SB_KEY}` } }
    );
    if (!res.ok) return [];
    return (await res.json()) as WhaleEvent[];
  } catch {
    return [];
  }
}

function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  return `$${(n / 1000).toFixed(0)}K`;
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
  if (hrs < 24) return `${hrs} sa önce`;
  return `${Math.floor(hrs / 24)} gün önce`;
}

function WhaleRadar() {
  const [events, setEvents] = useState<WhaleEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const data = await fetchWhaleEvents();
      if (!cancelled) {
        setEvents(data);
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

  const buyCount = events.filter((e) => e.side === "BUY").length;
  const sellCount = events.filter((e) => e.side === "SELL").length;

  return (
    <div style={{ minHeight: "100vh", background: "#05080d", color: "#e8eef7", fontFamily: "'Inter',system-ui,sans-serif", padding: "24px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <a href="/" style={{ color: "#8a93a3", fontSize: 13, textDecoration: "none" }}>← Ana Sayfa</a>

        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "16px 0 4px" }}>
          <span style={{ fontSize: 32 }}>🐋</span>
          <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, background: "linear-gradient(135deg,#f5b629,#ffd76a)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
            Whale Radar
          </h1>
        </div>
        <p style={{ color: "#8a93a3", fontSize: 14, margin: "0 0 24px" }}>
          Kripto piyasasında $250.000 üstü tekil işlemleri canlı takip eder — kimseyi hedef almaz, sadece büyük paranın nereye gittiğini gösterir.
        </p>

        <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
          <div style={{ flex: 1, background: "rgba(34,197,94,.08)", border: "1px solid rgba(34,197,94,.3)", borderRadius: 14, padding: "14px 18px" }}>
            <div style={{ fontSize: 12, color: "#8a93a3" }}>Büyük Alım</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#22c55e" }}>{buyCount}</div>
          </div>
          <div style={{ flex: 1, background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.3)", borderRadius: 14, padding: "14px 18px" }}>
            <div style={{ fontSize: 12, color: "#8a93a3" }}>Büyük Satım</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#ef4444" }}>{sellCount}</div>
          </div>
        </div>

        {loading ? (
          <p style={{ color: "#8a93a3", textAlign: "center", padding: 40 }}>Yükleniyor...</p>
        ) : events.length === 0 ? (
          <p style={{ color: "#8a93a3", textAlign: "center", padding: 40 }}>Henüz büyük bir hareket tespit edilmedi. Sayfa 30 saniyede bir otomatik yenilenir.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {events.map((e) => {
              const isBuy = e.side === "BUY";
              const color = isBuy ? "#22c55e" : "#ef4444";
              return (
                <div key={e.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: "rgba(255,255,255,.03)", border: `1px solid ${color}33`,
                  borderRadius: 12, padding: "12px 16px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 20 }}>{isBuy ? "🟢" : "🔴"}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>
                        {e.coin.replace(/USDT$/, "")} <span style={{ color, fontSize: 12 }}>{isBuy ? "BÜYÜK ALIM" : "BÜYÜK SATIM"}</span>
                      </div>
                      <div style={{ fontSize: 11, color: "#8a93a3" }}>Fiyat: {fmtPrice(e.price)} · {timeAgo(e.created_at)}</div>
                    </div>
                  </div>
                  <div style={{ fontWeight: 900, fontSize: 18, color }}>{fmtUsd(e.amount_usd)}</div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: 40, color: "#8a93a3", fontSize: 11, letterSpacing: "0.1em" }}>
          A BAMIR ONLINE STORE'S PRODUCTION
        </div>
      </div>
    </div>
  );
}
