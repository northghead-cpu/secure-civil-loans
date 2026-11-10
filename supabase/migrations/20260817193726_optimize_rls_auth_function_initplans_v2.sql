DO $$
DECLARE
  r record;
  using_expr text;
  check_expr text;
  stmt text;
BEGIN
  FOR r IN
    SELECT p.polname,n.nspname AS schemaname,c.relname AS tablename,p.polcmd,
           pg_get_expr(p.polqual,p.polrelid) AS using_expr,
           pg_get_expr(p.polwithcheck,p.polrelid) AS check_expr
    FROM pg_policy p
    JOIN pg_class c ON c.oid=p.polrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public'
      AND (coalesce(pg_get_expr(p.polqual,p.polrelid),'') ~ 'auth\.(uid|jwt)\(\)'
        OR coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'') ~ 'auth\.(uid|jwt)\(\)')
  LOOP
    using_expr := r.using_expr;
    check_expr := r.check_expr;
    IF using_expr IS NOT NULL THEN
      using_expr := regexp_replace(using_expr,'\bauth\.uid\(\)','(select auth.uid())','g');
      using_expr := regexp_replace(using_expr,'\bauth\.jwt\(\)','(select auth.jwt())','g');
    END IF;
    IF check_expr IS NOT NULL THEN
      check_expr := regexp_replace(check_expr,'\bauth\.uid\(\)','(select auth.uid())','g');
      check_expr := regexp_replace(check_expr,'\bauth\.jwt\(\)','(select auth.jwt())','g');
    END IF;
    stmt := format('ALTER POLICY %I ON %I.%I',r.polname,r.schemaname,r.tablename);
    IF r.polcmd='r' THEN
      stmt := stmt || format(' USING (%s)',using_expr);
    ELSIF r.polcmd='a' THEN
      stmt := stmt || format(' WITH CHECK (%s)',check_expr);
    ELSIF r.polcmd='w' THEN
      stmt := stmt || format(' USING (%s)',using_expr);
      IF check_expr IS NOT NULL THEN stmt := stmt || format(' WITH CHECK (%s)',check_expr); END IF;
    ELSE
      IF using_expr IS NOT NULL THEN stmt := stmt || format(' USING (%s)',using_expr); END IF;
      IF check_expr IS NOT NULL THEN stmt := stmt || format(' WITH CHECK (%s)',check_expr); END IF;
    END IF;
    EXECUTE stmt;
  END LOOP;
END $$;
