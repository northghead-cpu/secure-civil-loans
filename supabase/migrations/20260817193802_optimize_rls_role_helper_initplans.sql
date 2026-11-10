DO $$
DECLARE r record; u text; c text; s text; BEGIN
FOR r IN
SELECT p.polname,n.nspname,c.relname,p.polcmd,pg_get_expr(p.polqual,p.polrelid) u,pg_get_expr(p.polwithcheck,p.polrelid) c
FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND (coalesce(pg_get_expr(p.polqual,p.polrelid),'') LIKE '%private.has_role(%' OR coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'') LIKE '%private.has_role(%')
LOOP
u:=r.u; c:=r.c;
IF u IS NOT NULL THEN u:=replace(u,'auth.uid()','__UID__'); u:=regexp_replace(u,'private\.has_role\(([^()]*)\)','(select private.has_role(\1))','g'); u:=replace(u,'__UID__','(select auth.uid())'); END IF;
IF c IS NOT NULL THEN c:=replace(c,'auth.uid()','__UID__'); c:=regexp_replace(c,'private\.has_role\(([^()]*)\)','(select private.has_role(\1))','g'); c:=replace(c,'__UID__','(select auth.uid())'); END IF;
s:=format('ALTER POLICY %I ON %I.%I',r.polname,r.nspname,r.relname);
IF r.polcmd='r' THEN s:=s||format(' USING (%s)',u);
ELSIF r.polcmd='a' THEN s:=s||format(' WITH CHECK (%s)',c);
ELSIF r.polcmd='w' THEN s:=s||format(' USING (%s)',u); IF c IS NOT NULL THEN s:=s||format(' WITH CHECK (%s)',c); END IF;
ELSE IF u IS NOT NULL THEN s:=s||format(' USING (%s)',u); END IF; IF c IS NOT NULL THEN s:=s||format(' WITH CHECK (%s)',c); END IF; END IF;
EXECUTE s;
END LOOP; END $$;
