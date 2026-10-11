-- Require a real payroll reference and verified timestamp before a subscription can be billed.
alter table public.subscription_authorizations
  add constraint subscription_authorizations_payroll_reference_required
  check (
    payroll_status not in ('submitted', 'confirmed')
    or nullif(trim(payroll_reference), '') is not null
  );

alter table public.subscription_authorizations
  add constraint subscription_authorizations_confirmation_timestamp_required
  check (
    payroll_status <> 'confirmed'
    or payroll_confirmed_at is not null
  );

create or replace function public.reconcile_riverbanc_subscription_payroll(
  _authorization_id uuid,
  _status text,
  _payroll_reference text,
  _evidence_confirmed boolean
)
returns public.subscription_authorizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.subscription_authorizations;
  v_new public.subscription_authorizations;
  v_reference text := nullif(trim(coalesce(_payroll_reference, '')), '');
  v_role text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not (private.has_role('admin'::text) or private.has_role('super_admin'::text) or private.has_role('compliance_team'::text)) then
    raise exception 'Insufficient privileges to reconcile payroll';
  end if;
  if (auth.jwt() ->> 'aal') is distinct from 'aal2' then
    raise exception 'Multi-factor authentication is required for payroll reconciliation';
  end if;
  if _status not in ('submitted', 'confirmed', 'failed') then
    raise exception 'Unsupported payroll reconciliation status';
  end if;
  if _status in ('submitted', 'confirmed') and v_reference is null then
    raise exception 'A payroll reference is required';
  end if;
  if _status = 'confirmed' and coalesce(_evidence_confirmed, false) is not true then
    raise exception 'Confirm that the payroll deduction was verified against payroll evidence';
  end if;

  select * into v_old
  from public.subscription_authorizations
  where id = _authorization_id
  for update;

  if not found then raise exception 'Subscription authorization not found'; end if;
  if v_old.status <> 'active' then raise exception 'Only active subscription authorizations can be reconciled'; end if;
  if v_old.payroll_status = 'confirmed' then raise exception 'A confirmed payroll deduction cannot be changed through this action'; end if;

  update public.subscription_authorizations
  set payroll_status = _status,
      payroll_reference = v_reference,
      payroll_confirmed_at = case when _status = 'confirmed' then now() else null end,
      updated_at = now()
  where id = _authorization_id
  returning * into v_new;

  v_role := case
    when private.has_role('super_admin'::text) then 'super_admin'
    when private.has_role('admin'::text) then 'admin'
    else 'compliance_team'
  end;

  insert into public.audit_logs(user_id, role, action_performed, record_id, table_name, old_value, new_value)
  values (
    auth.uid(), v_role, 'subscription_payroll_reconciled', v_new.id::text, 'subscription_authorizations',
    jsonb_build_object('payroll_status', v_old.payroll_status, 'payroll_reference', v_old.payroll_reference, 'payroll_confirmed_at', v_old.payroll_confirmed_at),
    jsonb_build_object('payroll_status', v_new.payroll_status, 'payroll_reference', v_new.payroll_reference, 'payroll_confirmed_at', v_new.payroll_confirmed_at, 'evidence_confirmed', coalesce(_evidence_confirmed, false))
  );

  return v_new;
end;
$$;

revoke all on function public.reconcile_riverbanc_subscription_payroll(uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function public.reconcile_riverbanc_subscription_payroll(uuid, text, text, boolean) to authenticated;
notify pgrst, 'reload schema';
