-- Synthetic fixtures only. Run after the migration; ALWAYS roll back.
BEGIN;
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
('f2080000-0000-4000-8000-000000000001','ui-borrower-a@example.invalid','{"full_name":"Synthetic Borrower A"}'),
('f2080000-0000-4000-8000-000000000002','ui-borrower-b@example.invalid','{"full_name":"Synthetic Borrower B"}'),
('f2080000-0000-4000-8000-000000000003','ui-admin@example.invalid','{"full_name":"Synthetic Admin"}');
INSERT INTO public.user_roles(user_id,role) VALUES('f2080000-0000-4000-8000-000000000003','admin') ON CONFLICT DO NOTHING;
INSERT INTO public.profiles(user_id,full_name) VALUES
('f2080000-0000-4000-8000-000000000001','Synthetic Borrower A'),
('f2080000-0000-4000-8000-000000000002','Synthetic Borrower B'),
('f2080000-0000-4000-8000-000000000003','Synthetic Admin') ON CONFLICT(user_id) DO NOTHING;
INSERT INTO storage.objects(bucket_id,name) SELECT 'kyc-documents','f2080000-0000-4000-8000-000000000001/'||prefix||'-176000000000'||n||'.pdf' FROM (VALUES(1,'nrc'),(2,'gov-id'),(3,'payslip'),(4,'payslip'),(5,'payslip'),(6,'introductory-letter')) s(n,prefix);
SELECT set_config('request.jwt.claims','{"sub":"f2080000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE docs jsonb; details jsonb:=jsonb_build_object('fullName','Synthetic Borrower A','nrcNumber','123456/78/1','phone','+260971000000','employer','Synthetic Ministry','employeeNumber','EMP-TEST','govIdNumber','TEST-ID','govIdType','passport','signatureName','Synthetic Borrower A');
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='user') THEN RAISE EXCEPTION 'FAIL borrower bootstrap/chat role'; END IF;
 IF EXISTS(SELECT 1 FROM public.profiles WHERE user_id='f2080000-0000-4000-8000-000000000002') THEN RAISE EXCEPTION 'FAIL borrower isolation'; END IF;
 SELECT jsonb_agg(jsonb_build_object('document_type',kind,'storage_path','f2080000-0000-4000-8000-000000000001/'||prefix||'-176000000000'||n||'.pdf','pay_period',CASE WHEN n BETWEEN 3 AND 5 THEN (date_trunc('month',current_date)-make_interval(months=>n-2))::date END,'ocr_confidence',100)) INTO docs
 FROM (VALUES(1,'NRC','nrc'),(2,'GOV_ID','gov-id'),(3,'PAYSLIP','payslip'),(4,'PAYSLIP','payslip'),(5,'PAYSLIP','payslip'),(6,'INTRODUCTORY_LETTER','introductory-letter'))s(n,kind,prefix);
 PERFORM public.submit_kyc_verification(details,docs);
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE user_id=auth.uid() AND kyc_status='IN_REVIEW' AND gov_id_number='TEST-ID' AND kyc_signature='Synthetic Borrower A') THEN RAISE EXCEPTION 'FAIL KYC atomic profile status/details'; END IF;
 PERFORM public.submit_kyc_verification(details,docs);
 IF (SELECT count(*) FROM public.kyc_documents WHERE user_id=auth.uid() AND validation_status<>'REJECTED')<>6 THEN RAISE EXCEPTION 'FAIL retry duplicates'; END IF;
 BEGIN
  PERFORM public.submit_kyc_verification(details,jsonb_set(docs,'{0,storage_path}','"f2080000-0000-4000-8000-000000000002/nrc-1760000000001.pdf"'));
  RAISE EXCEPTION 'FAIL accepted another borrower document';
 EXCEPTION WHEN raise_exception OR insufficient_privilege THEN IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF; END;
 BEGIN PERFORM public.review_kyc_verification(auth.uid(),'COMPLETED',null); RAISE EXCEPTION 'FAIL self approval';
 EXCEPTION WHEN raise_exception OR insufficient_privilege THEN IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF; END;
 UPDATE public.profiles SET kyc_status='COMPLETED',nrc_verified=true WHERE user_id=auth.uid();
 IF EXISTS(SELECT 1 FROM public.profiles WHERE user_id=auth.uid() AND (kyc_status='COMPLETED' OR nrc_verified)) THEN RAISE EXCEPTION 'FAIL profile self verification'; END IF;
END $$;
RESET ROLE;

