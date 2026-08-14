-- Reconstruct the KYC table that exists in production but was historically created outside
-- the migration chain. This migration is intentionally timestamped before the first
-- migration that references public.kyc (20260505062444) so a fresh Supabase branch
-- can replay the complete schema in dependency order.

CREATE TABLE public.kyc (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  nrc_number text,
  employer text,
  employee_number text,
  phone_number text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT kyc_status_check CHECK (
    status IS NULL OR status = ANY (ARRAY['pending', 'submitted', 'verified', 'rejected', 'expired'])
  )
);

ALTER TABLE public.kyc ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own kyc"
  ON public.kyc FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own kyc"
  ON public.kyc FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own kyc"
  ON public.kyc FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all kyc"
  ON public.kyc FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

-- Preserve the existing status transition behavior used by production.
CREATE OR REPLACE FUNCTION public.set_kyc_submitted()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    NEW.status := 'submitted';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER kyc_auto_status
  BEFORE INSERT ON public.kyc
  FOR EACH ROW
  EXECUTE FUNCTION public.set_kyc_submitted();
