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

Modülün kaynak kodda bulunması, alıcı altyapısında kurulduğu veya canlı çalıştığı anlamına gelmez. Piyasa Röntgeni şu anda PR #53 içindeki ayrı geliştirme dalındadır; ana dala birleştirilmiş veya canlı sitede yayımlanmış değildir.

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
