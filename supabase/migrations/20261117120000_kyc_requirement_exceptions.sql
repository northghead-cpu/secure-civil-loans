create table private.kyc_requirement_exceptions(user_id uuid primary key references auth.users(id),exceptions jsonb not null);
revoke all on private.kyc_requirement_exceptions from public,anon,authenticated;
create function private.missing_kyc_requirements(details jsonb,documents jsonb) returns text[]
language plpgsql stable set search_path='' as $$
declare missing text[]:='{}'; k text; n integer; period text;
begin
 foreach k in array array['fullName','nrcNumber','phone','employer','employeeNumber','govIdType','govIdNumber'] loop
  if length(trim(coalesce(details->>k,'')))=0 then missing:=array_append(missing,'field:'||k); end if;
 end loop;
 foreach k in array array['NRC','GOV_ID','INTRODUCTORY_LETTER'] loop
  if not exists(select 1 from jsonb_array_elements(documents)x where x->>'document_type'=k) then missing:=array_append(missing,'doc:'||k); end if;
 end loop;
 for n in 1..3 loop
  period:=(date_trunc('month',current_date)-make_interval(months=>n))::date::text;
  if not exists(select 1 from jsonb_array_elements(documents)x where x->>'document_type'='PAYSLIP' and x->>'pay_period'=period) then missing:=array_append(missing,'doc:PAYSLIP:'||period); end if;
 end loop;
 return missing;
end $$;
create function private.validate_kyc_exceptions(details jsonb,documents jsonb,exceptions jsonb) returns void
language plpgsql set search_path='' as $$
declare k text; missing text[];
begin
 if jsonb_typeof(details) is distinct from 'object' or jsonb_typeof(documents) is distinct from 'array' or jsonb_array_length(documents)>6
 or jsonb_typeof(exceptions) is distinct from 'object' then raise exception 'Invalid intake'; end if;
 missing:=private.missing_kyc_requirements(details,documents);
 foreach k in array missing loop
  if length(trim(coalesce(exceptions->>k,''))) not between 5 and 500 then raise exception 'Skip reason required for %',k; end if;
 end loop;
 for k in select jsonb_object_keys(exceptions) loop
  if not k=any(missing) then raise exception 'Unexpected exception: %',k; end if;
 end loop;
 if coalesce(details->>'nrcNumber','')<>'' and details->>'nrcNumber' !~ '^[0-9]{6}/[0-9]{2}/[0-9]$' then raise exception 'Invalid NRC'; end if;
 if coalesce(details->>'phone','')<>'' and details->>'phone' !~ '^\+?[0-9 -]{9,20}$' then raise exception 'Invalid phone'; end if;
 if length(coalesce(details->>'fullName',''))>100 or length(coalesce(details->>'employer',''))>150
 or length(coalesce(details->>'employeeNumber',''))>50 or length(coalesce(details->>'govIdNumber',''))>50 then raise exception 'Field too long'; end if;
 if coalesce(details->>'govIdType','')<>'' and details->>'govIdType' not in ('passport','driving_license','employee_id') then raise exception 'Invalid ID type'; end if;
 if (select count(distinct x->>'storage_path') from jsonb_array_elements(documents)x)<>jsonb_array_length(documents)
 or exists(select 1 from jsonb_array_elements(documents)x group by x->>'document_type',x->>'pay_period' having count(*)>1) then raise exception 'Duplicate documents'; end if;
end $$;
revoke all on function private.missing_kyc_requirements(jsonb,jsonb),private.validate_kyc_exceptions(jsonb,jsonb,jsonb) from public,anon,authenticated;
create function public.submit_assisted_kyc(_user_id uuid,_details jsonb,_documents jsonb,_expected_revision uuid,_exceptions jsonb)
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
 perform private.validate_kyc_exceptions(_details,_documents,_exceptions);
 perform pg_advisory_xact_lock(hashtextextended('assisted-nrc:'||(_details->>'nrcNumber'),0));
 if coalesce(_details->>'nrcNumber','')<>'' and exists(select 1 from public.profiles where nrc_number=_details->>'nrcNumber' and user_id<>_user_id) then
  raise exception 'This NRC already belongs to another profile; use the existing profile';
 end if;
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
 update public.profiles set full_name=trim(_details->>'fullName'),nrc_number=nullif(_details->>'nrcNumber',''),
 phone=_details->>'phone',employer=trim(_details->>'employer'),employee_number=trim(_details->>'employeeNumber'),
 gov_id_type=_details->>'govIdType',gov_id_number=trim(_details->>'govIdNumber'),
 kyc_submitted_at=now(),kyc_status='IN_REVIEW',kyc_signature=null where user_id=_user_id;
 insert into private.kyc_requirement_exceptions(user_id,exceptions) values(_user_id,_exceptions)
 on conflict(user_id) do update set exceptions=excluded.exceptions;
 -- No borrower signature, subscription consent or loan authorisation is created.
 insert into public.audit_logs(user_id,role,action_performed,record_id,table_name,new_value)
 values(auth.uid(),'super_admin','assisted_kyc_submitted',_user_id::text,'profiles',
 jsonb_build_object('document_count',jsonb_array_length(_documents),'exceptions',_exceptions,'source','super_admin_assisted'));
