# KELTOŞ — Alıcı Bilgi Paketi

Bu belge, ürünün kapsamını ve teslimat öncesi koşulları kısa biçimde açıklar. Ticari teklif, lisans veya garanti belgesi değildir.

## Ürün

KELTOŞ; kripto varlık piyasalarını, teknik gösterge tabanlı sinyal kayıtlarını ve seçili piyasa verilerini tek web arayüzünde izlemek için geliştirilmiş bir paneldir. Alıcının kendi markası ve kendi sunucu/veritabanı altyapısıyla ayrı kurulum modeline göre hazırlanmıştır.

## Kaynak kodda bulunan modüller

- Ana piyasa ekranı ve sinyal terminali
- EMA, RSI, MACD, Bollinger ve hacim tabanlı BUY / SELL / WAIT sinyal mantığı
- Sinyal geçmişi ve tanımlı TP/SL seviyelerine göre teorik sonuç çözümleme
- Teorik performans özeti
- Bybit Spot ve USDT Linear son işlem örneklemlerindeki eşik üstü işlemleri izleyen Whale Radar
- Bybit / OKX fiyat karşılaştırması
- Fear & Greed veri entegrasyonu
- Telegram bildirim akışı
- Marka ayarları ve yönetici ekranları
- Ayrı özellik dalında geliştirilen Piyasa Röntgeni: fonlama, açık pozisyon, long/short hesap oranı ve emir defteri görünümü

Modülün kaynak kodda bulunması, alıcı altyapısında kurulduğu veya canlı çalıştığı anlamına gelmez. Piyasa Röntgeni `src/routes/radar.tsx` içinde bulunur; `/radar` rotası üretilmiş route ağacına ve ana sayfa navigasyonuna eklenmiştir. Lovable projesinin 2026-11-27 tarihli son commit'i `1e99200485f6d0a00ae6d378914f68189e49ea8f` bu rotayı kaydeder. Yayın durumu platformda `is_published=true` görünür; ancak bu denetimde canlı `/radar` sayfası tarayıcıyla doğrulanamadığından, son commit'in üretim URL'sinde başarıyla servis edildiği iddia edilmez.

## Teknik yapı

- Arayüz: React, TanStack Start/Router, Vite, TypeScript
- Veri tabanı, kimlik doğrulama ve sunucu fonksiyonları: Supabase
- Zamanlama: Supabase pg_cron / pg_net
- Bildirim: Telegram Bot API
- Paket yöneticisi: Bun

## Teslimat için gerekenler

Alıcı ortamında ayrı bir kurulum yapılmalıdır. Alıcının sağlaması gerekenler:

- Supabase projesi ve proje erişimi
- Frontend için Supabase URL ve publishable key
- Edge Function için service-role key, CRON_SECRET ve gerekli servis secret'ları
- Telegram kullanılacaksa alıcıya ait bot token'ı ve hedef kanal/grup kimliği
- Domain, hosting ve OAuth sağlayıcı ayarları
- Kurulum ve kabul testleri için yetkili teknik erişim

Gizli anahtarlar kaynak kod deposuna veya tarayıcı tarafına konulmaz. Alıcıya ait secret'lar güvenli sunucu ayarlarında tutulur.

## Kabul testleri

Teslim tamamlandı sayılmadan önce alıcı ortamında aşağıdakiler doğrulanmalıdır:

1. Temiz Supabase projesinde migration'ların doğru sırayla uygulanması.
2. RLS politikaları ve yönetici yetkilerinin doğrulanması.
3. Edge Function dağıtımı, logları ve cron tetiklemelerinin kontrolü.
4. Bybit, OKX ve Fear & Greed veri erişiminin ve API limit davranışının kontrolü.
5. Gerçek sinyal kaydı, sinyal geçmişi ve TP/SL resolver davranışının test edilmesi.
6. Whale Radar verilerinin migration sonrası görüntülenmesi.
7. Telegram test bildiriminin alıcı kanalına ulaşması.
8. Giriş, yönetici ekranları, masaüstü ve mobil arayüzlerin test edilmesi.
9. Üretim derlemesinin ve dağıtımın doğrulanması.

Derleme başarısı tek başına canlı sistem kabulü değildir.

## Açık doğrulama ve yayın durumu

- PR #53 derleme kontrolü başarılı olan ayrı bir geliştirme dalıdır.
- Piyasa Röntgeni için gerçek tarayıcı testi, CORS kontrolü ve canlı metrik görüntüleme doğrulaması henüz tamamlanmamıştır.
- PR #53 ana dala birleştirilmemiştir; canlı Lovable yayınına alınmamıştır.
- Lovable editör önizlemesinin eski Supabase backend bağlantısı ayrıca çözülmelidir. Bu önizleme sorunu, yayımlanmış sitenin durumuyla karıştırılmamalıdır.
- Repository genelinde ESLint kontrolünün temiz olduğu iddia edilmemektedir.
- Temiz alıcı Supabase projesinde uçtan uca kabul testi henüz yapılmamıştır.

