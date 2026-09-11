-- Yardımcı tablolarda RLS'i güvene al: exchange_prices, whale_events
--
-- Bu tablolar cron tarafından service_role ile YAZILIR (service_role RLS'i
-- bypass eder, yani yazma etkilenmez) ve panel tarafından anon ile SADECE
-- OKUNUR. Aşağıdaki politikalar public okumayı açık tutar; yazma/silme
-- yalnızca service_role'da kalır. kpk_signals ile aynı desen.
--
-- Not: Tablolar Lovable Cloud'da elle oluşturulmuş olabilir; bu migration
-- yalnızca RLS'i ve okuma politikasını ekler, tabloların kendisini değiştirmez.
-- Zaten RLS açıksa ENABLE tekrarı zararsızdır; DROP POLICY IF EXISTS mevcut
-- politikayla çakışmayı önler.

-- ---------- exchange_prices ----------
ALTER TABLE public.exchange_prices ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.exchange_prices TO anon;
GRANT SELECT ON public.exchange_prices TO authenticated;
GRANT ALL ON public.exchange_prices TO service_role;

DROP POLICY IF EXISTS "Public can read exchange prices" ON public.exchange_prices;
CREATE POLICY "Public can read exchange prices"
  ON public.exchange_prices FOR SELECT
  USING (true);

-- ---------- whale_events ----------
ALTER TABLE public.whale_events ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.whale_events TO anon;
GRANT SELECT ON public.whale_events TO authenticated;
GRANT ALL ON public.whale_events TO service_role;

DROP POLICY IF EXISTS "Public can read whale events" ON public.whale_events;
CREATE POLICY "Public can read whale events"
  ON public.whale_events FOR SELECT
  USING (true);
