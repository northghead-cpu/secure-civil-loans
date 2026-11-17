import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const db=new PGlite();
const actor="11111111-1111-4111-8111-111111111111";
const customer="22222222-2222-4222-8222-222222222222";
const other="33333333-3333-4333-8333-333333333333";
const revision="44444444-4444-4444-8444-444444444444";
await db.exec(`
 create role anon; create role authenticated;
 create schema auth; create schema private; create schema storage;
 create table auth.users(id uuid primary key);
 create table public.profiles(
 user_id uuid primary key references auth.users, full_name text,nrc_number text,phone text,employer text,employee_number text,
 gov_id_type text,gov_id_number text,kyc_submitted_at timestamptz,kyc_status text default 'PENDING',kyc_signature text,
 account_status text default 'active',kyc_review_revision uuid default gen_random_uuid(),consent_accepted boolean default false);
 create table public.kyc_documents(
 user_id uuid,document_type text,storage_path text,pay_period date,validation_status text,rejection_reason text,updated_at timestamptz default now());
 create table public.audit_logs(user_id uuid,role text,action_performed text,record_id text,table_name text,new_value jsonb,created_at timestamptz default now());
 create table storage.objects(bucket_id text,name text);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
 create function private.has_role(text) returns boolean language sql stable as $$select current_setting('test.role',true)=$1$$;
 create function private.is_privileged_role(uuid) returns boolean language sql stable as $$select $1='11111111-1111-4111-8111-111111111111'::uuid$$;
 create function private.require_interactive_session() returns void language plpgsql as $$begin
 if auth.uid() is null or current_setting('test.mfa',true) is distinct from 'aal2' then raise exception 'MFA required'; end if;
 end$$;
`);
// PGlite is single-session; transaction advisory locking is exercised on PostgreSQL in production.
const advisory=await db.query("select to_regprocedure('pg_catalog.pg_advisory_xact_lock(bigint)') as name");
if(!advisory.rows[0].name)await db.exec("create function pg_catalog.pg_advisory_xact_lock(bigint) returns void language sql as 'select null::void'");
await db.exec(await readFile(new URL("../supabase/migrations/20261117100000_assisted_customer_intake.sql",import.meta.url),"utf8"));
await db.query("select set_config('test.actor',$1,false),set_config('test.role','super_admin',false),set_config('test.mfa','aal2',false)",[actor]);
await db.query("insert into auth.users values ($1),($2),($3)",[actor,customer,other]);
await db.query("insert into public.profiles(user_id,kyc_review_revision) values ($1,$2),($3,gen_random_uuid())",[customer,revision,other]);
const periods=(await db.query("select (date_trunc('month',current_date)-make_interval(months=>n))::date::text period from generate_series(1,3)n")).rows.map(r=>r.period);
const docs=[
 {document_type:"NRC",storage_path:customer+"/nrc-1770000000001.pdf"},
 {document_type:"GOV_ID",storage_path:customer+"/gov-id-1770000000002.pdf"},
 {document_type:"INTRODUCTORY_LETTER",storage_path:customer+"/introductory-letter-1770000000003.pdf"},
 ...periods.map((period,i)=>({document_type:"PAYSLIP",storage_path:customer+"/payslip-177000000000"+(i+4)+".pdf",pay_period:period})),
];
for(const d of docs)await db.query("insert into storage.objects values('kyc-documents',$1)",[d.storage_path]);
const details={fullName:"Synthetic Customer",nrcNumber:"123456/78/1",phone:"+260971234567",employer:"Synthetic Employer",employeeNumber:"TEST01",govIdType:"passport",govIdNumber:"TEST123"};
const submit=(documents=docs,rev=revision)=>db.query("select public.submit_assisted_kyc($1,$2::jsonb,$3::jsonb,$4)",[customer,JSON.stringify(details),JSON.stringify(documents),rev]);
await db.query("select set_config('test.role','admin',false)");
await assert.rejects(()=>submit(),/Super admin/);
await db.query("select set_config('test.role','super_admin',false),set_config('test.mfa','aal1',false)");
await assert.rejects(()=>submit(),/MFA/);
await db.query("select set_config('test.mfa','aal2',false)");
await assert.rejects(()=>submit(docs,other),/Profile changed/);
await assert.rejects(()=>submit(docs.slice(1)),/Six/);
await assert.rejects(()=>submit(docs.map((d,i)=>i?d:{...d,storage_path:other+"/nrc-1770000000001.pdf"})),/wrong customer/);
await assert.rejects(()=>submit(docs.map((d,i)=>i===5?{...d,pay_period:periods[0]}:d)),/distinct payslip/);
await assert.rejects(()=>submit(docs.map((d,i)=>i===5?{...d,pay_period:"2000-01-01"}:d)),/latest completed/);
await db.query("insert into public.kyc_documents values($1,'NRC',$2,null,'PENDING',null,now())",[customer,customer+"/nrc-1700000000000.pdf"]);
await db.query("update public.profiles set nrc_number=$1 where user_id=$2",[details.nrcNumber,other]);
await assert.rejects(()=>submit(),/already belongs/);
await db.query("update public.profiles set nrc_number=null where user_id=$1",[other]);
await submit();
const p=(await db.query("select * from public.profiles where user_id=$1",[customer])).rows[0];
assert.equal(p.kyc_status,"IN_REVIEW");assert.equal(p.full_name,details.fullName);assert.equal(p.consent_accepted,false);assert.equal(p.kyc_signature,null);
const evidence=(await db.query("select * from public.kyc_documents where user_id=$1",[customer])).rows;
assert.equal(evidence.length,7);assert.equal(evidence.filter(d=>d.validation_status==="PENDING").length,6);
assert.equal(evidence.find(d=>d.validation_status==="REJECTED").rejection_reason,"Superseded by assisted submission");
assert(evidence.filter(d=>d.validation_status==="PENDING").every(d=>d.uploaded_by===actor&&d.intake_source==="super_admin_assisted"));
assert.equal((await db.query("select count(*)::int n from public.audit_logs")).rows[0].n,1);
await assert.rejects(()=>submit(),/already verified or under review/);

