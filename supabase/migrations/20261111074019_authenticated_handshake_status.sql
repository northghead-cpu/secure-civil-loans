-- No rows or tables are deleted. Customer reads continue through existing RLS.
alter table public.application_handoffs add column handshake_remote_id uuid;
alter table public.application_handoffs add column handshake_status_version bigint not null default 0;
alter table public.application_handoffs add column handshake_status_hash text;
alter table public.application_handoffs drop constraint application_handoffs_status_check;
alter table public.application_handoffs add constraint application_handoffs_status_check check(status in (
 'pending_authorization','authorized','preparing','sent_to_lender','lender_review','decision',
 'additional_information_requested','pre_approved','approved','declined','disbursed','expired','cancelled'));

-- Staff UPDATE grants cannot forge the remote identity, version or lender outcomes.
create or replace function public.prevent_manual_lender_handoff_status_change() returns trigger
language plpgsql set search_path='' as $$
begin
 if auth.role()='authenticated' then
  if new.handshake_remote_id is distinct from old.handshake_remote_id
    or new.handshake_status_version is distinct from old.handshake_status_version
    or new.handshake_status_hash is distinct from old.handshake_status_hash then
   raise exception 'Integration fields are worker controlled' using errcode='42501';
  end if;
  if new.status is distinct from old.status and
   (old.status in ('lender_review','additional_information_requested','pre_approved','approved','declined','disbursed','expired','cancelled')
    or new.status in ('lender_review','additional_information_requested','pre_approved','approved','declined','disbursed','expired','cancelled')) then
   raise exception 'Lender-controlled application handoff statuses must be reported by the financial institution' using errcode='42501';
  end if;
 end if;
 return new;
end $$;

create function public.apply_handshake_status(p_handoff_id uuid,p_handshake_id uuid,p_status text,p_version bigint,p_payload_hash text,p_expected_lender text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare h public.application_handoffs%rowtype;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Worker only' using errcode='42501';end if;
 if p_status is null or p_status not in ('preparing','sent_to_lender','lender_review','additional_information_requested','pre_approved','approved','declined','disbursed','expired','cancelled')
  or p_version is null or p_version<1 or p_payload_hash is null or p_payload_hash!~'^[a-f0-9]{64}$' or p_handshake_id is null then
  raise exception 'INVALID_STATUS_PAYLOAD' using errcode='22023';end if;
 select * into h from public.application_handoffs where id=p_handoff_id for update;
 if not found or h.lender_name is distinct from p_expected_lender or h.authorized_at is null
  or nullif(h.authorization_signature,'') is null or h.status='pending_authorization'
  or (h.handshake_remote_id is not null and h.handshake_remote_id<>p_handshake_id) then
  raise exception 'HANDOFF_BINDING_MISMATCH' using errcode='42501';end if;
 if p_version<h.handshake_status_version then return jsonb_build_object('accepted',true,'stale',true);end if;
 if p_version=h.handshake_status_version then
  if h.handshake_status_hash is distinct from p_payload_hash then raise exception 'STATUS_VERSION_CONFLICT' using errcode='23505';end if;
  return jsonb_build_object('accepted',true,'duplicate',true);
 end if;
 if h.status in ('declined','disbursed','expired','cancelled') and p_status<>h.status
  or h.status='approved' and p_status not in ('approved','disbursed') then
  raise exception 'TERMINAL_STATUS_CONFLICT' using errcode='23505';end if;
 update public.application_handoffs set status=p_status,handshake_remote_id=p_handshake_id,
 handshake_status_version=p_version,handshake_status_hash=p_payload_hash,
 handshake_transfer_status='accepted',handshake_accepted_at=coalesce(handshake_accepted_at,now()),
 handshake_transfer_last_error=null,updated_at=now() where id=h.id;
 insert into public.audit_logs(user_id,role,action_performed,record_id,table_name,new_value)
 values(null,'system','handshake_status_received',h.id::text,'application_handoffs',
 jsonb_build_object('status',p_status,'version',p_version,'handshake_id',p_handshake_id));
 return jsonb_build_object('accepted',true,'handoff_id',h.id,'status',p_status,'version',p_version);
end $$;
revoke all on function public.apply_handshake_status(uuid,uuid,text,bigint,text,text) from public,anon,authenticated;
grant execute on function public.apply_handshake_status(uuid,uuid,text,bigint,text,text) to service_role;

-- Operational status callbacks must not invalidate unchanged borrower authorization.
create or replace function private.marketplace_kyc_release_context(p_handoff_id uuid,p_lender_name text,p_nonce uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare h public.application_handoffs%rowtype;p public.profiles%rowtype;docs jsonb; fp text;
begin
 if (auth.jwt()->>'role') is distinct from 'service_role' then raise exception 'Trusted package source required' using errcode='42501';end if;
 if clock_timestamp()>='2026-11-30 22:00:00+00' then raise exception 'Pilot ended' using errcode='55000';end if;
 select * into h from public.application_handoffs where id=p_handoff_id;
 if not found or h.lender_name is distinct from p_lender_name or h.handshake_transfer_status is distinct from 'accepted'
 or h.status not in ('authorized','preparing','sent_to_lender','lender_review','additional_information_requested','pre_approved','approved','disbursed') or h.authorized_at is null or coalesce(h.authorization_signature,'')='' or coalesce(h.authorization_version,'')=''
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
 fp:=encode(extensions.digest(convert_to(jsonb_build_object('documents',docs,'review',p.kyc_review_revision,'profile',p.updated_at,'consents',p.consents_updated_at,'handoff',jsonb_build_object('authorized_at',h.authorized_at,'signature',h.authorization_signature,'version',h.authorization_version,'categories',h.information_categories,'lender',h.lender_name,'user',h.user_id,'amount',h.requested_amount,'term',h.term_months,'product',h.lender_product_id))::text,'utf8'),'sha256'),'hex');
 return jsonb_build_object('handoff_id',h.id,'source_fingerprint',fp,'documents',docs,'borrower',jsonb_build_object('full_name',p.full_name,'nrc_number',p.nrc_number,'employee_number',p.employee_number,'employer',p.employer,'phone',p.phone,'gov_id_type',p.gov_id_type,'gov_id_number',p.gov_id_number));
end $$;
