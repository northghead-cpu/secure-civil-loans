do $$
declare
  table_record record;
begin
  for table_record in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
  loop
    execute format('revoke insert, update, delete, truncate on table public.%I from anon', table_record.relname);
  end loop;
end;
$$;
