-- Marketplace only. Exact-version antivirus evidence; quarantine never deletes.
grant usage on schema private to service_role;
create table private.marketplace_storage_scan_config (
  singleton boolean primary key default true check(singleton),
  require_clean_scan boolean not null default false
);
insert into private.marketplace_storage_scan_config values(true,false);
create table private.marketplace_storage_scans (
  object_id uuid primary key,
  object_version text not null,
  sha256 text,
  verdict text not null check(verdict in ('clean','infected','error')),
  engine_version text not null check(length(engine_version) between 5 and 160),
  definitions_at timestamptz not null,
  scanned_at timestamptz not null default clock_timestamp(),
  check((sha256 is not null and sha256 ~ '^[0-9a-f]{64}$') or (verdict='error' and sha256 is null))
);
alter table private.marketplace_storage_scan_config enable row level security;
alter table private.marketplace_storage_scans enable row level security;
revoke all on private.marketplace_storage_scan_config,private.marketplace_storage_scans from public,anon,authenticated,service_role;

create function private.marketplace_storage_scan_allows_read(p_id uuid,p_version text)
returns boolean language sql stable security definer set search_path='' as $$
  select case when s.object_id is not null then
    s.verdict='clean' and s.object_version is not distinct from p_version
  else not c.require_clean_scan end
  from private.marketplace_storage_scan_config c
  left join private.marketplace_storage_scans s on s.object_id=p_id
  where c.singleton;
$$;
revoke all on function private.marketplace_storage_scan_allows_read(uuid,text) from public,anon;
grant execute on function private.marketplace_storage_scan_allows_read(uuid,text) to authenticated;
create policy marketplace_sensitive_storage_scan_quarantine
on storage.objects as restrictive for select to authenticated
using(bucket_id not in ('kyc-documents','payslips','payment-receipts')
  or private.marketplace_storage_scan_allows_read(id,version));

create function private.marketplace_security_source_page(p_after uuid,p_before timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  if (auth.jwt()->>'role') is distinct from 'service_role' then raise exception 'Storage worker required' using errcode='42501';end if;
  if p_before is null or p_before>clock_timestamp()+interval '5 minutes' then raise exception 'Invalid snapshot time' using errcode='22023';end if;
  select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) into result from (
    select id,bucket_id,name,version,updated_at,metadata
    from storage.objects where bucket_id in ('kyc-documents','payslips','payment-receipts')
      and created_at<=p_before and (p_after is null or id>p_after)
    order by id limit 100
  ) q;
  return result;
end $$;
revoke all on function private.marketplace_security_source_page(uuid,timestamptz) from public,anon,authenticated;
grant execute on function private.marketplace_security_source_page(uuid,timestamptz) to service_role;
create function public.marketplace_security_source_page(p_after uuid,p_before timestamptz)
returns jsonb language sql security invoker set search_path='' as $$select private.marketplace_security_source_page($1,$2)$$;
revoke all on function public.marketplace_security_source_page(uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.marketplace_security_source_page(uuid,timestamptz) to service_role;

create function private.record_marketplace_storage_scan(p_id uuid,p_version text,p_sha256 text,p_verdict text,p_engine text,p_definitions_at timestamptz)
returns void language plpgsql security definer set search_path='' as $$
begin
  if (auth.jwt()->>'role') is distinct from 'service_role' then raise exception 'Storage worker required' using errcode='42501';end if;
  if p_verdict is null or p_verdict not in ('clean','infected','error') or p_engine is null or length(p_engine) not between 5 and 160
    or (p_verdict<>'error' and (p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$'))
    or p_definitions_at is null or p_definitions_at<clock_timestamp()-interval '48 hours' or p_definitions_at>clock_timestamp()+interval '5 minutes' then
    raise exception 'Invalid or stale scan evidence' using errcode='22023';end if;
  perform 1 from storage.objects where id=p_id and version=p_version
    and bucket_id in ('kyc-documents','payslips','payment-receipts') for share;
  if not found then raise exception 'Source version changed' using errcode='40001';end if;
  insert into private.marketplace_storage_scans(object_id,object_version,sha256,verdict,engine_version,definitions_at)
    values(p_id,p_version,p_sha256,p_verdict,p_engine,p_definitions_at)
    on conflict(object_id) do update set object_version=excluded.object_version,sha256=excluded.sha256,
      verdict=excluded.verdict,engine_version=excluded.engine_version,definitions_at=excluded.definitions_at,scanned_at=clock_timestamp();
  insert into public.audit_logs(user_id,role,action_performed,record_id,table_name,new_value)
    values(null,'system','storage_scan_recorded',p_id::text,'storage.objects',
      jsonb_build_object('verdict',p_verdict,'sha256',p_sha256,'version',p_version));
end $$;
revoke all on function private.record_marketplace_storage_scan(uuid,text,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function private.record_marketplace_storage_scan(uuid,text,text,text,text,timestamptz) to service_role;
create function public.record_marketplace_storage_scan(p_id uuid,p_version text,p_sha256 text,p_verdict text,p_engine text,p_definitions_at timestamptz)
returns void language sql security invoker set search_path='' as $$select private.record_marketplace_storage_scan($1,$2,$3,$4,$5,$6)$$;
revoke all on function public.record_marketplace_storage_scan(uuid,text,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.record_marketplace_storage_scan(uuid,text,text,text,text,timestamptz) to service_role;
