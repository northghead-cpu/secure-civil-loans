import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, createPrivateKey } from "node:crypto";
import { seal, unseal, digest } from "./envelope.mjs";
import { runBackup, verifyRestore } from "./worker.mjs";
import {
  sourceFromEnv,
  boundedBytes,
  destinationFromEnv,
} from "./adapters.mjs";
const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 3072,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});
const now = () => new Date("2026-11-09T10:00:00Z");
function fixture(verdict = "clean") {
  const remote = new Map(),
    calls = [];
  const bytes = Buffer.from("synthetic KYC fixture, never a customer file");
  const item = {
    id: "11111111-1111-4111-8111-111111111111",
    bucket_id: "kyc-documents",
    name: "synthetic-owner/file.pdf",
    version: "immutable-v1",
    metadata: { size: bytes.length },
  };
  const source = {
    async page() {
      return [item];
    },
    async read() {
      calls.push("read");
      return Buffer.from(bytes);
    },
    async recordScan(_i, sha, status) {
      calls.push(status);
      assert.equal(sha, digest(bytes));
    },
  };
  const destination = {
    async put(key, value) {
      assert.ok(!remote.has(key));
      remote.set(key, Buffer.from(value));
    },
    async get(key) {
      return Buffer.from(remote.get(key));
    },
  };
  const scanner = {
    async preflight() {
      return {
        engine_version: "ClamAV synthetic-test",
        definitions_at: now().toISOString(),
      };
    },
    async scan() {
      return verdict;
    },
  };
  return { source, destination, scanner, remote, calls, bytes, item };
}
test("Encrypts payload and manifest, reads back ciphertext, then verifies recovered bytes", async () => {
  const f = fixture();
  const receipt = await runBackup({ ...f, publicKey, now });
  assert.equal(receipt.restore_verified, false);
  assert.equal(receipt.encrypted_readback_verified, true);
  for (const value of f.remote.values()) {
    assert.ok(!value.includes(f.bytes));
    assert.ok(!value.includes(Buffer.from("synthetic-owner")));
  }
  const restored = await verifyRestore({
    destination: f.destination,
    privateKey,
    runId: receipt.run_id,
    manifestSha256: receipt.manifest_sha256,
  });
  assert.deepEqual(restored, {
    run_id: receipt.run_id,
    verified_objects: 1,
    restore_verified: true,
  });
});
test("Different encryption keys/nonces produce distinct ciphertext for the same file", () => {
  const context = {
    kind: "object",
    run_id: "test-run",
    object_id: "test-object",
  };
  assert.notDeepEqual(
    seal(Buffer.from("same"), publicKey, context),
    seal(Buffer.from("same"), publicKey, context),
  );
});
test("Envelope tampering is rejected", () => {
  const context = {
    kind: "object",
    run_id: "test-run",
    object_id: "test-object",
  };
  const encrypted = JSON.parse(
    seal(Buffer.from("synthetic"), publicKey, context),
  );
  encrypted.ciphertext = Buffer.from("tampered").toString("base64");
  assert.throws(() =>
    unseal(Buffer.from(JSON.stringify(encrypted)), privateKey, context),
  );
});
test("Substitution from another object or run is rejected", () => {
  const encrypted = seal(Buffer.from("synthetic"), publicKey, {
    kind: "object",
    run_id: "a",
    object_id: "a",
  });
  assert.throws(
    () =>
      unseal(encrypted, privateKey, {
        kind: "object",
        run_id: "b",
        object_id: "a",
      }),
    /CONTEXT_MISMATCH/,
  );
});
test("A wrong recovery key cannot decrypt", () => {
  const wrong = generateKeyPairSync("rsa", {
    modulusLength: 3072,
  }).privateKey.export({ type: "pkcs8", format: "pem" });
  const c = { kind: "object", run_id: "a", object_id: "a" };
  assert.throws(
    () => unseal(seal(Buffer.from("synthetic"), publicKey, c), wrong, c),
    /RECOVERY_KEY_MISMATCH/,
  );
});
test("An independently encrypted private PEM can verify a restore", () => {
  const encrypted = createPrivateKey(privateKey).export({
    type: "pkcs8",
    format: "pem",
    cipher: "aes-256-cbc",
    passphrase: "synthetic-passphrase",
  });
  const context = { kind: "object", run_id: "a", object_id: "a" };
  const envelope = seal(Buffer.from("synthetic"), publicKey, context);
  assert.equal(
    unseal(
      envelope,
      { key: encrypted, passphrase: "synthetic-passphrase" },
      context,
    ).toString(),
    "synthetic",
  );
  assert.throws(() =>
    unseal(envelope, { key: encrypted, passphrase: "wrong" }, context),
  );
});
test("Weak recovery keys are rejected before source access", async () => {
  const weak = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  }).publicKey.export({ type: "spki", format: "pem" });
  const f = fixture();
  await assert.rejects(runBackup({ ...f, publicKey: weak, now }), /RSA_3072/);
  assert.deepEqual(f.calls, []);
});
test("A private recovery key cannot accidentally be configured as the worker public key", async () => {
  const f = fixture();
  await assert.rejects(
    runBackup({ ...f, publicKey: privateKey, now }),
    /PUBLIC_KEY_ONLY/,
  );
  assert.deepEqual(f.calls, []);
});
test("Stale signatures cannot turn into a clean scan", async () => {
  const f = fixture();
  f.scanner.preflight = async () => ({
    engine_version: "synthetic",
    definitions_at: "2026-10-01T00:00:00Z",
  });
  await assert.rejects(runBackup({ ...f, publicKey, now }), /STALE/);
  assert.deepEqual(f.calls, []);
});
test("Infected files are recorded and encrypted for retention, never deleted", async () => {
  const f = fixture("infected");
  const result = await runBackup({ ...f, publicKey, now });
  assert.equal(result.infected, 1);
  assert.equal(result.restore_verified, false);
  assert.ok(f.calls.includes("infected"));
  assert.equal(f.remote.size, 2);
  assert.equal(
    f.bytes.toString(),
    "synthetic KYC fixture, never a customer file",
  );
});
test("Scanner failures remain error verdicts rather than becoming clean", async () => {
  const f = fixture("error");
  const result = await runBackup({ ...f, publicKey, now });
  assert.equal(result.errors, 1);
  assert.ok(!f.calls.includes("clean"));
});
test("Changed source versions abort rather than publishing a success manifest", async () => {
  const f = fixture();
  f.source.recordScan = async () => {
    throw Error("SOURCE_CHANGED");
  };
  await assert.rejects(runBackup({ ...f, publicKey, now }), /SOURCE_CHANGED/);
  assert.equal(f.remote.size, 0);
});
test("Corrupted backup readback prevents success", async () => {
  const f = fixture();
  f.destination.get = async () => Buffer.from("wrong");
  await assert.rejects(
    runBackup({ ...f, publicKey, now }),
    /BACKUP_READBACK_MISMATCH/,
  );
});
test("Restore requires the trusted manifest receipt", async () => {
  const f = fixture();
  const receipt = await runBackup({ ...f, publicKey, now });
  await assert.rejects(
    verifyRestore({
      destination: f.destination,
      privateKey,
      runId: receipt.run_id,
      manifestSha256: "0".repeat(64),
    }),
    /MANIFEST_INTEGRITY/,
  );
});
test("Backup source cannot include another application or arbitrary bucket", async () => {
  const f = fixture();
  f.item.bucket_id = "unrelated";
  await assert.rejects(runBackup({ ...f, publicKey, now }), /SOURCE_SNAPSHOT/);
  assert.deepEqual(f.calls, []);
});
test("Missing configuration fails before any network request", async () => {
  assert.throws(() => sourceFromEnv({}), /WORKER_TOKEN_REQUIRED/);
  await assert.rejects(destinationFromEnv({}), /BACKUP_CONFIGURATION_REQUIRED/);
});
test("Source requests are bound to Marketplace and cannot traverse paths", async () => {
  let request;
  const source = sourceFromEnv(
    { MARKETPLACE_STORAGE_WORKER_TOKEN: "test-only-credential".repeat(3) },
    async (url, options) => {
      request = { url, options };
      return new Response("[]");
    },
  );
  await source.page(null, now().toISOString());
  assert.ok(
    request.url.startsWith("https://zdpeaxkormwjrgllwalq.supabase.co/"),
  );
  await assert.rejects(
    source.read({ bucket_id: "kyc-documents", name: "owner/../secret" }),
    /INVALID_SOURCE_PATH/,
  );
});
test("Oversized streams stop before unbounded buffering", async () => {
  const body = (async function* () {
    yield Buffer.alloc(4);
    yield Buffer.alloc(4);
  })();
  await assert.rejects(boundedBytes(body, 5), /RESPONSE_TOO_LARGE/);
});
