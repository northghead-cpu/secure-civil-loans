import { randomUUID } from "node:crypto";
import { seal, unseal, digest, publicKeyId } from "./envelope.mjs";
const BUCKETS = new Set(["kyc-documents", "payslips", "payment-receipts"]);
export async function runBackup({
  source,
  destination,
  scanner,
  publicKey,
  now = () => new Date(),
}) {
  const keyId = publicKeyId(publicKey); // Fail before reading any borrower data.
  const engine = await scanner.preflight();
  const age = now().getTime() - Date.parse(engine.definitions_at);
  if (!Number.isFinite(age) || age < -300000 || age > 48 * 3600000)
    throw Error("STALE_ANTIVIRUS_DEFINITIONS");
  const runId = randomUUID(),
    before = now().toISOString(),
    entries = [],
    seen = new Set();
  let after = null;
  for (;;) {
    const items = await source.page(after, before);
    if (!Array.isArray(items) || items.length > 100)
      throw Error("INVALID_SOURCE_PAGE");
    if (!items.length) break;
    for (const item of items) {
      if (
        !BUCKETS.has(item.bucket_id) ||
        typeof item.id !== "string" ||
        typeof item.version !== "string" ||
        !item.version ||
        seen.has(item.id) ||
        (after !== null && item.id <= after)
      )
        throw Error("SOURCE_SNAPSHOT_CHANGED");
      seen.add(item.id);
      after = item.id;
      const bytes = await source.read(item);
      try {
        if (
          !bytes.length ||
          bytes.length > 10 * 1024 * 1024 ||
          bytes.length !== Number(item.metadata?.size)
        )
          throw Error("INVALID_SOURCE_SIZE");
        const sha256 = digest(bytes),
          verdict = await scanner.scan(bytes);
        if (!["clean", "infected", "error"].includes(verdict))
          throw Error("INVALID_SCAN_VERDICT");
        // The service-only RPC rejects a different current object version.
        await source.recordScan(item, sha256, verdict, engine);
        const objectId = randomUUID(),
          key = `${runId}/${objectId}.enc`;
        const encrypted = seal(bytes, publicKey, {
          kind: "object",
          run_id: runId,
          object_id: objectId,
        });
        await destination.put(key, encrypted);
        if (digest(await destination.get(key)) !== digest(encrypted))
          throw Error("BACKUP_READBACK_MISMATCH");
        entries.push({
          object_id: objectId,
          key,
          source: {
            bucket: item.bucket_id,
            path: item.name,
            id: item.id,
            version: item.version,
          },
          sha256,
          size: bytes.length,
          verdict,
          encrypted_sha256: digest(encrypted),
        });
      } finally {
        bytes.fill(0);
      }
    }
    if (items.length < 100) break;
  }
  if (!entries.length) throw Error("EMPTY_BACKUP");
  const manifest = {
    run_id: runId,
    created_at: before,
    key_id: keyId,
    engine,
    entries,
  };
  const manifestKey = `${runId}/manifest.enc`;
  const encrypted = seal(Buffer.from(JSON.stringify(manifest)), publicKey, {
    kind: "manifest",
    run_id: runId,
    object_id: "manifest",
  });
  await destination.put(manifestKey, encrypted);
  const sha256 = digest(encrypted);
  if (digest(await destination.get(manifestKey)) !== sha256)
    throw Error("BACKUP_READBACK_MISMATCH");
  return {
    run_id: runId,
    manifest_key: manifestKey,
    manifest_sha256: sha256,
    objects: entries.length,
    infected: entries.filter((x) => x.verdict === "infected").length,
    errors: entries.filter((x) => x.verdict === "error").length,
    encrypted_readback_verified: true,
    restore_verified: false,
  };
}
export async function verifyRestore({
  destination,
  privateKey,
  runId,
  manifestSha256,
}) {
  if (!/^[0-9a-f-]{36}$/.test(runId) || !/^[0-9a-f]{64}$/.test(manifestSha256))
    throw Error("TRUSTED_BACKUP_RECEIPT_REQUIRED");
  const encryptedManifest = await destination.get(`${runId}/manifest.enc`);
  if (digest(encryptedManifest) !== manifestSha256)
    throw Error("MANIFEST_INTEGRITY_FAILURE");
  const rawManifest = unseal(encryptedManifest, privateKey, {
    kind: "manifest",
    run_id: runId,
    object_id: "manifest",
  });
  let manifest;
  try {
    manifest = JSON.parse(rawManifest.toString("utf8"));
  } finally {
    rawManifest.fill(0);
  }
  if (
    manifest.run_id !== runId ||
    !Array.isArray(manifest.entries) ||
    !manifest.entries.length
  )
    throw Error("INVALID_MANIFEST");
  let verified = 0;
  for (const item of manifest.entries) {
    if (item.key !== `${runId}/${item.object_id}.enc`)
      throw Error("INVALID_BACKUP_OBJECT_KEY");
    const encrypted = await destination.get(item.key);
    if (digest(encrypted) !== item.encrypted_sha256)
      throw Error("BACKUP_INTEGRITY_FAILURE");
    const restored = unseal(encrypted, privateKey, {
      kind: "object",
      run_id: runId,
      object_id: item.object_id,
    });
    try {
      if (restored.length !== item.size || digest(restored) !== item.sha256)
        throw Error("RESTORE_HASH_MISMATCH");
      verified++;
    } finally {
      restored.fill(0);
    }
  }
  return { run_id: runId, verified_objects: verified, restore_verified: true };
}
