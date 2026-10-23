create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create schema storage; create schema private; create schema extensions;
create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
create function auth.uid() returns uuid language sql stable as $$select nullif(auth.jwt()->>'sub','')::uuid$$;
create function auth.role() returns text language sql stable as $$select auth.jwt()->>'role'$$;
create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
create type public."app_role" as enum ('admin','user','super_admin','super_user','compliance_team','data_entry_team');
create type public."kyc_status" as enum ('pending','completed','approved','rejected');
create table public."application_handoffs" ("id" uuid default gen_random_uuid() not null,"user_id" uuid not null,"loan_application_id" uuid,"lender_product_id" uuid,"lender_name" text not null,"product_name" text,"requested_amount" numeric,"term_months" integer,"interest_rate" numeric,"estimated_monthly_repayment" numeric,"total_repayment" numeric,"information_categories" text[] default '{}'::text[] not null,"authorization_text" text not null,"authorization_version" text not null,"authorized_at" timestamp with time zone,"authorization_signature" text,"status" text default 'pending_authorization'::text not null,"created_at" timestamp with time zone default now() not null,"updated_at" timestamp with time zone default now() not null,constraint "application_handoffs_pkey" PRIMARY KEY (id),constraint "application_handoffs_status_check" CHECK ((status = ANY (ARRAY['pending_authorization'::text, 'authorized'::text, 'preparing'::text, 'sent_to_lender'::text, 'lender_review'::text, 'decision'::text]))));
alter table public."application_handoffs" enable row level security;
create table public."audit_logs" ("id" uuid default gen_random_uuid() not null,"user_id" uuid,"role" text,"action_performed" text,"record_id" text,"table_name" text,"old_value" jsonb,"new_value" jsonb,"created_at" timestamp with time zone default now() not null,"action" text,constraint "audit_logs_pkey" PRIMARY KEY (id));
alter table public."audit_logs" enable row level security;
create table public."automation_rules" ("id" uuid default gen_random_uuid() not null,"name" text not null,"description" text default ''::text not null,"trigger" text not null,"action" text not null,"enabled" boolean default false not null,"run_count" integer default 0 not null,"config" jsonb default '{}'::jsonb not null,"created_at" timestamp with time zone default now() not null,"updated_at" timestamp with time zone default now() not null,constraint "automation_rules_pkey" PRIMARY KEY (id),constraint "automation_rules_run_count_check" CHECK ((run_count >= 0)));
alter table public."automation_rules" enable row level security;
create table public."bank_products" ("id" uuid default gen_random_uuid() not null,"bank_name" text not null,"interest_rate" numeric not null,"min_amount" numeric default 10000 not null,"max_amount" numeric not null,"max_term_months" integer not null,"processing_days" integer default 2 not null,"active" boolean default true not null,"created_at" timestamp with time zone default now() not null,"product_type" text default 'loan_bank'::text not null,constraint "bank_products_pkey" PRIMARY KEY (id),constraint "bank_products_product_type_check" CHECK ((product_type = ANY (ARRAY['loan_bank'::text, 'loan_microfinance'::text, 'salary_advance_microfinance'::text]))));
alter table public."bank_products" enable row level security;
create table public."kyc_documents" ("id" uuid default gen_random_uuid() not null,"user_id" uuid not null,"document_type" text not null,"storage_path" text not null,"pay_period" date,"ocr_period" text,"ocr_confidence" numeric(5,2),"validation_status" text default 'PENDING'::text not null,"rejection_reason" text,"created_at" timestamp with time zone default now() not null,"updated_at" timestamp with time zone default now() not null,constraint "kyc_documents_document_type_check" CHECK ((document_type = ANY (ARRAY['NRC'::text, 'GOV_ID'::text, 'PAYSLIP'::text, 'INTRODUCTORY_LETTER'::text]))),constraint "kyc_documents_path_contract" CHECK ((storage_path ~ (('^'::text || (user_id)::text) || '/(nrc|gov-id|payslip|introductory-letter)-[0-9]{13}\.(pdf|png|jpe?g)$'::text))),constraint "kyc_documents_payslip_period_required" CHECK (((document_type <> 'PAYSLIP'::text) OR (pay_period IS NOT NULL))),constraint "kyc_documents_pkey" PRIMARY KEY (id),constraint "kyc_documents_validation_status_check" CHECK ((validation_status = ANY (ARRAY['PENDING'::text, 'VALID'::text, 'REJECTED'::text, 'REVIEW'::text]))));
alter table public."kyc_documents" enable row level security;
create table public."notifications" ("id" uuid default gen_random_uuid() not null,"user_id" uuid not null,"application_id" uuid,"title" text not null,"message" text not null,"created_at" timestamp with time zone default now() not null,constraint "notifications_pkey" PRIMARY KEY (id));
alter table public."notifications" enable row level security;
create table public."profiles" ("id" uuid default gen_random_uuid() not null,"user_id" uuid not null,"full_name" text,"phone" text,"employer" text,"employee_number" text,"created_at" timestamp with time zone default now() not null,"updated_at" timestamp with time zone default now() not null,"nrc_number" text,"email" text,"salary" numeric,"account_status" text default 'active'::text not null,"years_of_service" integer,"net_salary" numeric,"existing_obligations" numeric,"ministry" text,"kyc_status" text default 'INCOMPLETE'::text,"role" text default 'user'::text,"nrc_verified" boolean default false,"phone_verified" boolean default false,"consent_accepted" boolean default false not null,"consent_signed_at" timestamp with time zone,"consent_marketing" boolean default false not null,"consent_data_sharing_lenders" boolean default false not null,"consent_crb_check" boolean default false not null,"consent_analytics" boolean default false not null,"consents_updated_at" timestamp with time zone,constraint "check_nrc_format" CHECK ((nrc_number ~ '^[0-9]{6}/[0-9]{2}/[0-9]{1}$'::text)),constraint "profiles_amounts_nonneg" CHECK ((((salary IS NULL) OR (salary >= (0)::numeric)) AND ((net_salary IS NULL) OR (net_salary >= (0)::numeric)) AND ((existing_obligations IS NULL) OR (existing_obligations >= (0)::numeric)) AND ((years_of_service IS NULL) OR (years_of_service >= 0)))) NOT VALID,constraint "profiles_pkey" PRIMARY KEY (id),constraint "profiles_user_id_key" UNIQUE (user_id));
alter table public."profiles" enable row level security;
create table public."support_cases" ("id" uuid default gen_random_uuid() not null,"case_number" text default ('RB-'::text || upper(substr(replace((gen_random_uuid())::text, '-'::text, ''::text), 1, 10))) not null,"user_id" uuid not null,"subject" text not null,"category" text not null,"status" text default 'open'::text not null,"priority" text default 'normal'::text not null,"created_at" timestamp with time zone default now() not null,"updated_at" timestamp with time zone default now() not null,"last_message_at" timestamp with time zone default now() not null,"closed_at" timestamp with time zone,constraint "support_cases_case_number_key" UNIQUE (case_number),constraint "support_cases_category_check" CHECK ((category = ANY (ARRAY['account'::text, 'kyc'::text, 'application'::text, 'loan_comparison'::text, 'subscription'::text, 'privacy'::text, 'technical'::text, 'other'::text]))),constraint "support_cases_pkey" PRIMARY KEY (id),constraint "support_cases_priority_check" CHECK ((priority = ANY (ARRAY['normal'::text, 'high'::text, 'urgent'::text]))),constraint "support_cases_status_check" CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'waiting_on_customer'::text, 'resolved'::text, 'closed'::text]))),constraint "support_cases_subject_check" CHECK (((char_length(btrim(subject)) >= 5) AND (char_length(btrim(subject)) <= 160))));
alter table public."support_cases" enable row level security;
create table public."support_messages" ("id" uuid default gen_random_uuid() not null,"case_id" uuid not null,"sender_id" uuid not null,"body" text not null,"is_staff_reply" boolean default false not null,"created_at" timestamp with time zone default now() not null,constraint "support_messages_body_check" CHECK (((char_length(btrim(body)) >= 1) AND (char_length(btrim(body)) <= 10000))),constraint "support_messages_pkey" PRIMARY KEY (id));
alter table public."support_messages" enable row level security;
create table public."user_roles" ("id" uuid default gen_random_uuid() not null,"user_id" uuid not null,"role" app_role not null,constraint "user_roles_pkey" PRIMARY KEY (id),constraint "user_roles_user_id_role_key" UNIQUE (user_id, role));
alter table public."user_roles" enable row level security;
create table public.subscription_authorizations(id uuid);
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
BEGIN
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
AS $function$ DECLARE v_product public.bank_products; v_profile_full_name text; v_handoff public.application_handoffs; v_authorized_at timestamptz := clock_timestamp(); v_authorization_text text; v_authorization_hash text; BEGIN IF _user_id IS NULL OR _user_id <> (SELECT auth.uid()) THEN RAISE EXCEPTION 'Authentication required'; END IF; IF _authorization_accepted IS DISTINCT FROM true THEN RAISE EXCEPTION 'Information-sharing authorization must be accepted'; END IF; IF _requested_amount IS NULL OR _requested_amount <= 0 THEN RAISE EXCEPTION 'Invalid requested amount'; END IF; IF _term_months IS NULL OR _term_months <= 0 THEN RAISE EXCEPTION 'Invalid term'; END IF; SELECT * INTO v_product FROM public.bank_products WHERE id = _lender_product_id AND active = true; IF NOT FOUND THEN RAISE EXCEPTION 'Selected loan product is unavailable'; END IF; IF _requested_amount < v_product.min_amount OR _requested_amount > v_product.max_amount THEN RAISE EXCEPTION 'Requested amount is outside the selected product limits'; END IF; IF _term_months > v_product.max_term_months THEN RAISE EXCEPTION 'Requested term is outside the selected product limits'; END IF; SELECT trim(full_name) INTO v_profile_full_name FROM public.profiles WHERE user_id = _user_id; IF v_profile_full_name IS NULL OR length(v_profile_full_name) < 2 THEN RAISE EXCEPTION 'Verified legal name is required'; END IF; IF lower(trim(coalesce(_signature_name, ''))) <> lower(v_profile_full_name) THEN RAISE EXCEPTION 'Authorization signature must match your verified legal name'; END IF; v_authorization_text := format('INFORMATION-SHARING AUTHORIZATION (handoff-v1-2026-08)\n\nI authorize Riverbanc Technology Limited to prepare and share the verified information listed below with %s for my selected loan application.\n\nThis authorization is separate from Riverbanc subscription consent and does not authorize salary deduction for loan repayments.\n\nSelected product: %s\nRequested amount: ZMW %s\nSelected term: %s months\nSelected annual interest rate: %s%%\n\nInformation categories authorized for sharing: Identity information; Employment information; Income information; Verification results; Relevant supporting documents', v_product.bank_name, v_product.bank_name, _requested_amount, _term_months, v_product.interest_rate); SELECT encode(extensions.digest(concat_ws('|', _user_id::text, _lender_product_id::text, _requested_amount::text, _term_months::text, v_authorized_at::text, v_authorization_text), 'sha256'), 'hex') INTO v_authorization_hash; INSERT INTO public.application_handoffs (user_id, lender_product_id, lender_name, product_name, requested_amount, term_months, interest_rate, estimated_monthly_repayment, total_repayment, information_categories, authorization_text, authorization_version, authorized_at, authorization_signature, status) VALUES (_user_id, _lender_product_id, v_product.bank_name, v_product.bank_name, _requested_amount, _term_months, v_product.interest_rate, NULL, NULL, ARRAY['Identity information','Employment information','Income information','Verification results','Relevant supporting documents'], v_authorization_text, 'handoff-v1-2026-08', v_authorized_at, v_profile_full_name, 'authorized') RETURNING * INTO v_handoff; INSERT INTO private.application_handoff_secrets(handoff_id, authorization_hash) VALUES (v_handoff.id, v_authorization_hash); INSERT INTO public.audit_logs(user_id, role, action_performed, record_id, table_name, old_value, new_value) VALUES (_user_id, 'borrower', 'application_handoff_authorized', v_handoff.id::text, 'application_handoffs', NULL, jsonb_build_object('lender_product_id', _lender_product_id, 'lender_name', v_product.bank_name, 'requested_amount', _requested_amount, 'term_months', _term_months, 'authorization_version', 'handoff-v1-2026-08', 'information_sharing_authorized', true)); RETURN v_handoff; END; $function$
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
CREATE OR REPLACE FUNCTION private.has_role(required_role text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role::text = required_role
  );
