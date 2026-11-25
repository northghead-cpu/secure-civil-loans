const PREFIX = "managed-incremental-v1";
const STATE = `${PREFIX}/checkpoint.json`;
const MAX_ENVELOPE = 4 * 1024 * 1024;
const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const SHA = /^[a-f0-9]{64}$/;
const encoder = new TextEncoder();

const jsonOptions = {
  httpMetadata: { contentType: "application/json", cacheControl: "private, no-store" },
};

export async function incrementalTick(bucket, source, now, hash, bounded) {
  const day = new Date(now + 7200000).toISOString().slice(0, 10);
  const previous = await bucket.get(STATE);
  let state = previous && await previous.json();
  if (state?.lease_until > now) return { status: "busy" };
  if (state?.status === "complete" && state.day === day)
    return { status: "complete", count: state.count };
  if (!state || state.status === "complete") {
    state = {
      day, before: new Date(now).toISOString(), run_id: crypto.randomUUID(),
      after: null, count: 0, source_bytes: 0, last_page: null, key_id: null,
      status: "running",
    };
  }
  const claim = await bucket.put(STATE, JSON.stringify({ ...state, lease_until: now + 240000 }), {
    ...jsonOptions,
    onlyIf: previous ? { etagMatches: previous.etag } : { etagDoesNotMatch: "*" },
  });
  if (!claim) return { status: "busy" };
  const listing = JSON.parse(new TextDecoder().decode(
    await bounded((await source({ action: "inventory-page", before: state.before, after: state.after })).body, 16384),
  ));
  if (!SHA.test(listing.key_id) || (state.key_id && state.key_id !== listing.key_id) ||
      !Array.isArray(listing.items) || listing.items.length > 8)
    throw Error("INVENTORY_INVALID");
  state.key_id = listing.key_id;
  const records = [];
  let after = state.after;
  for (const item of listing.items) {
    if (!UUID.test(item.id) || (after && item.id <= after) ||
        typeof item.version !== "string" || !item.version || item.version.length > 128 ||
        !Number.isInteger(item.size) || item.size < 1 || item.size > 2 * 1024 * 1024)
      throw Error("INVENTORY_INVALID");
    after = item.id;
    const identity = await hash(encoder.encode(JSON.stringify([item.id, item.version])));
    const key = `${PREFIX}/objects/${state.key_id}/${identity}.enc.json`;
    let stored = await bucket.head(key);
    if (!stored) {
      const response = await source({ action: "seal", id: item.id, version: item.version, run_id: state.run_id });
      const sha = response.headers.get("X-Backup-SHA256");
      const bytes = await bounded(response.body, MAX_ENVELOPE);
      if (!SHA.test(sha || "") || await hash(bytes) !== sha) throw Error("TRANSFER_INTEGRITY");
      await bucket.put(key, bytes, {
        onlyIf: { etagDoesNotMatch: "*" },
        httpMetadata: { contentType: "application/octet-stream", cacheControl: "private, no-store" },
        customMetadata: { sha256: sha, run_id: state.run_id, size: String(item.size) },
      });
      stored = await bucket.get(key);
      if (!stored || await hash(await bounded(stored.body, MAX_ENVELOPE)) !== stored.customMetadata?.sha256)
        throw Error("READBACK_INTEGRITY");
    }
    const metadata = stored.customMetadata;
    if (!metadata || !SHA.test(metadata.sha256) || !UUID.test(metadata.run_id) ||
        Number(metadata.size) !== item.size || stored.size < 1 || stored.size > MAX_ENVELOPE)
      throw Error("DESTINATION_INVALID");
    records.push({ ...item, key, sha256: metadata.sha256, run_id: metadata.run_id });
  }
  if (records.length) {
    const page = JSON.stringify({ previous: state.last_page, records });
    const checksum = await hash(encoder.encode(page));
    const key = `${PREFIX}/runs/${state.run_id}/pages/${checksum}.json`;
    await bucket.put(key, page, { ...jsonOptions, onlyIf: { etagDoesNotMatch: "*" } });
    state.last_page = { key, sha256: checksum };
    state.after = after;
    state.count += records.length;
    state.source_bytes += records.reduce((total, record) => total + record.size, 0);
  }
  if (records.length < 8) {
    state.status = "complete";
    state.restore_verified = false;
    const receipt = JSON.stringify(state);
    const checksum = await hash(encoder.encode(receipt));
    await bucket.put(`${PREFIX}/runs/${state.run_id}/receipts/${checksum}.json`, receipt, {
      ...jsonOptions, onlyIf: { etagDoesNotMatch: "*" },
    });
  }
  const saved = await bucket.put(STATE, JSON.stringify({ ...state, lease_until: 0 }), {
    ...jsonOptions,
    onlyIf: { etagMatches: claim.etag },
  });
  if (!saved) throw Error("CHECKPOINT_CONFLICT");
  return { status: state.status, count: state.count };
}
