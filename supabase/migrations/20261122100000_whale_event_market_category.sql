-- Distinguish Bybit Spot trades from USDT perpetual (linear) trades.
-- Existing rows are historical Spot events and retain that classification.
alter table public.whale_events
  add column if not exists category text not null default 'spot';

alter table public.whale_events
  add constraint whale_events_category_check
  check (category in ('spot', 'linear'));
