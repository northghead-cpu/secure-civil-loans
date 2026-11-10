-- Supabase/Postgres is kept in UTC. 22:05 UTC on the 22nd is 00:05 Africa/Lusaka on the 23rd.
SELECT cron.schedule(
  'riverbanc-monthly-payroll-billing',
  '5 22 22 * *',
  $$SELECT private.run_riverbanc_monthly_billing((CURRENT_DATE + INTERVAL '1 day')::date);$$
);
