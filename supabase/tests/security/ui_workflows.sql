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
 EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF; END;
 BEGIN PERFORM public.review_kyc_verification(auth.uid(),'COMPLETED',null); RAISE EXCEPTION 'FAIL self approval';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF; END;
 UPDATE public.profiles SET kyc_status='COMPLETED',nrc_verified=true WHERE user_id=auth.uid();
 IF EXISTS(SELECT 1 FROM public.profiles WHERE user_id=auth.uid() AND (kyc_status='COMPLETED' OR nrc_verified)) THEN RAISE EXCEPTION 'FAIL profile self verification'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"f2080000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM public.review_kyc_verification('f2080000-0000-4000-8000-000000000001','COMPLETED',null); RAISE EXCEPTION 'FAIL review without MFA';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"f2080000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
SET LOCAL ROLE authenticated;
SELECT public.review_kyc_verification('f2080000-0000-4000-8000-000000000001','COMPLETED',null);
SELECT public.review_kyc_verification('f2080000-0000-4000-8000-000000000001','REJECTED','Synthetic correction reason');
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.kyc_documents WHERE user_id='f2080000-0000-4000-8000-000000000001' AND validation_status<>'REJECTED') THEN RAISE EXCEPTION 'FAIL review did not reject documents'; END IF;
END $$;
RESET ROLE;
UPDATE public.profiles SET account_status='suspended' WHERE user_id='f2080000-0000-4000-8000-000000000001';
SELECT set_config('request.jwt.claims','{"sub":"f2080000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.kyc_documents WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'FAIL suspended account data access'; END IF;
 BEGIN PERFORM public.create_support_case('Synthetic test case','account','Synthetic message'); RAISE EXCEPTION 'FAIL suspended support RPC';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF; END;
 UPDATE public.profiles SET account_status='active' WHERE user_id=auth.uid();
 IF EXISTS(SELECT 1 FROM public.profiles WHERE user_id=auth.uid() AND account_status='active') THEN RAISE EXCEPTION 'FAIL self reactivation'; END IF;
END $$;
RESET ROLE;
-- Rehearse operational handoff transitions and older audit search.
SELECT set_config('request.jwt.claims','{"sub":"f2080000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
UPDATE public.profiles SET kyc_status='COMPLETED' WHERE user_id='f2080000-0000-4000-8000-000000000002';
INSERT INTO public.application_handoffs(id,user_id,lender_name,authorization_text,authorization_version,status,requested_amount,term_months,interest_rate)
VALUES('f2080000-0000-4000-8000-000000000010','f2080000-0000-4000-8000-000000000002','Synthetic Institution','Synthetic authorization','test','authorized',1200,12,0);
INSERT INTO public.audit_logs(user_id,role,action_performed,created_at)
SELECT 'f2080000-0000-4000-8000-000000000003','admin',case when n=505 then 'older-unique-needle' else 'synthetic-operation' end,'2026-01-01'::timestamptz-make_interval(secs=>n) from generate_series(1,505)n;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.application_handoffs WHERE id='f2080000-0000-4000-8000-000000000010' AND estimated_monthly_repayment=100 AND total_repayment=1200) THEN RAISE EXCEPTION 'FAIL authoritative handoff estimate'; END IF;
 PERFORM public.advance_application_handoff('f2080000-0000-4000-8000-000000000010','preparing',null);
 BEGIN PERFORM public.advance_application_handoff('f2080000-0000-4000-8000-000000000010','sent_to_lender',''); RAISE EXCEPTION 'FAIL false delivery without evidence';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF; END;
 PERFORM public.advance_application_handoff('f2080000-0000-4000-8000-000000000010','sent_to_lender','Synthetic secure-delivery reference');
 BEGIN UPDATE public.application_handoffs SET status='approved' WHERE id='f2080000-0000-4000-8000-000000000010'; RAISE EXCEPTION 'FAIL staff manually set lender decision';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF (SELECT count(*) FROM public.search_audit_logs('older-unique-needle','all',null,0))<>1 THEN RAISE EXCEPTION 'FAIL audit search beyond initial page'; END IF;
 IF (SELECT count(*) FROM public.search_audit_logs('synthetic-operation','all',null,0))<>101 THEN RAISE EXCEPTION 'FAIL audit pagination sentinel'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{}',true);
UPDATE public.application_handoffs SET status='additional_information_requested',information_request='Synthetic requested information' WHERE id='f2080000-0000-4000-8000-000000000010';
UPDATE public.application_handoffs SET status='approved' WHERE id='f2080000-0000-4000-8000-000000000010';
SELECT 'PASS: borrower bootstrap/isolation, KYC submission/retry/review/MFA, suspension, handoff estimates/transitions/decision boundary and paginated audit search' AS result;
ROLLBACK;
