# Market Analysis Terminal Windows masaüstü istemcisi

Bu paket, mevcut Market Analysis Terminal web uygulamasını Windows masaüstü penceresinde açan bir Electron istemcisidir. Sinyal motorunu, Supabase veritabanını veya Edge Function'ları bilgisayara kopyalamaz; mevcut web hizmetini kullanır.

## Gereksinimler

- Windows 10/11, 64-bit
- İnternet bağlantısı
- Çalışır durumda, HTTPS üzerinden erişilebilen bir Market Analysis Terminal web kurulumu

## Geliştirici kurulumu

```powershell
cd desktop
npm install
npm start
```

Paketlenmiş sürüm varsayılan olarak `app-config.json` içindeki Market Analysis Terminal adresini açar. Kullanıcı ilk çalıştırmadan sonra menüdeki **Market Analysis Terminal → Bağlantı ayarları** bölümünden HTTPS adresini değiştirebilir.

## Windows kurulum dosyası

GitHub deposunda Actions → **Windows Desktop Installer** → Run workflow adımlarını izleyin. `web_url` alanı varsayılan olarak üretim adresini getirir. Paketleme başlamadan önce iş akışı adresin HTTPS olduğunu ve HTTP 200 ile HTML döndürdüğünü doğrular. Doğrulama başarısızsa kurulum dosyası üretilmez. İş tamamlandığında Actions artifact bölümünden `Market-Analysis-Terminal-Setup-1.0.0-x64.exe` dosyasını alın.

## Çalışma sınırları

- Bu istemci çevrimdışı çalışmaz; web uygulamasına ve Supabase hizmetlerine internet üzerinden erişir.
- Kullanıcı girişi ve veriler mevcut web uygulaması tarafından yönetilir.
- Her müşteri için kendi web kurulumunun HTTPS adresiyle ayrı kurulum dosyası üretilebilir.
- Web uygulaması kapalıysa masaüstü istemcisi de kullanılamaz.
- Bu ilk sürüm otomatik güncelleme içermez.
- Windows kod imzalama sertifikası yapılandırılmadığı için kurulum dosyası imzasızdır; Windows SmartScreen uyarısı görülebilir. İmzalama ve SmartScreen itibarı ayrı konulardır; imzalı yeni dosyalarda da ilk dağıtımlarda uyarı görülebilir.

## Güvenlik

Electron penceresinde Node entegrasyonu kapalı, context isolation ve sandbox açıktır. Yerel köprü yalnızca web adresini okumak/kaydetmek için sınırlıdır. Service-role anahtarı, Telegram token'ı veya başka sunucu sırrı bu pakete eklenmez. Bu istemci, web uygulamasının ve sunucu tarafı kimlik doğrulamasının güvenli yapılandırıldığını varsayar.
