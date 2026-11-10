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

Her alıcı için bağımsız deployment ve ayrı Supabase projesi kurulur. Ortak çok kiracılı veri altyapısı bu teslim modelinin parçası değildir. Marka adı, logo, slogan, ana renk, vurgu rengi ve alt bilgi alıcı kurulumundaki `/branding` yönetim ekranından ayarlanır. Yönetim yetkisi `user_metadata` üzerinden değil, sunucu tarafından yönetilen `app_metadata.role = admin` claim'i üzerinden verilir.


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

- Depodaki CI üretim derlemesini kontrol eder; tüm depo ESLint kontrolü temiz değildir.
- Otomatik test kapsamı sınırlıdır; kritik sinyal çözümleme senaryoları ayrıca test edilmelidir.
- Bybit API rate-limit yanıtı gözlemlenmiştir; alıcı ortamında tekrar test edilmeli ve izlenmelidir.
- Fear & Greed tablosu/akışı ve diğer dış servisler alıcı ortamında doğrulanmalıdır.
- Whale Radar migration'ı uygulanmadan bu tabloya bağlı ekran olay verisi gösteremez.
- Feature branch'teki yeni resolver ve Whale Radar düzeltmeleri canlı ortama deploy edilmiş değildir.
- Canlı cron/Edge Function ayarları, alıcı onayı ve erişimi olmadan değiştirilmez.

## 7. Sözleşmede açıkça kararlaştırılacak ticari maddeler

Taraflar yazılı olarak belirlemelidir:

- Devir türü: kullanım lisansı mı, münhasır hak devri mi, kaynak kod devri mi?
- Tek alıcıya özel kullanım mı, çoğaltma ve yeniden satış hakkı da var mı?
- Ücret, ödeme takvimi ve vergi/fatura koşulları
- Kurulum kapsamı, teslim tarihi ve kabul kriterleri
- Hata düzeltme süresi ve destek kapsamı
- Yeni özellik, bakım ve üçüncü taraf servis maliyetleri
- Marka, domain, görsel ve içerik haklarının kapsamı
- Üçüncü taraf açık kaynak paket lisanslarına uyum

Bu maddeler kararlaştırılmadan depoya varsayımsal bir açık kaynak veya ticari lisans dosyası eklenmemelidir.

## 8. Satış görüşmesinde kullanılabilecek doğru ifade

“KELTOŞ, teknik gösterge tabanlı kripto sinyallerini ve piyasa izleme verilerini tek panelde sunan, kendi altyapınıza kurulabilen bir yazılım projesidir. Kaynak kod ve kurulum dokümantasyonu teslim edilebilir. Canlı kullanım, alıcıya ait Supabase, Telegram ve veri kaynağı ayarlarıyla kurulum ve kabul testlerinden sonra doğrulanır. Yazılım kâr veya sinyal başarısı garantisi vermez.”
