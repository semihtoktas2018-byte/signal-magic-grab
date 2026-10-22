import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://gmwlkkebwpenocatlmty.supabase.co",
  "sb_publishable_vxLxplUzQw9qNSaZjX4ucA_LZ1NW3a1"
);

export const Route = createFileRoute("/signals")({
  component: SignalTerminal,
});

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
  price24hPcnt: number;
}

function fmtNum(p: number): string {
  if (!Number.isFinite(p) || p <= 0) return "—";
  if (p >= 100) return p.toFixed(2);
  if (p >= 1) return p.toFixed(4);
  return p.toFixed(6);
}

function coinShort(c: string): string {
  return c.replace(/USDT$/, "");
}

async function loadSignals(): Promise<Signal[]> {
  try {
    const { data, error } = await supabase
      .from("kpk_signals")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) return [];
    return (data as Signal[]) || [];
  } catch (error) {
    return [];
  }
}

async function loadPrices(): Promise<PriceRow[]> {
  try {
    const { data, error } = await supabase
      .from("exchange_prices")
      .select("*");
    if (error) {
      console.error("exchange_prices okunamadı:", error.message);
      return [];
    }
    if (!data) return [];
    return data.map((row: any) => ({
      coin: row.coin,
      bybit_price: Number(row.bybit_price),
      price24hPcnt: Number(row.diff_pct) || 0,
    }));
  } catch (error) {
    return [];
  }
}

function SignalTerminal() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const s = await loadSignals();
      setSignals(s);
      const p = await loadPrices();
      setPrices(p);
      setLoading(false);
    };
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div style={{ background: "#05070c", minHeight: "100vh", color: "#fff", padding: "20px" }}>
      <h1 style={{ color: "#f5b629" }}>Sinyal Terminali</h1>
      
      {loading ? (
        <p>Yükleniyor...</p>
      ) : (
        <>
          <h2>Canlı Fiyatlar ({prices.length})</h2>
          {prices.length === 0 ? (
            <p>Tablo boş veya RLS engelliyor.</p>
          ) : (
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "20px" }}>
              {prices.map((p) => (
                <div key={p.coin} style={{ background: "#151b2b", padding: "10px", borderRadius: "8px" }}>
                  <b>{p.coin}</b>: {fmtNum(p.bybit_price)} USDT
                </div>
              ))}
            </div>
          )}

          <h2>Sinyaller ({signals.length})</h2>
          {signals.length === 0 ? (
            <p>Henüz sinyal yok.</p>
          ) : (
            <ul>
              {signals.map((s) => (
                <li key={s.id}>{coinShort(s.coin)} - {s.signal} - Skor: {s.score}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