await db.exec(await readFile(new URL("../supabase/migrations/20261117120000_kyc_requirement_exceptions.sql",import.meta.url),"utf8"));
await db.exec("create table public.notifications(user_id uuid,title text,message text)");
await db.query("update public.profiles set kyc_status='PENDING' where user_id=$1",[customer]);
const partial={...details,employeeNumber:"",govIdNumber:"",govIdType:""};
const exceptions={"field:employeeNumber":"Not required for this employer","field:govIdNumber":"NRC accepted instead","field:govIdType":"NRC accepted instead","doc:NRC":"Evidence checked separately","doc:GOV_ID":"NRC accepted instead","doc:INTRODUCTORY_LETTER":"Employment verified separately",...Object.fromEntries(periods.map(p=>["doc:PAYSLIP:"+p,"Not required for this review"]))};
const submitPartial=(reasons)=>db.query("select public.submit_assisted_kyc($1,$2::jsonb,'[]'::jsonb,$3,$4::jsonb)",[customer,JSON.stringify(partial),revision,JSON.stringify(reasons)]);
await assert.rejects(()=>submitPartial({}),/Skip reason required/);
await assert.rejects(()=>submitPartial({...exceptions,"field:imaginary":"Invalid exception"}),/Unexpected exception/);
await submitPartial(exceptions);
await db.query("select set_config('test.role','admin',false)");
await assert.rejects(()=>db.query("select public.approve_kyc_with_exceptions($1,$2,$3::jsonb)",[customer,revision,JSON.stringify(exceptions)]),/Super admin/);
await db.query("select set_config('test.role','super_admin',false)");
await assert.rejects(()=>db.query("select public.approve_kyc_with_exceptions($1,$2,'{}'::jsonb)",[customer,revision]),/Skip reason required/);
await db.query("select public.approve_kyc_with_exceptions($1,$2,$3::jsonb)",[customer,revision,JSON.stringify(exceptions)]);
const approved=(await db.query("select * from public.profiles where user_id=$1",[customer])).rows[0];
assert.equal(approved.kyc_status,"COMPLETED");assert.equal(approved.consent_accepted,false);assert.equal(approved.kyc_signature,null);
assert.equal((await db.query("select count(*)::int n from public.kyc_documents")).rows[0].n,7);
await db.exec("set role authenticated");
await assert.rejects(()=>db.query("alter table public.profiles add column unauthorized text"));
await db.close();
console.log("Assisted intake: authorization, MFA, completeness, ownership, periods, concurrency, duplicates, evidence retention and consent checks passed.");
