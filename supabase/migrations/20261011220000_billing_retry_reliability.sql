-- Keep monthly billing runs retryable until every active payroll authorization is confirmed.
-- Retry outstanding email deliveries for every completed run, not only the latest run.

create or replace function private.run_riverbanc_monthly_billing(_billing_date date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.billing_runs;
  v_end date;
  s record;
  v_tx public.billing_transactions;
  v_receipt public.payment_receipts;
  n integer := 0;
  rc integer := 0;
  e integer := 0;
  v_has_unconfirmed_active_authorizations boolean := false;
begin
  if _billing_date is null or extract(day from _billing_date) <> 23 then
    raise exception 'Billing date must be the 23rd of a month';
  end if;

  v_end := (_billing_date + interval '1 month' - interval '1 day')::date;

  insert into public.billing_runs(billing_date, period_start, period_end, status, started_at)
  values (_billing_date, _billing_date, v_end, 'running', now())
  on conflict (billing_date) do update
  set status = case when public.billing_runs.status = 'completed' then public.billing_runs.status else 'running' end,
      started_at = case when public.billing_runs.status = 'completed' then public.billing_runs.started_at else now() end,
      completed_at = case when public.billing_runs.status = 'completed' then public.billing_runs.completed_at else null end,
      error_message = case when public.billing_runs.status = 'completed' then public.billing_runs.error_message else null end,
      updated_at = now()
  returning * into v_run;

  if v_run.status = 'completed' then
    return jsonb_build_object(
      'billing_run_id', v_run.id,
      'status', v_run.status,
      'transactions', v_run.transaction_count,
      'receipts', v_run.receipt_count,
      'idempotent', true
    );
  end if;

  select count(*) into e
  from public.subscription_authorizations
  where status = 'active';

  for s in
    select sa.user_id, sa.payroll_reference, sa.payroll_confirmed_at, p.full_name, p.email
    from public.subscription_authorizations sa
    join public.profiles p on p.user_id = sa.user_id
    where sa.status = 'active'
      and sa.payroll_status = 'confirmed'
  loop
    begin
      insert into public.billing_transactions(
        billing_run_id, user_id, period_start, period_end, amount, currency,
        payment_method, payroll_reference, status, confirmed_at
      )
      values (
        v_run.id, s.user_id, _billing_date, v_end, 60, 'ZMW',
        'payroll', s.payroll_reference, 'confirmed',
        coalesce(s.payroll_confirmed_at, now())
      )
      on conflict (user_id, period_start) do nothing
      returning * into v_tx;

      if v_tx.id is null then
        continue;
      end if;
      n := n + 1;

      insert into public.payment_receipts(
        billing_transaction_id, user_id, receipt_number, customer_name, customer_email,
        amount, currency, billing_period_start, billing_period_end, payment_method, payroll_reference
      )
      values (
        v_tx.id, s.user_id,
        'RB-' || to_char(_billing_date, 'YYYYMM') || '-' ||
          lpad(nextval('public.payment_receipt_number_seq')::text, 8, '0'),
        coalesce(nullif(trim(s.full_name), ''), 'Riverbanc Subscriber'),
        s.email, 60, 'ZMW', _billing_date, v_end, 'payroll', s.payroll_reference
      )
      returning * into v_receipt;

      insert into public.receipt_deliveries(receipt_id, channel, status, delivered_at)
      values
        (v_receipt.id, 'dashboard', 'available', now()),
        (v_receipt.id, 'email', 'pending', null);

      insert into public.audit_logs(
        user_id, role, action_performed, record_id, table_name, old_value, new_value
      )
      values (
        s.user_id, 'system', 'subscription_payment_receipted', v_receipt.id::text,
        'payment_receipts', null,
        jsonb_build_object(
          'receipt_number', v_receipt.receipt_number,
          'amount', 60,
          'currency', 'ZMW',
          'payment_method', 'payroll',
          'payroll_reference', s.payroll_reference,
          'billing_period_start', _billing_date,
          'billing_period_end', v_end
        )
      );
      rc := rc + 1;
    exception when unique_violation then
      null;
    end;
  end loop;

  select exists (
    select 1
    from public.subscription_authorizations
    where status = 'active'
      and payroll_status is distinct from 'confirmed'
  )
  into v_has_unconfirmed_active_authorizations;

  update public.billing_runs br
  set eligible_count = e,
      confirmed_count = (
        select count(*) from public.billing_transactions bt
        where bt.billing_run_id = br.id and bt.status = 'confirmed'
      ),
      transaction_count = (
        select count(*) from public.billing_transactions bt
        where bt.billing_run_id = br.id
      ),
      receipt_count = (
        select count(*)
        from public.payment_receipts pr
        join public.billing_transactions bt on bt.id = pr.billing_transaction_id
        where bt.billing_run_id = br.id
      ),
      status = case when v_has_unconfirmed_active_authorizations then 'pending' else 'completed' end,
      completed_at = case when v_has_unconfirmed_active_authorizations then null else now() end,
      error_message = null,
      updated_at = now()
  where br.id = v_run.id
  returning br.* into v_run;

  return jsonb_build_object(
    'billing_run_id', v_run.id,
    'status', v_run.status,
    'eligible', v_run.eligible_count,
    'confirmed', v_run.confirmed_count,
    'transactions', v_run.transaction_count,
    'receipts', v_run.receipt_count,
    'created_now', n,
    'receipts_created_now', rc,
    'awaiting_payroll_confirmation', v_has_unconfirmed_active_authorizations,
    'idempotent', false
  );
end;
$$;

-- Daily retry: revisit this month's unfinished billing run and retry all outstanding
-- email deliveries from completed runs, with the Edge Function's five-attempt cap.
do $migration$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname = 'riverbanc-retry-receipt-email-delivery';
  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;
  select jobid into v_job_id from cron.job where jobname = 'riverbanc-billing-retry';
  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;
  perform cron.schedule(
  'riverbanc-billing-retry',
  '30 3 * * *',
  $job$
    select net.http_post(
      url := 'https://zdpeaxkormwjrgllwalq.supabase.co/functions/v1/process-monthly-payroll-receipts',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'riverbanc_cron_secret')
      ),
      body := jsonb_build_object('billing_date', due.billing_date::text)
    )
    from (
      select br.billing_date
      from public.billing_runs br
      where br.status in ('pending', 'failed')
        and br.billing_date = (
          date_trunc('month', now() at time zone 'Africa/Lusaka')::date + interval '22 days'
        )::date
        and br.billing_date <= (now() at time zone 'Africa/Lusaka')::date

      union

      select distinct br.billing_date
      from public.billing_runs br
      join public.billing_transactions bt on bt.billing_run_id = br.id
      join public.payment_receipts pr on pr.billing_transaction_id = bt.id
      join public.receipt_deliveries rd on rd.receipt_id = pr.id
      where br.status = 'completed'
        and rd.channel = 'email'
        and rd.status in ('pending', 'failed')
        and rd.attempt_count < 5
    ) due;
  $job$
  );
end;
$migration$;
