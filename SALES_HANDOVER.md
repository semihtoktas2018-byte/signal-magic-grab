# White-Label Market Analysis Terminal — Satış ve Devir Teslim Dosyası

Bu belge, alıcı görüşmesinde ürün kapsamını ve teslimat sınırlarını netleştirmek için hazırlanmıştır. Ticari sözleşme veya hukukî lisans metni değildir.

## 1. Ürün tanımı

Ürün; kripto spot piyasa verilerini, teknik gösterge tabanlı BUY / SELL / WAIT sinyallerini, sinyal geçmişini, tanımlı TP/SL seviyelerine göre teorik sonuç takibini, Bybit/OKX fiyat karşılaştırmasını ve Bybit Spot ile USDT perpetual (Linear) işlemlerindeki eşik üstü tekil işlemleri ayrı kategorilerde görüntüleyen web panelidir.

Otomatik emir göndermez. Yatırım danışmanlığı değildir. Kâr, doğruluk oranı veya belirli getiri taahhüt etmez.

## 2. Kaynak kodda bulunan modüller

- Ana sayfa ve piyasa özeti
- Sinyal terminali
- Performans ve geçmiş sonuçlar
- Whale Radar (Bybit Spot son 60 ve USDT perpetual Linear son 1.000 işlem içinden eşik üstü tekil işlemler; cüzdan takibi değildir)
- Borsa fiyat karşılaştırma ekranı
- Supabase Edge Functions: `kpk-signals-cron`, `fear-greed`
- Supabase veritabanı migration'ları
- Telegram bildirim akışı (alıcı botu ve kanalına göre yapılandırılmalıdır)

Modüllerin kodda bulunması, alıcının altyapısında canlı çalıştıklarının kanıtı değildir.

## 3. Teslimat paketi

Teslim kapsamı, yazılı anlaşmaya göre aşağıdaki maddeleri içerebilir:

- Git kaynak kodu ve ilgili branch/commit
- `README.md`, `SETUP.md`, `ARCHITECTURE.md`
- Supabase migration dosyaları
- Alıcı altyapısına kurulum ve yapılandırma
- Kurulum sonrası kabul testlerinin sonuç raporu

Domain, hosting, Supabase, Telegram, borsa hesapları/API erişimi ve üçüncü taraf servis ücretleri ayrıca kararlaştırılmalıdır. Gizli anahtarlar veya mevcut işletme hesapları kaynak kodla birlikte devredilmez.

## 4. Alıcıya özel yapılandırma

Her alıcı için bağımsız deployment ve ayrı Supabase projesi kurulur. Ortak çok kiracılı veri altyapısı bu teslim modelinin parçası değildir. Marka adı, logo, slogan, ana renk, vurgu rengi, alt bilgi ve WhatsApp iletişim numarası alıcı kurulumundaki `/branding` yönetim ekranından ayarlanır. İletişim numarası alıcı tarafından girilene kadar satış/iletişim CTA butonları gösterilmez. Yönetim yetkisi `user_metadata` üzerinden değil, sunucu tarafından yönetilen `app_metadata.role = admin` claim'i üzerinden verilir.


Alıcı kendi değerlerini sağlamalıdır:

- Supabase proje ref'i ve gerekli anahtarlar
- Edge Function secrets ve Vault secret'ları
- Telegram bot token'ı ve hedef kanal kimliği
- Frontend ortam değişkenleri
- Domain ve hosting erişimi
- Gerekli üçüncü taraf servis hesapları

Service-role anahtarı, Telegram bot token'ı ve cron secret frontend'e veya Git deposuna yazılmamalıdır.

## 5. Kabul testleri

Teslim tamamlandı olarak işaretlenmeden önce aşağıdakiler alıcı ortamında test edilmelidir:

- Temiz kurulumda migration'ların uygulanması
- RLS ve erişim politikalarının doğrulanması
- Edge Function deploy ve log kontrolü
- Cron'un tetiklenmesi ve fonksiyonun beklenen sonucu üretmesi
- Bybit/OKX/alternative.me kaynaklarının erişilebilirliği ve rate-limit davranışı
- Gerçek sinyal kaydının oluşması ve terminalde görünmesi
- TP/SL sonucu, temas mumuna kadar tüm gerekli 15 dakikalık mumlar eksiksizse kesinleştirilir
- 48 saat sonunda yalnızca pencerenin tamamı eksiksizse `suresi_doldu` yazılır; veri boşluğu varsa sinyal beklemede kalır
- Telegram test bildiriminin alıcı botu/kanalına ulaşması
- Whale Radar migration sonrası olayların görüntülenmesi
- Mobil ve masaüstü görünüm kontrolü
- Üretim build sonucunun başarılı olması

