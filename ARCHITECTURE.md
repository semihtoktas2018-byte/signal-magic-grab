# KELTOŞ — Mevcut Mimari

Bu belge, depodaki mevcut uygulamayı açıklar. Çalıştığı canlı servisler ve dış hesap ayarları ayrıca doğrulanmadıkça doğrulanmış kabul edilmez.

## Uygulama bileşenleri

- **Web arayüzü:** React, TanStack Start/Router ve Vite. Rotalar `src/routes/` altında bulunur.
- **Veri ve kimlik doğrulama:** Supabase istemcisi, Auth ve RLS politikaları. İstemci yapılandırması `src/integrations/supabase/` altındadır.
- **Sinyal üretimi:** Supabase Edge Function `supabase/functions/kpk-signals-cron/index.ts`. Fonksiyon piyasa verisi alır, göstergeleri/puanlamayı hesaplar, sinyal kayıtlarını günceller ve yapılandırılmış Telegram hedefine bildirim gönderebilir.
- **Zamanlama:** Depodaki SQL migration'ları Supabase `pg_cron` ve `pg_net` üzerinden Edge Function çağrısı kurmayı hedefler. Canlı projede cron kaydının, Vault secret'ının ve son başarılı çalışmanın ayrıca kontrol edilmesi gerekir.
- **Fear & Greed:** Ayrı `fear-greed` Edge Function'ı ve ilgili tablo/arayüz entegrasyonu bulunur. Kaynağa erişim ve canlı güncelleme durumu bu depo incelemesiyle kanıtlanmış değildir.

## Sinyal akışı

1. Edge Function dış piyasa uçlarından mum, fiyat ve yakın dönem işlem verilerini almaya çalışır.
2. Teknik göstergeler ve V1 sinyal mantığı hesaplanır. V2 skoru karşılaştırma/analiz amaçlıdır; V1 kararının yerine geçmez.
3. Eşik ve tur başına kayıt sınırına uyan sinyaller Supabase'e yazılır.
4. Telegram bildirimi yapılandırılmış bot ve kanal kimliğiyle gönderilmeye çalışılır.
5. Resolver, açık sinyallerin hedef/stop seviyelerine ulaşıp ulaşmadığını kontrol ederek sonuç alanlarını günceller.
6. `/performance` ekranı kayıtlı sinyallerden geçmiş sonuç ve teorik metrikleri hesaplar.

Bu akışın kaynak kodda bulunması, dış servislerin şu anda erişilebilir veya cron'un canlıda çalışıyor olduğu anlamına gelmez.

## Dış servisler ve yapılandırma

| Bileşen | Kodda görülen kullanım | Canlı doğrulama |
|---|---|---|
| Bybit | Mum, ticker ve son işlemler uçları | Yapılmadı |
| OKX | Ticker/fiyat karşılaştırması | Yapılmadı |
| Supabase | Auth, veritabanı, Edge Functions | Yapılmadı |
| Telegram | Bot API ile bildirim | Yapılmadı |
| alternative.me | Fear & Greed kaynağı | Yapılmadı |

Gizli değerler Supabase Edge Function Secrets içinde tutulmalıdır. `SUPABASE_SERVICE_ROLE_KEY`, bot token'ı ve cron secret istemciye veya depoya konulmamalıdır. `TELEGRAM_CHAT_ID` mevcut kaynak kodda sabittir; başka kurulumda değiştirilmesi gerekir.

## Güvenlik sınırları

- `kpk-signals-cron` için platform JWT kontrolü kapalıdır; fonksiyonun kendi `x-cron-secret` kontrolü güvenlik sınırıdır. Secret'ın güçlü, gizli ve Vault ile Edge Function ayarında eşleşmiş olması gerekir.
- `fear-greed` için `verify_jwt = false` ayarı vardır. Fonksiyonun yalnızca gerekli salt-okunur veriyi açtığı ve CORS davranışı ayrıca incelenmelidir.
- Supabase RLS politikaları ve migration'lar yeni bir Supabase projesinde uygulanmadan önce incelenmelidir.
- Canlı servis anahtarları bu depoya yazılmamalıdır.

## Bilinen sınırlamalar

- Canlı Bybit/OKX erişimi, Supabase proje ayarları, cron çalışma geçmişi ve Telegram teslimatı bu kod incelemesinde doğrulanmadı.
- `exchange_prices` tablosunun canlı veriyle beslenmesi ve ekranın dolu görünmesi ayrı doğrulama gerektirir.
- Sinyal performans metrikleri geçmiş kayıtların ve sabit TP/SL kurallarının teorik değerlendirmesidir. Komisyon, spread, kayma ve gerçek emir gerçekleşmesi dahil değildir.
- Resolver, TP/SL temasından önceki 15 dakikalık mumların eksiksiz olduğunu doğrulamadan sonucu kesinleştirmez. 48 saat sonunda da yalnızca tüm pencerenin gerekli mum kapsamı eksiksizse `suresi_doldu` yazar. Veri boşluğu varsa kayıt beklemede kalır. Süresi dolan kayıtlar isabet oranı ve teorik EV paydasına dahil edilmez.
- Bu yeni resolver davranışı feature branch kodundadır; canlı Edge Function dağıtımı yapılmış olduğu anlamına gelmez.
- Otomatik işlem/emir iletimi bu dokümanda mevcut özellik olarak sunulmaz.
- CI üretim derlemesini kontrol eder. Genel ESLint kontrolü şu anda başarısızdır; lint temizliği tamamlanmış değildir.

## Önerilen sonraki mühendislik işleri

1. Temiz Supabase projesinde migration'ları test etmek ve cron kurulumunu idempotent hale getirmek.
2. Dış API hataları, eksik veri ve rate-limit durumlarında görünür sağlık durumu/uyarı eklemek.
3. Sinyal resolver'ı için testler ve geçmiş mumlarla kontrollü doğrulama eklemek; 48 saat sonunda hedef/stop görmeyen sinyaller için ayrı bir zaman aşımı durumu tasarlamak.
4. RLS, Edge Function erişimi ve secret rotasyonu için güvenlik incelemesi yapmak.
5. Alıcıya özel marka, kanal, Supabase proje ref'i ve dağıtım ayarlarını yapılandırılabilir hale getirmek.
