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
  await db.exec(`
    create table vault.decrypted_secrets(name text,decrypted_secret text);
    insert into vault.decrypted_secrets values('riverbanc_cron_secret',repeat('x',32));
    create schema net;
    create table net.requests(id bigint generated always as identity,body jsonb);
    create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds int)
    returns bigint language plpgsql as $$
    declare n bigint;
    begin
     if current_setting('test.fail_http',true)='true' then raise exception 'network unavailable';end if;
     insert into net.requests(body) values(body) returning id into n;return n;
    end $$;
    create function private.require_interactive_session() returns void language plpgsql as $$
    begin if current_setting('test.aal',true) is distinct from 'aal2' then raise insufficient_privilege;end if;end $$;
    create function private.has_role(role_name text) returns boolean language sql as $$
    select coalesce(current_setting('test.staff',true),'')=role_name
    $$;
  `);
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/20261118003000_immediate_financial_analysis.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const user = "11111111-1111-4111-8111-111111111111";
  await db.query("insert into auth.users values($1)", [user]);
  await db.exec("begin");
  await db.query("insert into kyc_documents values($1)", [user]);
  await db.query("insert into kyc_documents values($1)", [user]);
  await db.exec("commit");
  assert.equal(
    (await db.query("select count(*)::int n from net.requests")).rows[0].n,
    1,
    "one immediate wake per user per intake transaction",
  );
  assert.equal(
    (await db.query("select body from net.requests")).rows[0].body.user_id,
    user,
  );
  assert.equal(
    (await db.query("select state from private.financial_analysis_jobs"))
      .rows[0].state,
    "pending",
  );

  await db.query("select set_config('test.role','authenticated',false)");
  await assert.rejects(() =>
    db.query("select public.claim_financial_analysis(null)"),
  );
  await db.query("select set_config('test.role','service_role',false)");
  const first = (
    await db.query("select public.claim_financial_analysis($1) as jobs", [user])
  ).rows[0].jobs[0];
  assert.equal(first.state, "processing");
  assert.equal(
    (
      await db.query("select public.claim_financial_analysis($1) as jobs", [
        user,
      ])
    ).rows[0].jobs.length,
    0,
  );
  await db.query("update kyc_documents set user_id=user_id where user_id=$1", [
    user,
  ]);
  assert.equal(
    (
      await db.query(
        "select public.financial_analysis_current($1,$2,$3) as ok",
        [user, first.generation, first.lease_token],
      )
    ).rows[0].ok,
    false,
  );
  assert.equal(
    (
      await db.query(
        "select public.finish_financial_analysis($1,$2,$3,'{}') as ok",
        [user, first.generation, first.lease_token],
      )
    ).rows[0].ok,
    false,
  );
  const second = (
    await db.query("select public.claim_financial_analysis($1) as jobs", [user])
  ).rows[0].jobs[0];
  assert.ok(second.generation > first.generation);
  assert.equal(
    (
      await db.query(
        "select public.financial_analysis_current($1,$2,$3) as ok",
        [user, second.generation, second.lease_token],
      )
    ).rows[0].ok,
    true,
  );
  assert.equal(
    (
      await db.query(
        "select public.finish_financial_analysis($1,$2,$3,$4::jsonb) as ok",
        [
          user,
          second.generation,
          second.lease_token,
          JSON.stringify({
            status: "review_required",
            sourceGeneration: second.generation,
          }),
        ],
      )
    ).rows[0].ok,
    true,
  );
  assert.equal(
    (
      await db.query(
        "select state from private.financial_analysis_jobs where user_id=$1",
        [user],
      )
    ).rows[0].state,
    "done",
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from private.financial_analysis_jobs",
      )
    ).rows[0].n,
    1,
  );
  await assert.rejects(() =>
    db.query("select public.get_financial_analysis_preview($1)", [user]),
  );
  await db.query("select set_config('test.aal','aal2',false)");
  await assert.rejects(() =>
    db.query("select public.get_financial_analysis_preview($1)", [user]),
  );
  await db.query("select set_config('test.staff','admin',false)");
  const preview = (
    await db.query("select public.get_financial_analysis_preview($1) p", [user])
  ).rows[0].p;
  assert.equal(preview.current, true);
  assert.equal(
    "rows" in preview.assessment,
    false,
    "private payroll rows are never returned",
  );
  await db.query("select set_config('test.fail_http','true',false)");
  await db.query("update kyc_documents set user_id=user_id where user_id=$1", [
    user,
  ]);
  const failedWake = (
    await db.query(
      "select state,last_wake_error from private.financial_analysis_jobs",
    )
  ).rows[0];
  assert.equal(
    failedWake.state,
    "pending",
    "upload succeeds and cron can recover",
  );
  assert.equal(failedWake.last_wake_error, "IMMEDIATE_WAKE_FAILED");
  const stale = (
    await db.query("select public.get_financial_analysis_preview($1) p", [user])
  ).rows[0].p;
  assert.equal(stale.current, false);
  assert.equal(
    stale.assessment,
    null,
    "do not show an earlier generation after documents change",
  );
  assert.equal(
    (
      await db.query(
        "select has_function_privilege('anon','private.wake_financial_analysis()','EXECUTE') ok",
      )
    ).rows[0].ok,
    false,
  );
  assert.equal(
    (
      await db.query(
        "select has_function_privilege('authenticated','private.wake_financial_analysis()','EXECUTE') ok",
      )
    ).rows[0].ok,
    false,
  );
  console.log(
    "PASS immediate wake: transaction batching, targeted job, upload-safe failure, private staff summary, MFA, stale preview suppression",
  );
  console.log(
    "PASS financial analysis queue: service restriction, single lease, changed-document fencing, result persistence, no duplicate jobs",
  );
} finally {
  await db.close();
}