-- Version changes invalidate a previously loaded reviewer snapshot, including
-- profile-only edits between document load and approval.
SELECT set_config('request.jwt.claims','{"sub":"f2080000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
SELECT set_config('test.old_revision',(select kyc_review_revision::text from public.profiles where user_id='f2080000-0000-4000-8000-000000000001'),true);
UPDATE public.profiles set phone='+260970000001' where user_id='f2080000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN
  PERFORM public.review_kyc_verification('f2080000-0000-4000-8000-000000000001','COMPLETED',null,current_setting('test.old_revision')::uuid);
  RAISE EXCEPTION 'FAIL stale KYC review accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'KYC submission changed%' THEN RAISE; END IF; END;
 PERFORM public.review_kyc_verification('f2080000-0000-4000-8000-000000000001','COMPLETED',null,(select kyc_review_revision from public.profiles where user_id='f2080000-0000-4000-8000-000000000001'));
 IF has_function_privilege('authenticated','public.review_kyc_verification(uuid,text,text)','EXECUTE') OR has_function_privilege('authenticated','private.review_kyc_verification(uuid,text,text)','EXECUTE') THEN RAISE EXCEPTION 'FAIL old unbound review executable'; END IF;
END $$;
RESET ROLE;
-- Deliberately permissive legacy branches cannot bypass new restrictive guards.
CREATE POLICY test_legacy_storage_staff ON storage.objects FOR SELECT TO authenticated USING(private.has_role('admin'));
CREATE POLICY test_legacy_profile_staff ON public.profiles FOR UPDATE TO authenticated USING(true) WITH CHECK(true);
GRANT INSERT ON public.notifications TO authenticated;
CREATE POLICY test_legacy_notification ON public.notifications FOR INSERT TO authenticated WITH CHECK(true);
INSERT INTO storage.objects(bucket_id,name)values('payment-receipts','f2080000-0000-4000-8000-000000000002/test.pdf');
INSERT INTO public.support_cases(id,user_id,subject,category)values('f2080000-0000-4000-8000-000000000021','f2080000-0000-4000-8000-000000000002','Synthetic support case','other');
SELECT set_config('request.jwt.claims','{"sub":"f2080000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM storage.objects) THEN RAISE EXCEPTION 'FAIL staff Storage read without MFA'; END IF;
 IF EXISTS(SELECT 1 FROM public.support_cases) THEN RAISE EXCEPTION 'FAIL staff support read without MFA'; END IF;
 BEGIN PERFORM public.reply_support_case('f2080000-0000-4000-8000-000000000021','Synthetic staff reply'); RAISE EXCEPTION 'FAIL staff support RPC without MFA';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"f2080000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='payment-receipts') OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='kyc-documents') THEN RAISE EXCEPTION 'FAIL MFA staff Storage access'; END IF;
 PERFORM public.reply_support_case('f2080000-0000-4000-8000-000000000021','Synthetic staff reply');
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"f2080000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN INSERT INTO public.notifications(user_id,title,message)VALUES('f2080000-0000-4000-8000-000000000001','Forged','Synthetic forgery'); RAISE EXCEPTION 'FAIL client notification forgery';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM public.create_support_case('Synthetic borrower case','other','Synthetic borrower message');
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"f2080000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","client_id":"dummy-read-client"}',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'FAIL OAuth own read'; END IF;
 UPDATE public.profiles SET phone='OAuth mutation' WHERE user_id=auth.uid();
 IF EXISTS(SELECT 1 FROM public.profiles WHERE user_id=auth.uid() AND phone='OAuth mutation') THEN RAISE EXCEPTION 'FAIL OAuth table mutation'; END IF;
 BEGIN PERFORM public.create_support_case('OAuth mutation case','other','Synthetic mutation'); RAISE EXCEPTION 'FAIL OAuth definer mutation';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES('f2080000-0000-4000-8000-000000000004','readonly@example.invalid','{}');
INSERT INTO public.profiles(user_id,full_name) VALUES('f2080000-0000-4000-8000-000000000004','Read only staff');
INSERT INTO public.user_roles(user_id,role)VALUES('f2080000-0000-4000-8000-000000000004','super_user');
SELECT set_config('request.jwt.claims','{"sub":"f2080000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);
SET LOCAL ROLE authenticated;
UPDATE public.profiles SET phone='Read-only write' WHERE user_id='f2080000-0000-4000-8000-000000000002';
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.profiles WHERE phone='Read-only write') THEN RAISE EXCEPTION 'FAIL read-only staff cross-owner update'; END IF; END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"f2080000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
UPDATE public.profiles SET account_status='suspended' WHERE user_id='f2080000-0000-4000-8000-000000000003';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'FAIL suspended role bootstrap read'; END IF;
 BEGIN INSERT INTO public.user_roles(user_id,role)VALUES('f2080000-0000-4000-8000-000000000002','data_entry_team'); RAISE EXCEPTION 'FAIL suspended role mutation';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT 'PASS: stale KYC review, old RPC denial, Storage/support MFA, notification forgery, OAuth read-only, read-only staff and suspended role mutation regressions' AS result;
ROLLBACK;
