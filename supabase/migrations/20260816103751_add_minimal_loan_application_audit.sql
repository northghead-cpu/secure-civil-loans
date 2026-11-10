create or replace function public.audit_loan_application_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  changed_fields jsonb := '{}'::jsonb;
  actor_role text;
  action_name text;
begin
  actor_role := coalesce((select role::text from public.user_roles where user_id = auth.uid() limit 1), case when auth.uid() is null then 'system' else 'unknown' end);

  if tg_op = 'INSERT' then
    action_name := 'loan_application_created';
    insert into public.audit_logs (user_id, role, action_performed, record_id, table_name, old_value, new_value, created_at)
    values (auth.uid(), actor_role, action_name, new.id::text, 'loan_applications', null, jsonb_build_object('event','created'), now());
    return new;
  end if;

  if tg_op = 'DELETE' then
    action_name := 'loan_application_deleted';
    insert into public.audit_logs (user_id, role, action_performed, record_id, table_name, old_value, new_value, created_at)
    values (auth.uid(), actor_role, action_name, old.id::text, 'loan_applications', jsonb_build_object('event','deleted'), null, now());
    return old;
  end if;

  if old.status is distinct from new.status then changed_fields := changed_fields || jsonb_build_object('status', true); end if;
  if old.loan_product_id is distinct from new.loan_product_id then changed_fields := changed_fields || jsonb_build_object('loan_product_id', true); end if;
  if old.loan_amount is distinct from new.loan_amount then changed_fields := changed_fields || jsonb_build_object('loan_amount', true); end if;
  if old.loan_term is distinct from new.loan_term then changed_fields := changed_fields || jsonb_build_object('loan_term', true); end if;
  if old.underwriting_score is distinct from new.underwriting_score then changed_fields := changed_fields || jsonb_build_object('underwriting_score', true); end if;
  if old.credit_score is distinct from new.credit_score then changed_fields := changed_fields || jsonb_build_object('credit_score', true); end if;
  if old.fraud_score is distinct from new.fraud_score then changed_fields := changed_fields || jsonb_build_object('fraud_score', true); end if;
  if old.risk_level is distinct from new.risk_level then changed_fields := changed_fields || jsonb_build_object('risk_level', true); end if;

  if changed_fields <> '{}'::jsonb then
    insert into public.audit_logs (user_id, role, action_performed, record_id, table_name, old_value, new_value, created_at)
    values (auth.uid(), actor_role, 'loan_application_fields_changed', new.id::text, 'loan_applications', changed_fields, jsonb_build_object('changed_at', now()), now());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_audit_loan_applications on public.loan_applications;
create trigger trg_audit_loan_applications
after insert or update or delete on public.loan_applications
for each row execute function public.audit_loan_application_changes();
