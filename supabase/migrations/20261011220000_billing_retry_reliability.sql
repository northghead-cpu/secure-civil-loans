-- Keep monthly billing runs retryable until every active payroll authorization is confirmed.
-- Retry outstanding email deliveries for every completed run, not only the latest run.


-- A subscription authorization is not evidence that each month's deduction happened.
-- Store a separate, immutable, evidence-backed outcome for every user and billing period.
create table if not exists public.payroll_deduction_confirmations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  billing_period_start date not null check (extract(day from billing_period_start) = 23),
  status text not null check (status in ('confirmed', 'failed')),
  payroll_reference text,
  evidence_reference text not null check (char_length(btrim(evidence_reference)) between 1 and 240),
  evidence_confirmed boolean not null check (evidence_confirmed is true),
  confirmed_by uuid not null references auth.users(id) on delete restrict,
  confirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, billing_period_start),
  check (status <> 'confirmed' or nullif(btrim(payroll_reference), '') is not null)
);
create index if not exists payroll_deduction_confirmations_period_status_idx
  on public.payroll_deduction_confirmations (billing_period_start, status, user_id);
alter table public.payroll_deduction_confirmations enable row level security;
drop policy if exists payroll_deduction_confirmations_admin_read on public.payroll_deduction_confirmations;
create policy payroll_deduction_confirmations_admin_read
  on public.payroll_deduction_confirmations for select to authenticated
  using (
    (select private.has_role('admin'::text))
    or (select private.has_role('super_admin'::text))
    or (select private.has_role('compliance_team'::text))
  );
revoke insert, update, delete on public.payroll_deduction_confirmations from anon, authenticated;

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
    select sa.user_id, pd.payroll_reference, pd.confirmed_at as payroll_confirmed_at, p.full_name, p.email
    from public.payroll_deduction_confirmations pd
    join public.subscription_authorizations sa on sa.user_id = pd.user_id and sa.status = 'active'
    join public.profiles p on p.user_id = sa.user_id
    where pd.billing_period_start = _billing_date
      and pd.status = 'confirmed'
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
    from public.subscription_authorizations sa
    where sa.status = 'active'
      and not exists (
        select 1
        from public.payroll_deduction_confirmations pd
        where pd.user_id = sa.user_id
          and pd.billing_period_start = _billing_date
      )
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
      status = case
        when v_has_unconfirmed_active_authorizations then 'pending'
        when exists (
          select 1 from public.payroll_deduction_confirmations pd
          where pd.billing_period_start = _billing_date and pd.status = 'failed'
        ) then 'partial'
        else 'completed'
      end,
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


