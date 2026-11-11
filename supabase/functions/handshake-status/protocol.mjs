const enc = new TextEncoder();
export const STATUSES = new Set([
  "preparing",
  "sent_to_lender",
  "lender_review",
  "additional_information_requested",
  "pre_approved",
  "approved",
  "declined",
  "disbursed",
  "expired",
  "cancelled",
]);
export const uuid = (v) =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export async function signStatus(timestamp, body, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const bytes = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode("handshake-status-v1." + timestamp + "." + body),
  );
  return [...new Uint8Array(bytes)].map((v) => v.toString(16).padStart(2, "0")).join("");
}
export async function verifyStatus(timestamp, body, signature, secret, now = Date.now()) {
  if (
    !/^\d{10}$/.test(timestamp) ||
    !/^[a-f0-9]{64}$/i.test(signature) ||
    Math.abs(Math.floor(now / 1000) - Number(timestamp)) > 300
  )
    return false;
  const expected = await signStatus(timestamp, body, secret);
  let diff = 0;
  for (let i = 0; i < 64; i++)
    diff |= expected.charCodeAt(i) ^ signature.toLowerCase().charCodeAt(i);
  return diff === 0;
}
export function validateStatus(input) {
  const keys = [
    "event_id",
    "handoff_id",
    "handshake_id",
    "row_id",
    "tenant_short_name",
    "status",
    "version",
  ];
  return (
    !!input &&
    typeof input === "object" &&
    !Array.isArray(input) &&
    Object.keys(input).every((k) => keys.includes(k)) &&
    uuid(input.handoff_id) &&
    uuid(input.handshake_id) &&
    input.row_id === input.handshake_id &&
    Number.isSafeInteger(input.version) &&
    input.version > 0 &&
    input.event_id === input.handshake_id + ":" + input.version &&
    typeof input.tenant_short_name === "string" &&
    /^[A-Za-z0-9 _-]{1,80}$/.test(input.tenant_short_name) &&
    STATUSES.has(input.status)
  );
}
