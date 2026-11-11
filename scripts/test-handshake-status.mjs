import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const db = new PGlite();
const read = (p) => fs.readFile(new URL("../" + p, import.meta.url), "utf8");
try {
  await db.exec(await read("supabase/tests/fixtures/ui_bootstrap.sql"));
  await db.exec(await read("supabase/migrations/20261027085120_handshake_transfer_retry.sql"));
  await db.exec(
    await read("supabase/migrations/20261111074019_authenticated_handshake_status.sql"),
  );
  const user = "11111111-1111-4111-8111-111111111111",
    handoff = "22222222-2222-4222-8222-222222222222",
    remote = "33333333-3333-4333-8333-333333333333";
  await db.query("insert into auth.users(id,email) values($1,$2)", [user, "test@example.invalid"]);
  await db.query(
    "insert into public.application_handoffs(id,user_id,lender_name,authorization_text,authorization_version,authorized_at,authorization_signature,status) values($1,$2,'Synthetic Lender','test','v1',now(),'Synthetic','authorized')",
    [handoff, user],
  );
  const apply = (
    status,
    version,
    hash = "a".repeat(64),
    id = remote,
    lender = "Synthetic Lender",
  ) =>
    db.query("select public.apply_handshake_status($1,$2,$3,$4,$5,$6) r", [
      handoff,
      id,
      status,
      version,
      hash,
      lender,
    ]);
  await db.exec("select set_config('request.jwt.claims','{\"role\":\"authenticated\"}',false)");
  await assert.rejects(apply("pre_approved", 1), (e) => e.code === "42501");
  await db.exec("select set_config('request.jwt.claims','{\"role\":\"service_role\"}',false)");
  await assert.rejects(
    apply("pre_approved", 1, "a".repeat(64), remote, "Other Lender"),
    (e) => e.code === "42501",
  );
  assert.equal((await apply("pre_approved", 2)).rows[0].r.status, "pre_approved");
  assert.equal((await apply("pre_approved", 2)).rows[0].r.duplicate, true);
  assert.equal((await apply("sent_to_lender", 1)).rows[0].r.stale, true);
  await assert.rejects(apply("declined", 2, "b".repeat(64)), (e) => e.code === "23505");
  await assert.rejects(apply("approved", 3, "c".repeat(64), user), (e) => e.code === "42501");
  await apply("approved", 3, "c".repeat(64));
  await apply("disbursed", 4, "d".repeat(64));
  await assert.rejects(apply("preparing", 5, "e".repeat(64)), (e) => e.code === "23505");
  const audit = await db.query(
    "select count(*)::int n from public.audit_logs where action_performed='handshake_status_received'",
  );
  assert.equal(audit.rows[0].n, 3);
  await db.exec("select set_config('request.jwt.claims','{\"role\":\"authenticated\"}',false)");
  await assert.rejects(
    db.query("update public.application_handoffs set handshake_status_version=99 where id=$1", [
      handoff,
    ]),
    (e) => e.code === "42501",
  );
  console.log(
    "PASS: worker authority, lender binding, remote identity, duplicates, conflicts, stale ordering, terminal states, audit and client field protection",
  );
} finally {
  await db.close();
}
