import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const db = new PGlite();
const id = "11111111-1111-4111-8111-111111111111",
  nonce = "22222222-2222-4222-8222-222222222222";
let n = 0;
const check = (label, ok) => {
  assert.ok(ok, label);
  console.log("PASS: " + label);
  n++;
};
try {
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema private;create schema storage;create schema extensions;
create function auth.jwt() returns jsonb language sql as $$select coalesce(current_setting('request.jwt.claims',true),'{}')::jsonb$$;
create function extensions.digest(bytea,text) returns bytea language sql as $$select decode(repeat(md5($1),2),'hex')$$;
create table public.application_handoffs(id uuid,user_id uuid,lender_name text,handshake_transfer_status text,status text,authorized_at timestamptz,authorization_signature text,authorization_version text,information_categories text[],updated_at timestamptz);
create table public.profiles(user_id uuid,account_status text,kyc_status text,consent_data_sharing_lenders boolean,kyc_review_revision uuid,consents_updated_at timestamptz,updated_at timestamptz,full_name text,nrc_number text,employee_number text,employer text,phone text,gov_id_type text,gov_id_number text);
create table public.kyc_documents(id uuid default gen_random_uuid(),user_id uuid,document_type text,storage_path text,pay_period date,validation_status text);
create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,version text,metadata jsonb);
create table private.marketplace_storage_scans(object_id uuid,object_version text,verdict text,sha256 text,definitions_at timestamptz);
grant usage on schema public,private,auth to anon,authenticated,service_role;
insert into public.application_handoffs values('${id}','${id}','Test lender','accepted','preparing',now(),'Synthetic','v1',array['Identity information','Employment information','Income information','Relevant supporting documents'],now());
insert into public.profiles(user_id,account_status,kyc_status,consent_data_sharing_lenders,kyc_review_revision,consents_updated_at,updated_at,full_name)values('${id}','active','VERIFIED',true,gen_random_uuid(),now(),now(),'Synthetic');
insert into public.kyc_documents(user_id,document_type,storage_path,pay_period,validation_status)select '${id}',t,'${id}/'||i||'.pdf',case when t='PAYSLIP' then ('2026-0'||i||'-01')::date end,'VALID' from (values(1,'NRC'),(2,'GOV_ID'),(3,'INTRODUCTORY_LETTER'),(4,'PAYSLIP'),(5,'PAYSLIP'),(6,'PAYSLIP'))q(i,t);
insert into storage.objects(bucket_id,name,version,metadata)select 'kyc-documents',storage_path,'v1','{"size":8}' from public.kyc_documents;
`);
  await db.exec(
    await fs.readFile(
      new URL(
        "../supabase/migrations/20261110082452_marketplace_kyc_release_source.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const context = () =>
    db.query(
      `select public.marketplace_kyc_release_context('${id}','Test lender',null) as c`,
    );
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`set role ${role}`);
    await assert.rejects(context(), (e) => e.code === "42501");
    await db.exec("reset role");
    check(role + " cannot invoke document source", true);
  }
  await db.exec(
    `select set_config('request.jwt.claims','{"role":"service_role"}',false);set role service_role;`,
  );
  await assert.rejects(context(), (e) => e.code === "55000");
  check("Unscanned files refuse export", true);
  await db.exec("reset role");
  await db.exec(
    `insert into private.marketplace_storage_scans select id,version,'clean',repeat('a',64),now() from storage.objects;set role service_role;`,
  );
  const initial = (await context()).rows[0].c;
  check(
    "Exact reviewed clean inventory returns six files",
    initial.documents.length === 6,
  );
  await assert.rejects(
    db.query(
      `select public.marketplace_kyc_release_context('${id}','Wrong lender',null)`,
    ),
    (e) => e.code === "42501",
  );
  check("Cross-lender handoff refused", true);
  await db.query(
    `select public.marketplace_kyc_release_context('${id}','Test lender','${nonce}')`,
  );
  await assert.rejects(
    db.query(
      `select public.marketplace_kyc_release_context('${id}','Test lender','${nonce}')`,
    ),
    (e) => e.code === "23505",
  );
  check("Preparation nonce replay refused", true);
  await db.exec("reset role");
  for (const [label, change, undo] of [
    [
      "Withdrawn consent",
      `update public.profiles set consent_data_sharing_lenders=false`,
      `update public.profiles set consent_data_sharing_lenders=true`,
    ],
    [
      "Suspended borrower",
      `update public.profiles set account_status='suspended'`,
      `update public.profiles set account_status='active'`,
    ],
    [
      "Replaced object",
      `update storage.objects set version='v2'`,
      `update storage.objects set version='v1'`,
    ],
    [
      "Infected evidence",
      `update private.marketplace_storage_scans set verdict='infected'`,
      `update private.marketplace_storage_scans set verdict='clean'`,
    ],
    [
      "Stale malware definitions",
      `update private.marketplace_storage_scans set definitions_at=now()-interval '3 days'`,
      `update private.marketplace_storage_scans set definitions_at=now()`,
    ],
    [
      "Missing size",
      `update storage.objects set metadata='{}'`,
      `update storage.objects set metadata='{"size":8}'`,
    ],
    [
      "Unreviewed document",
      `update public.kyc_documents set validation_status='PENDING'`,
      `update public.kyc_documents set validation_status='VALID'`,
    ],
  ]) {
    await db.exec(change);
    await db.exec("set role service_role");
    await assert.rejects(context());
    await db.exec("reset role");
    await db.exec(undo);
    check(label + " blocks package export", true);
  }
  await db.exec(
    `update public.profiles set updated_at=now()+interval '1 second';set role service_role;`,
  );
  check(
    "Profile changes invalidate source fingerprint",
    (await context()).rows[0].c.source_fingerprint !==
      initial.source_fingerprint,
  );
  console.log("PASS: " + n + " isolated source authorization checks");
} finally {
  await db.close();
}
