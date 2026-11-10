import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const db = new PGlite();
const read = path => fs.readFile(new URL('../'+path,import.meta.url),'utf8');
try {
 await db.exec(await read('supabase/tests/fixtures/ui_bootstrap.sql'));
 await db.exec(await read('supabase/migrations/20261023081750_marketplace_ui_workflows.sql'));
 // Simulate production overlap: the revision already exists before the repair.
 await db.exec(`alter table public.profiles add column kyc_review_revision uuid not null default gen_random_uuid();`);
 const migration=await read('supabase/migrations/20261105082522_assessment_authorization_and_intake_repairs.sql');
 await db.exec(migration);await db.exec(migration);
 console.log('PASS: repair applies with existing revision column and can be reapplied');
 const checks=await db.exec(await read('supabase/tests/security/audit_remediation.sql'));
 for(const r of checks)for(const row of r.rows??[])if(row.result)console.log(row.result);
 await db.exec(`insert into auth.users(id,email) values ('f3090000-0000-4000-8000-000000000001','synthetic-export@example.invalid'); insert into public.profiles(user_id,account_status) values ('f3090000-0000-4000-8000-000000000001','active');
 select set_config('request.jwt.claims','{"sub":"f3090000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',false); set role authenticated;`);
 await db.query('select public.record_personal_export_prepared()');
 await db.query('select public.require_document_upload_session()');
 await db.exec('reset role');
 await db.exec(`grant insert on storage.objects to authenticated;create policy fixture_legacy_upload on storage.objects for insert to authenticated with check (true);set role authenticated;`);
 await assert.rejects(db.query(`insert into storage.objects(bucket_id,name) values ('kyc-documents','f3090000-0000-4000-8000-000000000001/nrc-1760000000001.pdf')`),e=>e.code==='42501');
 console.log('PASS: authenticated raw KYC uploads cannot bypass the validating intake');
 await assert.rejects(db.query(`select public.consume_edge_request('f3090000-0000-4000-8000-000000000001','process-loan','nonce-0000000000000001')`),/permission denied/);
 await db.exec('reset role');
 const audit=await db.query(`select user_id,role,action_performed,record_id from public.audit_logs where action_performed='personal_data_export_prepared'`);
 assert.equal(audit.rows.length,1);assert.equal(audit.rows[0].user_id,'f3090000-0000-4000-8000-000000000001');assert.equal(audit.rows[0].role,'borrower');
 assert.equal((await db.query(`select has_function_privilege('anon','public.record_personal_export_prepared()','EXECUTE') as allowed`)).rows[0].allowed,false);
 console.log('PASS: export audit derives actor/action and rejects unauthenticated/guard clients');
 await db.exec(`select set_config('request.jwt.claims','{"role":"service_role"}',false);set role service_role;`);
 const results=await Promise.all(Array.from({length:25},(_,i)=>db.query(`select public.consume_edge_request('f3090000-0000-4000-8000-000000000001','process-loan','nonce-000000000000${String(i).padStart(4,'0')}') result`)));
 assert.equal(results.filter(r=>r.rows[0].result.allowed).length,20);
 assert.equal((await db.query(`select public.consume_edge_request('f3090000-0000-4000-8000-000000000001','process-loan','nonce-0000000000000000') result`)).rows[0].result.replay,true);
 await db.exec('reset role');
 await db.exec(`update public.edge_request_log set created_at=clock_timestamp()-interval '61 seconds';set role service_role;`);
 assert.equal((await db.query(`select public.consume_edge_request('f3090000-0000-4000-8000-000000000001','process-loan','nonce-next-window-0001') result`)).rows[0].result.allowed,true);
 await db.exec('reset role');
 console.log('PASS: concurrent quota admits exactly 20/25, rejects nonce replay and resets its window');
 await db.exec(`create trigger test_commission_guard before insert or update on public.payouts for each row execute function public.require_payroll_authorization_for_payout();`);
 await db.exec(`insert into public.payouts(status) values ('pending')`);
 await assert.rejects(db.query(`update public.payouts set status='paid'`),e=>e.code==='55000'&&e.message.includes('Commission settlement workflow'));
 console.log('PASS: commission register fails closed with a defined error instead of missing-column failure');
} catch(error){console.error(error.message,error.where??'',error.internalQuery??'');process.exitCode=1;}
finally{await db.close();}
