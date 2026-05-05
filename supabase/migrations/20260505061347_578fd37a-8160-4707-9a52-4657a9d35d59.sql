
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE public.loan_applications;
EXCEPTION WHEN undefined_object THEN
  NULL;
END;
$$;
