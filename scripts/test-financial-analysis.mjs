import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const db = new PGlite();
try {
  await db.exec(
    "create role anon;create role authenticated;create role service_role;create schema auth;create schema private;create schema vault;create schema extensions;create table auth.users(id uuid primary key);create function auth.role() returns text language sql as $$select current_setting('test.role',true)$$;create table public.profiles(user_id uuid,employee_number text,kyc_status text,account_status text);create table public.kyc_documents(user_id uuid);create table public.application_handoffs(user_id uuid,information_categories text[],authorization_signature text,authorized_at timestamptz,requested_amount numeric,term_months int,status text);",
  );
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/20261117170507_automated_financial_documents.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      new URL(
        "../supabase/operations/financial-profile-reanalysis.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const user = "11111111-1111-4111-8111-111111111111";
  await db.query("insert into auth.users values($1)", [user]);
  await db.query("insert into kyc_documents values($1)", [user]);
  await db.query("select set_config('test.role','authenticated',false)");
  await assert.rejects(() => db.query("select public.claim_financial_analysis(null)"));
  await db.query("select set_config('test.role','service_role',false)");
  const first = (await db.query("select public.claim_financial_analysis($1) as jobs", [user]))
    .rows[0].jobs[0];
  assert.equal(first.state, "processing");
  assert.equal(
    (await db.query("select public.claim_financial_analysis($1) as jobs", [user])).rows[0].jobs
      .length,
    0,
  );
  await db.query("update kyc_documents set user_id=user_id where user_id=$1", [user]);
  assert.equal(
    (
      await db.query("select public.financial_analysis_current($1,$2,$3) as ok", [
        user,
        first.generation,
        first.lease_token,
      ])
    ).rows[0].ok,
    false,
  );
  assert.equal(
    (
      await db.query("select public.finish_financial_analysis($1,$2,$3,'{}') as ok", [
        user,
        first.generation,
        first.lease_token,
      ])
    ).rows[0].ok,
    false,
  );
  const second = (await db.query("select public.claim_financial_analysis($1) as jobs", [user]))
    .rows[0].jobs[0];
  assert.ok(second.generation > first.generation);
  assert.equal(
    (
      await db.query("select public.financial_analysis_current($1,$2,$3) as ok", [
        user,
        second.generation,
        second.lease_token,
      ])
    ).rows[0].ok,
    true,
  );
  assert.equal(
    (
      await db.query(
        'select public.finish_financial_analysis($1,$2,$3,\'{"status":"review_required"}\') as ok',
        [user, second.generation, second.lease_token],
      )
    ).rows[0].ok,
    true,
  );
  assert.equal(
    (await db.query("select state from private.financial_analysis_jobs where user_id=$1", [user]))
      .rows[0].state,
    "done",
  );
  assert.equal(
    (await db.query("select count(*)::int n from private.financial_analysis_jobs")).rows[0].n,
    1,
  );
  console.log(
    "PASS financial analysis queue: service restriction, single lease, changed-document fencing, result persistence, no duplicate jobs",
  );
} finally {
  await db.close();
}
