create or replace function public.audit_user_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text;
  target_user_id uuid;
  previous_role text;
  next_role text;
  operation text;
begin
  actor_role := coalesce((select role::text from public.user_roles where user_id = auth.uid() limit 1), case when auth.uid() is null then 'system' else 'unknown' end);

  if tg_op = 'INSERT' then
    target_user_id := new.user_id;
    previous_role := null;
    next_role := new.role::text;
    operation := 'role_granted';
  elsif tg_op = 'UPDATE' then
    target_user_id := new.user_id;
    previous_role := old.role::text;
    next_role := new.role::text;
    operation := 'role_changed';
  else
    target_user_id := old.user_id;
    previous_role := old.role::text;
    next_role := null;
    operation := 'role_revoked';
  end if;

  insert into public.audit_logs (user_id, role, action_performed, record_id, table_name, old_value, new_value, created_at)
  values (
    auth.uid(),
    actor_role,
    operation,
    target_user_id::text,
    'user_roles',
    case when previous_role is null then null else jsonb_build_object('role', previous_role) end,
    case when next_role is null then null else jsonb_build_object('role', next_role) end,
    now()
  );

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_audit_user_role_change on public.user_roles;
create trigger trg_audit_user_role_change
after insert or update or delete on public.user_roles
for each row execute function public.audit_user_role_change();