Build başarısı tek başına uçtan uca kabul testi değildir.

## 6. Bilinen teknik sınırlamalar / açık işler

**Mevcut satıcı ortamı için 2026-11-17 doğrulama notu:** GitHub `main` ile canlı Edge Function v12 kaynak dosyası birebir eşleşti. `kpk-signals-cron` cron görevi 5 dakikada bir aktif; incelenen son koşular başarılı. Fonksiyonun son incelenen yanıtı HTTP 200, `ok: true`, `errors: []` döndürdü. Telegram test mesajı ve gerçek LINK/USDT SELL sinyal bildirimi alıcı sohbetine ulaştı. Bu doğrulama yalnızca mevcut satıcı ortamını kapsar; alıcıya ait temiz kurulumun kabul testi yerine geçmez. `whale_events` tablosu kurulu ancak denetim anında 0 kayıt içeriyordu.

- Depodaki CI üretim derlemesini kontrol eder; tüm depo ESLint kontrolü temiz değildir.
- Otomatik test kapsamı sınırlıdır; kritik sinyal çözümleme senaryoları ayrıca test edilmelidir.
- Bybit API rate-limit yanıtı gözlemlenmiştir; alıcı ortamında tekrar test edilmeli ve izlenmelidir.
- Canlı projede Fear & Greed tablosu kayıt içeriyor; son görülen kaynak tarihi 2026-11-16. Alıcı ortamında güncellik ve servis sürekliliği doğrulanmalıdır.
- Whale Radar migration'ı uygulanmadan bu tabloya bağlı ekran olay verisi gösteremez.
- 2026-11-17 denetiminde canlı Edge Function v12 ile GitHub `main` kaynak dosyası birebir eşleşti. Resolver kodu canlı fonksiyonda mevcut; yine de temiz alıcı projesinde kabul testi yapılmalıdır.
- Canlı `whale_events` tablosu mevcut ancak denetim anında 0 kayıt içeriyordu; olay akışının veri üretmesi ayrıca doğrulanmalıdır.
- V1/V2 motorları arasında sinyal yönü/puanı ayrışabiliyor. Örnek canlı cron yanıtında LINKUSDT V1 SELL 78, V2 WAIT 28 ve V2 coverage 0.75 döndü. V2, mevcut uygulamada karşılaştırma amaçlıdır; performans garantisi olarak pazarlanmamalıdır.
- Canlı cron/Edge Function ayarları, alıcı onayı ve erişimi olmadan değiştirilmez.

## 7. Sözleşmede açıkça kararlaştırılacak ticari maddeler

Taraflar yazılı olarak belirlemelidir:

- Devir türü: kullanım lisansı mı, münhasır hak devri mi, kaynak kod devri mi?
- Tek alıcıya özel kullanım mı, çoğaltma ve yeniden satış hakkı da var mı?
- Ücret, ödeme takvimi ve vergi/fatura koşulları
- Kurulum kapsamı, teslim tarihi ve kabul kriterleri
- Hata düzeltme süresi ve destek kapsamı
- Yeni özellik, bakım ve üçüncü taraf servis maliyetleri
- WhatsApp iletişim numarası ve destek kanalının kime ait olacağı
- Marka, domain, görsel ve içerik haklarının kapsamı
- Üçüncü taraf açık kaynak paket lisanslarına uyum

Bu maddeler kararlaştırılmadan depoya varsayımsal bir açık kaynak veya ticari lisans dosyası eklenmemelidir.

## 8. Satış görüşmesinde kullanılabilecek doğru ifade

“Bu yazılım, teknik gösterge tabanlı kripto sinyallerini ve piyasa izleme verilerini tek panelde sunan, kendi altyapınıza kurulabilen bir üründür. Kaynak kod ve kurulum dokümantasyonu teslim edilebilir. Canlı kullanım, alıcıya ait Supabase, Telegram ve veri kaynağı ayarlarıyla kurulum ve kabul testlerinden sonra doğrulanır. Yazılım kâr veya sinyal başarısı garantisi vermez.”


