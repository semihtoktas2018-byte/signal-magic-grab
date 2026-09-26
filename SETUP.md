# KELTOŞ Panel — Kurulum Rehberi

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
3. **`config.toml`**: `project_id` sizin ref'iniz olmalı. Bu repoda
   `gmwlkkebwpenocatlmty` olarak ayarlıdır; kendi ref'inizle değiştirin.
4. **Edge Function Secrets**'i girin (bkz. 1b).

> `config.toml` içinde her iki fonksiyon için `verify_jwt = false` ayarlıdır:
> `kpk-signals-cron` kendi `x-cron-secret` kontrolünü yapar; `fear-greed` herkese
> açık salt-okunur uçtur.

---

## 3. Veritabanı & pg_cron

Migration'lar (`supabase/migrations/`) tabloları, RLS'i ve `pg_cron` işini kurar.
`supabase db push` (veya GitHub entegrasyonu) bunları uygular.

**Önemli — cron migration'ından ÖNCE Vault secret'i ekleyin.**
`pg_cron` işi, `x-cron-secret` değerini çalışma anında Supabase Vault'tan okur
(düz metin saklanmaz). SQL Editor'de:

```sql
select vault.create_secret('EDGE-FUNCTION-CRON_SECRET-ILE-AYNI-DEGER', 'cron_secret');
```

Bu değer, edge function'ın `CRON_SECRET` secret'iyle **birebir aynı** olmalıdır.
Eşleşmezse fonksiyon 401 döner ve sinyal üretilmez.

`20260926120000_reschedule_cron_to_edge_function.sql` migration'ı, cron işini
5 dakikada bir şu adrese POST atacak şekilde kurar:
`https://<PROJECT_REF>.supabase.co/functions/v1/kpk-signals-cron`
(URL'yi kendi ref'inizle güncelleyin.)

Cron'un çalıştığını kontrol:
```sql
select * from cron.job;                          -- iş kayıtlı mı
select * from cron.job_run_details order by start_time desc limit 10;  -- son koşular
```

> **Sıfırdan kurulum notu:** Daha eski bir migration
> (`20260905191345_...sql`) `select cron.unschedule(1)` satırı içerir. Bu satır,
> henüz hiç cron işi olmayan **bomboş** bir projede "job 1 not found" hatası
> verebilir ve `db push`'u durdurabilir. Karşılaşırsanız güvenle atlayabilir
> (o satırı geçici olarak yorum satırı yapıp devam edebilir) ya da önce boş bir
> job kaydı oluşturabilirsiniz; nihai zamanlamayı zaten bu dosyadaki yeni
> migration (`20260926120000_...`) doğru adrese kurar.

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
- [ ] `config.toml` ve cron migration'ındaki proje ref'i sizinki.
- [ ] `supabase functions deploy` iki fonksiyonu da deploy etti.
- [ ] `cron.job_run_details` başarılı koşu gösteriyor.
- [ ] Panelde sinyaller, fiyatlar ve Fear & Greed görünüyor.

---

## Marka Notu

Footer imzası **"A BAMIR ONLINE STORE'S PRODUCTION"** korunur. "KELTOŞ" markası,
Shopier ödeme linkleri, WhatsApp numarası ve Telegram kanalı kod içinde
tanımlıdır; kendi markanıza uyarlamak için ilgili dosyalarda güncelleyin.
