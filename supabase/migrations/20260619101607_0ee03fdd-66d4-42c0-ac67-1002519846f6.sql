CREATE TABLE public.kpk_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coin TEXT NOT NULL,
  signal TEXT NOT NULL,
  score INTEGER NOT NULL,
  quality TEXT,
  price NUMERIC NOT NULL,
  result TEXT NOT NULL DEFAULT 'bekliyor',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ
);
CREATE INDEX kpk_signals_created_idx ON public.kpk_signals (created_at DESC);
CREATE INDEX kpk_signals_open_idx ON public.kpk_signals (result) WHERE result = 'bekliyor';

GRANT SELECT ON public.kpk_signals TO anon;
GRANT SELECT ON public.kpk_signals TO authenticated;
GRANT ALL ON public.kpk_signals TO service_role;

ALTER TABLE public.kpk_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read signals"
  ON public.kpk_signals FOR SELECT
  USING (true);

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;