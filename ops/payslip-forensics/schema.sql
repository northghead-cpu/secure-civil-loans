-- Additive Marketplace-only payslip review queue. No evidence is deleted.
set local lock_timeout = '5s';
create table private.payslip_forensics_jobs (
 id uuid primary key default gen_random_uuid(),
 document_id uuid not null,
 storage_path text not null,
 status text not null default 'pending' check(status in ('pending','processing','review_required','no_indicators_detected','unsupported','error')),
 attempts integer not null default 0,
 lease uuid,
 lease_until timestamptz,
 source_id uuid,
 source_version text,
 sha256 text,
 result jsonb,
 created_at timestamptz not null default now(),
 checked_at timestamptz,
 unique(document_id,storage_path)
);
alter table private.payslip_forensics_jobs enable row level security;
revoke all on private.payslip_forensics_jobs from public,anon,authenticated;
create index payslip_forensics_pending on private.payslip_forensics_jobs(created_at) where status in ('pending','processing');

create function private.queue_payslip_forensics() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.document_type='PAYSLIP' then
  insert into private.payslip_forensics_jobs(document_id,storage_path,status)
  values(new.id,new.storage_path,case when lower(new.storage_path) like '%.pdf' then 'pending' else 'unsupported' end)
  on conflict(document_id,storage_path) do nothing;
 end if;
 return new;
end $$;
revoke all on function private.queue_payslip_forensics() from public,anon,authenticated;
create trigger queue_payslip_forensics after insert or update of storage_path,document_type on public.kyc_documents
for each row execute function private.queue_payslip_forensics();

-- Staff-only read RPC. Applicants cannot submit or replace scanner verdicts.
create function public.get_payslip_forensics(p_document_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j private.payslip_forensics_jobs; d public.kyc_documents; current_version text;
begin
 perform private.require_interactive_session();
 if not(private.has_role('admin') or private.has_role('super_admin')) then
  raise exception 'Staff review required' using errcode='42501';
 end if;
 select * into d from public.kyc_documents where id=p_document_id and document_type='PAYSLIP';
 if not found then raise exception 'Payslip unavailable'; end if;
 select * into j from private.payslip_forensics_jobs where document_id=d.id and storage_path=d.storage_path;
 if not found then return jsonb_build_object('status','not_checked'); end if;
 select coalesce(o.version,o.updated_at::text) into current_version from storage.objects o where o.id=j.source_id;
 if j.source_id is not null and current_version is distinct from j.source_version then
  return jsonb_build_object('status','stale','checked_at',j.checked_at);
 end if;
 return jsonb_build_object('status',j.status,'checked_at',j.checked_at,'result',j.result);
end $$;
revoke all on function public.get_payslip_forensics(uuid) from public,anon;
grant execute on function public.get_payslip_forensics(uuid) to authenticated;

-- Service-only worker RPC. Edge verifies GitHub OIDC before calling it.
create function public.payslip_forensics_worker(p_action text,p_job_id uuid default null,p_lease uuid default null,p_result jsonb default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j private.payslip_forensics_jobs; obj storage.objects; valid_doc boolean;
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'Worker only' using errcode='42501'; end if;
 if p_action='claim' then
  update private.payslip_forensics_jobs set status='error',lease=null,lease_until=null
   where status='processing' and lease_until<now() and attempts>=3;
  select * into j from private.payslip_forensics_jobs
   where status='pending' or (status='processing' and lease_until<now() and attempts<3)
   order by created_at for update skip locked limit 1;
  if not found then return null; end if;
  select exists(select 1 from public.kyc_documents d where d.id=j.document_id and d.document_type='PAYSLIP' and d.storage_path=j.storage_path) into valid_doc;
  select * into obj from storage.objects where bucket_id='kyc-documents' and name=j.storage_path;
  if not valid_doc or obj.id is null or coalesce((obj.metadata->>'size')::bigint,0) not between 1 and 5242880 then
   update private.payslip_forensics_jobs set status='error' where id=j.id;
   return jsonb_build_object('skip',true);
  end if;
  update private.payslip_forensics_jobs set status='processing',attempts=attempts+1,lease=gen_random_uuid(),lease_until=now()+interval '10 minutes',source_id=obj.id,source_version=coalesce(obj.version,obj.updated_at::text)
   where id=j.id returning * into j;
  return jsonb_build_object('id',j.id,'lease',j.lease);
 end if;
 select * into j from private.payslip_forensics_jobs where id=p_job_id and lease=p_lease and status='processing' and lease_until>now() for update;
 if not found then raise exception 'Lease unavailable'; end if;
 select * into obj from storage.objects where id=j.source_id and bucket_id='kyc-documents' and name=j.storage_path;
 if obj.id is null or coalesce(obj.version,obj.updated_at::text) is distinct from j.source_version or not exists(select 1 from public.kyc_documents d where d.id=j.document_id and d.document_type='PAYSLIP' and d.storage_path=j.storage_path) then
  raise exception 'Source changed';
 end if;
 if p_action='read' then
  return jsonb_build_object('path',j.storage_path,'size',(obj.metadata->>'size')::bigint,'version',j.source_version);
 elsif p_action='complete' then
  if p_result is null or coalesce(p_result->>'status','') not in ('review_required','no_indicators_detected','error') or
   coalesce(p_result->>'sha256','') !~ '^[0-9a-f]{64}$' or
   coalesce(p_result->'authenticity_verified','null'::jsonb)<>'false'::jsonb or
   jsonb_typeof(p_result->'findings') is distinct from 'array' or
   jsonb_array_length(p_result->'findings')>100 or octet_length(p_result::text)>32768 then
   raise exception 'Invalid result';
  end if;
  update private.payslip_forensics_jobs set status=p_result->>'status',sha256=p_result->>'sha256',result=p_result,checked_at=now(),lease=null,lease_until=null where id=j.id;
  return jsonb_build_object('recorded',true);
 end if;
 raise exception 'Invalid action';
end $$;
revoke all on function public.payslip_forensics_worker(text,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.payslip_forensics_worker(text,uuid,uuid,jsonb) to service_role;

-- Existing records join the same bounded queue; original evidence remains intact.
insert into private.payslip_forensics_jobs(document_id,storage_path,status)
select id,storage_path,case when lower(storage_path) like '%.pdf' then 'pending' else 'unsupported' end
from public.kyc_documents where document_type='PAYSLIP'
on conflict(document_id,storage_path) do nothing;