## 9. Performans denetimi — 2026-11-19

Canlı satıcı veritabanında son 30 gün için yapılan salt-okunur denetim:

- Toplam 343 sinyal: 136 `tuttu`, 171 `tutmadi`, 36 `bekliyor`.
- Kapanmış 307 sinyalde isabet oranı: %44,3.
- Sabit TP +%2,5 / SL −%2 varsayımıyla brüt teorik EV: yaklaşık −%0,01 / kapanmış sinyal.
- BUY: 98 kapanmış sinyal, 19 başarılı (%19,4).
- SELL: 209 kapanmış sinyal, 117 başarılı (%56,0).
- Son 7 günde 61 kapanmış sinyal: 29 başarılı, 32 başarısız; brüt teorik EV yaklaşık +%0,14 / sinyal.

Bu değerler denetim anındaki satıcı veritabanı anlık görüntüsüdür; gelecekteki performans tahmini veya alıcı ortamı sonucu değildir. 7 günlük örneklem kısa dönemlidir. BUY ve SELL performansları belirgin biçimde farklı olduğundan tek bir genel isabet oranı motorun her iki yönde aynı kalitede çalıştığı anlamına gelmez.

Performans ekranındaki EV hesabı, resolver'ın kullandığı sabit TP/SL yüzdeleriyle matematiksel olarak tutarlıdır. Aynı 15 dakikalık mumda TP ve SL birlikte görülürse resolver kaybı seçer; eksik mum kapsamı varsa sonucu kesinleştirmez. Ekran EV'yi brüt teorik olarak adlandırır ve komisyon, spread, kayma ve gerçek emir gerçekleşmesini hariç tuttuğunu belirtir.

**Satış kısıtı:** Mevcut örneklem, kârlılık veya yatırım performansı iddiasını desteklemez. BUY/SELL motor eşikleri değiştirilmeden önce ayrı dönemlerde, maliyetler dahil ve ileriye dönük test yapılmalıdır. Bu test tamamlanana kadar ürün yalnızca veri izleme ve teorik sinyal takip yazılımı olarak tanıtılmalıdır.


## 10. BUY / SELL motor review — 2026-11-19

A read-only review compared the current V1 scoring implementation, the V2 diagnostic score, and live historical outcomes.

### Verified implementation facts
- V1 BUY and SELL use different component weights and entry conditions.
- The current V1 BUY baseline can reach 67 points from: above EMA20 (+20), EMA20 >= EMA50 (+15), rising EMA20 (+12), positive MACD histogram (+14), and high volume (+6).
- The current V1 SELL baseline can reach 78 points from: below EMA20 (+28), EMA20 < EMA50 (+18), falling EMA20 (+12), negative MACD histogram (+14), and high volume (+6).
- Both directions are admitted at the same `RECORD_THRESHOLD = 75`; therefore SELL can pass on a baseline combination that cannot reach the threshold for BUY without additional conditions. This is a structural scoring asymmetry, not a proven causal explanation for outcomes.
- V2 classifies scores below 45 as WAIT. Recent stored records show V2 scores in the 25–31 range while V1 still emitted BUY/SELL. V2 is diagnostic only in the current insert path; it is not a mandatory confirmation gate.
- Current live function v12 and GitHub main both show `RECORD_THRESHOLD = 75`. Since 2026-11-18 14:00 UTC, the two inspected live records were SELL score 78; no sub-75 record was present in that interval. Older historical rows include scores below 75 and should not be used to infer the current threshold behavior.

### Historical outcome observations
- In the 30-day seller snapshot, BUY closed 19/98 (19.4%) and SELL closed 117/209 (56.0%).
- All 98 closed BUY records had EMA trend up and positive MACD; all 209 closed SELL records had EMA trend down and negative MACD.
- Mean stored V2 score was 27.42 for BUY wins and 25.14 for BUY losses; for SELL, 18.96 for wins and 24.11 for losses. These are descriptive associations only and do not establish predictive causality.
- The V1 score bands do not explain the gap: BUY 65–74 had 16/82 wins and 75–81 had 3/16 wins; SELL 65–74 had 64/102 wins and 75–81 had 53/107 wins. Older rows below the current 75 threshold predate the current threshold behavior.

