-- Keep workflow state changes atomic and align the UI with authoritative records.
alter table public.profiles add column if not exists gov_id_type text;
alter table public.profiles add column if not exists gov_id_number text;
alter table public.profiles add column if not exists kyc_signature text;
alter table public.profiles add column if not exists kyc_submitted_at timestamptz;
alter table public.application_handoffs add column if not exists delivery_reference text;
alter table public.application_handoffs add column if not exists information_request text;

-- Definer lookup is required to avoid recursive profiles RLS. No public API grant.
create or replace function private.is_account_active() returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles where user_id=(select auth.uid()) and account_status='active');
$$;
revoke all on function private.is_account_active() from public, anon;
grant execute on function private.is_account_active() to authenticated;

-- Privileged membership is effective only while that account remains active.
create or replace function private.has_role(required_role text) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.user_roles r join public.profiles p on p.user_id=r.user_id
 where r.user_id=(select auth.uid()) and r.role::text=required_role and p.account_status='active');
$$;
create or replace function private.has_role(_user_id uuid,_role public.app_role) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.user_roles r join public.profiles p on p.user_id=r.user_id
 where r.user_id=_user_id and r.role=_role and p.account_status='active');
$$;

-- Ordinary users may read their own role bootstrap row; MFA restriction remains.
create policy user_roles_read_self on public.user_roles for select to authenticated
using (user_id=(select auth.uid()));
create policy profiles_staff_read on public.profiles for select to authenticated
using (private.has_role('super_user') or private.has_role('compliance_team') or private.has_role('data_entry_team'));
create policy audit_super_user_read on public.audit_logs for select to authenticated
using (private.has_role('super_user'));
create policy handoffs_super_user_read on public.application_handoffs for select to authenticated
using (private.has_role('super_user'));
create policy kyc_staff_read on public.kyc_documents for select to authenticated
using (private.has_role('admin') or private.has_role('super_admin') or private.has_role('super_user') or private.has_role('compliance_team') or private.has_role('data_entry_team'));
create policy kyc_storage_staff_read on storage.objects for select to authenticated
using (bucket_id='kyc-documents' and (select auth.jwt()->>'aal')='aal2'
 and (private.has_role('admin') or private.has_role('super_admin') or private.has_role('super_user') or private.has_role('compliance_team') or private.has_role('data_entry_team')));

drop policy if exists "Admins can do everything" on public.risk_flags;
create policy risk_staff_read on public.risk_flags for select to authenticated
using (private.has_role('admin') or private.has_role('super_admin') or private.has_role('super_user') or private.has_role('compliance_team'));
create policy risk_super_admin_update on public.risk_flags for update to authenticated
using (private.has_role('super_admin')) with check (private.has_role('super_admin'));

-- The upload layout is user UUID / allowlisted filename (one folder).
drop policy if exists "Users can upload own documents" on storage.objects;
create policy "Users can upload own documents" on storage.objects for insert to authenticated
with check (bucket_id='kyc-documents' and (select auth.uid())::text=split_part(name,'/',1)
 and array_length(string_to_array(name,'/'),1)=2 and public.is_valid_kyc_storage_object_name(split_part(name,'/',2)));
drop policy if exists "Users can update own documents" on storage.objects;
-- Submitted evidence is immutable. New submissions use new object paths.
revoke insert, update, delete on public.kyc_documents from authenticated;

create or replace function public.protect_profile_security_fields() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if not (private.has_role('admin') or private.has_role('super_admin')) then
  -- Requesting review is not verification. Borrowers still cannot self-approve.
  if not (auth.uid()=old.user_id and new.kyc_status='IN_REVIEW'
     and coalesce(old.kyc_status,'INCOMPLETE') in ('INCOMPLETE','PENDING','REJECTED','IN_REVIEW')) then
   new.kyc_status := old.kyc_status;
  end if;
  new.nrc_verified := old.nrc_verified;
  new.phone_verified := old.phone_verified;
  new.account_status := old.account_status;
  if upper(coalesce(old.kyc_status,'')) in ('VERIFIED','COMPLETED') then
   new.full_name := old.full_name; new.nrc_number := old.nrc_number;
   new.employee_number := old.employee_number;
   new.gov_id_type := old.gov_id_type; new.gov_id_number := old.gov_id_number;
   new.kyc_signature := old.kyc_signature; new.kyc_submitted_at := old.kyc_submitted_at;
  end if;
 end if;
 return new;
