// Isolated PostgreSQL policies; no live accounts, bytes or external connections.
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const db = new PGlite();
const read = (path) => fs.readFile(new URL("../" + path, import.meta.url), "utf8");
const a="f3090000-0000-4000-8000-000000000001";
const b="f3090000-0000-4000-8000-000000000002";
const staff="f3090000-0000-4000-8000-000000000003";
let checks=0;
const check=(label,condition)=>{assert.ok(condition,label);checks++;console.log("PASS: "+label);};
async function claims(user, extra={}) {
  await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({sub:user,session_id:user,role:"authenticated",aal:user===staff?"aal2":"aal1",...extra})]);
}
async function count() { return (await db.query("select count(*)::int n from storage.objects")).rows[0].n; }
try {
  await db.exec(await read("supabase/tests/fixtures/ui_bootstrap.sql"));
  await db.exec(await read("supabase/migrations/20261022205917_marketplace_ui_workflows.sql"));
  await db.exec(await read("supabase/migrations/20261024064302_cloudflare_audit_remediation.sql"));
  await db.exec(`create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz,oauth_client_id uuid);
    create function storage.operation() returns text language sql stable as $$select current_setting('storage.operation',true)$$;
    create function storage.allow_any_operation(ops text[]) returns boolean language sql stable as $$select replace(storage.operation(),'storage.','')=any(ops)$$;
    grant select,insert,update,delete on storage.objects to anon,authenticated;
    create policy future_broad_select on storage.objects for select to anon,authenticated using(true);
  `);
  await db.exec(await read("supabase/migrations/20261109110816_marketplace_sensitive_storage_sessions.sql"));
  for (const user of [a,b,staff]) {
    await db.query("insert into auth.users(id,email) values($1,$2)",[user,user+"@example.invalid"]);
    await db.query("insert into public.profiles(user_id,account_status) values($1,'active')",[user]);
    await db.query("insert into auth.sessions(id,user_id) values($1,$1)",[user]);
  }
  await db.query("insert into public.user_roles(user_id,role) values($1,'admin')",[staff]);
  for(const bucket of ["kyc-documents","payment-receipts","payslips"]) for(const user of [a,b]) {
    await db.query("insert into storage.objects(bucket_id,name) values($1,$2)",[bucket,user+"/nrc-1760000000001.pdf"]);
  }
  await db.exec("set role anon");check("Anonymous users cannot read any sensitive bucket",await count()===0);
  await db.exec("reset role");await claims(a);await db.exec("set role authenticated");
  check("Borrower sees only own objects even with a broad SELECT policy",await count()===3);
  await db.query("select public.require_document_upload_session()");check("Live first-party borrower may use validated upload",true);
  await claims(a,{session_id:b});check("Another borrower's session cannot be borrowed",await count()===0);
  await claims(a,{session_id:"not-a-uuid"});check("Malformed session fails closed without casting errors",await count()===0);
  await claims(a,{session_id:null});check("Missing session denied",await count()===0);
  await claims(a,{client_id:"oauth-client"});check("OAuth client claim cannot read documents",await count()===0);
  await claims(a,{is_anonymous:true});check("Anonymous Auth users cannot read documents",await count()===0);
  await db.exec("reset role");await db.query("update auth.sessions set oauth_client_id=gen_random_uuid() where id=$1",[a]);
  await claims(a);await db.exec("set role authenticated");check("Database OAuth session is denied even without client_id claim",await count()===0);
  await db.exec("reset role");await db.query("update auth.sessions set oauth_client_id=null,not_after=now()-interval '1 minute' where id=$1",[a]);
  await db.exec("set role authenticated");check("Expired server session denied",await count()===0);
  await assert.rejects(db.query("select public.require_document_upload_session()"),e=>e.code==='42501');check("Expired session cannot use service-backed upload",true);
  await db.exec("reset role");await db.query("update auth.sessions set not_after=null where id=$1",[a]);
  await db.query("delete from auth.sessions where id=$1",[a]);await db.exec("set role authenticated");check("Revoked login session cannot read using an unexpired JWT",await count()===0);
  await db.exec("reset role");await db.query("insert into auth.sessions(id,user_id) values($1,$1)",[a]);
  await claims(staff);
  await db.query("update public.profiles set account_status='suspended' where user_id=$1",[a]);
  await claims(a);
  await db.exec("set role authenticated");check("Suspended borrower denied",await count()===0);
  await db.exec("reset role");await claims(staff);await db.query("update public.profiles set account_status='active' where user_id=$1",[a]);
  await claims(staff,{aal:"aal1"});await db.exec("set role authenticated");check("Privileged staff without MFA denied",await count()===0);
  await claims(staff);check("Active MFA administrator keeps authorized document access",await count()===6);
  await db.exec("reset role");
  await db.exec(await read("supabase/operations/marketplace_authenticated_document_reads.sql"));
  await claims(a);await db.exec("set role authenticated");
  for(const operation of ["storage.object.sign","storage.object.sign_many","storage.render.image_sign","storage.s3.object.get",""]) {
    await db.query("select set_config('storage.operation',$1,false)",[operation]);
    check("Staged operation policy denies "+(operation||"direct table API"),await count()===0);
  }
  for(const operation of ["storage.object.get_authenticated","storage.object.list","storage.object.list_v2","object.get_authenticated_info"]) {
    await db.query("select set_config('storage.operation',$1,false)",[operation]);
    check("Staged operation policy preserves "+operation,await count()===3);
  }
  await db.exec("reset role");
  await db.exec(`alter table storage.objects add column version text not null default 'version-1',add column created_at timestamptz default now(),add column updated_at timestamptz default now(),add column metadata jsonb default '{"size":1}';`);
  await db.exec(await read("supabase/migrations/20261109114704_marketplace_scan_quarantine.sql"));
  await db.exec(await read("supabase/migrations/20261109115530_marketplace_worker_object_lookup.sql"));
  await db.exec(await read("supabase/migrations/20261109120438_marketplace_scan_evidence_ordering.sql"));
  await claims(a);await db.exec("set role authenticated");
  await assert.rejects(db.query("select public.marketplace_security_source_page(null,now())"),e=>e.code==='42501');
  check("Borrowers cannot invoke the backup source listing",true);
  await assert.rejects(db.query("select public.marketplace_security_source_object(gen_random_uuid())"),e=>e.code==='42501');check("Borrowers cannot invoke the worker object lookup",true);
  await db.exec("reset role");
  await db.exec(`select set_config('request.jwt.claims','{"role":"service_role"}',false);set role service_role;`);
  const page=(await db.query("select public.marketplace_security_source_page(null,clock_timestamp()) as items")).rows[0].items;
  check("Service worker lists only the expected sensitive source objects",page.length===6);
  const item=page.find(x=>x.bucket_id==='kyc-documents'&&x.name.startsWith(a));
  check("Service worker lookup is bound to the exact source ID",(await db.query("select public.marketplace_security_source_object($1) as item",[item.id])).rows[0].item.id===item.id);
  const record=(version,verdict,age="0 seconds",sha='a'.repeat(64))=>db.query(`select public.record_marketplace_storage_scan($1,$2,$3,$4,'ClamAV synthetic test',clock_timestamp()-$5::interval)`,[item.id,version,sha,verdict,age]);
  await record('version-1','infected');
  await db.exec("reset role");await claims(a);await db.exec("set role authenticated");
  check("A positive scan quarantines access without deleting the object",(await db.query("select count(*)::int n from storage.objects where id=$1",[item.id])).rows[0].n===0);
  await db.exec("reset role");
  check("Quarantined bytes metadata is retained",(await db.query("select count(*)::int n from storage.objects where id=$1",[item.id])).rows[0].n===1);
  await db.exec(`select set_config('request.jwt.claims','{"role":"service_role"}',false);set role service_role;`);
  await assert.rejects(record('wrong-version','clean'),e=>e.code==='40001');check("Stale version cannot be certified clean",true);
  await assert.rejects(record('version-1','clean','3 days'),e=>e.code==='22023');check("Stale antivirus signatures rejected by the server",true);
  await assert.rejects(record('version-1','clean','1 hour'),e=>e.code==='40001');check("Delayed older clean evidence cannot replace a newer positive",true);
  await record('version-1','error');
  await db.exec("reset role");await claims(a);await db.exec("set role authenticated");
  check("An unreadable scan does not reopen quarantined access",(await db.query("select count(*)::int n from storage.objects where id=$1",[item.id])).rows[0].n===0);
  await db.exec("reset role");await db.exec(`select set_config('request.jwt.claims','{"role":"service_role"}',false);set role service_role;`);
  await record('version-1','clean');
  await db.exec("reset role");await claims(a);await db.exec("set role authenticated");
  check("A later clean report cannot silently clear a positive digest",(await db.query("select count(*)::int n from storage.objects where id=$1",[item.id])).rows[0].n===0);
  await db.exec("reset role");await db.query("update storage.objects set version='safe-replacement-version' where id=$1",[item.id]);
  await db.exec(`select set_config('request.jwt.claims','{"role":"service_role"}',false);set role service_role;`);
  await record('safe-replacement-version','clean','0 seconds','b'.repeat(64));
  await db.exec("reset role");await claims(a);await db.exec("set role authenticated");
  check("Verified new version and new digest can restore authorized access",(await db.query("select count(*)::int n from storage.objects where id=$1",[item.id])).rows[0].n===1);
  await db.exec("reset role");await db.query("update storage.objects set version='version-2' where id=$1",[item.id]);
  await claims(a);await db.exec("set role authenticated");
  check("Overwriting an old clean object cannot reuse its scan result",(await db.query("select count(*)::int n from storage.objects where id=$1",[item.id])).rows[0].n===0);
  await db.exec("reset role");await db.exec("update private.marketplace_storage_scan_config set require_clean_scan=true");
  await claims(a);await db.exec("set role authenticated");
  check("Optional strict mode blocks unscanned objects",await count()===0);
  await db.exec("reset role");
  console.log(`PASS: ${checks} Marketplace storage authorization checks, including quarantine; isolated fixtures only.`);
} catch(error) { console.error(error.message,error.where??"",error.internalQuery??"");process.exitCode=1; }
finally { await db.close(); }
