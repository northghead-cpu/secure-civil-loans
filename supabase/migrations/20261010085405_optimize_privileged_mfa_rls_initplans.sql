-- Preserve the restrictive privileged-session MFA gate while avoiding per-row auth helper evaluation.
DO $migration$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname = 'Privileged sessions require MFA'
  LOOP
    EXECUTE format(
      'ALTER POLICY %I ON %I.%I USING ((NOT private.is_privileged_role((SELECT auth.uid()))) OR (((SELECT auth.jwt()) ->> ''aal'') = ''aal2'')) WITH CHECK ((NOT private.is_privileged_role((SELECT auth.uid()))) OR (((SELECT auth.jwt()) ->> ''aal'') = ''aal2''))',
      p.policyname, p.schemaname, p.tablename
    );
  END LOOP;
END
$migration$;
