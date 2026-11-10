# White-Label Market Analysis Terminal — Kurulum Rehberi

Bu panel, kripto sinyalleri üreten bir Supabase Edge Function (cron) + TanStack
Start tabanlı bir frontend'den oluşur. Aşağıdaki adımlar, paneli **kendi Supabase
projenizde** sıfırdan ayağa kaldırmak içindir.

Tüm veriler gerçek kaynaklardan gelir (Bybit, OKX, alternative.me). Veri yoksa
panel ilgili bölümü boş/"veri yok" olarak gösterir; uydurma değer üretilmez.

---

## 0. Genel Mimari

- **Frontend** (`src/`): TanStack Start uygulaması. Supabase'e yalnızca
  publishable (anon) key ile bağlanır; veriler RLS ile korunur.
- **Sinyal motoru** (`supabase/functions/kpk-signals-cron`): Deno Edge Function.
  Bybit'ten mum verisi çeker, indikatör + skor hesaplar, TP/SL sonucunu çözer,
  Supabase'e service role ile yazar ve Telegram'a bildirim gönderir.
- **Fear & Greed** (`supabase/functions/fear-greed`): alternative.me endeksini
  çekip `market_sentiment` tablosunda önbelleğe alır.
- **Zamanlama**: Supabase içindeki `pg_cron`, sinyal fonksiyonunu 5 dakikada bir
  `net.http_post` ile tetikler.

---

## 1. Ortam Değişkenleri

### 1a. Frontend (repo `.env`)

`.env.example` dosyasını `.env` olarak kopyalayın ve doldurun:

| Değişken | Açıklama | Gizli mi? |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://<PROJECT_REF>.supabase.co` | Hayır (public) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable (anon) key | Hayır (public) |
| `VITE_SUPABASE_PROJECT_ID` | Proje ref'i | Hayır |

> `.env` dosyası `.gitignore`'dadır, **asla commit edilmez**. Örnek için
> `.env.example` kullanın.

### 1b. Edge Function Secrets (Supabase Dashboard → Edge Functions → Secrets)

Bu değerler **repoya girilmez**, yalnızca Supabase Secrets'a elle eklenir:

| Secret | Nereden alınır | Kullanım |
|---|---|---|
| `SUPABASE_URL` | Project Settings → API | Fonksiyonların DB'ye bağlanması |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API (service_role) | Cron'un tablolara yazması |
| `TELEGRAM_BOT_TOKEN` | Telegram @BotFather | Sinyal/sonuç bildirimi |
| `CRON_SECRET` | Kendiniz üretin (uzun rastgele değer) | pg_cron → fonksiyon doğrulaması |

> `SUPABASE_URL` ve `SUPABASE_SERVICE_ROLE_KEY` çoğu Supabase projesinde edge
> function'lara otomatik enjekte edilir; yine de eksikse elle ekleyin.
>
> `CRON_SECRET` üretmek için örn: `openssl rand -hex 32`

Telegram kanal kimliği (`TELEGRAM_CHAT_ID`) kodda sabittir
(`supabase/functions/kpk-signals-cron/index.ts`). Kendi kanalınızı kullanmak
için oradaki değeri değiştirin.

---

## 2. Supabase Projesi Kurulumu