$function$
;
CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$function$
;
CREATE OR REPLACE FUNCTION private.is_privileged_role(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role::text IN ('super_admin','admin','super_user','compliance_team','data_entry_team'));
$function$
;
CREATE OR REPLACE FUNCTION public.is_valid_kyc_storage_object_name(object_name text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
  SELECT object_name ~* '^(nrc|gov-id|payslip|introductory-letter)-[0-9]{13}\.(pdf|png|jpe?g)$'
$function$
;
CREATE OR REPLACE FUNCTION public.prevent_manual_lender_handoff_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF auth.role() = 'authenticated'
     AND NEW.status IS DISTINCT FROM OLD.status
     AND (
       OLD.status IN ('lender_review', 'additional_information_requested', 'approved', 'declined', 'disbursed')
       OR NEW.status IN ('lender_review', 'additional_information_requested', 'approved', 'declined', 'disbursed')
     ) THEN
    RAISE EXCEPTION 'Lender-controlled application handoff statuses must be reported by the financial institution';
  END IF;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.protect_profile_security_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (private.has_role('admin') or private.has_role('super_admin')) then
    new.kyc_status := old.kyc_status;
    new.nrc_verified := old.nrc_verified;
    new.phone_verified := old.phone_verified;
    new.account_status := old.account_status;

    if upper(coalesce(old.kyc_status, '')) in ('VERIFIED', 'COMPLETED') then
      new.full_name := old.full_name;
      new.nrc_number := old.nrc_number;
      new.employee_number := old.employee_number;
    end if;
  end if;
  return new;
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
create policy "Admins can update application handoffs" on "public"."application_handoffs" as PERMISSIVE for UPDATE to "authenticated" using ((( SELECT private.has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role) OR ( SELECT private.has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role) OR ( SELECT private.has_role(( SELECT auth.uid() AS uid), 'compliance_team'::app_role) AS has_role))) with check ((( SELECT private.has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role) OR ( SELECT private.has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role) OR ( SELECT private.has_role(( SELECT auth.uid() AS uid), 'compliance_team'::app_role) AS has_role)));
create policy "Privileged sessions require MFA" on "public"."application_handoffs" as RESTRICTIVE for ALL to "authenticated" using (((NOT private.is_privileged_role(( SELECT auth.uid() AS uid))) OR ((( SELECT auth.jwt() AS jwt) ->> 'aal'::text) = 'aal2'::text))) with check (((NOT private.is_privileged_role(( SELECT auth.uid() AS uid))) OR ((( SELECT auth.jwt() AS jwt) ->> 'aal'::text) = 'aal2'::text)));
create policy "Users can view own application handoffs" on "public"."application_handoffs" as PERMISSIVE for SELECT to "authenticated" using (((( SELECT ( SELECT auth.uid() AS uid) AS uid) = user_id) OR private.has_role(( SELECT ( SELECT auth.uid() AS uid) AS uid), 'admin'::app_role) OR private.has_role(( SELECT ( SELECT auth.uid() AS uid) AS uid), 'super_admin'::app_role) OR private.has_role(( SELECT ( SELECT auth.uid() AS uid) AS uid), 'compliance_team'::app_role)));
create policy "Privileged sessions require MFA" on "public"."audit_logs" as RESTRICTIVE for ALL to "authenticated" using (((NOT private.is_privileged_role(( SELECT auth.uid() AS uid))) OR ((( SELECT auth.jwt() AS jwt) ->> 'aal'::text) = 'aal2'::text))) with check (((NOT private.is_privileged_role(( SELECT auth.uid() AS uid))) OR ((( SELECT auth.jwt() AS jwt) ->> 'aal'::text) = 'aal2'::text)));
create policy "audit_admin_only" on "public"."audit_logs" as PERMISSIVE for SELECT to "authenticated" using ((( SELECT private.has_role('admin'::text) AS has_role) OR ( SELECT private.has_role('super_admin'::text) AS has_role) OR ( SELECT private.has_role('compliance_team'::text) AS has_role)));
create policy "Privileged sessions require MFA" on "public"."automation_rules" as RESTRICTIVE for ALL to "authenticated" using (((NOT private.is_privileged_role(( SELECT auth.uid() AS uid))) OR ((( SELECT auth.jwt() AS jwt) ->> 'aal'::text) = 'aal2'::text))) with check (((NOT private.is_privileged_role(( SELECT auth.uid() AS uid))) OR ((( SELECT auth.jwt() AS jwt) ->> 'aal'::text) = 'aal2'::text)));
create policy "automation_rules_delete_super_admin" on "public"."automation_rules" as PERMISSIVE for DELETE to "authenticated" using (private.has_role('super_admin'::text));
create policy "automation_rules_insert_super_admin" on "public"."automation_rules" as PERMISSIVE for INSERT to "authenticated" with check (private.has_role('super_admin'::text));
create policy "automation_rules_select_admin" on "public"."automation_rules" as PERMISSIVE for SELECT to "authenticated" using ((private.has_role('admin'::text) OR private.has_role('super_admin'::text) OR private.has_role('super_user'::text) OR private.has_role('compliance_team'::text) OR private.has_role('data_entry_team'::text)));
create policy "automation_rules_update_super_admin" on "public"."automation_rules" as PERMISSIVE for UPDATE to "authenticated" using (private.has_role('super_admin'::text)) with check (private.has_role('super_admin'::text));
create policy "Anyone can view bank products" on "public"."bank_products" as PERMISSIVE for SELECT to "authenticated" using (true);
create policy "Privileged sessions require MFA" on "public"."bank_products" as RESTRICTIVE for ALL to "authenticated" using (((NOT private.is_privileged_role(( SELECT auth.uid() AS uid))) OR ((( SELECT auth.jwt() AS jwt) ->> 'aal'::text) = 'aal2'::text))) with check (((NOT private.is_privileged_role(( SELECT auth.uid() AS uid))) OR ((( SELECT auth.jwt() AS jwt) ->> 'aal'::text) = 'aal2'::text)));
create policy "bank_admin_delete" on "public"."bank_products" as PERMISSIVE for DELETE to "authenticated" using ((( SELECT private.has_role('admin'::text) AS has_role) OR ( SELECT private.has_role('super_admin'::text) AS has_role)));
create policy "bank_admin_insert" on "public"."bank_products" as PERMISSIVE for INSERT to "authenticated" with check ((( SELECT private.has_role('admin'::text) AS has_role) OR ( SELECT private.has_role('super_admin'::text) AS has_role)));
create policy "bank_admin_update" on "public"."bank_products" as PERMISSIVE for UPDATE to "authenticated" using ((( SELECT private.has_role('admin'::text) AS has_role) OR ( SELECT private.has_role('super_admin'::text) AS has_role))) with check ((( SELECT private.has_role('admin'::text) AS has_role) OR ( SELECT private.has_role('super_admin'::text) AS has_role)));
create policy "Privileged sessions require MFA" on "public"."kyc_documents" as RESTRICTIVE for ALL to "authenticated" using (((NOT private.is_privileged_role(( SELECT auth.uid() AS uid))) OR ((( SELECT auth.jwt() AS jwt) ->> 'aal'::text) = 'aal2'::text))) with check (((NOT private.is_privileged_role(( SELECT auth.uid() AS uid))) OR ((( SELECT auth.jwt() AS jwt) ->> 'aal'::text) = 'aal2'::text)));
create policy "Users can create own pending KYC documents" on "public"."kyc_documents" as PERMISSIVE for INSERT to "authenticated" with check (((( SELECT auth.uid() AS uid) = user_id) AND (validation_status = 'PENDING'::text)));
create policy "Users can view own KYC documents" on "public"."kyc_documents" as PERMISSIVE for SELECT to "authenticated" using ((( SELECT auth.uid() AS uid) = user_id));
create policy "Users cannot update KYC validation state" on "public"."kyc_documents" as PERMISSIVE for UPDATE to "authenticated" using (((( SELECT auth.uid() AS uid) = user_id) AND (validation_status = 'PENDING'::text))) with check (((( SELECT auth.uid() AS uid) = user_id) AND (validation_status = 'PENDING'::text)));
create policy "notifications_insert" on "public"."notifications" as PERMISSIVE for INSERT to "authenticated" with check (((( SELECT auth.uid() AS uid) = user_id) OR ( SELECT private.has_role('admin'::text) AS has_role) OR ( SELECT private.has_role('super_admin'::text) AS has_role)));
create policy "notifications_select" on "public"."notifications" as PERMISSIVE for SELECT to "authenticated" using (((( SELECT auth.uid() AS uid) = user_id) OR ( SELECT private.has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role) OR ( SELECT private.has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role)));
create policy "Privileged sessions require MFA" on "public"."profiles" as RESTRICTIVE for ALL to "authenticated" using (((NOT private.is_privileged_role(( SELECT auth.uid() AS uid))) OR ((( SELECT auth.jwt() AS jwt) ->> 'aal'::text) = 'aal2'::text))) with check (((NOT private.is_privileged_role(( SELECT auth.uid() AS uid))) OR ((( SELECT auth.jwt() AS jwt) ->> 'aal'::text) = 'aal2'::text)));
create policy "profiles_insert_policy" on "public"."profiles" as PERMISSIVE for INSERT to "authenticated" with check ((( SELECT auth.uid() AS uid) = user_id));
create policy "profiles_select_policy" on "public"."profiles" as PERMISSIVE for SELECT to "authenticated" using (((( SELECT auth.uid() AS uid) = user_id) OR private.has_role('admin'::text) OR private.has_role('super_admin'::text)));
create policy "profiles_update_policy" on "public"."profiles" as PERMISSIVE for UPDATE to "authenticated" using (((( SELECT auth.uid() AS uid) = user_id) OR private.has_role('admin'::text) OR private.has_role('super_admin'::text))) with check (((( SELECT auth.uid() AS uid) = user_id) OR private.has_role('admin'::text) OR private.has_role('super_admin'::text)));
create policy "support_cases_read_own_or_staff" on "public"."support_cases" as PERMISSIVE for SELECT to "authenticated" using (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.has_role('admin'::text) AS has_role) OR ( SELECT private.has_role('super_admin'::text) AS has_role)));
create policy "support_messages_read_own_or_staff" on "public"."support_messages" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM support_cases c
  WHERE ((c.id = support_messages.case_id) AND ((c.user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.has_role('admin'::text) AS has_role) OR ( SELECT private.has_role('super_admin'::text) AS has_role))))));
