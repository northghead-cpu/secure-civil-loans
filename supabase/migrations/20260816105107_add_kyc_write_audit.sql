create or replace function public.audit_kyc_write_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text;
  operation text;
  subject_user_id uuid;
  record_key text;
begin
  actor_role := coalesce((select role::text from public.user_roles where user_id = auth.uid() limit 1), case when auth.uid() is null then 'system' else 'unknown' end);

  if tg_op = 'INSERT' then
    operation := 'kyc_record_created';
    subject_user_id := new.user_id;
    record_key := new.id::text;
  elsif tg_op = 'UPDATE' then
    operation := 'kyc_record_updated';
    subject_user_id := new.user_id;
    record_key := new.id::text;
  else
    operation := 'kyc_record_deleted';
    subject_user_id := old.user_id;
    record_key := old.id::text;
  end if;

  insert into public.audit_logs (user_id, role, action_performed, record_id, table_name, old_value, new_value, created_at)
  values (
    auth.uid(),
    actor_role,
    operation,
    record_key,
    'kyc',
    case when tg_op = 'UPDATE' then jsonb_build_object('user_id', old.user_id, 'record_id', old.id) when tg_op = 'DELETE' then jsonb_build_object('user_id', old.user_id, 'record_id', old.id) else null end,
    case when tg_op <> 'DELETE' then jsonb_build_object('user_id', new.user_id, 'record_id', new.id) else null end,
    now()
  );

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_audit_kyc_write_change on public.kyc;
create trigger trg_audit_kyc_write_change
after insert or update or delete on public.kyc
for each row execute function public.audit_kyc_write_change();