1. **Supabase projesi oluşturun** (https://supabase.com). Proje ref'inizi not edin.
2. **Repoyu bağlayın**: Supabase Dashboard → Project Settings → Integrations →
   **GitHub**. Bu repoyu seçin. Böylece `main`'e her push'ta `supabase/migrations`
   ve `supabase/functions` otomatik deploy edilir.
   - Alternatif (CLI ile elle):
     ```bash
     npm i -g supabase
     supabase login
     supabase link --project-ref <PROJECT_REF>
     supabase db push          # migration'ları uygular
     supabase functions deploy kpk-signals-cron
     supabase functions deploy fear-greed
     ```
3. **`config.toml`**: `project_id` sizin ref'iniz olmalı. Bu repoda örnek proje kimliği kullanılır; gerçek Supabase bağlantısı `.env` ve Vault secret'larından gelir.
4. **Edge Function Secrets**'i girin (bkz. 1b).

> `config.toml` içinde her iki fonksiyon için `verify_jwt = false` ayarlıdır:
> `kpk-signals-cron` kendi `x-cron-secret` kontrolünü yapar; `fear-greed` herkese
> açık salt-okunur uçtur.

---

## 3. Veritabanı & pg_cron

Migration'lar (`supabase/migrations/`) tabloları, RLS'i ve `pg_cron` işini kurar.
`supabase db push` (veya GitHub entegrasyonu) bunları uygular.

**Whale Radar veri tablosu:** `20261110090000_create_whale_events.sql`,
Bybit spot işlemlerinden eşik üstü tekil işlemleri saklayan `whale_events`
tablosunu oluşturur. Kaynak işlem kimliği benzersizdir; aynı işlem sonraki
cron taramalarında tekrar yazılmaz. Bu tabloya herkese açık SELECT, yalnızca
`service_role` için INSERT izni verilir. Bu migration uygulanmadan Whale Radar
ekranında olay listesi veri alamaz.

**Önemli — cron migration'ından ÖNCE Vault secret'i ekleyin.**
`pg_cron` işi, `x-cron-secret` değerini çalışma anında Supabase Vault'tan okur
(düz metin saklanmaz). SQL Editor'de:

```sql
select vault.create_secret('CRON_SECRET_DEGERI', 'cron_secret');
select vault.create_secret('https://<PROJECT_REF>.supabase.co', 'supabase_url');
select vault.create_secret('sb_publishable_<PROJECT_KEY>', 'supabase_publishable_key');
```

Bu değer, edge function'ın `CRON_SECRET` secret'iyle **birebir aynı** olmalıdır.
Eşleşmezse fonksiyon 401 döner ve sinyal üretilmez.

`20260926120000_reschedule_cron_to_edge_function.sql` migration'ı URL'yi,
publishable key'i ve CRON_SECRET değerini Vault'tan okur. Bu nedenle üç Vault
secret'ı migration çalıştırılmadan önce oluşturulmalıdır; SQL dosyasını alıcıya
özel URL veya anahtarla elle düzenlemek gerekmez.

Cron'un çalıştığını kontrol:
```sql
select * from cron.job;                          -- iş kayıtlı mı
select * from cron.job_run_details order by start_time desc limit 10;  -- son koşular
```

> **Cron migration notu:** İlk migration yalnızca eski isimli işi temizler; eski
> Lovable endpoint'ine istek göndermez. Sonraki migration, alıcıya ait Vault
> secret'ları kullanarak `kpk-signals-cron` işini oluşturur.

---

## 4. Frontend'i Çalıştırma / Deploy

```bash
bun install      # veya npm install
bun run dev      # yerel geliştirme
bun run build    # production derleme
```

Frontend'i istediğiniz statik/SSR host'a (Vercel, Netlify, Cloudflare, Lovable
vb.) deploy edin. `VITE_*` değişkenlerini host'un ortam değişkenlerine girmeyi
unutmayın.

---

## 5. Doğrulama Kontrol Listesi

- [ ] `.env` dolduruldu, `VITE_SUPABASE_URL` doğru.
- [ ] Edge Function Secrets girildi (`SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN`, `CRON_SECRET`).
- [ ] Vault'ta `cron_secret` var ve `CRON_SECRET` ile aynı.
- [ ] `config.toml` yerel proje adı geneldir; Vault'taki `supabase_url` ve `supabase_publishable_key` sizin projenize aittir.
- [ ] `supabase functions deploy` iki fonksiyonu da deploy etti.
- [ ] `cron.job_run_details` başarılı koşu gösteriyor.
- [ ] Panelde sinyaller, fiyatlar ve Fear & Greed görünüyor.
- [ ] Whale Radar migration uygulanmış ve olay kayıtları doğrulanmış.
- [ ] 48 saatlik sinyal resolver davranışı, tam mum kapsamı ve eksik veri senaryolarıyla test edilmiş.
- [ ] `suresi_doldu` kayıtlarının isabet oranı ve EV hesaplarına girmediği doğrulanmış.
- [ ] Alıcıya ait Telegram botu ve hedef kanalına test bildirimi ulaştığı doğrulanmış.
- [ ] Alıcıya ait Supabase projesinde RLS, cron, Edge Function logları ve API rate-limit davranışı doğrulanmış.
- [ ] Mobil ve masaüstü ekranları gerçek veriyle kontrol edilmiş.

---

## Satış Öncesi Teslimat Sınırı

Bu rehber, alıcının kendi altyapısına kurulum içindir. Kaynak kodun derlenmesi canlı servislerin çalıştığını kanıtlamaz. Her alıcı ayrı Supabase projesi, domain/hosting ve Telegram botu kullanmalıdır. Marka adı, logo, slogan, ana renk, vurgu rengi ve alt bilgi `/branding` yönetim ekranından yapılandırılır. Marka ayarları yalnızca ilgili kurulumun `app_metadata.role = "admin"` yetkisine sahip yöneticisi tarafından değiştirilebilir.

Her satışta alıcıya özel deployment ve ayrı veri altyapısı kullanılmalıdır; bu paket ortak çok kiracılı (multi-tenant) hizmet olarak tasarlanmamıştır. Canlıya geçişten önce yukarıdaki kontrol listesi tamamlanmalıdır.
