-- KELTOŞ — pg_cron işini yeni Supabase Edge Function adresine çevir.
--
-- Eski kurulum, sinyal cron'unu Lovable Cloud'daki TanStack route'una
-- (project--....lovable.app/api/public/hooks/kpk-signals-cron) POST atacak
-- şekilde zamanlıyordu. Sinyal motoru artık bir Supabase Edge Function'a
-- taşındığı için işi yeni adrese yeniden zamanlıyoruz. Cadence aynı: 5 dakika.
--
-- GÜVENLİK:
--   * Proje URL'si ve publishable key Vault'tan okunur; migration içinde sabitlenmez.
--   * CRON_SECRET gizlidir; bu dosyaya DÜZ METİN yazılmaz. Çalışma anında
--     Supabase Vault'tan okunur. Bu migration'ı çalıştırmadan ÖNCE Vault'a
--     'cron_secret' adında bir secret ekleyin (değeri, edge function'ın
--     CRON_SECRET ortam değişkeniyle AYNI olmalı):
--
--       select vault.create_secret('CRON_SECRET_DEGERI', 'cron_secret');
select vault.create_secret('https://<PROJECT_REF>.supabase.co', 'supabase_url');
select vault.create_secret('sb_publishable_<PROJECT_KEY>', 'supabase_publishable_key');
--
--   Aynı değeri Supabase Dashboard → Edge Functions → Secrets içine de
--   CRON_SECRET olarak girin. İkisi eşleşmezse edge function 401 döner.

-- Gerekli eklentiler (zaten kuruluysa zararsız)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Eski işi adıyla güvenli şekilde kaldır (yoksa hata vermesin)
do $$
begin
  perform cron.unschedule('kpk-signals-cron');
exception when others then
  raise notice 'kpk-signals-cron job not found, skipping unschedule';
end $$;

-- Yeni edge function adresine 5 dakikada bir POST at.
-- x-cron-secret değeri çalışma anında Vault'tan okunur (düz metin değil).
select cron.schedule(
  'kpk-signals-cron',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_url') || '/functions/v1/kpk-signals-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_publishable_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
