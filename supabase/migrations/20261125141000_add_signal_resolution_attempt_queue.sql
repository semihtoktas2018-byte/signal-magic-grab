-- Persist the last resolution attempt so cron runs can process pending rows fairly.
alter table public.kpk_signals
  add column resolve_attempted_at timestamptz;

-- Seed existing rows by their creation time; this preserves oldest-first ordering.
update public.kpk_signals
set resolve_attempted_at = created_at
where resolve_attempted_at is null;

alter table public.kpk_signals
  alter column resolve_attempted_at set default now(),
  alter column resolve_attempted_at set not null;

create index if not exists kpk_signals_pending_resolution_queue_idx
  on public.kpk_signals (resolve_attempted_at, created_at)
  where result = 'bekliyor';