-- Record a single month's payroll outcome only after a privileged reviewer attests to evidence.
create or replace function public.reconcile_riverbanc_monthly_payroll_deduction(
  _user_id uuid,
  _billing_date date,
  _status text,
  _payroll_reference text,
  _evidence_reference text,
  _evidence_confirmed boolean
) returns public.payroll_deduction_confirmations
language plpgsql
security definer
set search_path = ''
as $
declare
  v_old public.payroll_deduction_confirmations;
  v_new public.payroll_deduction_confirmations;
  v_reference text := nullif(trim(coalesce(_payroll_reference, '')), '');
  v_evidence text := nullif(trim(coalesce(_evidence_reference, '')), '');
  v_role text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not (
    private.has_role('admin'::text)
    or private.has_role('super_admin'::text)
    or private.has_role('compliance_team'::text)
  ) then raise exception 'Insufficient privileges to reconcile monthly payroll'; end if;
  if (auth.jwt() ->> 'aal') is distinct from 'aal2' then
    raise exception 'Multi-factor authentication is required for payroll reconciliation';
  end if;
  if _billing_date is null or extract(day from _billing_date) <> 23 then
    raise exception 'Billing period must start on the 23rd of a month';
  end if;
  if _status not in ('confirmed', 'failed') then
    raise exception 'Monthly payroll outcome must be confirmed or failed';
  end if;
  if _status = 'confirmed' and v_reference is null then
    raise exception 'A payroll reference is required for a confirmed deduction';
  end if;
  if v_evidence is null or coalesce(_evidence_confirmed, false) is not true then
    raise exception 'Evidence reference and evidence verification attestation are required';
  end if;
  if not exists (
    select 1 from public.subscription_authorizations
    where user_id = _user_id and status = 'active'
  ) then raise exception 'No active subscription authorization found'; end if;

  select * into v_old
  from public.payroll_deduction_confirmations
  where user_id = _user_id and billing_period_start = _billing_date
  for update;

  if found and v_old.status = 'confirmed' then
    raise exception 'A confirmed monthly deduction cannot be changed through this action';
  end if;
  if not found and exists (
    select 1 from public.billing_runs
    where billing_date = _billing_date and status = 'completed'
  ) then
    raise exception 'This billing period is closed; a new deduction cannot be added';
  end if;

  if found then
    update public.payroll_deduction_confirmations
    set status = _status,
        payroll_reference = v_reference,
        evidence_reference = v_evidence,
        evidence_confirmed = true,
        confirmed_by = auth.uid(),
        confirmed_at = now(),
        updated_at = now()
    where id = v_old.id
    returning * into v_new;
  else
    insert into public.payroll_deduction_confirmations(
      user_id, billing_period_start, status, payroll_reference,
      evidence_reference, evidence_confirmed, confirmed_by
    )
    values (_user_id, _billing_date, _status, v_reference, v_evidence, true, auth.uid())
    returning * into v_new;
  end if;

  v_role := case
    when private.has_role('super_admin'::text) then 'super_admin'
    when private.has_role('admin'::text) then 'admin'
    else 'compliance_team'
  end;

  insert into public.audit_logs(user_id, role, action_performed, record_id, table_name, old_value, new_value)
  values (
    auth.uid(), v_role, 'monthly_payroll_deduction_reconciled', v_new.id::text,
    'payroll_deduction_confirmations',
    case when v_old.id is null then null else jsonb_build_object(
      'status', v_old.status, 'payroll_reference', v_old.payroll_reference,
      'evidence_reference', v_old.evidence_reference, 'billing_period_start', v_old.billing_period_start
    ) end,
    jsonb_build_object(
      'user_id', v_new.user_id, 'status', v_new.status,
      'payroll_reference', v_new.payroll_reference,
      'evidence_reference', v_new.evidence_reference,
      'evidence_confirmed', v_new.evidence_confirmed,
      'billing_period_start', v_new.billing_period_start
    )
  );

  if exists (
    select 1 from public.billing_runs
    where billing_date = _billing_date and status <> 'completed'
  ) then
    perform private.run_riverbanc_monthly_billing(_billing_date);
  end if;

  return v_new;
end;
$;
revoke all on function public.reconcile_riverbanc_monthly_payroll_deduction(uuid,date,text,text,text,boolean) from public, anon, authenticated;
grant execute on function public.reconcile_riverbanc_monthly_payroll_deduction(uuid,date,text,text,text,boolean) to authenticated;

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
        and br.billing_date <= (now() at time zone 'Africa/Lusaka')::date
        and br.billing_date >= ((now() at time zone 'Africa/Lusaka')::date - interval '60 days')::date

      union

      select distinct br.billing_date
      from public.billing_runs br
      join public.billing_transactions bt on bt.billing_run_id = br.id
      join public.payment_receipts pr on pr.billing_transaction_id = bt.id
      join public.receipt_deliveries rd on rd.receipt_id = pr.id
      where br.status in ('completed', 'partial')
        and rd.channel = 'email'
        and rd.status in ('pending', 'failed')
        and rd.attempt_count < 5
    ) due;
  $job$
  );
end;
$migration$;
