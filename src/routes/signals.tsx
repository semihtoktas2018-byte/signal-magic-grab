import { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

// --- TİPLER ---
interface Signal {
  id: string;
  coin: string;
  signal: string;
  score: number;
  quality: string | null;
  price: number;
  result: string;
  created_at: string;
}

interface LivePrice {
  symbol: string;
  price: number;
  change_pct: number;
}

// Bybit sembollerini oluşturmak için yardımcı (BTC -> BTCUSDT)
const formatSymbol = (coin: string) => {
  const cleanCoin = coin.replace("USDT", "").toUpperCase();
  return `${cleanCoin}USDT`;
};

export default function SignalsTerminal() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [signalsLoaded, setSignalsLoaded] = useState(false);
  
  const [livePrices, setLivePrices] = useState<Record<string, LivePrice>>({});
  const [pricesLoaded, setPricesLoaded] = useState(false);
  
  // Bileşen kaldırıldığında interval'i durdurmak için
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // 1. SUPABASE'DEN SİNYALLERİ ÇEK
  useEffect(() => {
    let cancelled = false;
    
    const loadSignals = async () => {
      try {
        const { data, error } = await supabase
          .from("kpk_signals")
          .select("id,coin,signal,score,quality,price,result,created_at")
          .order("created_at", { ascending: false })
          .limit(100);

        if (!cancelled) {
          if (!error && data) {
            setSignals(data as Signal[]);
          }
          setSignalsLoaded(true);
        }
      } catch (err) {
        console.error("Sinyal yükleme hatası:", err);
        if (!cancelled) setSignalsLoaded(true);
      }
    };

    loadSignals();
    const signalInterval = setInterval(loadSignals, 30000); // 30 saniyede bir sinyalleri güncelle

    return () => {
      cancelled = true;
      clearInterval(signalInterval);
    };
  }, []);

  // 2. BYBIT API'DEN CANLI FİYATLARI ÇEK
  useEffect(() => {
    let cancelled = false;

    const fetchBybitPrices = async () => {
      if (signals.length === 0) {
        if (!cancelled) setPricesLoaded(true);
        return;
      }

      // Sinyallerdeki tekil coinleri al ve Bybit formuna çevir
      const uniqueCoins = Array.from(new Set(signals.map((s) => s.coin)));
      const symbols = uniqueCoins.map(formatSymbol);
      const newPrices: Record<string, LivePrice> = {};

      try {
        // Her sembol için ayrı istek atıyoruz (Bybit tek sembol destekler sorguda)
        const promises = symbols.map(async (symbol) => {
          const res = await fetch(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${symbol}`);
          if (!res.ok) return null; // HTTP hatası varsa geç
          
          const data = await res.json();
          if (data.retCode === 0 && data.result?.list?.length > 0) {
            const ticker = data.result.list[0];
            return {
              symbol: ticker.symbol,
              price: Number(ticker.lastPrice),
              change_pct: Number(ticker.price24hPcnt) * 100, // Bybit oran verir, %'ye çevir
            };
          }
          return null;
        });

        const results = await Promise.all(promises);
        
        if (!cancelled) {
          results.forEach((item) => {
            if (item) newPrices[item.symbol] = item;
          });
          setLivePrices(newPrices);
          setPricesLoaded(true);
        }
      } catch (err) {
        console.error("Bybit fiyat hatası:", err);
        if (!cancelled) setPricesLoaded(true);
      }
    };

    fetchBybitPrices();
    intervalRef.current = setInterval(fetchBybitPrices, 30000); // 30 saniyede bir fiyatları güncelle

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [signals]); // Sinyaller değiştikçe fiyat listesi güncellenir

  // Fiyat Map'ini oluştur (Coin -> LivePrice)
  const priceMap = useMemo(() => {
    const map: Record<string, LivePrice> = {};
    Object.values(livePrices).forEach((lp) => {
      const coinName = lp.symbol.replace("USDT", "");
      map[coinName] = lp;
    });
    return map;
  }, [livePrices]);

  return (
    <div style={{ padding: "20px", background: "#0b0f19", minHeight: "100vh", color: "#fff" }}>
      <h1 style={{ color: "#f5b629", marginBottom: "20px" }}>Sinyal Terminali</h1>
      
      {!signalsLoaded ? (
        <p>Yükleniyor...</p>
      ) : signals.length === 0 ? (
        <p>Henüz kayıtlı sinyal bulunmuyor.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "15px" }}>
          {signals.map((signal) => {
            const live = priceMap[signal.coin.replace("USDT", "")];
            const isUp = live ? live.change_pct >= 0 : null;
            
            return (
              <div key={signal.id} style={{ background: "#151b2b", padding: "15px", borderRadius: "10px", border: "1px solid #2a3441" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                  <span style={{ fontWeight: "bold", fontSize: "18px" }}>{signal.coin}</span>
                  <span style={{ color: signal.signal === "BUY" ? "#22c55e" : "#ef4444", fontWeight: "bold" }}>
                    {signal.signal}
                  </span>
                </div>
                
                <div style={{ fontSize: "14px", color: "#8a93a3", marginBottom: "10px" }}>
                  Giriş Fiyatı: {signal.price}
                </div>

                {/* Canlı Fiyat Kısmı */}
                <div style={{ borderTop: "1px dashed #2a3441", paddingTop: "10px", marginTop: "10px" }}>
                  {!pricesLoaded ? (
                    <span style={{ color: "#8a93a3" }}>Fiyat yükleniyor...</span>
                  ) : live ? (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: "12px", color: "#8a93a3" }}>Anlık Fiyat</div>
                        <div style={{ fontWeight: "bold", fontSize: "16px" }}>{live.price.toLocaleString()} USDT</div>
                      </div>
                      <div style={{ color: isUp ? "#22c55e" : "#ef4444", fontWeight: "bold", background: isUp ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", padding: "5px 10px", borderRadius: "5px" }}>
                        {isUp ? "+" : ""}{live.change_pct.toFixed(2)}%
                      </div>
                    </div>
                  ) : (
                    <span style={{ color: "#ef4444" }}>Bybit fiyatı alınamadı</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
