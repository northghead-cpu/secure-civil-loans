-- Reject delayed evidence and keep a positive digest quarantined.
create or replace function private.record_marketplace_storage_scan(p_id uuid,p_version text,p_sha256 text,p_verdict text,p_engine text,p_definitions_at timestamptz)
returns void language plpgsql security definer set search_path='' as $$
declare applied_verdict text;
begin
  if (auth.jwt()->>'role') is distinct from 'service_role' then raise exception 'Storage worker required' using errcode='42501';end if;
  if p_verdict is null or p_verdict not in ('clean','infected','error') or p_engine is null or length(p_engine) not between 5 and 160
    or (p_verdict<>'error' and (p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$'))
    or p_definitions_at is null or p_definitions_at<clock_timestamp()-interval '48 hours' or p_definitions_at>clock_timestamp()+interval '5 minutes' then
    raise exception 'Invalid or stale scan evidence' using errcode='22023';end if;
  perform 1 from storage.objects where id=p_id and version=p_version
    and bucket_id in ('kyc-documents','payslips','payment-receipts') for share;
  if not found then raise exception 'Source version changed' using errcode='40001';end if;
  insert into private.marketplace_storage_scans as current_scan(object_id,object_version,sha256,verdict,engine_version,definitions_at)
    values(p_id,p_version,p_sha256,p_verdict,p_engine,p_definitions_at)
    on conflict(object_id) do update set object_version=excluded.object_version,sha256=excluded.sha256,
      verdict=case when current_scan.verdict='infected' and current_scan.sha256=excluded.sha256 then 'infected' else excluded.verdict end,
      engine_version=case when current_scan.verdict='infected' and current_scan.sha256=excluded.sha256 and excluded.verdict<>'infected' then current_scan.engine_version else excluded.engine_version end,
      definitions_at=case when current_scan.verdict='infected' and current_scan.sha256=excluded.sha256 and excluded.verdict<>'infected' then current_scan.definitions_at else excluded.definitions_at end,
      scanned_at=clock_timestamp()
    where (current_scan.object_version is distinct from excluded.object_version or current_scan.sha256 is null or current_scan.sha256=excluded.sha256)
      and (current_scan.object_version is distinct from excluded.object_version or excluded.definitions_at>=current_scan.definitions_at)
    returning verdict into applied_verdict;
  if not found then raise exception 'Out-of-order or inconsistent scan evidence' using errcode='40001';end if;
  insert into public.audit_logs(user_id,role,action_performed,record_id,table_name,new_value)
    values(null,'system','storage_scan_recorded',p_id::text,'storage.objects',
      jsonb_build_object('verdict',applied_verdict,'reported_verdict',p_verdict,'sha256',p_sha256,'version',p_version));
end $$;
