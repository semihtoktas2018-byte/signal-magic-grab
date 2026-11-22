# White-Label Market Analysis Terminal — Satış ve Devir Teslim Dosyası

Bu belge, alıcı görüşmesinde ürün kapsamını ve teslimat sınırlarını netleştirmek için hazırlanmıştır. Ticari sözleşme veya hukukî lisans metni değildir.

## 1. Ürün tanımı

Ürün; kripto spot piyasa verilerini, teknik gösterge tabanlı BUY / SELL / WAIT sinyallerini, sinyal geçmişini, tanımlı TP/SL seviyelerine göre teorik sonuç takibini, piyasa karşılaştırmasını ve Bybit spot işlemlerindeki eşik üstü tekil işlemleri görüntüleyen web panelidir.

Otomatik emir göndermez. Yatırım danışmanlığı değildir. Kâr, doğruluk oranı veya belirli getiri taahhüt etmez.

## 2. Kaynak kodda bulunan modüller

- Ana sayfa ve piyasa özeti
- Sinyal terminali
- Performans ve geçmiş sonuçlar
- Whale Radar (Bybit spot işlemlerinden eşik üstü tekil işlem kayıtları; cüzdan takibi değildir)
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

## 6. Bilinen teknik sınırlamalar / açık işler\n\n**Mevcut satıcı ortamı için 2026-11-17 doğrulama notu:** GitHub `main` ile canlı Edge Function v12 kaynak dosyası birebir eşleşti. `kpk-signals-cron` cron görevi 5 dakikada bir aktif; incelenen son koşular başarılı. Fonksiyonun son incelenen yanıtı HTTP 200, `ok: true`, `errors: []` döndürdü. Telegram test mesajı ve gerçek LINK/USDT SELL sinyal bildirimi alıcı sohbetine ulaştı. Bu doğrulama yalnızca mevcut satıcı ortamını kapsar; alıcıya ait temiz kurulumun kabul testi yerine geçmez. `whale_events` tablosu kurulu ancak denetim anında 0 kayıt içeriyordu.

- Depodaki CI üretim derlemesini kontrol eder; tüm depo ESLint kontrolü temiz değildir.
- Otomatik test kapsamı sınırlıdır; kritik sinyal çözümleme senaryoları ayrıca test edilmelidir.
- Bybit API rate-limit yanıtı gözlemlenmiştir; alıcı ortamında tekrar test edilmeli ve izlenmelidir.
- Canlı projede Fear & Greed tablosu kayıt içeriyor; son görülen kaynak tarihi 2026-11-16. Alıcı ortamında güncellik ve servis sürekliliği doğrulanmalıdır.
- Whale Radar migration'ı uygulanmadan bu tabloya bağlı ekran olay verisi gösteremez.
- 2026-11-17 denetiminde canlı Edge Function v12 ile GitHub `main` kaynak dosyası birebir eşleşti. Resolver kodu canlı fonksiyonda mevcut; yine de temiz alıcı projesinde kabul testi yapılmalıdır.\n- Canlı `whale_events` tablosu mevcut ancak denetim anında 0 kayıt içeriyordu; olay akışının veri üretmesi ayrıca doğrulanmalıdır.\n- V1/V2 motorları arasında sinyal yönü/puanı ayrışabiliyor. Örnek canlı cron yanıtında LINKUSDT V1 SELL 78, V2 WAIT 28 ve V2 coverage 0.75 döndü. V2, mevcut uygulamada karşılaştırma amaçlıdır; performans garantisi olarak pazarlanmamalıdır.
- Canlı cron/Edge Function ayarları, alıcı onayı ve erişimi olmadan değiştirilmez.

## 7. Sözleşmede açıkça kararlaştırılacak ticari maddeler

Taraflar yazılı olarak belirlemelidir:

- Devir türü: kullanım lisansı mı, münhasır hak devri mi, kaynak kod devri mi?
- Tek alıcıya özel kullanım mı, çoğaltma ve yeniden satış hakkı da var mı?
- Ücret, ödeme takvimi ve vergi/fatura koşulları
- Kurulum kapsamı, teslim tarihi ve kabul kriterleri
- Hata düzeltme süresi ve destek kapsamı
- Yeni özellik, bakım ve üçüncü taraf servis maliyetleri
- WhatsApp iletişim numarası ve destek kanalının kime ait olacağı\n- Marka, domain, görsel ve içerik haklarının kapsamı
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
