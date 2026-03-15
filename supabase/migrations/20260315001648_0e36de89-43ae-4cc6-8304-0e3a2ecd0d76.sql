
-- Allow admins and super_admins to manage user_roles (insert, update, delete)
CREATE POLICY "Admins can insert roles" ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Admins can update roles" ON public.user_roles
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Admins can delete roles" ON public.user_roles
FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Allow compliance_team and data_entry_team to read profiles
-- (already covered by "Admins can view all profiles" for admin role; 
--  we need separate policies for the new roles)
CREATE POLICY "Super users can view all profiles" ON public.profiles
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_user'::app_role));

CREATE POLICY "Compliance team can view all profiles" ON public.profiles
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'compliance_team'::app_role));

CREATE POLICY "Data entry team can view all profiles" ON public.profiles
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'data_entry_team'::app_role));

-- Super users can update profiles
CREATE POLICY "Super users can update all profiles" ON public.profiles
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'super_user'::app_role));

-- Data entry team can update profiles (field-level restriction enforced in app)
CREATE POLICY "Data entry team can update profiles" ON public.profiles
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'data_entry_team'::app_role));

-- Super users can view and update loan applications
CREATE POLICY "Super users can view all applications" ON public.loan_applications
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_user'::app_role));

CREATE POLICY "Super users can update applications" ON public.loan_applications
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'super_user'::app_role));

-- Compliance team can view loan applications (read-only)
CREATE POLICY "Compliance team can view all applications" ON public.loan_applications
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'compliance_team'::app_role));

-- New roles can read their own roles
CREATE POLICY "New roles can read own roles" ON public.user_roles
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'super_user'::app_role) OR
  has_role(auth.uid(), 'compliance_team'::app_role) OR
  has_role(auth.uid(), 'data_entry_team'::app_role)
);
