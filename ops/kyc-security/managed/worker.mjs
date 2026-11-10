// One bounded encrypted snapshot per daily invocation; no HTTP data endpoint.
const SOURCE =
  "https://zdpeaxkormwjrgllwalq.supabase.co/functions/v1/marketplace-backup-source";
const END = Date.parse("2026-12-01T00:00:00+02:00"),
  MAX_ENVELOPE = 8 * 1024 * 1024;
export async function tick(env, now = Date.now(), request = fetch) {
  if (
    env.BACKUP_ENABLED !== "true" ||
    !env.SOURCE_TOKEN ||
    now >= END ||
    now < Date.parse("2026-11-09T00:00:00Z")
  )
    return { status: "disabled" };
  const bucket = env.BACKUPS,
    day = new Date(now + 7200000).toISOString().slice(0, 10),
    stateKey = "managed-daily-v2/state/" + day + ".json";
  const existing = await bucket.get(stateKey);
  let state = existing ? await existing.json() : null;
  if (
    state?.status === "complete" ||
    state?.status === "failed" ||
    state?.lease_until > now
  )
    return { status: state?.status || "busy" };
  state ??= {
    run_id: crypto.randomUUID(),
    day,
    before: new Date(now).toISOString(),
    attempts: 0,
    status: "running",
  };
  state.lease_until = now + 240000;
  state.attempts++;
  if (state.attempts > 3) state.status = "failed";
  const claimed = await bucket.put(stateKey, JSON.stringify(state), {
    onlyIf: existing
      ? { etagMatches: existing.etag }
      : { etagDoesNotMatch: "*" },
    httpMetadata: {
      contentType: "application/json",
      cacheControl: "private, no-store",
    },
  });
  if (!claimed) return { status: "busy" };
  if (state.status === "failed") return { status: "failed" };
  const key = `managed-daily-v2/runs/${state.run_id}/snapshot.enc.json`;
  let stored = await bucket.get(key);
  if (!stored) {
    const response = await request(SOURCE, {
      method: "POST",
      redirect: "error",
      headers: {
        Authorization: `Bearer ${env.SOURCE_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "snapshot",
        before: state.before,
        run_id: state.run_id,
      }),
      signal: AbortSignal.timeout(120000),
      cache: "no-store",
    });
    if (!response.ok) throw Error("SOURCE_SNAPSHOT_FAILED");
    const sha = response.headers.get("X-Backup-SHA256"),
      keyId = response.headers.get("X-Backup-Key-Id"),
      count = Number(response.headers.get("X-Backup-Object-Count")),
      sourceBytes = Number(response.headers.get("X-Backup-Source-Bytes"));
    if (
      !/^[a-f0-9]{64}$/.test(sha || "") ||
      !/^[a-f0-9]{64}$/.test(keyId || "") ||
      !Number.isInteger(count) ||
      count < 1 ||
      count >= 100 ||
      !Number.isSafeInteger(sourceBytes) ||
      sourceBytes < 1 ||
      sourceBytes > 4 * 1024 * 1024
    )
      throw Error("SNAPSHOT_LIMIT");
    const bytes = await bounded(response.body, MAX_ENVELOPE);
    if ((await hash(bytes)) !== sha) throw Error("TRANSFER_INTEGRITY");
    await bucket.put(key, bytes, {
      onlyIf: { etagDoesNotMatch: "*" },
      customMetadata: {
        sha256: sha,
        key_id: keyId,
        count: String(count),
        source_bytes: String(sourceBytes),
      },
      httpMetadata: {
        contentType: "application/octet-stream",
        cacheControl: "private, no-store",
      },
    });
    stored = await bucket.get(key);
  }
  if (!stored || stored.size > MAX_ENVELOPE) throw Error("DESTINATION_MISSING");
  const sha = await hash(await bounded(stored.body, MAX_ENVELOPE));
  if (sha !== stored.customMetadata?.sha256) throw Error("READBACK_INTEGRITY");
  state = {
    ...state,
    status: "complete",
    lease_until: 0,
    key,
    sha256: sha,
    key_id: stored.customMetadata.key_id,
    count: Number(stored.customMetadata.count),
    source_bytes: Number(stored.customMetadata.source_bytes),
    encrypted_readback_verified: true,
    restore_verified: false,
    completed_at: new Date(now).toISOString(),
  };
  const saved = await bucket.put(stateKey, JSON.stringify(state), {
    onlyIf: { etagMatches: claimed.etag },
    httpMetadata: {
      contentType: "application/json",
      cacheControl: "private, no-store",
    },
  });
  if (!saved) throw Error("CHECKPOINT_CONFLICT");
  return { status: "complete", count: state.count };
}
async function bounded(stream, max) {
  const reader = stream.getReader(),
    chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max) throw Error("SIZE_LIMIT");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
async function hash(bytes) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
export default {
  fetch() {
    return new Response("Not found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(
      tick(env)
        .then((result) =>
          console.log(JSON.stringify({ event: "backup_daily", ...result })),
        )
        .catch(() =>
          console.error(JSON.stringify({ event: "backup_daily_failed" })),
        ),
    );
  },
};
