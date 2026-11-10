create or replace function public.update_reconciliation_finding_status(p_finding_id uuid,p_status text)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
 if auth.uid() is null or not exists (select 1 from user_roles where user_id=auth.uid() and role in ('admin'::app_role,'super_admin'::app_role)) then raise exception 'Admin access required'; end if;
 if p_status not in ('open','acknowledged','resolved','false_positive') then raise exception 'Invalid finding status'; end if;
 update reconciliation_findings set status=p_status,resolved_at=case when p_status in ('resolved','false_positive') then now() else null end,resolved_by=case when p_status in ('resolved','false_positive') then auth.uid() else null end where id=p_finding_id;
 if not found then raise exception 'Finding not found'; end if;
end;
$$;
revoke all on function public.update_reconciliation_finding_status(uuid,text) from public,anon,authenticated;
grant execute on function public.update_reconciliation_finding_status(uuid,text) to authenticated;
