-- lovable-cron-fallback-reviewed: 288 runs/day; existing production signal scan on 15m candles, cadence preserved, only the request timeout is fixed
select cron.unschedule(1);

select cron.schedule(
  'kpk-signals-cron',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--984c0451-4eb3-4420-8cfb-fba99bbb94e9.lovable.app/api/public/hooks/kpk-signals-cron',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);