create policy "Admins can delete roles" on "public"."user_roles" as PERMISSIVE for DELETE to "authenticated" using ((( SELECT private.has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role) OR (( SELECT private.has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role) AND (role <> 'super_admin'::app_role) AND (role <> 'admin'::app_role))));
create policy "Admins can insert roles" on "public"."user_roles" as PERMISSIVE for INSERT to "authenticated" with check ((( SELECT private.has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role) OR (( SELECT private.has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role) AND (role <> 'super_admin'::app_role) AND (role <> 'admin'::app_role))));
create policy "Admins can update roles" on "public"."user_roles" as PERMISSIVE for UPDATE to "authenticated" using ((( SELECT private.has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role) OR (( SELECT private.has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role) AND (role <> 'super_admin'::app_role) AND (role <> 'admin'::app_role)))) with check ((( SELECT private.has_role(( SELECT auth.uid() AS uid), 'super_admin'::app_role) AS has_role) OR (( SELECT private.has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role) AND (role <> 'super_admin'::app_role) AND (role <> 'admin'::app_role))));
create policy "Privileged MFA required for role reads except own bootstrap row" on "public"."user_roles" as RESTRICTIVE for SELECT to "authenticated" using (((NOT private.is_privileged_role(( SELECT auth.uid() AS uid))) OR ((( SELECT auth.jwt() AS jwt) ->> 'aal'::text) = 'aal2'::text) OR (user_id = ( SELECT auth.uid() AS uid))));
create policy "Privileged sessions require MFA for role deletes" on "public"."user_roles" as RESTRICTIVE for DELETE to "authenticated" using (((NOT private.is_privileged_role(( SELECT auth.uid() AS uid))) OR ((( SELECT auth.jwt() AS jwt) ->> 'aal'::text) = 'aal2'::text)));
create policy "Privileged sessions require MFA for role inserts" on "public"."user_roles" as RESTRICTIVE for INSERT to "authenticated" with check (((NOT private.is_privileged_role(( SELECT auth.uid() AS uid))) OR ((( SELECT auth.jwt() AS jwt) ->> 'aal'::text) = 'aal2'::text)));
create policy "Privileged sessions require MFA for role updates" on "public"."user_roles" as RESTRICTIVE for UPDATE to "authenticated" using (((NOT private.is_privileged_role(( SELECT auth.uid() AS uid))) OR ((( SELECT auth.jwt() AS jwt) ->> 'aal'::text) = 'aal2'::text))) with check (((NOT private.is_privileged_role(( SELECT auth.uid() AS uid))) OR ((( SELECT auth.jwt() AS jwt) ->> 'aal'::text) = 'aal2'::text)));
create policy "roles_admin_only" on "public"."user_roles" as PERMISSIVE for SELECT to "authenticated" using ((( SELECT private.has_role('admin'::text) AS has_role) OR ( SELECT private.has_role('super_admin'::text) AS has_role)));
grant usage on schema public,private,auth,storage to authenticated,anon;
grant select on all tables in schema public,storage to authenticated,anon;
grant insert,update,delete on all tables in schema public,storage to authenticated;
create trigger protect_profile_security_fields before update on public.profiles for each row execute function public.protect_profile_security_fields();
create trigger protect_lender_handoff_status before update on public.application_handoffs for each row execute function public.prevent_manual_lender_handoff_status_change();
create function public.test_assign_default_role() returns trigger language plpgsql security definer as $$begin insert into public.user_roles(user_id,role)values(new.id,'user'); return new;end;$$;
create trigger test_new_user after insert on auth.users for each row execute function public.test_assign_default_role();


create table public.risk_flags(id uuid primary key default gen_random_uuid(),user_id uuid,status text); alter table public.risk_flags enable row level security;
