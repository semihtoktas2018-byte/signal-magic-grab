# KELTOŞ — Mühendislik ve Operasyon Notları

**Belge durumu:** Mevcut kod ve doğrulanmış süreçleri ayıran çalışma notudur. Bu belge, uygulanmamış süreçleri varmış gibi göstermez.

## 1. Mevcut teknik taban

- Web uygulaması: React + TanStack Start/Router + Vite.
- Dil: TypeScript.
- Veri/auth: Supabase.
- Sinyal ve sonuç işleme: Supabase Edge Function `kpk-signals-cron`.
- Dış servisler: Bybit, OKX, Telegram; Fear & Greed için alternative.me.
- Paket yöneticisi: Bun lockfile ve `bun install --frozen-lockfile`.
- Üretim derleme komutu: `bun run build`.

## 2. Doğrulanmış kalite durumu

- GitHub Actions üzerinde bağımlılık kurulumu ve üretim derlemesi başarılıdır (PR dalındaki Build Check çalışması).
- Genel `bun run lint` kontrolü mevcut depoda çok sayıda hata nedeniyle başarısız olmuştur. Bu nedenle lint temiz denemez.
- Otomatik birim, entegrasyon veya uçtan uca test kapsamı bu belgeyle iddia edilmez.
- Canlı Supabase, cron, Bybit/OKX ve Telegram bağlantıları ayrıca doğrulanmalıdır.
- Build başarısı, canlı çalışma veya yatırım performansı garantisi değildir.

## 3. Güvenlik kuralları

- `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN` ve `CRON_SECRET` yalnızca sunucu/Edge Function secret alanlarında tutulur.
- Gizli anahtarlar istemci koduna, `VITE_*` değişkenlerine veya Git deposuna eklenmez.
- `kpk-signals-cron` kendi `x-cron-secret` kontrolünü kullanır. Supabase Vault'taki `cron_secret` ile Edge Function `CRON_SECRET` aynı olmalıdır.
- Alıcıya teslimden önce RLS politikaları, public Edge Function yüzeyi ve Telegram hedefi yeniden kontrol edilmelidir.
- Gerçek kullanıcı veya müşteri verisiyle test yapılmamalıdır; ayrı test Supabase projesi kullanılmalıdır.

## 4. Değişiklik ve yayın akışı

Mevcut depo için güvenli önerilen akış:
1. Değişikliği ayrı bir branch üzerinde yap.
2. Etkilenen dosyaları ve migration etkisini incele.
3. `bun install --frozen-lockfile` ve `bun run build` çalıştır.
4. İlgili testler varsa çalıştır; yoksa test eksikliğini açıkça kaydet.
5. PR diff'ini ve güvenlik etkisini incele.
6. Canlı Supabase/Telegram/cron veya hosting üzerinde değişiklik yapmadan önce açık onay al.
7. Geri alma adımını belirlemeden production değişikliği yapma.

Bu maddeler önerilen çalışma disiplinidir; depoda tamamlanmış staging/canary veya rollback otomasyonu olduğu anlamına gelmez.

## 5. Sinyal ve performans sunum ilkeleri

- Sinyal, yatırım tavsiyesi veya otomatik işlem emri değildir.
- Performans ekranındaki sabit TP/SL oranlarından türetilen EV brüt teoriktir.
- Komisyon, spread, kayma, likidite, emir gerçekleşmesi ve piyasa etkisi hesaba katılmaz.
- Geçmiş sonuçlar gelecekteki getiriyi garanti etmez.
- Whale verisi, Bybit spot son işlemler uç noktasından eşik üstü tekil işlemleri tarar; cüzdan sahipliği veya piyasa genelindeki tüm büyük yatırımcı akışı olarak tanımlanmamalıdır.
- Eksik/erişilemeyen veri gerçek değer gibi gösterilmemelidir.

## 6. Alıcıya teslim öncesi kontrol listesi

- [ ] Temiz bir test Supabase projesinde tüm migration'lar hatasız uygulanıyor.
- [ ] İlk kurulumda cron job güvenli ve tekrarlanabilir şekilde kuruluyor.
- [ ] Edge Function secrets ve Vault eşleşmesi doğrulanıyor.
- [ ] Bybit ve OKX uçları hedef çalışma ortamından erişilebilir.
- [ ] Telegram test bildirimi doğru hedefe ulaşıyor.
- [ ] Auth ve RLS izinleri yetkisiz erişimi engelliyor.
- [ ] Sinyal üretimi ve TP/SL çözümleme kontrollü test verisiyle doğrulanıyor.
- [ ] Performans ekranı gerçek kayıtlarla karşılaştırılıyor.
- [ ] Marka, kanal, iletişim, ödeme ve proje kimlikleri alıcıya göre yapılandırılıyor.
- [ ] Lisans, kaynak kod devri, üçüncü taraf bağımlılık lisansları ve destek kapsamı yazılı hale getiriliyor.

## 7. Açık teknik borçlar

- Genel ESLint temizliği.
- Migration'ların boş projede sorunsuz ve tekrar çalıştırılabilir olması.
- Sabit Telegram kanal kimliğinin yapılandırmaya taşınması.
- API/cron sağlık kontrolü ve hata görünürlüğü.
- Otomatik testlerin eklenmesi.
- Marka/kurulum ayarlarının tek noktadan yönetilmesi.

Bu maddeler tamamlanana kadar ürün “kurulumu ve canlı bağlantıları doğrulanmış, tamamen satışa hazır paket” olarak tanımlanmamalıdır.