### Decision
Do not change live thresholds or enable V2 as a hard gate based on this sample. The next valid step is a reproducible historical replay using timestamp-aligned 15-minute candles and the exact signal-time inputs, followed by an out-of-sample period with trading costs. Until then, keep the engine unchanged and do not market its signals as profitable or independently validated.


## 11. Live engine follow-up audit — 2026-11-22 06:11 UTC

Read-only snapshot from the seller Supabase project and version 12 Edge Function logs.

### Rolling 30-day outcomes
- 324 closed signals: 150 `tuttu`, 174 `tutmadi`; hit rate 46.30%.
- Gross theoretical EV using the documented +2.5% TP / -2.0% SL: +0.083% per closed signal, before fees, spread, slippage, and execution effects.
- BUY: 19/98 wins (19.39%).
- SELL: 131/226 wins (57.96%).
- 35 signals remained pending at the audit time; no expired signals were present in this 30-day slice.
- Rolling-window results differ from the 2026-11-19 snapshot because the window and database records have advanced. Use the timestamped snapshot, not the old figure, when describing current status.

### Post-v12 cohort
For signals created since 2026-11-18 14:00 UTC:
- 28 signals recorded, all SELL at score 78.
- 23 closed: 18 wins and 5 losses; 5 remained pending.
- All 28 stored V2 decisions were WAIT, with V2 scores in the 7–37 range. V1 therefore continued recording SELL while V2 did not confirm those signals.
- Latest BUY in the table was created 2026-11-18 08:00 UTC; there have been no later BUY records in this cohort.

This is a small, one-direction cohort during the observed market regime; it is not evidence of a stable 78.3% win rate and cannot validate BUY performance.

### Data and operational observations
- All 324 closed signal snapshots had zero stored `whaleBuyUsd` and `whaleSellUsd`. This means the stored signal cohort contains no qualifying whale-flow amounts; it does not establish that the Bybit trade endpoint is broken.
- `whale_events` contained 2 events, newest 2026-11-20 08:20 UTC; none in the preceding 24 hours.
- The cron Edge Function was active at version 12. In the preceding 24 hours, 287 result logs were observed; 285 had empty error arrays. Two runs reported Bybit retCode 10006 rate-limit errors, one for DOGEUSDT (2026-11-21 11:00 UTC) and one for BNBUSDT (2026-11-22 04:00 UTC). Other coin processing and exchange-price writes continued in those runs. The latest observed run at 06:10 UTC had an empty error array.
- All 9 exchange-price rows were refreshed at approximately 06:10 UTC. The Bybit/OKX differences in that snapshot ranged from approximately 0.169% to 0.453%.

### Decision
Keep the live signal engine unchanged. Do not activate V2 as a hard gate or retune BUY/SELL thresholds from this limited cohort. Priorities for a future validation build are: (1) persist signal-time V1/V2 decisions and indicator inputs in a queryable comparison dataset, (2) address transient Bybit rate-limit handling with bounded backoff, and (3) run a timestamp-aligned historical replay and out-of-sample test with trading costs. These are future engineering tasks, not changes made by this audit.


## 12. Live seller environment audit — 2026-11-22 07:45 UTC

This is a read-only snapshot of the seller's existing Supabase project after the Spot/Linear release. It is not a buyer-environment acceptance test.

### Deployment and data pipeline
- GitHub PR #29 is merged to `main` as commit `71f55aeff1547dcd2659a1b5d21c4a1f398edda8`.
- The live `kpk-signals-cron` Edge Function is ACTIVE at version 15. The `whale_events.category` migration is applied; existing events remain classified as `spot`.
- The active `kpk-signals-cron` schedule is every five minutes.
- The 2026-11-22 07:45:18 UTC version-15 execution returned HTTP 200 and `errors: []`. Its diagnostics reported successful Bybit responses for all 9 configured symbols: 60 Spot trades and 1,000 Linear trades per symbol. No trade at or above the USD 250,000 threshold was present in those sampled windows. This confirms API connectivity and scan sizes for that execution; it does not prove that no large trades occurred outside the sampled recent-trade windows.
- The same execution refreshed all 9 Bybit/OKX comparison rows. It generated no new signals in that run.
- Current table counts at audit time: 370 signal rows, 2 whale events (both historical Spot events; no Linear event yet), 9 exchange-price rows, 9 market-sentiment rows, and 1 branding row.

