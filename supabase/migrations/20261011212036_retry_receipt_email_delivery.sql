-- Retry unresolved receipt email deliveries daily after the monthly billing run.
-- The function is idempotent for completed runs and caps each receipt at five attempts.
select cron.schedule(
  'riverbanc-retry-receipt-email-delivery',
  '30 3 * * *',
  $job$
    select net.http_post(
      url := 'https://zdpeaxkormwjrgllwalq.supabase.co/functions/v1/process-monthly-payroll-receipts',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'riverbanc_cron_secret')
      ),
      body := jsonb_build_object(
        'billing_date',
        (select max(billing_date)::text from public.billing_runs where status = 'completed')
      )
    )
    where exists (select 1 from public.billing_runs where status = 'completed');
  $job$
);
