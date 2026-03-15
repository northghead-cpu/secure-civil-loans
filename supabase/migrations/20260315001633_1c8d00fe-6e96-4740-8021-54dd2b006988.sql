
-- Create audit_logs table
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text NOT NULL,
  action_performed text NOT NULL,
  record_id text,
  table_name text,
  old_value jsonb,
  new_value jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins, super_users, and compliance_team can read audit logs
CREATE POLICY "Admin roles can view audit logs" ON public.audit_logs
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'super_user'::app_role) OR
  has_role(auth.uid(), 'compliance_team'::app_role)
);

-- Allow insert for authenticated users (audit log entries are created by the system)
CREATE POLICY "Authenticated can insert audit logs" ON public.audit_logs
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Update has_role function to handle new roles (already works since it checks user_roles table)

-- Create a security definer function for inserting audit logs
CREATE OR REPLACE FUNCTION public.log_audit(
  _user_id uuid,
  _role text,
  _action text,
  _record_id text DEFAULT NULL,
  _table_name text DEFAULT NULL,
  _old_value jsonb DEFAULT NULL,
  _new_value jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (user_id, role, action_performed, record_id, table_name, old_value, new_value)
  VALUES (_user_id, _role, _action, _record_id, _table_name, _old_value, _new_value);
END;
$$;