end $$;
revoke all on function public.submit_assisted_kyc(uuid,jsonb,jsonb,uuid,jsonb) from public,anon;
grant execute on function public.submit_assisted_kyc(uuid,jsonb,jsonb,uuid,jsonb) to authenticated;

create function public.kyc_approval_requirements(_user_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.profiles; docs jsonb; details jsonb;
begin
 perform private.require_interactive_session();
 if not coalesce(private.has_role('super_admin'),false) then raise exception 'Super admin required'; end if;
 select * into strict p from public.profiles where user_id=_user_id;
 select coalesce(jsonb_agg(jsonb_build_object('document_type',document_type,'pay_period',pay_period)),'[]') into docs from public.kyc_documents where user_id=_user_id and validation_status<>'REJECTED';
 details:=jsonb_build_object('fullName',p.full_name,'nrcNumber',p.nrc_number,'phone',p.phone,'employer',p.employer,'employeeNumber',p.employee_number,'govIdType',p.gov_id_type,'govIdNumber',p.gov_id_number);
 return jsonb_build_object('missing',private.missing_kyc_requirements(details,docs),'saved',coalesce((select exceptions from private.kyc_requirement_exceptions where user_id=_user_id),'{}'),'revision',p.kyc_review_revision);
end $$;
create function public.approve_kyc_with_exceptions(_user_id uuid,_expected_revision uuid,_exceptions jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare p public.profiles; requirements jsonb; k text;
begin
 perform private.require_interactive_session();
 if not coalesce(private.has_role('super_admin'),false) then raise exception 'Super admin required'; end if;
 select * into strict p from public.profiles where user_id=_user_id for update;
 if _expected_revision is null or p.kyc_review_revision<>_expected_revision or p.kyc_status<>'IN_REVIEW' then raise exception 'Profile changed; refresh before approval'; end if;
 requirements:=public.kyc_approval_requirements(_user_id);
 if jsonb_typeof(_exceptions) is distinct from 'object' then raise exception 'Reasons required'; end if;
 for k in select jsonb_array_elements_text(requirements->'missing') loop
  if length(trim(coalesce(_exceptions->>k,''))) not between 5 and 500 then raise exception 'Skip reason required for %',k; end if;
 end loop;
 for k in select jsonb_object_keys(_exceptions) loop
  if not (requirements->'missing') ? k then raise exception 'Unexpected exception'; end if;
 end loop;
 update public.kyc_documents set validation_status='VALID',updated_at=now() where user_id=_user_id and validation_status<>'REJECTED';
 update public.profiles set kyc_status='COMPLETED' where user_id=_user_id;
 insert into private.kyc_requirement_exceptions(user_id,exceptions) values(_user_id,_exceptions) on conflict(user_id) do update set exceptions=excluded.exceptions;
 insert into public.audit_logs(user_id,role,action_performed,record_id,table_name,new_value) values(auth.uid(),'super_admin','kyc_approved_with_exceptions',_user_id::text,'profiles',jsonb_build_object('exceptions',_exceptions));
 insert into public.notifications(user_id,title,message) values(_user_id,'Verification update','Your profile review is complete.');
end $$;
revoke all on function public.kyc_approval_requirements(uuid),public.approve_kyc_with_exceptions(uuid,uuid,jsonb) from public,anon;
grant execute on function public.kyc_approval_requirements(uuid),public.approve_kyc_with_exceptions(uuid,uuid,jsonb) to authenticated;
