-- Super-admin assisted intake. Retains existing profiles and all historical evidence.
set local lock_timeout = '5s';
set local statement_timeout = '60s';

alter table public.kyc_documents add column if not exists uploaded_by uuid references auth.users(id);
alter table public.kyc_documents add column if not exists intake_source text;

create function public.require_assisted_kyc_target(_user_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_interactive_session();
 if not coalesce(private.has_role('super_admin'),false) then
  raise exception 'Super admin required' using errcode='42501';
 end if;
 if _user_id is null or not exists(select 1 from public.profiles where user_id=_user_id and account_status='active')
 or private.is_privileged_role(_user_id) then
  raise exception 'Active borrower profile required' using errcode='42501';
 end if;
 if exists(select 1 from public.profiles where user_id=_user_id and kyc_status in ('VERIFIED','COMPLETED','IN_REVIEW')) then
  raise exception 'This profile is already verified or under review';
 end if;
end $$;
revoke all on function public.require_assisted_kyc_target(uuid) from public,anon;
grant execute on function public.require_assisted_kyc_target(uuid) to authenticated;

create function public.submit_assisted_kyc(_user_id uuid,_details jsonb,_documents jsonb,_expected_revision uuid)
returns void language plpgsql security definer set search_path='' as $$
declare p public.profiles; d jsonb; v_path text; v_kind text;
begin
 perform public.require_assisted_kyc_target(_user_id);
 select * into strict p from public.profiles where user_id=_user_id for update;
 -- Recheck after the row lock to reject concurrent review/submission.
 if _expected_revision is null or p.kyc_review_revision<>_expected_revision
 or p.kyc_status in ('VERIFIED','COMPLETED','IN_REVIEW') then
  raise exception 'Profile changed; refresh before submitting';
 end if;
 if jsonb_typeof(_details) is distinct from 'object'
 or jsonb_typeof(_documents) is distinct from 'array'
 or jsonb_array_length(_documents)<>6 then raise exception 'Six verification documents required'; end if;
 if length(trim(coalesce(_details->>'fullName',''))) not between 2 and 100
 or coalesce(_details->>'nrcNumber','') !~ '^[0-9]{6}/[0-9]{2}/[0-9]$'
 or coalesce(_details->>'phone','') !~ '^\+?[0-9 -]{9,20}$'
 or length(trim(coalesce(_details->>'employer',''))) not between 2 and 150
 or length(trim(coalesce(_details->>'employeeNumber',''))) not between 1 and 50
 or length(trim(coalesce(_details->>'govIdNumber',''))) not between 1 and 50
 or coalesce(_details->>'govIdType','') not in ('passport','driving_license','employee_id')
 then raise exception 'Complete the customer identity and employment details'; end if;
 perform pg_advisory_xact_lock(hashtextextended('assisted-nrc:'||(_details->>'nrcNumber'),0));
 if exists(select 1 from public.profiles where nrc_number=_details->>'nrcNumber' and user_id<>_user_id) then
  raise exception 'This NRC already belongs to another profile; use the existing profile';
 end if;
 if (select count(*) from jsonb_array_elements(_documents)x where x->>'document_type'='NRC')<>1
 or (select count(*) from jsonb_array_elements(_documents)x where x->>'document_type'='GOV_ID')<>1
 or (select count(*) from jsonb_array_elements(_documents)x where x->>'document_type'='INTRODUCTORY_LETTER')<>1
 or (select count(*) from jsonb_array_elements(_documents)x where x->>'document_type'='PAYSLIP')<>3
 or (select count(distinct x->>'storage_path') from jsonb_array_elements(_documents)x)<>6
 or (select count(distinct x->>'pay_period') from jsonb_array_elements(_documents)x where x->>'document_type'='PAYSLIP')<>3
 then raise exception 'Required document types or distinct payslip months are missing'; end if;
 for d in select * from jsonb_array_elements(_documents) loop
  v_path:=d->>'storage_path';
  v_kind:=case d->>'document_type' when 'NRC' then 'nrc' when 'GOV_ID' then 'gov-id'
   when 'INTRODUCTORY_LETTER' then 'introductory-letter' when 'PAYSLIP' then 'payslip' end;
  if v_path is null or v_kind is null
   or v_path !~ ('^'||_user_id::text||'/'||v_kind||'-[0-9]{13}\.(pdf|png|jpe?g)$')
   or not exists(select 1 from storage.objects where bucket_id='kyc-documents' and name=v_path)
   or exists(select 1 from public.kyc_documents where storage_path=v_path)
  then raise exception 'Document is missing, previously submitted or assigned to the wrong customer'; end if;
  if d->>'document_type'='PAYSLIP' and (d->>'pay_period' is null or
   (d->>'pay_period')::date not in (select (date_trunc('month',current_date)-make_interval(months=>n))::date from generate_series(1,3)n))
  then raise exception 'Payslips must cover the three latest completed months'; end if;
 end loop;
 update public.kyc_documents set validation_status='REJECTED',rejection_reason='Superseded by assisted submission',updated_at=now()
 where user_id=_user_id and validation_status<>'REJECTED';
 insert into public.kyc_documents(user_id,document_type,storage_path,pay_period,validation_status,uploaded_by,intake_source)
 select _user_id,x->>'document_type',x->>'storage_path',case when x->>'document_type'='PAYSLIP' then (x->>'pay_period')::date else null end,
 'PENDING',auth.uid(),'super_admin_assisted' from jsonb_array_elements(_documents)x;
 update public.profiles set full_name=trim(_details->>'fullName'),nrc_number=_details->>'nrcNumber',
 phone=_details->>'phone',employer=trim(_details->>'employer'),employee_number=trim(_details->>'employeeNumber'),
 gov_id_type=_details->>'govIdType',gov_id_number=trim(_details->>'govIdNumber'),
 kyc_submitted_at=now(),kyc_status='IN_REVIEW',kyc_signature=null where user_id=_user_id;
 -- No borrower signature, subscription consent or loan authorisation is created.
 insert into public.audit_logs(user_id,role,action_performed,record_id,table_name,new_value)
 values(auth.uid(),'super_admin','assisted_kyc_submitted',_user_id::text,'profiles',
 jsonb_build_object('document_count',6,'source','super_admin_assisted'));
end $$;
revoke all on function public.submit_assisted_kyc(uuid,jsonb,jsonb,uuid) from public,anon;
grant execute on function public.submit_assisted_kyc(uuid,jsonb,jsonb,uuid) to authenticated;
