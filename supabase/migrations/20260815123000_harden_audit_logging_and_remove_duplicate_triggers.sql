drop trigger if exists trg_audit_consent_change on public.profiles;
drop trigger if exists trg_audit_kyc_status_change on public.profiles;
drop trigger if exists trg_sanitize_loan_application_insert on public.loan_applications;
drop trigger if exists loan_credit_score on public.loan_applications;

create or replace function public.audit_kyc_table_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (user_id, role, action_performed, record_id, table_name, old_value, new_value)
  values (
    coalesce(auth.uid(), coalesce(new.user_id, old.user_id)),
    coalesce((select role::text from public.user_roles where user_id = auth.uid() limit 1), 'system'),
    case when tg_op = 'INSERT' then 'kyc_record_created' else 'kyc_record_updated' end,
    coalesce(new.id, old.id)::text,
    'kyc',
    case when tg_op = 'UPDATE' then jsonb_build_object('status', old.status) else null end,
    jsonb_build_object('status', new.status)
  );
  return coalesce(new, old);
end;
$$;
