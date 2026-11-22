# KELTOŞ Windows istemcisi — yayın ve teslim notu

## Mimari karar

KELTOŞ'un mevcut uygulaması TanStack Start tabanlı, SSR kullanan bir web uygulamasıdır. Bu nedenle ilk Windows sürümü yerel bir kopya veya bağımsız sinyal motoru olarak değil, mevcut HTTPS web paneline bağlanan bir Electron masaüstü istemcisi olarak hazırlanır. Böylece web ve Windows istemcisi aynı uygulamayı ve aynı Supabase altyapısını kullanır.

## Yayın

1. Web uygulamasını müşteriye ait HTTPS adresinde çalışır ve erişilebilir hale getirin.
2. GitHub Actions içindeki **Windows Desktop Installer** iş akışını manuel başlatın.
3. `web_url` parametresine tam HTTPS adresini girin.
4. İş akışının başarılı tamamlandığını doğrulayın.
5. Actions artifact bölümünden Windows x64 NSIS kurulum dosyasını indirin.
6. Kurulumu temiz bir Windows 10/11 x64 ortamında deneyin: ilk bağlantı, giriş, sayfa yenileme, menüden bağlantı ayarları ve çıkış.

## Bilinen kapsam dışı işler

- Çevrimdışı çalışma
- Yerel sinyal motoru veya yerel veritabanı
- Otomatik güncelleme
- Windows kod imzalama ve kurumsal yayın sertifikası
- macOS/Linux paketleri

## Teslimat kabul koşulu

Kaynak kodun eklenmesi veya CI iş akışının oluşturulması, Windows kurulum dosyasının üretildiği anlamına gelmez. Teslim tamamlandı demek için Windows iş akışının başarılı olması, gerçek HTTPS web adresiyle EXE'nin üretilmesi ve temiz Windows ortamında temel açılış/giriş testlerinin yapılması gerekir.
