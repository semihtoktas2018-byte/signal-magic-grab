import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { createClient } from "@supabase/supabase-js";
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

// KELTOŞ kendi Supabase projesi (keltos) — 'fear-greed' Edge Function burada çalışır
const KPK_SB_URL = "https://gmwlkkebwpenocatlmty.supabase.co";
const keltos = createClient(KPK_SB_URL, "sb_publishable_vxLxplUzQw9qNSaZjX4ucA_LZ1NW3a1");

/* ============================================================
 * AI SIGNAL INTELLIGENCE CENTER
 * Tüm veriler gerçek kaynaklardan gelir:
 *  - Bybit API (canlı fiyat + 24s değişim, doğrudan API)
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
  price: number;
  change_pct: number;
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
  const [signals, setSignals] = useState<SignalRow[] | null>(null);
  const [whales, setWhales] = useState<WhaleRow[] | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [s, w] = await Promise.all([
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

        setSignals((s.data as SignalRow[] | null) ?? []);
        setWhales((w.data as WhaleRow[] | null) ?? []);
      } catch (error) {
        console.error("Gerçek veri yüklenemedi:", error);
        if (!cancelled) {
          setSignals([]);
          setWhales([]);
        }
      } finally {
        if (!cancelled) {
          setLoaded(true);
        }
      }
    };

    void load();
    const id = setInterval(() => {
      void load();
    }, 60000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return { signals, whales, loaded };
}

/* ---------- Canlı fiyatlar (gerçek: Bybit API, doğrudan) ---------- */
const BYBIT_SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "ADAUSDT",
  "DOGEUSDT",
  "AVAXUSDT",
  "LINKUSDT",
];

async function fetchBybitTickers(): Promise<PriceRow[]> {
  const now = new Date().toISOString();
  try {
    const promises = BYBIT_SYMBOLS.map(symbol =>
      fetch(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${symbol}`)
        .then(res => res.json())
    );

    const results = await Promise.all(promises);
    const rows: PriceRow[] = [];

    for (const res of results) {
      if (res.retCode === 0 && res.result && res.result.list && res.result.list.length > 0) {
        const item = res.result.list[0];
        rows.push({
          coin: item.symbol,
          price: Number(item.lastPrice),
          change_pct: Number(item.price24hPcnt) * 100, // Bybit ondalık verir, 100 ile çarpıyoruz
          updated_at: now,
        });
      }
    }
    return rows;
  } catch (error) {
    console.error("Bybit API hatası:", error);
    return [];
  }
}

function useLivePrices() {
  const [prices, setPrices] = useState<PriceRow[] | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const rows = await fetchBybitTickers();
        if (!cancelled) {
          setPrices(rows);
          setLoaded(true);
        }
      } catch (error) {
        console.error("Fiyat çekme hatası:", error);
        if (!cancelled) setLoaded(true);
      }
    };
    load();
    const id = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return { prices, loaded };
}
