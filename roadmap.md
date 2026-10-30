# KELTOŞ — Roadmap

- [x] Fix failed build (typecheck errors in AISignalIntelligence mid-edit) — latest build OK
- [x] Canlı Fiyat / Fark: fetch live prices + 24h change from Binance API instead of the missing `exchange_prices` table (homepage AI center, /signals, /performance, homepage live PnL)
- [ ] /exchange (Borsa Karşılaştır) still reads `exchange_prices` for the Bybit-vs-OKX gap — needs a decision: this page's whole purpose is the two-exchange spread, which Binance alone cannot supply
