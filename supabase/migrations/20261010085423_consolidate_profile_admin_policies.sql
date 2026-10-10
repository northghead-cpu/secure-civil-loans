-- Combine own-row and admin access into single permissive policies to avoid overlapping policy evaluation.
ALTER POLICY profiles_select_policy ON public.profiles
  USING (
    (SELECT auth.uid()) = user_id
    OR private.has_role('admin')
    OR private.has_role('super_admin')
  );
DROP POLICY IF EXISTS profiles_admin_select_policy ON public.profiles;

ALTER POLICY profiles_update_policy ON public.profiles
  USING (
    (SELECT auth.uid()) = user_id
    OR private.has_role('admin')
    OR private.has_role('super_admin')
  )
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    OR private.has_role('admin')
    OR private.has_role('super_admin')
  );
DROP POLICY IF EXISTS profiles_admin_update_policy ON public.profiles;
