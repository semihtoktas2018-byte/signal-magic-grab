import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { translations, getLang, setLangStorage, type LangCode } from "../i18n";

export const Route = createFileRoute("/whale")({
  head: () => ({
    meta: [
      { title: "Whale Radar — KELTOŞ" },
      { name: "description", content: "Kripto piyasasında büyük cüzdan hareketlerini canlı takip et." },
    ],
  }),
  component: WhaleRadar,
});

const KPK_SB_URL = "https://gmwlkkebwpenocatlmty.supabase.co";
const KPK_SB_KEY = "sb_publishable_vxLxplUzQw9qNSaZjX4ucA_LZ1NW3a1";

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
  const [lang, setLang] = useState<LangCode>(getLang());

  const t = (key: string) => translations[key]?.[lang] || key;

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

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
    <div className="kt-data-page" dir={lang === "ar" ? "rtl" : "ltr"}>
      <style>{".kt-data-page{min-height:100vh;padding:clamp(16px,4vw,42px);background:radial-gradient(ellipse at 50% -10%,rgba(245,182,41,.13),transparent 58%),#05070b;color:#f0f2f5;font-family:Inter,system-ui,sans-serif}.kt-data-shell{max-width:1000px;margin:0 auto;padding:clamp(18px,3vw,32px);border:1px solid rgba(245,182,41,.16);border-radius:22px;background:linear-gradient(145deg,rgba(255,255,255,.045),rgba(255,255,255,.012));box-shadow:0 24px 80px rgba(0,0,0,.28)}.kt-data-page select{background:#0d1118!important;color:#f0c568!important;border:1px solid rgba(245,182,41,.28)!important;border-radius:10px!important;padding:8px 12px!important}.kt-data-page h1{letter-spacing:-.035em}@media(max-width:600px){.kt-data-page{padding:10px}.kt-data-shell{padding:16px;border-radius:16px}}"}</style>
      <div className="kt-data-shell">
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <a href="/" style={{ color: "#8a93a3", fontSize: 13, textDecoration: "none" }}>← {t("home")}</a>
          <select
            value={lang}
            onChange={(e) => {
              const next = e.target.value as LangCode;
              setLang(next);
              setLangStorage(next);
            }}
            style={{ background: "transparent", border: "1px solid rgba(245,182,41,.25)", color: "#f5b629", borderRadius: 8, padding: "6px 10px" }}
          >
            <option value="tr">TR</option>
            <option value="en">EN</option>
            <option value="de">DE</option>
            <option value="fr">FR</option>
            <option value="ar">AR</option>
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "16px 0 4px" }}>
          <span style={{ fontSize: 32 }}>🐋</span>
          <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, background: "linear-gradient(135deg,#f5b629,#ffd76a)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
            {t("whaleRadar")}
          </h1>
        </div>
        <p style={{ color: "#8a93a3", fontSize: 14, margin: "0 0 24px" }}>
          {t("whaleDescription")}
        </p>

        <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
          <div style={{ flex: 1, background: "rgba(34,197,94,.08)", border: "1px solid rgba(34,197,94,.3)", borderRadius: 14, padding: "14px 18px" }}>
            <div style={{ fontSize: 12, color: "#8a93a3" }}>{t("largeBuy")}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#22c55e" }}>{buyCount}</div>
          </div>
          <div style={{ flex: 1, background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.3)", borderRadius: 14, padding: "14px 18px" }}>
            <div style={{ fontSize: 12, color: "#8a93a3" }}>{t("largeSell")}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#ef4444" }}>{sellCount}</div>
          </div>
        </div>

        {loading ? (
          <p style={{ color: "#8a93a3", textAlign: "center", padding: 40 }}>{t("loading")}...</p>
        ) : events.length === 0 ? (
          <p style={{ color: "#8a93a3", textAlign: "center", padding: 40 }}>{t("noData")}. {t("refreshInSeconds")}.</p>
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
                        {e.coin.replace(/USDT$/, "")} <span style={{ color, fontSize: 12 }}>{isBuy ? t("largeBuy").toUpperCase() : t("largeSell").toUpperCase()}</span>
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
            @keyframes whaleShine { to { background-position: 200% center; } }
            @keyframes whalePulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.4); opacity: .5; } }
          `}</style>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            fontSize: 11, fontWeight: 800, letterSpacing: "2px", textTransform: "uppercase",
            background: "linear-gradient(90deg,#7dd3fc,#a78bfa,#7dd3fc)", backgroundSize: "200% auto",
            WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent",
            animation: "whaleShine 4s linear infinite",
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%", background: "#22c55e",
              boxShadow: "0 0 8px #22c55e", animation: "whalePulse 1.6s infinite", flexShrink: 0,
            }} />
            A BAMIR ONLINE STORE'S PRODUCTION
          </span>
        </div>
      </div>
      </div>
    </div>
  );
}
