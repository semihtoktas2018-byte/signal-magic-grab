-- Faz 0: sinyal ölçüm altyapısı — kpk_signals'a analiz alanları eklenir.
-- Hepsi NULLABLE ve IF NOT EXISTS: mevcut kayıtları ve çalışan insert'i bozmaz.
-- ÖNEMLİ: Bu SQL, yeni cron kodu deploy olmadan ÖNCE çalıştırılmalı (yoksa
-- insert olmayan kolona yazmaya çalışır).

alter table public.kpk_signals add column if not exists entry_snapshot numeric;
alter table public.kpk_signals add column if not exists entry_snapshot_at timestamptz;
alter table public.kpk_signals add column if not exists components jsonb;
alter table public.kpk_signals add column if not exists score_band text;