### Current signal outcome snapshot
A rolling 30-day database query at audit time returned 299 signals: 269 closed (120 wins, 149 losses) and 30 pending. Closed-signal hit rate was 44.61%. By direction: BUY 18/91 wins (19.78%); SELL 102/178 wins (57.30%). With the documented fixed +2.5% TP / -2.0% SL, the gross theoretical EV is approximately +0.007% per closed signal before fees, spread, slippage, funding, and actual execution. This is effectively flat at the displayed precision and is not evidence of a profitable strategy.

The rolling 7-day slice contained 61 signals: 55 closed (30 wins, 25 losses) and 6 pending. Hit rate was 54.55%; the sample is short and directionally uneven (BUY 1/7, SELL 29/48). Do not use this short-window result as a sales performance claim.

### Commercial readiness limits
- Position the product as a market-monitoring and theoretical signal-history terminal, not a profitable trading system, automated execution product, or investment service.
- The current live database is the seller's operating environment. It is not the buyer's isolated deployment. Each buyer still needs a separate Supabase project, environment variables, Edge Function secrets, cron/Vault setup, OAuth configuration, and acceptance testing.
- The editor preview has a separate stale Lovable Cloud backend link to project ref `hnzjvcwbcfgfwpnfyhiz`; its DNS does not resolve. The published site uses `gmwlkkebwpenocatlmty` and is the working environment. Do not use the editor preview failure as proof that the published site is down; do not resume the stale backend or remove any database.
- The editor-preview backend link cannot currently be repointed through the available project tools. Lovable support intervention may be required.
- No current successful build workflow run was found for the PR merge commit in the queried GitHub workflow-run endpoint. Do not claim a fresh CI build passed solely from the merge state. A local/clean buyer build and buyer-environment acceptance tests remain required.
- The repository contains no completed buyer-specific commercial license, signed rights transfer, price, warranty, or support agreement. These must be agreed in writing. Third-party software and service terms remain applicable.

### Release decision
The seller's published application and version-15 backend are operational in the observed snapshot. The source can be presented for a controlled buyer demonstration and technical due diligence. Do not describe the package as fully turnkey, independently validated for trading profitability, or ready for immediate buyer production use until a clean buyer deployment passes the acceptance checklist in section 5 and commercial terms are signed.


## 13. Live seller environment audit — 2026-11-22 13:25 UTC

This is a newer read-only snapshot of the seller environment. It supersedes the point-in-time operational counts and rolling outcome figures in section 12; earlier sections remain historical audit records. It is not a buyer-environment acceptance test.

### Deployment and live data
- Lovable project status: published; project agent status: ready. Its latest project commit is `455674b807e556b3ee8d29035f4e433fb59a7e17`, matching GitHub `main` at the time of inspection.
- Live Supabase Edge Function `kpk-signals-cron`: ACTIVE, version 15, `verify_jwt=false`. The function itself checks the `x-cron-secret` header against `CRON_SECRET`.
- Latest database snapshot: 370 total signal rows; 6 signal rows created in the preceding 24 hours; newest signal timestamp `2026-11-22 06:15:11.783294 UTC`.
- `whale_events`: 20 rows total — 2 Spot and 18 Linear. Latest inserted event: `2026-11-22 13:20:04 UTC`. This confirms Linear events are now being stored; it does not imply comprehensive coverage of every market trade.
- `exchange_prices`: 9 rows; latest update `2026-11-22 13:25:17 UTC`.
- `market_sentiment`: 9 rows; latest source timestamp `2026-11-22 00:00:00 UTC`, latest database update `2026-11-22 06:07:23 UTC`. Source data timestamp and database refresh time are different measures.

### Rolling signal outcome snapshot
A read-only query at this audit returned:
- Last 30 days: 358 signals; 328 closed (149 wins, 179 losses); 30 pending.
- Closed-signal hit rate: 45.43%.
- BUY: 19 wins from 97 closed (19.59%).
- SELL: 130 wins from 231 closed (56.28%).
- Gross theoretical EV using fixed +2.5% TP / -2.0% SL: approximately +0.044% per closed signal, before fees, spread, slippage, funding and execution effects. This is marginal and is not evidence of a profitable strategy.
- Last 7 days: 59 signals, all 59 closed (30 wins, 29 losses); hit rate 50.85%; BUY 1/7 and SELL 29/52. Gross theoretical EV under the same fixed TP/SL assumption is approximately +0.288% per closed signal. This short window is not a sales performance claim.

