CREATE OR REPLACE FUNCTION public.audit_loan_application_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
declare changed_fields jsonb := '{}'::jsonb; actor_role text;
begin
  actor_role := coalesce((select role::text from public.user_roles where user_id = auth.uid() limit 1), case when auth.uid() is null then 'system' else 'unknown' end);
  if tg_op = 'INSERT' then
    insert into public.audit_logs (user_id, role, action_performed, record_id, table_name, old_value, new_value, created_at)
    values (auth.uid(), actor_role, 'loan_application_created', new.id::text, 'loan_applications', null,
      jsonb_build_object('event','created','user_id',new.user_id,'tracked_fields',jsonb_build_object('status',true,'risk_level',true,'credit_score',true,'fraud_score',true,'underwriting_score',true)), now());
    return new;
  end if;
  if tg_op = 'DELETE' then
    insert into public.audit_logs (user_id, role, action_performed, record_id, table_name, old_value, new_value, created_at)
    values (auth.uid(), actor_role, 'loan_application_deleted', old.id::text, 'loan_applications', jsonb_build_object('event','deleted','user_id',old.user_id), null, now());
    return old;
  end if;
  if old.status is distinct from new.status then changed_fields := changed_fields || jsonb_build_object('status',true); end if;
  if old.risk_level is distinct from new.risk_level then changed_fields := changed_fields || jsonb_build_object('risk_level',true); end if;
  if old.credit_score is distinct from new.credit_score then changed_fields := changed_fields || jsonb_build_object('credit_score',true); end if;
  if old.fraud_score is distinct from new.fraud_score then changed_fields := changed_fields || jsonb_build_object('fraud_score',true); end if;
  if old.underwriting_score is distinct from new.underwriting_score then changed_fields := changed_fields || jsonb_build_object('underwriting_score',true); end if;
  if old.user_id is distinct from new.user_id then changed_fields := changed_fields || jsonb_build_object('user_id',true); end if;
  if old.loan_product_id is distinct from new.loan_product_id then changed_fields := changed_fields || jsonb_build_object('loan_product_id',true); end if;
  if old.loan_amount is distinct from new.loan_amount then changed_fields := changed_fields || jsonb_build_object('loan_amount',true); end if;
  if old.loan_term is distinct from new.loan_term then changed_fields := changed_fields || jsonb_build_object('loan_term',true); end if;
  if changed_fields <> '{}'::jsonb then
    insert into public.audit_logs (user_id, role, action_performed, record_id, table_name, old_value, new_value, created_at)
    values (auth.uid(), actor_role, 'loan_application_fields_changed', new.id::text, 'loan_applications', changed_fields, jsonb_build_object('changed_at',now()), now());
  end if;
  return new;
end;
$function$;
DROP TRIGGER IF EXISTS trg_audit_loan_application ON public.loan_applications;
DROP TRIGGER IF EXISTS trg_audit_loan_applications ON public.loan_applications;
CREATE TRIGGER trg_audit_loan_applications AFTER INSERT OR DELETE OR UPDATE ON public.loan_applications FOR EACH ROW EXECUTE FUNCTION public.audit_loan_application_changes();
