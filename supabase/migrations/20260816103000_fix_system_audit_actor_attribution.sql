-- Harden audit actor attribution for trusted/system-triggered changes.
-- Authenticated actions retain auth.uid(); system actions remain explicitly system-attributed.

create or replace function public.audit_kyc_table_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.audit_logs (user_id, role, action_performed, record_id, table_name, old_value, new_value, created_at)
  values (
    auth.uid(),
    case when auth.uid() is null then 'system' else coalesce((select role::text from public.user_roles where user_id = auth.uid() limit 1), 'authenticated') end,
    case when tg_op = 'INSERT' then 'kyc_record_created' else 'kyc_record_updated' end,
    coalesce(new.id, old.id)::text,
    'kyc',
    case when tg_op = 'UPDATE' then jsonb_build_object('status', old.status) else null end,
    jsonb_build_object('status', new.status),
    now()
  );
  return coalesce(new, old);
end;
$$;

create or replace function public.audit_kyc_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.kyc_status is distinct from new.kyc_status then
    insert into public.audit_logs (user_id, role, action_performed, record_id, table_name, old_value, new_value, created_at)
    values (
      auth.uid(),
      case when auth.uid() is null then 'system' else coalesce((select role::text from public.user_roles where user_id = auth.uid() limit 1), 'authenticated') end,
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

create or replace function public.audit_consent_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.consent_accepted is distinct from new.consent_accepted or old.consent_signed_at is distinct from new.consent_signed_at then
    insert into public.audit_logs (user_id, role, action_performed, record_id, table_name, old_value, new_value, created_at)
    values (
      auth.uid(),
      case when auth.uid() is null then 'system' else coalesce((select role::text from public.user_roles where user_id = auth.uid() limit 1), 'authenticated') end,
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
