create or replace function public.audit_consent_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.consent_accepted is distinct from new.consent_accepted
     or old.consent_signed_at is distinct from new.consent_signed_at then
    insert into public.audit_logs (user_id, role, action_performed, record_id, table_name, old_value, new_value, created_at)
    values (
      auth.uid(),
      coalesce((select role::text from public.user_roles where user_id = auth.uid() limit 1), 'system'),
      'consent_esign_changed',
      new.user_id::text,
      'profiles',
      jsonb_build_object('consent_accepted', old.consent_accepted, 'consent_signed_at', old.consent_signed_at),
      jsonb_build_object('consent_accepted', new.consent_accepted, 'consent_signed_at', new.consent_signed_at),
      now()
    );
  end if;
  return new;
end;
$$;

create or replace function public.audit_kyc_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.kyc_status is distinct from new.kyc_status then
    insert into public.audit_logs (user_id, role, action_performed, record_id, table_name, old_value, new_value, created_at)
    values (
      auth.uid(),
      coalesce((select role::text from public.user_roles where user_id = auth.uid() limit 1), 'system'),
      'kyc_status_changed',
      new.user_id::text,
      'profiles',
      jsonb_build_object('kyc_status', old.kyc_status::text),
      jsonb_build_object('kyc_status', new.kyc_status::text),
      now()
    );
  end if;
  return new;
end;
$$;

create or replace function public.audit_kyc_table_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (user_id, role, action_performed, record_id, table_name, old_value, new_value, created_at)
  values (
    auth.uid(),
    coalesce((select role::text from public.user_roles where user_id = auth.uid() limit 1), 'system'),
    case when tg_op = 'INSERT' then 'kyc_record_created' else 'kyc_record_updated' end,
    coalesce(new.id, old.id)::text,
    'kyc',
    case when tg_op = 'UPDATE' then jsonb_build_object('status', old.status) else null end,
    case when tg_op = 'INSERT' then jsonb_build_object('status', new.status) else jsonb_build_object('status', new.status) end,
    now()
  );
  return coalesce(new, old);
end;
$$;

create or replace function public.audit_profile_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  changed_fields jsonb := '{}'::jsonb;
begin
  if tg_op = 'DELETE' then
    insert into public.audit_logs (user_id, role, action_performed, record_id, table_name, old_value, new_value, created_at)
    values (
      auth.uid(),
      coalesce((select role::text from public.user_roles where user_id = auth.uid() limit 1), 'system'),
      'profile_deleted',
      old.id::text,
      'profiles',
      jsonb_build_object('profile_id', old.id, 'user_id', old.user_id),
      null,
      now()
    );
    return old;
  end if;

  if old.full_name is distinct from new.full_name then changed_fields := changed_fields || jsonb_build_object('full_name', true); end if;
  if old.phone is distinct from new.phone then changed_fields := changed_fields || jsonb_build_object('phone', true); end if;
  if old.employer is distinct from new.employer then changed_fields := changed_fields || jsonb_build_object('employer', true); end if;
  if old.employee_number is distinct from new.employee_number then changed_fields := changed_fields || jsonb_build_object('employee_number', true); end if;
  if old.nrc_number is distinct from new.nrc_number then changed_fields := changed_fields || jsonb_build_object('nrc_number', true); end if;
  if old.email is distinct from new.email then changed_fields := changed_fields || jsonb_build_object('email', true); end if;
  if old.salary is distinct from new.salary then changed_fields := changed_fields || jsonb_build_object('salary', true); end if;
  if old.net_salary is distinct from new.net_salary then changed_fields := changed_fields || jsonb_build_object('net_salary', true); end if;
  if old.existing_obligations is distinct from new.existing_obligations then changed_fields := changed_fields || jsonb_build_object('existing_obligations', true); end if;
  if old.ministry is distinct from new.ministry then changed_fields := changed_fields || jsonb_build_object('ministry', true); end if;
  if old.kyc_status is distinct from new.kyc_status then changed_fields := changed_fields || jsonb_build_object('kyc_status', true); end if;
  if old.nrc_verified is distinct from new.nrc_verified then changed_fields := changed_fields || jsonb_build_object('nrc_verified', true); end if;
  if old.phone_verified is distinct from new.phone_verified then changed_fields := changed_fields || jsonb_build_object('phone_verified', true); end if;

  if changed_fields <> '{}'::jsonb then
    insert into public.audit_logs (user_id, role, action_performed, record_id, table_name, old_value, new_value, created_at)
    values (
      auth.uid(),
      coalesce((select role::text from public.user_roles where user_id = auth.uid() limit 1), 'system'),
      'profile_fields_changed',
      new.id::text,
      'profiles',
      changed_fields,
      jsonb_build_object('changed_at', now()),
      now()
    );
  end if;
  return new;
end;
$$;
