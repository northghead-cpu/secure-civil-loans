create or replace function public.log_audit(_user_id uuid, _role text, _action text, _record_id text default null, _table_name text default null, _old_value jsonb default null, _new_value jsonb default null)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  caller uuid := auth.uid();
  caller_is_admin boolean := caller is not null and (public.has_role(caller, 'admin'::app_role) or public.has_role(caller, 'super_admin'::app_role));
  effective_user uuid;
  effective_role text;
  audit_id uuid;
begin
  if caller is null then raise exception 'log_audit requires an authenticated caller'; end if;
  if not caller_is_admin and _user_id is distinct from caller then raise exception 'not authorized to write audit entries for another user'; end if;
  effective_user := coalesce(_user_id, caller);
  effective_role := coalesce((select role::text from public.user_roles where user_id = caller limit 1), case when caller_is_admin then _role else 'user' end);

  insert into public.audit_logs (user_id, role, action_performed, record_id, table_name, old_value, new_value)
  values (effective_user, effective_role, _action, _record_id, _table_name, _old_value, _new_value)
  returning id into audit_id;

  perform public.evaluate_audit_event_for_incident(audit_id);
end;
$function$;

revoke all on function public.log_audit(uuid,text,text,text,text,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.log_audit(uuid,text,text,text,text,jsonb,jsonb) to authenticated;
