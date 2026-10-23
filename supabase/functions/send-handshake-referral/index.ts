import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeadersFor } from "../_shared/cors.ts";

const MAX_CLOCK_SKEW_SECONDS = 300;

function json(status: number, body: Record<string, unknown>, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmac(timestamp: string, body: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(timestamp + "." + body),
  ));
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

Deno.serve(async (req: Request) => {
  const cors = corsHeadersFor(req, "POST");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED" }, cors);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "UNAUTHORIZED" }, cors);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const handshakeUrl = Deno.env.get("HANDSHAKE_API_URL");
  const hmacSecret = Deno.env.get("RIVERBANC_HANDSHAKE_HMAC_SECRET");
  const tenantMapRaw = Deno.env.get("RIVERBANC_HANDSHAKE_TENANT_MAP");

  if (!supabaseUrl || !publishableKey || !serviceRoleKey || !handshakeUrl ||
      !hmacSecret || hmacSecret.length < 32 || !tenantMapRaw) {
    console.error("[send-handshake-referral] server configuration incomplete");
    return json(503, { error: "HANDSHAKE_INTEGRATION_NOT_CONFIGURED" }, cors);
  }

  let tenantMap: Record<string, string>;
  try {
    const parsed: unknown = JSON.parse(tenantMapRaw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid map");
    tenantMap = parsed as Record<string, string>;
  } catch {
    console.error("[send-handshake-referral] tenant map is invalid JSON");
    return json(503, { error: "HANDSHAKE_INTEGRATION_NOT_CONFIGURED" }, cors);
  }

  let input: unknown;
  try { input = await req.json(); } catch {
    return json(400, { error: "INVALID_JSON" }, cors);
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return json(400, { error: "INVALID_REQUEST" }, cors);
  }
  const handoffId = (input as Record<string, unknown>).handoff_id;
  if (typeof handoffId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(handoffId)) {
    return json(400, { error: "INVALID_HANDOFF_ID" }, cors);
  }

  const asUser = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await asUser.auth.getUser();
  if (authError || !authData.user) return json(401, { error: "UNAUTHORIZED" }, cors);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: handoff, error: handoffError } = await admin
    .from("application_handoffs")
    .select("id,user_id,lender_name,requested_amount,term_months,authorization_version,authorized_at,authorization_signature,status")
    .eq("id", handoffId)
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (handoffError) {
    console.error("[send-handshake-referral] failed to load handoff", handoffError.code ?? "UNKNOWN");
    return json(500, { error: "HANDOFF_LOOKUP_FAILED" }, cors);
  }
  if (!handoff) return json(404, { error: "HANDOFF_NOT_FOUND" }, cors);
  if (handoff.status !== "authorized" || !handoff.authorized_at ||
      !handoff.authorization_signature || !handoff.authorization_version) {
    return json(409, { error: "HANDOFF_NOT_AUTHORIZED" }, cors);
  }
  if (typeof handoff.requested_amount !== "number" || handoff.requested_amount <= 0) {
    return json(409, { error: "HANDOFF_AMOUNT_INVALID" }, cors);
  }

  const tenantShortName = tenantMap[handoff.lender_name];
  if (typeof tenantShortName !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(tenantShortName)) {
    console.error("[send-handshake-referral] no tenant mapping for selected lender");
    return json(409, { error: "LENDER_TENANT_NOT_CONFIGURED" }, cors);
  }

  // Transfer only a reference, the selected amount, and the employer name if the user
  // explicitly authorized the lender handoff. Do not transfer NRC, TPIN, salary,
  // bank details, KYC files, payslips, or underwriting documents through this endpoint.
  const reference = `RBH-${handoff.id}`;
  const payload = {
    event_id: handoff.id,
    tenant_short_name: tenantShortName,
    reference,
    applicant_alias: `Riverbanc referral ${handoff.id}`,
    requested_amount_zmw: handoff.requested_amount,
  };
  const rawBody = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = await hmac(timestamp, rawBody, hmacSecret);

  let target: URL;
  try {
    target = new URL(handshakeUrl);
    if (target.protocol !== "https:") throw new Error("HTTPS required");
  } catch {
    console.error("[send-handshake-referral] HANDSHAKE_API_URL must be a valid HTTPS URL");
    return json(503, { error: "HANDSHAKE_INTEGRATION_NOT_CONFIGURED" }, cors);
  }

  let response: Response;
  try {
    response = await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-riverbanc-timestamp": timestamp,
        "x-riverbanc-signature": signature,
      },
      body: rawBody,
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    console.error("[send-handshake-referral] Handshake request failed at transport layer");
    return json(502, { error: "HANDSHAKE_UNREACHABLE", handoff_id: handoff.id }, cors);
  }

  const responseBody = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    console.error("[send-handshake-referral] Handshake rejected request", response.status);
    return json(response.status === 409 ? 409 : response.status >= 500 ? 502 : 400, {
      error: "HANDSHAKE_REFERRAL_REJECTED",
      handoff_id: handoff.id,
    }, cors);
  }

  await admin.from("audit_logs").insert({
    user_id: authData.user.id,
    role: "borrower",
    action_performed: "handshake_referral_accepted",
    record_id: handoff.id,
    table_name: "application_handoffs",
    new_value: {
      destination: "handshake",
      handshake_reference: reference,
      event_id: handoff.id,
      accepted_at: new Date().toISOString(),
    },
  }).then(({ error }) => {
    if (error) console.error("[send-handshake-referral] audit insert failed", error.code ?? "UNKNOWN");
  });

  return json(201, {
    accepted: true,
    handoff_id: handoff.id,
    handshake_reference: reference,
    handshake_status: responseBody.status ?? "queued",
  }, cors);
});
