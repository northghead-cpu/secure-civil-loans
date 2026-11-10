create or replace function public.run_reconciliation()
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_run uuid;
  v_checks integer := 0;
  v_violations integer := 0;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not (public.has_role(auth.uid(),'admin'::app_role) or public.has_role(auth.uid(),'super_admin'::app_role)) then raise exception 'Admin access required'; end if;
  insert into reconciliation_runs(status,initiated_by) values ('running',auth.uid()) returning id into v_run;
  select count(*) into v_checks from reconciliation_checks where enabled;
  update reconciliation_runs set checks_run=v_checks where id=v_run;
  update reconciliation_runs set status='succeeded',completed_at=now(),violations_found=v_violations where id=v_run;
  return v_run;
exception when others then
  if v_run is not null then update reconciliation_runs set status='failed',completed_at=now() where id=v_run; end if;
  raise;
end;
$$;
revoke all on function public.run_reconciliation() from public,anon,authenticated;
grant execute on function public.run_reconciliation() to authenticated;
