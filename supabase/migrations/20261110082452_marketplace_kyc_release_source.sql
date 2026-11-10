-- Service-only package source. No table data or retained files are removed.
create table private.kyc_release_nonces(nonce uuid primary key, handoff_id uuid not null, created_at timestamptz not null default clock_timestamp());
create index kyc_release_nonces_handoff_time on private.kyc_release_nonces(handoff_id,created_at);
alter table private.kyc_release_nonces enable row level security;
revoke all on private.kyc_release_nonces from public,anon,authenticated,service_role;
create function private.marketplace_kyc_release_context(p_handoff_id uuid,p_lender_name text,p_nonce uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare h public.application_handoffs%rowtype;p public.profiles%rowtype;docs jsonb; fp text;
begin
 if (auth.jwt()->>'role') is distinct from 'service_role' then raise exception 'Trusted package source required' using errcode='42501';end if;
 if clock_timestamp()>='2026-11-30 22:00:00+00' then raise exception 'Pilot ended' using errcode='55000';end if;
 select * into h from public.application_handoffs where id=p_handoff_id;
 if not found or h.lender_name is distinct from p_lender_name or h.handshake_transfer_status is distinct from 'accepted'
 or h.status not in ('authorized','preparing','sent_to_lender') or h.authorized_at is null or coalesce(h.authorization_signature,'')='' or coalesce(h.authorization_version,'')=''
 or not coalesce(h.information_categories @> array['Identity information','Employment information','Income information','Relevant supporting documents'],false)
 then raise exception 'Current authorized lender handoff required' using errcode='42501';end if;
 select * into p from public.profiles where user_id=h.user_id;
 if not found or p.account_status is distinct from 'active' or p.kyc_status not in ('VERIFIED','COMPLETED') or not coalesce(p.consent_data_sharing_lenders,false)
 then raise exception 'Current borrower verification and sharing consent required' using errcode='42501';end if;
 if p_nonce is not null then
  perform pg_advisory_xact_lock(hashtextextended(h.id::text,801110));
  if (select count(*) from private.kyc_release_nonces where handoff_id=h.id and created_at>clock_timestamp()-interval '1 hour')>=10 then raise exception 'Preparation rate limit' using errcode='54000';end if;
  insert into private.kyc_release_nonces(nonce,handoff_id) values(p_nonce,h.id);
 end if;
 -- Export only the reviewed inventory and exact object versions with real clean evidence.
 if (select count(*) from public.kyc_documents where user_id=h.user_id and validation_status<>'REJECTED')<>6 then raise exception 'Complete reviewed inventory required' using errcode='55000';end if;
 if exists(select 1 from public.kyc_documents d left join storage.objects o on o.bucket_id='kyc-documents' and o.name=d.storage_path
  left join private.marketplace_storage_scans s on s.object_id=o.id
  where d.user_id=h.user_id and d.validation_status<>'REJECTED' and (
   d.validation_status<>'VALID' or split_part(d.storage_path,'/',1)<>h.user_id::text or o.id is null
   or coalesce((o.metadata->>'size')::bigint,0) not between 1 and 5242880 or s.object_id is null or s.verdict<>'clean'
   or s.object_version is distinct from o.version or s.sha256 is null or s.definitions_at<clock_timestamp()-interval '48 hours'))
 then raise exception 'Current clean malware evidence required for every reviewed document' using errcode='55000';end if;
 select jsonb_agg(jsonb_build_object('id',o.id,'version',o.version,'path',d.storage_path,'type',d.document_type,'period',d.pay_period,'size',(o.metadata->>'size')::bigint,'sha256',s.sha256) order by d.document_type,d.pay_period,d.id)
 into docs from public.kyc_documents d join storage.objects o on o.bucket_id='kyc-documents' and o.name=d.storage_path
 join private.marketplace_storage_scans s on s.object_id=o.id where d.user_id=h.user_id and d.validation_status='VALID';
 if (select count(*) from jsonb_array_elements(docs)x where x->>'type'='NRC')<>1
 or (select count(*) from jsonb_array_elements(docs)x where x->>'type'='GOV_ID')<>1
 or (select count(*) from jsonb_array_elements(docs)x where x->>'type'='INTRODUCTORY_LETTER')<>1
 or (select count(distinct x->>'period') from jsonb_array_elements(docs)x where x->>'type'='PAYSLIP')<>3
 or (select sum((x->>'size')::bigint) from jsonb_array_elements(docs)x)>20971520 then raise exception 'Package inventory limits' using errcode='55000';end if;
 fp:=encode(extensions.digest(convert_to(jsonb_build_object('documents',docs,'review',p.kyc_review_revision,'profile',p.updated_at,'consents',p.consents_updated_at,'handoff',h.updated_at)::text,'utf8'),'sha256'),'hex');
 return jsonb_build_object('handoff_id',h.id,'source_fingerprint',fp,'documents',docs,'borrower',jsonb_build_object('full_name',p.full_name,'nrc_number',p.nrc_number,'employee_number',p.employee_number,'employer',p.employer,'phone',p.phone,'gov_id_type',p.gov_id_type,'gov_id_number',p.gov_id_number));
end $$;
revoke all on function private.marketplace_kyc_release_context(uuid,text,uuid) from public,anon,authenticated;
grant execute on function private.marketplace_kyc_release_context(uuid,text,uuid) to service_role;
create function public.marketplace_kyc_release_context(p_handoff_id uuid,p_lender_name text,p_nonce uuid default null)
returns jsonb language sql security invoker set search_path='' as $$select private.marketplace_kyc_release_context($1,$2,$3)$$;
revoke all on function public.marketplace_kyc_release_context(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.marketplace_kyc_release_context(uuid,text,uuid) to service_role;
