-- Persist the largest qualifying Bybit spot trade per coin without duplicates.
-- The source trade ID is unique so repeated cron scans cannot duplicate the same trade.

create table if not exists public.whale_events (
  id uuid primary key default gen_random_uuid(),
  source_trade_id text not null unique,
  coin text not null,
  side text not null check (side in ('BUY', 'SELL')),
  amount_usd numeric(30, 8) not null check (amount_usd >= 0),
  price numeric(30, 12) not null check (price > 0),
  created_at timestamptz not null,
  inserted_at timestamptz not null default now()
);

create index if not exists whale_events_created_at_desc_idx
  on public.whale_events (created_at desc);

create index if not exists whale_events_coin_created_at_idx
  on public.whale_events (coin, created_at desc);

alter table public.whale_events enable row level security;

drop policy if exists "Public can read whale events" on public.whale_events;
create policy "Public can read whale events"
  on public.whale_events
  for select
  to anon, authenticated
  using (true);

grant select on public.whale_events to anon, authenticated;
grant insert on public.whale_events to service_role;
