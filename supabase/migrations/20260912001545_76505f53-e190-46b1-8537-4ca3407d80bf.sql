CREATE TABLE public.market_sentiment (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  value integer NOT NULL,
  classification text NOT NULL,
  source_timestamp timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX market_sentiment_source_timestamp_key ON public.market_sentiment (source_timestamp);

GRANT SELECT ON public.market_sentiment TO anon;
GRANT SELECT ON public.market_sentiment TO authenticated;
GRANT ALL ON public.market_sentiment TO service_role;

ALTER TABLE public.market_sentiment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read market sentiment" ON public.market_sentiment FOR SELECT USING (true);