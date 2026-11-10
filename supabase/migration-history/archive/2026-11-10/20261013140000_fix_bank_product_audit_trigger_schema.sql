-- Fix the bank_products audit trigger to match the live lender-product schema.
-- The previous function referenced legacy columns (name, description, bank_id, is_active),
-- which caused every UPDATE to fail before the row could be saved.
CREATE OR REPLACE FUNCTION public.audit_bank_product_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_role text;
  changed_fields jsonb := '{}'::jsonb;
  operation text;
  record_key text;
BEGIN
  actor_role := coalesce(
    (SELECT role::text FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1),
    CASE WHEN auth.uid() IS NULL THEN 'system' ELSE 'unknown' END
  );

  IF TG_OP = 'INSERT' THEN
    operation := 'bank_product_created';
    record_key := NEW.id::text;
  ELSIF TG_OP = 'DELETE' THEN
    operation := 'bank_product_deleted';
    record_key := OLD.id::text;
  ELSE
    operation := 'bank_product_fields_changed';
    record_key := NEW.id::text;

    IF OLD.bank_name IS DISTINCT FROM NEW.bank_name THEN changed_fields := changed_fields || jsonb_build_object('bank_name', true); END IF;
    IF OLD.product_type IS DISTINCT FROM NEW.product_type THEN changed_fields := changed_fields || jsonb_build_object('product_type', true); END IF;
    IF OLD.interest_rate IS DISTINCT FROM NEW.interest_rate THEN changed_fields := changed_fields || jsonb_build_object('interest_rate', true); END IF;
    IF OLD.min_amount IS DISTINCT FROM NEW.min_amount THEN changed_fields := changed_fields || jsonb_build_object('min_amount', true); END IF;
    IF OLD.max_amount IS DISTINCT FROM NEW.max_amount THEN changed_fields := changed_fields || jsonb_build_object('max_amount', true); END IF;
    IF OLD.max_term_months IS DISTINCT FROM NEW.max_term_months THEN changed_fields := changed_fields || jsonb_build_object('max_term_months', true); END IF;
    IF OLD.processing_days IS DISTINCT FROM NEW.processing_days THEN changed_fields := changed_fields || jsonb_build_object('processing_days', true); END IF;
    IF OLD.active IS DISTINCT FROM NEW.active THEN changed_fields := changed_fields || jsonb_build_object('active', true); END IF;

    IF changed_fields = '{}'::jsonb THEN
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO public.audit_logs (
    user_id, role, action_performed, record_id, table_name, old_value, new_value, created_at
  )
  VALUES (
    auth.uid(),
    actor_role,
    operation,
    record_key,
    'bank_products',
    CASE
      WHEN TG_OP = 'UPDATE' THEN changed_fields
      WHEN TG_OP = 'DELETE' THEN jsonb_build_object('record_id', OLD.id)
      ELSE NULL
    END,
    CASE
      WHEN TG_OP = 'UPDATE' THEN jsonb_build_object('changed_at', now())
      WHEN TG_OP = 'INSERT' THEN jsonb_build_object('record_id', NEW.id)
      ELSE NULL
    END,
    now()
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;