end;
$$;
revoke all on function public.protect_profile_security_fields() from public, anon, authenticated;

create or replace function private.submit_kyc_verification(_details jsonb,_documents jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=auth.uid(); v_profile public.profiles; d jsonb; v_path text;
begin
 if v_user is null or not private.is_account_active() then raise exception 'Active account required'; end if;
 if private.is_privileged_role(v_user) and coalesce(auth.jwt()->>'aal','') <> 'aal2' then raise exception 'MFA required'; end if;
 select * into strict v_profile from public.profiles where user_id=v_user for update;
 if v_profile.kyc_status in ('VERIFIED','COMPLETED') then raise exception 'Verification is already complete'; end if;
 if jsonb_typeof(_details) is distinct from 'object' or jsonb_typeof(_documents) is distinct from 'array'
 or jsonb_array_length(_documents)<>6 then raise exception 'Six verification documents required'; end if;
 if length(trim(coalesce(_details->>'fullName',''))) not between 2 and 100
 or coalesce(_details->>'nrcNumber','') !~ '^[0-9]{6}/[0-9]{2}/[0-9]$'
 or coalesce(_details->>'phone','') !~ '^\+?[0-9 -]{9,20}$'
 or length(trim(coalesce(_details->>'employer',''))) not between 2 and 150
 or length(trim(coalesce(_details->>'employeeNumber',''))) not between 1 and 50
 or length(trim(coalesce(_details->>'govIdNumber',''))) not between 1 and 50
 or coalesce(_details->>'govIdType','') not in ('passport','driving_license','employee_id')
 or lower(trim(coalesce(_details->>'signatureName',''))) <> lower(trim(_details->>'fullName'))
 then raise exception 'Complete the identity fields and sign with your full name'; end if;
 if (select count(*) from jsonb_array_elements(_documents) x where x->>'document_type'='NRC')<>1
 or (select count(*) from jsonb_array_elements(_documents) x where x->>'document_type'='GOV_ID')<>1
 or (select count(*) from jsonb_array_elements(_documents) x where x->>'document_type'='INTRODUCTORY_LETTER')<>1
 or (select count(*) from jsonb_array_elements(_documents) x where x->>'document_type'='PAYSLIP')<>3
 then raise exception 'Required document types are missing'; end if;
 for d in select * from jsonb_array_elements(_documents) loop
  v_path:=d->>'storage_path';
  if v_path is null or split_part(v_path,'/',1)<>v_user::text
   or array_length(string_to_array(v_path,'/'),1)<>2
   or not public.is_valid_kyc_storage_object_name(split_part(v_path,'/',2))
   or not exists(select 1 from storage.objects where bucket_id='kyc-documents' and name=v_path)
  then raise exception 'An uploaded document could not be verified'; end if;
  if d->>'document_type'='PAYSLIP' and (
    (d->>'pay_period')::date not in (select (date_trunc('month',current_date)-make_interval(months=>n))::date from generate_series(1,3) n)
    or coalesce((d->>'ocr_confidence')::numeric,0)<70) then raise exception 'Three latest completed payslip months required'; end if;
 end loop;
 if (select count(distinct x->>'storage_path') from jsonb_array_elements(_documents)x)<>6
 or (select count(distinct x->>'pay_period') from jsonb_array_elements(_documents)x where x->>'document_type'='PAYSLIP')<>3
 then raise exception 'Duplicate documents or payslip periods'; end if;
 -- Idempotent replacement, with old evidence retained as superseded/rejected.
 update public.kyc_documents set validation_status='REJECTED',rejection_reason='Superseded by a new submission',updated_at=now()
 where user_id=v_user and validation_status<>'REJECTED';
 insert into public.kyc_documents(user_id,document_type,storage_path,pay_period,ocr_period,ocr_confidence,validation_status)
 select v_user,x->>'document_type',x->>'storage_path',(x->>'pay_period')::date,x->>'ocr_period',(x->>'ocr_confidence')::numeric,'PENDING'
 from jsonb_array_elements(_documents)x;
 update public.profiles set full_name=trim(_details->>'fullName'),nrc_number=_details->>'nrcNumber',phone=_details->>'phone',
 employer=trim(_details->>'employer'),employee_number=trim(_details->>'employeeNumber'),gov_id_type=_details->>'govIdType',
 gov_id_number=trim(_details->>'govIdNumber'),kyc_signature=trim(_details->>'signatureName'),kyc_submitted_at=now(),kyc_status='IN_REVIEW'
 where user_id=v_user;
 if not exists(select 1 from public.profiles where user_id=v_user and kyc_status='IN_REVIEW') then raise exception 'Verification status was not recorded'; end if;
end;
$$;
revoke all on function private.submit_kyc_verification(jsonb,jsonb) from public, anon;
grant execute on function private.submit_kyc_verification(jsonb,jsonb) to authenticated;
create or replace function public.submit_kyc_verification(_details jsonb,_documents jsonb) returns void
language sql security invoker set search_path = '' as $$ select private.submit_kyc_verification(_details,_documents); $$;
revoke all on function public.submit_kyc_verification(jsonb,jsonb) from public, anon;
grant execute on function public.submit_kyc_verification(jsonb,jsonb) to authenticated;

create or replace function private.review_kyc_verification(_user_id uuid,_status text,_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null or not private.is_account_active() or coalesce(auth.jwt()->>'aal','')<>'aal2'
 or not (private.has_role('admin') or private.has_role('super_admin')) then raise exception 'Authorized MFA staff required'; end if;
 if _status not in ('COMPLETED','REJECTED') then raise exception 'Invalid review result'; end if;
 perform 1 from public.profiles where user_id=_user_id for update;
 if not found then raise exception 'Profile not found'; end if;
 if _status='COMPLETED' and ((select count(*) from public.kyc_documents where user_id=_user_id and validation_status<>'REJECTED')<>6 or (select count(distinct document_type) from public.kyc_documents where user_id=_user_id and validation_status<>'REJECTED')<>4 or (select count(distinct pay_period) from public.kyc_documents where user_id=_user_id and document_type='PAYSLIP' and validation_status<>'REJECTED')<>3) then raise exception 'Review requires a complete document submission'; end if;
 if _status='REJECTED' and length(trim(coalesce(_reason,'')))<5 then raise exception 'Give a reason so the borrower can correct the submission'; end if;
 update public.kyc_documents set validation_status=case when _status='COMPLETED' then 'VALID' else 'REJECTED' end,
 rejection_reason=case when _status='REJECTED' then trim(_reason) else null end,updated_at=now()
 where user_id=_user_id and validation_status<>'REJECTED';
 update public.profiles set kyc_status=_status where user_id=_user_id;
 insert into public.notifications(user_id,title,message) values(_user_id,'Verification update',case when _status='COMPLETED' then 'Your identity and employment verification is complete.' else 'Please resubmit verification: '||trim(_reason) end);
end;
$$;
revoke all on function private.review_kyc_verification(uuid,text,text) from public, anon;
grant execute on function private.review_kyc_verification(uuid,text,text) to authenticated;
create or replace function public.review_kyc_verification(_user_id uuid,_status text,_reason text default null) returns void
language sql security invoker set search_path = '' as $$ select private.review_kyc_verification(_user_id,_status,_reason); $$;
revoke all on function public.review_kyc_verification(uuid,text,text) from public, anon;
grant execute on function public.review_kyc_verification(uuid,text,text) to authenticated;

-- Accept institution-controlled outcomes represented by the tracking UI.
alter table public.application_handoffs drop constraint if exists application_handoffs_status_check;
alter table public.application_handoffs add constraint application_handoffs_status_check check(status in ('pending_authorization','authorized','preparing','sent_to_lender','lender_review','decision','additional_information_requested','approved','declined','disbursed'));
-- Operational updates go through the constrained RPC below, not arbitrary row edits.
revoke update on public.application_handoffs from authenticated;

-- Prepare/send are operational milestones, never fabricated lender decisions.
create or replace function private.advance_application_handoff(_id uuid,_status text,_reference text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_handoff public.application_handoffs;
begin
 if auth.uid() is null or not private.is_account_active() or coalesce(auth.jwt()->>'aal','')<>'aal2'
 or not (private.has_role('admin') or private.has_role('super_admin')) then raise exception 'Authorized MFA staff required'; end if;
 select * into strict v_handoff from public.application_handoffs where id=_id for update;
 if not ((_status='preparing' and v_handoff.status='authorized') or (_status='sent_to_lender' and v_handoff.status='preparing')) then raise exception 'Invalid handoff transition'; end if;
 if _status='sent_to_lender' and length(trim(coalesce(_reference,'')))<5 then raise exception 'Record the actual delivery reference before marking sent'; end if;
 update public.application_handoffs set status=_status,delivery_reference=nullif(trim(_reference),''),updated_at=now() where id=_id;
 insert into public.notifications(user_id,title,message) values(v_handoff.user_id,'Application handoff update',case when _status='preparing' then 'Your authorized information is being prepared for ' else 'Your authorized information was sent to ' end||v_handoff.lender_name);
 insert into public.audit_logs(user_id,role,action_performed,record_id,table_name,new_value)
 values(auth.uid(),'staff','advance_application_handoff',_id::text,'application_handoffs',jsonb_build_object('status',_status,'delivery_reference',_reference));
end;
$$;
revoke all on function private.advance_application_handoff(uuid,text,text) from public, anon;
grant execute on function private.advance_application_handoff(uuid,text,text) to authenticated;
create or replace function public.advance_application_handoff(_id uuid,_status text,_reference text default null) returns void
language sql security invoker set search_path = '' as $$ select private.advance_application_handoff(_id,_status,_reference); $$;
revoke all on function public.advance_application_handoff(uuid,text,text) from public, anon;
grant execute on function public.advance_application_handoff(uuid,text,text) to authenticated;

-- Disable dormant rules: no worker can execute these free-text definitions.
update public.automation_rules set enabled=false where enabled=true;

-- RLS enforces suspension even for already-issued tokens. Own profile/role reads
-- remain available for a blocked-account message and recovery, not app access.
do $$ declare t record; begin
 for t in select tablename from pg_tables where schemaname='public' and tablename not in ('profiles','user_roles') loop
  execute format('create policy "Active account required" on public.%I as restrictive for all to authenticated using ((select private.is_account_active())) with check ((select private.is_account_active()))',t.tablename);
 end loop;
end $$;
create policy profiles_active_update on public.profiles as restrictive for update to authenticated
using ((select private.is_account_active())) with check ((select private.is_account_active()));
create policy storage_active_account on storage.objects as restrictive for all to authenticated
using ((select private.is_account_active())) with check ((select private.is_account_active()));

create or replace function public.search_audit_logs(_search text default '',_action text default 'all',_date date default null,_offset integer default 0)
returns setof public.audit_logs language sql stable security invoker set search_path = '' as $$
 select a.* from public.audit_logs a
 where (_search='' or concat_ws(' ',a.user_id::text,a.role,a.action_performed,a.record_id) ilike '%'||_search||'%')
 and (_action='all' or a.action_performed=_action)
 and (_date is null or (a.created_at>=_date::timestamp at time zone 'UTC' and a.created_at<(_date+1)::timestamp at time zone 'UTC'))
 order by a.created_at desc,a.id desc limit 101 offset greatest(_offset,0);
$$;
revoke all on function public.search_audit_logs(text,text,date,integer) from public, anon;
grant execute on function public.search_audit_logs(text,text,date,integer) to authenticated;

-- Existing RPCs bypass RLS internally; suspension must be checked explicitly.
CREATE OR REPLACE FUNCTION private.authorize_application_handoff_internal(_user_id uuid, _lender_product_id uuid, _requested_amount numeric, _term_months integer, _signature_name text)
 RETURNS application_handoffs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_product public.bank_products;
  v_profile_full_name text;
  v_handoff public.application_handoffs;
  v_authorized_at timestamptz := clock_timestamp();
  v_authorization_text text;
  v_authorization_hash text;
begin
  if auth.uid() is null or not private.is_account_active() then raise exception 'Active account required'; end if;

  IF _user_id IS NULL OR _user_id <> (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF _requested_amount IS NULL OR _requested_amount <= 0 THEN RAISE EXCEPTION 'Invalid requested amount'; END IF;
  IF _term_months IS NULL OR _term_months <= 0 THEN RAISE EXCEPTION 'Invalid term'; END IF;

  SELECT * INTO v_product
  FROM public.bank_products
  WHERE id = _lender_product_id AND active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Selected loan product is unavailable'; END IF;
  IF _requested_amount < v_product.min_amount OR _requested_amount > v_product.max_amount THEN
    RAISE EXCEPTION 'Requested amount is outside the selected product limits';
  END IF;
  IF _term_months > v_product.max_term_months THEN
    RAISE EXCEPTION 'Requested term is outside the selected product limits';
  END IF;

  SELECT trim(full_name) INTO v_profile_full_name
  FROM public.profiles WHERE user_id = _user_id;
  IF v_profile_full_name IS NULL OR length(v_profile_full_name) < 2 THEN
    RAISE EXCEPTION 'Verified legal name is required';
  END IF;
  IF lower(trim(coalesce(_signature_name, ''))) <> lower(v_profile_full_name) THEN
    RAISE EXCEPTION 'Authorization signature must match your verified legal name';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id AND consent_accepted = true
  ) THEN
    RAISE EXCEPTION 'Required Riverbanc consent has not been accepted';
  END IF;

  v_authorization_text := format(
    'INFORMATION-SHARING AUTHORIZATION (handoff-v1-2026-08)\n\nI authorize Riverbanc Technology Limited to prepare and share my verified information with %s for my selected loan application.\n\nSelected product: %s\nRequested amount: ZMW %s\nSelected term: %s months\nAnnual interest rate: %s%%',
    v_product.bank_name,
    v_product.bank_name,
    _requested_amount,
    _term_months,
    v_product.interest_rate
  );

  SELECT encode(
    extensions.digest(
      concat_ws('|', _user_id::text, _lender_product_id::text, _requested_amount::text, _term_months::text, v_authorized_at::text, v_authorization_text),
      'sha256'
    ),
    'hex'
  ) INTO v_authorization_hash;

  INSERT INTO public.application_handoffs (
    user_id, lender_product_id, lender_name, product_name, requested_amount,
    term_months, interest_rate, estimated_monthly_repayment, total_repayment,
    information_categories, authorization_text, authorization_version,
    authorized_at, authorization_signature, status
  )
  VALUES (
    _user_id, _lender_product_id, v_product.bank_name, v_product.bank_name,
    _requested_amount, _term_months, v_product.interest_rate, NULL, NULL,
    ARRAY['Identity information','Employment information','Income information','Verification results','Relevant supporting documents'],
    v_authorization_text, 'handoff-v1-2026-08', v_authorized_at,
    v_profile_full_name, 'authorized'
  )
  RETURNING * INTO v_handoff;

  INSERT INTO private.application_handoff_secrets(handoff_id, authorization_hash)
  VALUES (v_handoff.id, v_authorization_hash);

  INSERT INTO public.audit_logs(user_id, role, action_performed, record_id, table_name, old_value, new_value)
  VALUES (
    _user_id, 'borrower', 'application_handoff_authorized', v_handoff.id::text,
    'application_handoffs', NULL,
    jsonb_build_object(
      'lender_product_id', _lender_product_id,
      'lender_name', v_product.bank_name,
      'product_name', v_product.bank_name,
      'requested_amount', _requested_amount,
      'term_months', _term_months,
      'authorization_version', 'handoff-v1-2026-08'
    )
  );

  RETURN v_handoff;
END;
$function$
;
CREATE OR REPLACE FUNCTION private.authorize_application_handoff_internal(_user_id uuid, _lender_product_id uuid, _requested_amount numeric, _term_months integer, _signature_name text, _authorization_accepted boolean)
 RETURNS application_handoffs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ DECLARE v_product public.bank_products; v_profile_full_name text; v_handoff public.application_handoffs; v_authorized_at timestamptz := clock_timestamp(); v_authorization_text text; v_authorization_hash text; begin
  if auth.uid() is null or not private.is_account_active() then raise exception 'Active account required'; end if;
 IF _user_id IS NULL OR _user_id <> (SELECT auth.uid()) THEN RAISE EXCEPTION 'Authentication required'; END IF; IF _authorization_accepted IS DISTINCT FROM true THEN RAISE EXCEPTION 'Information-sharing authorization must be accepted'; END IF; IF _requested_amount IS NULL OR _requested_amount <= 0 THEN RAISE EXCEPTION 'Invalid requested amount'; END IF; IF _term_months IS NULL OR _term_months <= 0 THEN RAISE EXCEPTION 'Invalid term'; END IF; SELECT * INTO v_product FROM public.bank_products WHERE id = _lender_product_id AND active = true; IF NOT FOUND THEN RAISE EXCEPTION 'Selected loan product is unavailable'; END IF; IF _requested_amount < v_product.min_amount OR _requested_amount > v_product.max_amount THEN RAISE EXCEPTION 'Requested amount is outside the selected product limits'; END IF; IF _term_months > v_product.max_term_months THEN RAISE EXCEPTION 'Requested term is outside the selected product limits'; END IF; SELECT trim(full_name) INTO v_profile_full_name FROM public.profiles WHERE user_id = _user_id; IF v_profile_full_name IS NULL OR length(v_profile_full_name) < 2 THEN RAISE EXCEPTION 'Verified legal name is required'; END IF; IF lower(trim(coalesce(_signature_name, ''))) <> lower(v_profile_full_name) THEN RAISE EXCEPTION 'Authorization signature must match your verified legal name'; END IF; v_authorization_text := format('INFORMATION-SHARING AUTHORIZATION (handoff-v1-2026-08)\n\nI authorize Riverbanc Technology Limited to prepare and share the verified information listed below with %s for my selected loan application.\n\nThis authorization is separate from Riverbanc subscription consent and does not authorize salary deduction for loan repayments.\n\nSelected product: %s\nRequested amount: ZMW %s\nSelected term: %s months\nSelected annual interest rate: %s%%\n\nInformation categories authorized for sharing: Identity information; Employment information; Income information; Verification results; Relevant supporting documents', v_product.bank_name, v_product.bank_name, _requested_amount, _term_months, v_product.interest_rate); SELECT encode(extensions.digest(concat_ws('|', _user_id::text, _lender_product_id::text, _requested_amount::text, _term_months::text, v_authorized_at::text, v_authorization_text), 'sha256'), 'hex') INTO v_authorization_hash; INSERT INTO public.application_handoffs (user_id, lender_product_id, lender_name, product_name, requested_amount, term_months, interest_rate, estimated_monthly_repayment, total_repayment, information_categories, authorization_text, authorization_version, authorized_at, authorization_signature, status) VALUES (_user_id, _lender_product_id, v_product.bank_name, v_product.bank_name, _requested_amount, _term_months, v_product.interest_rate, NULL, NULL, ARRAY['Identity information','Employment information','Income information','Verification results','Relevant supporting documents'], v_authorization_text, 'handoff-v1-2026-08', v_authorized_at, v_profile_full_name, 'authorized') RETURNING * INTO v_handoff; INSERT INTO private.application_handoff_secrets(handoff_id, authorization_hash) VALUES (v_handoff.id, v_authorization_hash); INSERT INTO public.audit_logs(user_id, role, action_performed, record_id, table_name, old_value, new_value) VALUES (_user_id, 'borrower', 'application_handoff_authorized', v_handoff.id::text, 'application_handoffs', NULL, jsonb_build_object('lender_product_id', _lender_product_id, 'lender_name', v_product.bank_name, 'requested_amount', _requested_amount, 'term_months', _term_months, 'authorization_version', 'handoff-v1-2026-08', 'information_sharing_authorized', true)); RETURN v_handoff; END; $function$
;
CREATE OR REPLACE FUNCTION public.authorize_riverbanc_subscription(_signed_name text)
 RETURNS subscription_authorizations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null or not private.is_account_active() then raise exception 'Active account required'; end if;

  if auth.uid() is null then raise exception 'Authentication required'; end if;
  return private.authorize_riverbanc_subscription_internal(auth.uid(), _signed_name);
end;
$function$
;
CREATE OR REPLACE FUNCTION public.create_support_case(p_subject text, p_category text, p_message text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_case_id uuid;
begin
  if auth.uid() is null or not private.is_account_active() then raise exception 'Active account required'; end if;

  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_subject is null or char_length(btrim(p_subject)) not between 5 and 160 then
    raise exception 'Subject must be between 5 and 160 characters';
  end if;
  if p_message is null or char_length(btrim(p_message)) not between 1 and 10000 then
    raise exception 'Message must be between 1 and 10000 characters';
  end if;
  if p_category is null or p_category not in ('account', 'kyc', 'application', 'loan_comparison', 'subscription', 'privacy', 'technical', 'other') then
    raise exception 'Invalid support category';
  end if;

  insert into public.support_cases (user_id, subject, category)
  values (v_user_id, btrim(p_subject), p_category)
  returning id into v_case_id;

  insert into public.support_messages (case_id, sender_id, body, is_staff_reply)
  values (v_case_id, v_user_id, btrim(p_message), false);

  return v_case_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.reply_support_case(p_case_id uuid, p_message text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_case public.support_cases%rowtype;
  v_is_staff boolean;
  v_message_id uuid;
begin
  if auth.uid() is null or not private.is_account_active() then raise exception 'Active account required'; end if;

  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_message is null or char_length(btrim(p_message)) not between 1 and 10000 then
    raise exception 'Message must be between 1 and 10000 characters';
  end if;

  v_is_staff := coalesce((select private.has_role('admin')), false)
    or coalesce((select private.has_role('super_admin')), false);

  select * into v_case from public.support_cases where id = p_case_id for update;
  if not found then raise exception 'Support case not found'; end if;
  if v_case.user_id <> v_user_id and not coalesce(v_is_staff, false) then raise exception 'Access denied'; end if;
  if v_case.status = 'closed' then raise exception 'This case is closed'; end if;

  insert into public.support_messages (case_id, sender_id, body, is_staff_reply)
  values (p_case_id, v_user_id, btrim(p_message), v_is_staff)
  returning id into v_message_id;

  update public.support_cases
  set last_message_at = now(),
      updated_at = now(),
      status = case when not v_is_staff and status = 'resolved' then 'open' else status end
  where id = p_case_id;

  return v_message_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.update_support_case(p_case_id uuid, p_status text, p_priority text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if auth.uid() is null or not private.is_account_active() then raise exception 'Active account required'; end if;

  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not coalesce(
    (select private.has_role('admin'))
    or (select private.has_role('super_admin')),
    false
  ) then raise exception 'Access denied'; end if;
  if p_status is null or p_status not in ('open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed') then
    raise exception 'Invalid case status';
  end if;
  if p_priority is null or p_priority not in ('normal', 'high', 'urgent') then
    raise exception 'Invalid case priority';
  end if;

  update public.support_cases
  set status = p_status,
      priority = p_priority,
      updated_at = now(),
      closed_at = case when p_status = 'closed' then coalesce(closed_at, now()) else null end
  where id = p_case_id;
  if not found then raise exception 'Support case not found'; end if;
end;
$function$
;


-- Persist read state only; clients cannot edit notification contents or ownership.
alter table public.notifications add column if not exists read_at timestamptz;
revoke update on public.notifications from authenticated;
grant update(read_at) on public.notifications to authenticated;
create policy notifications_mark_read on public.notifications for update to authenticated
using (user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

-- Record estimates from the product snapshot, never client-supplied calculated values.
create or replace function private.prepare_handoff_record() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r numeric; growth numeric;
begin
 if auth.uid() is not null and new.status='authorized' and not exists(select 1 from public.profiles where user_id=new.user_id and account_status='active' and kyc_status in ('VERIFIED','COMPLETED')) then raise exception 'Completed verification required'; end if;
 if new.requested_amount>0 and new.term_months>0 and new.interest_rate>=0 then
  r:=new.interest_rate/1200;
  if r=0 then new.estimated_monthly_repayment:=new.requested_amount/new.term_months;
  else growth:=power(1+r,new.term_months); new.estimated_monthly_repayment:=new.requested_amount*r*growth/(growth-1); end if;
  new.total_repayment:=new.estimated_monthly_repayment*new.term_months;
 end if;
 return new;
end;
$$;
revoke all on function private.prepare_handoff_record() from public,anon,authenticated;
create trigger prepare_handoff_record before insert on public.application_handoffs for each row execute function private.prepare_handoff_record();

-- Borrowers may clean up uploads that were never submitted, not erase review evidence.
drop policy if exists "Users can delete own documents" on storage.objects;
create policy "Users can delete unsubmitted documents" on storage.objects for delete to authenticated
using (bucket_id='kyc-documents' and (select auth.uid())::text=split_part(name,'/',1)
 and not exists(select 1 from public.kyc_documents d where d.storage_path=name));
