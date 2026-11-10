-- lovable-cron-fallback-reviewed: 288 runs/day; existing production signal scan on 15m candles, cadence preserved, only the request timeout is fixed
-- Remove only this application's named job. Never assume job id 1 belongs to KELTOŞ.
do $$
begin
  perform cron.unschedule('kpk-signals-cron');
exception when others then
  raise notice 'kpk-signals-cron job not found, skipping unschedule';
end $$;

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