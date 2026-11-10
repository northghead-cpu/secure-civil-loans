create or replace function public.audit_bank_product_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text;
  changed_fields jsonb := '{}'::jsonb;
  operation text;
  record_key text;
  col record;
begin
  actor_role := coalesce((select role::text from public.user_roles where user_id = auth.uid() limit 1), case when auth.uid() is null then 'system' else 'unknown' end);
  record_key := coalesce(new.id, old.id)::text;

  if tg_op = 'INSERT' then
    operation := 'bank_product_created';
  elsif tg_op = 'DELETE' then
    operation := 'bank_product_deleted';
  else
    operation := 'bank_product_fields_changed';
    if old IS DISTINCT FROM new then
      if old.product_type is distinct from new.product_type then changed_fields := changed_fields || jsonb_build_object('product_type', true); end if;
      if old.name is distinct from new.name then changed_fields := changed_fields || jsonb_build_object('name', true); end if;
      if old.description is distinct from new.description then changed_fields := changed_fields || jsonb_build_object('description', true); end if;
      if old.bank_id is distinct from new.bank_id then changed_fields := changed_fields || jsonb_build_object('bank_id', true); end if;
      if old.is_active is distinct from new.is_active then changed_fields := changed_fields || jsonb_build_object('is_active', true); end if;
    end if;
    if changed_fields = '{}'::jsonb then return new; end if;
  end if;

  insert into public.audit_logs (user_id, role, action_performed, record_id, table_name, old_value, new_value, created_at)
  values (
    auth.uid(),
    actor_role,
    operation,
    record_key,
    'bank_products',
    case when tg_op = 'UPDATE' then changed_fields when tg_op = 'DELETE' then jsonb_build_object('record_id', old.id) else null end,
    case when tg_op = 'UPDATE' then jsonb_build_object('changed_at', now()) when tg_op = 'INSERT' then jsonb_build_object('record_id', new.id) else null end,
    now()
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_audit_bank_product_change on public.bank_products;
create trigger trg_audit_bank_product_change
after insert or update or delete on public.bank_products
for each row execute function public.audit_bank_product_change();
