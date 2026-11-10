-- Prevent profile audit entries from copying complete historical profile rows.
-- Keep the existing trigger; only replace its implementation with a minimal
-- field-change audit record and a minimal deletion record.

CREATE OR REPLACE FUNCTION public.audit_profile_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed_fields jsonb := '{}'::jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (
      user_id, role, action_performed, record_id, table_name,
      old_value, new_value, created_at
    )
    VALUES (
      COALESCE(auth.uid(), OLD.user_id),
      COALESCE((SELECT role::text FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1), 'system'),
      'profile_deleted',
      OLD.id::text,
      'profiles',
      jsonb_build_object('profile_id', OLD.id, 'user_id', OLD.user_id),
      NULL,
      now()
    );
    RETURN OLD;
  END IF;

  IF OLD.full_name IS DISTINCT FROM NEW.full_name THEN changed_fields := changed_fields || jsonb_build_object('full_name', true); END IF;
  IF OLD.phone IS DISTINCT FROM NEW.phone THEN changed_fields := changed_fields || jsonb_build_object('phone', true); END IF;
  IF OLD.employer IS DISTINCT FROM NEW.employer THEN changed_fields := changed_fields || jsonb_build_object('employer', true); END IF;
  IF OLD.employee_number IS DISTINCT FROM NEW.employee_number THEN changed_fields := changed_fields || jsonb_build_object('employee_number', true); END IF;
  IF OLD.nrc_number IS DISTINCT FROM NEW.nrc_number THEN changed_fields := changed_fields || jsonb_build_object('nrc_number', true); END IF;
  IF OLD.email IS DISTINCT FROM NEW.email THEN changed_fields := changed_fields || jsonb_build_object('email', true); END IF;
  IF OLD.salary IS DISTINCT FROM NEW.salary THEN changed_fields := changed_fields || jsonb_build_object('salary', true); END IF;
  IF OLD.net_salary IS DISTINCT FROM NEW.net_salary THEN changed_fields := changed_fields || jsonb_build_object('net_salary', true); END IF;
  IF OLD.existing_obligations IS DISTINCT FROM NEW.existing_obligations THEN changed_fields := changed_fields || jsonb_build_object('existing_obligations', true); END IF;
  IF OLD.ministry IS DISTINCT FROM NEW.ministry THEN changed_fields := changed_fields || jsonb_build_object('ministry', true); END IF;
  IF OLD.kyc_status IS DISTINCT FROM NEW.kyc_status THEN changed_fields := changed_fields || jsonb_build_object('kyc_status', true); END IF;
  IF OLD.nrc_verified IS DISTINCT FROM NEW.nrc_verified THEN changed_fields := changed_fields || jsonb_build_object('nrc_verified', true); END IF;
  IF OLD.phone_verified IS DISTINCT FROM NEW.phone_verified THEN changed_fields := changed_fields || jsonb_build_object('phone_verified', true); END IF;

  IF changed_fields <> '{}'::jsonb THEN
    INSERT INTO public.audit_logs (
      user_id, role, action_performed, record_id, table_name,
      old_value, new_value, created_at
    )
    VALUES (
      COALESCE(auth.uid(), NEW.user_id),
      COALESCE((SELECT role::text FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1), 'system'),
      'profile_fields_changed',
      NEW.id::text,
      'profiles',
      changed_fields,
      jsonb_build_object('changed_at', now()),
      now()
    );
  END IF;

  RETURN NEW;
END;
$$;
