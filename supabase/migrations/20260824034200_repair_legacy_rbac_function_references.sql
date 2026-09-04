-- Repair legacy RBAC references left behind after the RBAC hardening.
-- Preserve existing function behavior; only replace obsolete public.has_role()
-- calls with the canonical private.has_role() helper.
-- This migration is ordered after 20260824034153, which defines that helper.

CREATE OR REPLACE FUNCTION public.log_audit(
  _user_id uuid,_role text,_action text,_record_id text DEFAULT NULL,_table_name text DEFAULT NULL,_old_value jsonb DEFAULT NULL,_new_value jsonb DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
declare caller uuid := auth.uid(); caller_is_admin boolean := caller is not null AND (private.has_role('admin') OR private.has_role('super_admin')); effective_user uuid; effective_role text; audit_id uuid;
begin
  if caller is null then raise exception 'log_audit requires an authenticated caller'; end if;
  if not caller_is_admin and _user_id is distinct from caller then raise exception 'not authorized to write audit entries for another user'; end if;
  effective_user := coalesce(_user_id, caller);
  effective_role := coalesce((select role::text from public.user_roles where user_id = caller limit 1), case when caller_is_admin then _role else 'user' end);
  insert into public.audit_logs (user_id, role, action_performed, record_id, table_name, old_value, new_value) values (effective_user, effective_role, _action, _record_id, _table_name, _old_value, _new_value) returning id into audit_id;
  perform public.evaluate_audit_event_for_incident(audit_id);
end; $function$;

CREATE OR REPLACE FUNCTION public.protect_profile_consent_fields() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NOT (auth.uid() = NEW.user_id OR private.has_role('admin') OR private.has_role('super_admin')) THEN
    NEW.consent_accepted := OLD.consent_accepted; NEW.consent_signed_at := OLD.consent_signed_at;
  END IF; RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.protect_profile_security_fields() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NOT (private.has_role('admin') OR private.has_role('super_admin')) THEN
    NEW.kyc_status := OLD.kyc_status; NEW.nrc_verified := OLD.nrc_verified; NEW.phone_verified := OLD.phone_verified; NEW.account_status := OLD.account_status;
  END IF; RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.sanitize_loan_application_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NOT (private.has_role('admin') OR private.has_role('super_admin')) THEN
    NEW.decision := NULL; NEW.decision_reason := NULL; NEW.fraud_flag := NULL; NEW.fraud_score := NULL; NEW.underwriting_score := NULL; NEW.verification_passed := NULL; NEW.verification_notes := NULL; NEW.credit_score := NULL; NEW.crb_status := NULL; NEW.admin_notes := NULL; NEW.risk_level := NULL; NEW.interest_rate := NULL;
  END IF; RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.sanitize_loan_application_update() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NOT (private.has_role('admin') OR private.has_role('super_admin')) THEN
    NEW.decision := OLD.decision; NEW.decision_reason := OLD.decision_reason; NEW.fraud_flag := OLD.fraud_flag; NEW.fraud_score := OLD.fraud_score; NEW.underwriting_score := OLD.underwriting_score; NEW.verification_passed := OLD.verification_passed; NEW.verification_notes := OLD.verification_notes; NEW.credit_score := OLD.credit_score; NEW.crb_status := OLD.crb_status; NEW.admin_notes := OLD.admin_notes; NEW.risk_level := OLD.risk_level; NEW.interest_rate := OLD.interest_rate;
  END IF; RETURN NEW;
END; $function$;
