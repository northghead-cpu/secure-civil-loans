-- Run as postgres on a test database or through the SQL tool. Synthetic rows
-- and role switches are contained in one transaction and always rolled back.
-- Apply pending migrations first. An assertion failure aborts the transaction.
BEGIN;
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES
 ('f1070000-0000-4000-8000-000000000001', 'owasp-borrower-a@example.invalid', '{"full_name":"Synthetic Borrower A"}'),
 ('f1070000-0000-4000-8000-000000000002', 'owasp-borrower-b@example.invalid', '{"full_name":"Synthetic Borrower B"}'),
 ('f1070000-0000-4000-8000-000000000003', 'owasp-admin@example.invalid', '{"full_name":"Synthetic Admin"}');
INSERT INTO public.profiles (user_id, full_name) VALUES
 ('f1070000-0000-4000-8000-000000000001', 'Synthetic Borrower A'),
 ('f1070000-0000-4000-8000-000000000002', 'Synthetic Borrower B'),
 ('f1070000-0000-4000-8000-000000000003', 'Synthetic Admin')
ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.user_roles (user_id, role) VALUES
 ('f1070000-0000-4000-8000-000000000003', 'admin') ON CONFLICT DO NOTHING;

SET LOCAL ROLE anon;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id IN
   ('f1070000-0000-4000-8000-000000000001','f1070000-0000-4000-8000-000000000002'))
 THEN RAISE EXCEPTION 'FAIL anonymous profile access'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"f1070000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","user_metadata":{"role":"super_admin"}}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = 'f1070000-0000-4000-8000-000000000001')
 THEN RAISE EXCEPTION 'FAIL owner cannot read own profile'; END IF;
 IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = 'f1070000-0000-4000-8000-000000000002')
 THEN RAISE EXCEPTION 'FAIL cross-borrower profile read'; END IF;
 IF private.has_role('super_admin') THEN RAISE EXCEPTION 'FAIL mutable metadata escalation'; END IF;
 BEGIN
  INSERT INTO public.user_roles(user_id,role) VALUES ('f1070000-0000-4000-8000-000000000001','super_admin');
  RAISE EXCEPTION 'FAIL borrower role escalation';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 UPDATE public.profiles SET nrc_verified = true, kyc_status = 'VERIFIED'
 WHERE user_id = 'f1070000-0000-4000-8000-000000000001';
 IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = 'f1070000-0000-4000-8000-000000000001'
  AND (nrc_verified OR kyc_status = 'VERIFIED'))
 THEN RAISE EXCEPTION 'FAIL borrower self verification'; END IF;
 IF has_table_privilege(current_user, 'public.loan_results', 'INSERT') OR
    has_table_privilege(current_user, 'public.underwriting_queue', 'INSERT') OR
    has_table_privilege(current_user, 'public.kyc', 'UPDATE')
 THEN RAISE EXCEPTION 'FAIL client can write trusted outputs'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"f1070000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = 'f1070000-0000-4000-8000-000000000002')
 THEN RAISE EXCEPTION 'FAIL administrator bypassed MFA'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = 'f1070000-0000-4000-8000-000000000003' AND role = 'admin')
 THEN RAISE EXCEPTION 'FAIL MFA bootstrap role read'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"f1070000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = 'f1070000-0000-4000-8000-000000000002')
 THEN RAISE EXCEPTION 'FAIL AAL2 administrator cannot access authorized record'; END IF;
END $$;
RESET ROLE;
SELECT 'PASS: anonymous, borrower isolation, metadata/role escalation, verification, trusted-output writes, admin AAL1/AAL2 and bootstrap' AS result;
ROLLBACK;
