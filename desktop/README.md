# KELTOŞ Windows masaüstü istemcisi

Bu paket, mevcut KELTOŞ web uygulamasını Windows masaüstü penceresinde açan bir Electron istemcisidir. Sinyal motorunu, Supabase veritabanını veya Edge Function'ları bilgisayara kopyalamaz; mevcut web hizmetini kullanır.

## Gereksinimler

- Windows 10/11, 64-bit
- İnternet bağlantısı
- Çalışır durumda, HTTPS üzerinden erişilebilen bir KELTOŞ web kurulumu

## Geliştirici kurulumu

```powershell
cd desktop
npm install
npm start
```

İlk açılışta KELTOŞ web adresi istenir. Adres HTTPS olmalıdır.

## Windows kurulum dosyası

GitHub deposunda Actions → **Windows Desktop Installer** → Run workflow adımlarını izleyin. `web_url` alanına müşteriye ait çalışan HTTPS KELTOŞ adresini girin. İş tamamlandığında Actions artifact bölümünden `KELTOS-Setup-1.0.0-x64.exe` dosyasını alın.

## Çalışma sınırları

- Bu istemci çevrimdışı çalışmaz; web uygulamasına ve Supabase hizmetlerine internet üzerinden erişir.
- Kullanıcı girişi ve veriler mevcut web uygulaması tarafından yönetilir.
- Her müşteri için kendi web kurulumunun HTTPS adresiyle ayrı kurulum dosyası üretilebilir.
- Web uygulaması kapalıysa masaüstü istemcisi de kullanılamaz.
- Bu ilk sürüm otomatik güncelleme içermez.
- Windows kod imzalama sertifikası yapılandırılmadığı için kurulum dosyası imzasızdır; Windows SmartScreen uyarısı görülebilir. Ticari dağıtım öncesinde kurumsal kod imzalama sertifikası edinilmesi önerilir.

## Güvenlik

Electron penceresinde Node entegrasyonu kapalı, context isolation ve sandbox açıktır. Masaüstü uygulamasının yerel köprüsü yalnızca web adresini okumak/kaydetmek için sınırlıdır. Service-role anahtarı, Telegram token'ı veya başka sunucu sırrı bu pakete eklenmez.
