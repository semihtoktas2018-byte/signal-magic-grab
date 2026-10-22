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

function SignalTerminal() {
  const [prices, setPrices] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    // Doğrudan Supabase'e bağlan ve tabloyu oku
    const fetchData = async () => {
      try {
        console.log("Supabase bağlantısı başlatıldı...");
        
        const { data, error } = await supabase
          .from("exchange_prices")
          .select("*");

        if (error) {
          console.error("Supabase Hatası:", error);
          setErrorMsg("Supabase Hatası: " + error.message);
          return;
        }

        console.log("Gelen veri:", data);
        
        if (data) {
          setPrices(data);
        }
      } catch (err: any) {
        console.error("Beklenmedik Hata:", err);
        setErrorMsg("Beklenmedik Hata: " + err.message);
      }
    };

    fetchData();
  }, []);

  return (
    <div style={{ background: "#05070c", minHeight: "100vh", color: "#fff", padding: "20px" }}>
      <h1 style={{ color: "#f5b629" }}>Sinyal Terminali Test</h1>
      
      {/* Hata varsa burada kırmızı yazıyla göster */}
      {errorMsg && (
        <div style={{ background: "red", color: "white", padding: "10px", marginBottom: "20px", borderRadius: "8px" }}>
          {errorMsg}
        </div>
      )}

      <h2>Canlı Fiyatlar (Supabase'den)</h2>
      
      {prices.length === 0 && !errorMsg ? (
        <p>Veri bekleniyor veya tablo boş...</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "10px" }}>
          {prices.map((p, index) => (
            <div key={index} style={{ background: "#151b2b", padding: "15px", borderRadius: "10px", border: "1px solid #2a3441" }}>
              <div style={{ fontWeight: "bold" }}>{p.coin}</div>
              <div style={{ color: "#22c55e" }}>{p.bybit_price} USDT</div>
              <div style={{ fontSize: "12px", color: "#8a93a3" }}>Fark: %{p.diff_pct}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
