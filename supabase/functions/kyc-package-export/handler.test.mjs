import test from "node:test";
import assert from "node:assert/strict";
import { makeExport } from "./handler.mjs";
import {
  sha,
  sign,
  requestText,
  verify,
  responseText,
  zip,
} from "./protocol.mjs";
const secret = "synthetic-test-secret-".repeat(3),
  id = "11111111-1111-4111-8111-111111111111",
  nonce = "22222222-2222-4222-8222-222222222222",
  fp = "a".repeat(64),
  bytes = new TextEncoder().encode("%PDF-synthetic");
const body = {
  request_id: id,
  attempt_id: nonce,
  reference: "RBH-" + id,
  tenant_short_name: "test-lender",
  package_fingerprint: fp,
  operation: "prepare",
};
const documents = [
  "NRC",
  "GOV_ID",
  "INTRODUCTORY_LETTER",
  "PAYSLIP",
  "PAYSLIP",
  "PAYSLIP",
].map((type, i) => ({
  id,
  type,
  period: type === "PAYSLIP" ? `2026-0${i}` : null,
  path: id + "/" + i + ".pdf",
  size: bytes.length,
  sha256: sha(bytes),
}));
const ctx = {
  documents,
  borrower: { full_name: "Synthetic Borrower" },
  source_fingerprint: fp,
};
const ports = {
  secret,
  tenantMap: { "Test lender": "test-lender" },
  context: async () => ctx,
  read: async () => bytes,
  audit: async () => {},
};
function req(value = body, sig = true) {
  const raw = JSON.stringify(value),
    time = String(Math.floor(Date.now() / 1000));
  return new Request("https://test.invalid", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-riverbanc-timestamp": time,
      "x-riverbanc-signature": sig
        ? sign(secret, requestText(time, raw))
        : "f".repeat(64),
    },
    body: raw,
  });
}
test("Unsigned, browser, extra-field and wrong-lender requests never read PII", async () => {
  let reads = 0;
  const h = makeExport({
    ...ports,
    read: async () => {
      reads++;
      return bytes;
    },
  });
  assert.equal((await h(req(body, false))).status, 401);
  assert.equal((await h(req({ ...body, user_id: id }))).status, 400);
  assert.equal(
    (await h(req({ ...body, tenant_short_name: "other" }))).status,
    403,
  );
  const browser = req();
  browser.headers.set("Origin", "https://evil.test");
  assert.equal((await h(browser)).status, 403);
  assert.equal(reads, 0);
});
test("Missing authorization context refuses package assembly", async () => {
  const r = await makeExport({
    ...ports,
    context: async () => {
      throw Error("Authorization missing");
    },
  })(req());
  assert.equal(r.status, 409);
});
test("Approved exact bytes assemble to signed private ZIP without source paths", async () => {
  const r = await makeExport(ports)(req());
  assert.equal(r.status, 200);
  const z = new Uint8Array(await r.arrayBuffer()),
    hash = sha(z);
  assert.equal(z[0], 80);
  assert.equal(z[1], 75);
  assert.equal(r.headers.get("Cache-Control"), "private, no-store");
  assert.ok(
    verify(
      secret,
      responseText(body, hash, fp),
      r.headers.get("X-KYC-Signature"),
    ),
  );
  assert.ok(!new TextDecoder().decode(z).includes(id + "/"));
});
test("Changed bytes, changed consent snapshot or unavailable audit deny release", async () => {
  assert.equal(
    (
      await makeExport({ ...ports, read: async () => new Uint8Array([1]) })(
        req(),
      )
    ).status,
    409,
  );
  let calls = 0;
  assert.equal(
    (
      await makeExport({
        ...ports,
        context: async () => ({
          ...ctx,
          source_fingerprint: ++calls === 1 ? fp : "b".repeat(64),
        }),
      })(req())
    ).status,
    409,
  );
  assert.equal(
    (
      await makeExport({
        ...ports,
        audit: async () => {
          throw Error("Audit down");
        },
      })(req())
    ).status,
    409,
  );
});
test("Check operation returns only an authenticated source fingerprint", async () => {
  let reads = 0;
  const r = await makeExport({
    ...ports,
    read: async () => {
      reads++;
      return bytes;
    },
  })(req({ ...body, operation: "check" }));
  assert.deepEqual(await r.json(), { source_fingerprint: fp });
  assert.equal(reads, 0);
});
test("ZIP rejects traversal and duplicate entries", () => {
  assert.throws(() => zip([["../private.pdf", bytes]]));
  assert.throws(() =>
    zip([
      ["NRC.pdf", bytes],
      ["NRC.pdf", bytes],
    ]),
  );
});

test("Reviewed documents without scan evidence assemble with computed content hashes", async () => {
  const r = await makeExport({...ports, context: async () => ({...ctx, documents: documents.map(({sha256, ...d}) => d)})})(req());
  assert.equal(r.status, 200);
  const archive = new TextDecoder().decode(await r.arrayBuffer());
  assert.ok(archive.includes(sha(bytes)));
  assert.ok(archive.includes("reviewed-source-versions-no-av-prerequisite"));
  assert.ok(!archive.includes("clean-scans"));
});