Bu nedenle mevcut paket, kontrollü demo ve teknik inceleme için sunulabilir; tüm alıcı kurulumları tamamlanmış, anahtar teslim ve üretime hazır ürün olarak tanıtılmamalıdır.

## Performans ve risk sınırı

Sinyal sonuçları gerçek emir gerçekleşmesi veya yatırım getirisi değildir. Teorik TP/SL hesapları komisyon, spread, kayma, fonlama ve emir gerçekleşme etkilerini kapsamaz. Önceki satıcı ortamı denetimlerinde BUY ve SELL sonuçları arasında belirgin farklar görülmüştür. Bu veriler kârlılık iddiasını desteklemez.

KELTOŞ otomatik al-sat veya emir iletim sistemi değildir; yatırım danışmanlığı vermez ve kâr / isabet oranı garantisi sunmaz.

## Ticari koşullar

Aşağıdaki maddeler alıcıyla yazılı olarak kararlaştırılmalıdır:

- Ücret ve ödeme planı
- Kullanım lisansı veya kaynak kod / hak devri kapsamı
- Münhasırlık ve yeniden satış hakkı
- Kurulum, teslim ve kabul kapsamı
- Destek ve bakım süresi
- Hosting, Supabase, Telegram ve diğer üçüncü taraf servis maliyetleri
- Üçüncü taraf paket ve servis lisanslarına uyum

Bu belgede fiyat, garanti, münhasır hak veya destek taahhüdü verilmemektedir.


## 2026-11-28 — Güncel satış hazırlığı denetimi

### Satıcı ortamı — salt okunur doğrulama
- Supabase projesi `gmwlkkebwpenocatlmty` erişilebilir; beş uygulama tablosunda RLS etkin.
- Tablolardaki mevcut satır sayıları: `kpk_signals` 418, `whale_events` 368, `exchange_prices` 9, `market_sentiment` 14, `app_branding` 1.
- `kpk-signals-cron` görevi `*/5 * * * *` takviminde etkin. 2026-11-27 23:10 UTC tarihli son incelenen cron çağrısı HTTP 200 ve `errors: []` döndürdü; incelenen 9 coin için Spot ve Linear tarama yanıtları başarılıydı.
- Son gözlenen güncelleme zamanları: sinyal 2026-11-27 22:15 UTC, Whale olayı 22:55 UTC, borsa karşılaştırması 23:10 UTC, sentiment tablosu 18:30 UTC. Bunlar denetim anındaki zaman damgalarıdır; kesintisiz hizmet garantisi değildir.
- Bu doğrulama mevcut satıcı ortamına aittir; alıcı için temiz kurulum kabul testi yerine geçmez.

### Satış modeli ve eksikler
- Mevcut arayüzde self-servis ödeme/checkout, Stripe entegrasyonu, abonelik yenileme, lisans anahtarı, süreli aktivasyon veya merkezi lisans sunucusu bulunmaz.
- `/admin/users` ekranı kullanıcı daveti ve erişim kapatma/açma sağlar; lisans/abonelik yönetimi sağlamaz.
- Bu nedenle mevcut ürün, bugün için otomatik aylık abonelik SaaS'ı olarak değil, alıcıya özel Supabase kurulumu ve yazılı lisans/devir kapsamıyla sunulan white-label yazılım paketi olarak konumlandırılmalıdır.
- Canlı siteye son commit'in yansıması, tarayıcıda giriş ve sayfa testleri, alıcıya özel kurulum, güvenlik uyarılarının ele alınması ve ticari lisans koşulları henüz tamamlanmış kabul edilmez.
- Supabase Security Advisor denetiminde sızdırılmış parola korumasının kapalı olduğu ve `pg_net` uzantısının `public` şemasında bulunduğu uyarıları görüldü. Bunlar alıcıya teslim öncesi değerlendirilmelidir; bu denetimde ayar veya şema değiştirilmedi.

### Satışta kullanılabilecek sınır
Ürün, gerçek piyasa kaynaklarına bağlanan piyasa izleme ve teorik sinyal geçmişi yazılımı olarak gösterilebilir. Kârlılık, yatırım başarısı, kesintisiz çalışma, hazır abonelik sistemi veya tek tıkla alıcı kurulumu iddiası kullanılmamalıdır. Alıcı kurulumu ve kabul testleri tamamlanmadan “anahtar teslim üretim sistemi” olarak tanıtılmamalıdır.
