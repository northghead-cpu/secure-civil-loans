create or replace function public.record_reconciliation_test_finding(p_check_key text, p_summary text default 'Controlled reconciliation test finding')
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare v_check_id uuid; v_run_id uuid; v_finding_id uuid;
begin
 if auth.uid() is null or not exists (select 1 from user_roles where user_id=auth.uid() and role in ('admin'::app_role,'super_admin'::app_role)) then raise exception 'Admin access required'; end if;
 select id into v_check_id from reconciliation_checks where check_key=p_check_key and enabled;
 if v_check_id is null then raise exception 'Enabled reconciliation check not found'; end if;
 insert into reconciliation_runs(status,checks_run,violations_found,initiated_by,completed_at) values ('succeeded',1,1,auth.uid(),now()) returning id into v_run_id;
 insert into reconciliation_findings(run_id,check_id,severity,finding_code,summary,entity_type) select v_run_id,id,severity,'CONTROLLED_TEST',p_summary,'test' from reconciliation_checks where id=v_check_id returning id into v_finding_id;
 return v_finding_id;
end;
$$;
revoke all on function public.record_reconciliation_test_finding(text,text) from public,anon,authenticated;
grant execute on function public.record_reconciliation_test_finding(text,text) to authenticated;
