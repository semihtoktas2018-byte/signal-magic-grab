# KELTOŞ — Kripto Sinyal ve Piyasa İzleme Paneli

KELTOŞ, kripto varlıklar için teknik gösterge tabanlı BUY / SELL / WAIT sinyalleri, sinyal geçmişi, teorik TP/SL sonuç takibi ve piyasa izleme ekranları sunan bir web uygulamasıdır.

> **Önemli risk bildirimi:** KELTOŞ yatırım danışmanlığı, portföy yönetimi veya emir iletim sistemi değildir. Üretilen sinyaller kâr garantisi vermez. Geçmiş veya teorik performans gelecekteki sonuçları göstermez. Komisyon, spread, kayma ve gerçek emir gerçekleşmesi performans hesabına dahil değildir.

## Mevcut kapsam

- Teknik göstergelerle sinyal üretimi: EMA, RSI, MACD, Bollinger ve hacim ölçümleri.
- Sinyal kayıtları ve BUY / SELL / WAIT gösterimi.
- Tanımlı TP/SL seviyelerine göre teorik sonuç çözümleme.
- Performans ekranında kapanmış sinyaller üzerinden brüt teorik EV özeti.
- Whale Radar: Bybit spot işlemler akışında tanımlı eşik üzerindeki tekil işlemleri izleme. Bu özellik cüzdan takibi veya tüm piyasa balina akışı değildir.
- Fear & Greed verisi için ayrı Supabase Edge Function.
- Telegram bildirim entegrasyonu (kanal ve bot yapılandırması gerekir).

**Veri kaynağı ve çalışma durumu:** Kodda Bybit, OKX ve alternative.me entegrasyonları bulunur. Ancak bu depodaki kaynak kodun varlığı, alıcı ortamında API erişiminin, Supabase cron'unun, Telegram teslimatının veya canlı panelin çalıştığını tek başına kanıtlamaz. Bunlar kurulum sonrasında ayrıca doğrulanmalıdır.

## Teknoloji

- Frontend: React, TanStack Start / Router, Vite, TypeScript
- Backend ve veri katmanı: Supabase, PostgreSQL, Edge Functions
- Zamanlama: Supabase pg_cron
- Bildirim: Telegram Bot API
- Paket yöneticisi: Bun (kilit dosyası: `bun.lock`)

## Gereksinimler

- Bun
- Supabase projesi
- Supabase CLI (migration ve Edge Function dağıtımı için)
- Telegram botu ve hedef kanal/grup (bildirim kullanılacaksa)
- Harici API erişimi

## Hızlı başlangıç

1. Depoyu klonlayın.
2. `.env.example` dosyasını `.env` olarak kopyalayıp frontend Supabase değişkenlerini doldurun.
3. Supabase proje kimliğini `supabase/config.toml` içinde kendi projenize göre güncelleyin.
4. `SETUP.md` dosyasındaki veritabanı, Vault, Edge Function ve cron adımlarını tamamlayın.
5. Yerel geliştirme için:

```bash
bun install --frozen-lockfile
bun run dev
```

Üretim derlemesi:

```bash
bun run build
```

Ayrıntılı kurulum ve doğrulama adımları için [SETUP.md](./SETUP.md), mimari için [ARCHITECTURE.md](./ARCHITECTURE.md), satış ve devir kapsamı için [SALES_HANDOVER.md](./SALES_HANDOVER.md) dosyalarına bakın.

## Yapılandırma ve devralma notları

Bu depo, başka bir operatörün kendi altyapısına taşıması için uyarlanmalıdır. Özellikle:

- Supabase proje kimliği ve ortam değişkenleri alıcıya göre değiştirilmelidir.
- Edge Function secret'ları güvenli biçimde yeniden oluşturulmalıdır; service-role anahtarı frontend'e veya depoya konulmamalıdır.
- Telegram bot token'ı ve hedef kanal kimliği alıcının kendi değerleriyle değiştirilmelidir.
- Marka metinleri, ödeme bağlantıları, WhatsApp bilgileri ve diğer sabit bağlantılar kontrol edilmelidir.
- Migration'lar temiz bir Supabase projesinde uygulanmadan önce `SETUP.md` içindeki cron migration uyarısı ele alınmalıdır.
- Canlıya geçmeden önce API erişimi, cron çalışma kayıtları, sinyal kayıtları, oturum açma, ekranlar ve Telegram teslimatı uçtan uca test edilmelidir.

## Kalite durumu

Depoda otomatik üretim derlemesi kontrolü bulunmaktadır. Mevcut ESLint yapılandırmasının tüm depoda çalıştırılması, önceden var olan çok sayıda biçimlendirme ve tip uyarısı/hatası nedeniyle başarısız olmuştur. Bu nedenle lint temizliği tamamlanmış olarak sunulmamaktadır. Derleme ve canlı ortam doğrulaması ayrı ayrı raporlanmalıdır.

## Lisans ve satış

Alıcıya sunum ve devir kapsamı için [SALES_HANDOVER.md](./SALES_HANDOVER.md) dosyasına bakın. Lisans türü, kullanım hakkı, yeniden satış, destek, ücret ve üçüncü taraf bağımlılık koşulları taraflar arasında yazılı sözleşmeyle belirlenmelidir. Bu depo için henüz alıcıya özel ticari lisans veya münhasır hak devri taahhüdü verilmemektedir. Üçüncü taraf paketlerin ve servislerin kendi lisans/şartları geçerlidir.