These are rolling database snapshots, not independently audited trading returns. Theoretical TP/SL outcomes are not executed P&L. Do not market them as profitability, investment performance, or a guaranteed hit rate.

### Current release position
The seller's published application and version-15 backend show live data activity, including Linear Whale Radar records. The source is suitable for a controlled demonstration and technical due diligence. A buyer-ready production handover is still incomplete until a separate buyer Supabase project is provisioned, secrets/OAuth/cron are configured, a clean build is verified, and all acceptance tests in section 5 pass. Commercial license, rights transfer, price, warranty and support terms must also be agreed in writing.

### Known caveats carried forward
- No successful fresh CI build run has been verified for the current release commit; do not claim CI passed.
- Repository-wide ESLint is not clean; do not claim lint passed.
- The Lovable editor preview retains a stale backend reference described in section 12. The published site and its live Supabase project are separate and must not be conflated.
- The current performance snapshot is effectively near-flat on the fixed theoretical TP/SL model before trading costs. Keep the engine unchanged; do not enable V2 as a hard gate or retune thresholds from these samples.

## 12. Live operational and performance audit — 2026-11-26 09:02 UTC

Read-only verification against the seller Supabase project. No database rows, schema, secrets, cron settings, or Edge Function configuration were changed.

### Current operating checks
- The `kpk-signals-cron` job is active on the five-minute schedule (`*/5 * * * *`).
- The latest 72 recorded HTTP invocations in the preceding 24 hours returned HTTP 2xx; none had a recorded failure.
- The latest inspected invocation at 2026-11-26 09:00 UTC returned HTTP 200, `ok: true`, and an empty `errors` array. It inserted one real signal: `ETHUSDT BUY 77`.
- At that same check, the price table contained all 9 tracked coins, with latest updates around 09:00 UTC.
- `whale_events` contained 249 records. The latest inspected cron invocation reported all 18 Spot/Linear market checks (9 coins × 2 markets) with status `ok` and no API errors. A qualifying Linear trade had been logged in the 08:50 UTC run.
- One signal was pending and it was newly created; no pending signal older than 48 hours was present.
- RLS was enabled on all five public tables inspected. Public policies were SELECT-only for market/signal/branding data; branding writes were restricted to the active deployment admin helper. Cron writes are performed by the server-side function.

### Rolling 30-day outcome snapshot
Calculated from `kpk_signals` by `created_at` at the audit time:
- 350 signals total: 156 `tuttu`, 170 `tutmadi`, 23 `suresi_doldu`, and 1 `bekliyor`.
- 326 closed signals; hit rate 47.85%.
- Gross theoretical EV: +0.1534% per closed signal using the configured +2.5% TP / -2.0% SL, before fees, spread, slippage, and execution effects.
- BUY: 18 wins / 77 losses, 95 closed; hit rate 18.95%; 12 expired and 1 pending.
- SELL: 138 wins / 93 losses, 231 closed; hit rate 59.74%; 11 expired.
- Expired and pending signals are excluded from hit-rate and EV denominators.

These are a timestamped historical snapshot of the seller environment, not a forecast, a guarantee, or evidence that BUY and SELL perform equally. BUY performance is materially weaker in this sample. Do not market the product as profitable or as an investment recommendation.

### Publication and code verification
- GitHub PR #52 (closed-signal live movement display) was merged into `main` as commit `bb33d517b62b2598d6b4b854d7b961c6c2d2d3f2`.
- The production Build Check and Pages deployment workflows for that commit both completed successfully.
- The linked Lovable project reports the same latest commit and remains published.
- The Lovable AI agent final audit could not be started because the workspace reported that it was out of credits. No credits were purchased.

### Remaining acceptance limitations
- The Lovable Security view previously showed that a scan could not complete. This is not a clean security certification; the result must not be represented as one.
- The live site was not browser-automated in this audit, so visual interaction checks for login, mobile layout, and each route still require a browser session.
- This seller-environment check does not replace a buyer's separate Supabase setup, secret configuration, cron, Telegram, and acceptance tests.
