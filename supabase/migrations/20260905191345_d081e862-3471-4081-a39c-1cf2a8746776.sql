-- KELTOŞ — reserve the named cron job for the final Edge Function migration.
-- The next migration creates the buyer-configured endpoint after Vault secrets
-- have been supplied. Do not schedule the old Lovable-hosted endpoint here.
do $$
begin
  perform cron.unschedule('kpk-signals-cron');
exception when others then
  raise notice 'kpk-signals-cron job not found, skipping unschedule';
end $$;
