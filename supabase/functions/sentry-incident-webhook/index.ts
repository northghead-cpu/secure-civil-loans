import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const MAX_BODY_BYTES = 256 * 1024;
const corsHeaders = { "Content-Type": "application/json" };

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
}

async function sha256(body: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body)));
}

function equalHex(a: string, b: string): boolean {
  const left = a.trim().toLowerCase().replace(/^sha256=/, "");
  const right = b.trim().toLowerCase().replace(/^sha256=/, "");
  if (!/^[0-9a-f]+$/.test(left) || !/^[0-9a-f]+$/.test(right) || left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function getNested(obj: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = obj;
  for (const key of path) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function severityFromSentry(level: unknown): "critical" | "high" | "medium" | "low" {
  switch (text(level).toLowerCase()) {
    case "fatal": return "critical";
    case "error": return "high";
    case "warning":
    case "warn": return "medium";
    default: return "low";
  }
}

function clampSummary(value: string): string {
  const clean = value.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
  return clean.slice(0, 240) || "Sentry alert received";
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, Allow: "POST" },
    });
  }

  const rawBody = await req.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return new Response(JSON.stringify({ error: "Payload too large" }), { status: 413, headers: corsHeaders });
  }

  const secret = Deno.env.get("SENTRY_INCIDENT_WEBHOOK_SECRET");
  const signature = req.headers.get("Sentry-Hook-Signature") ?? req.headers.get("X-Sentry-Hook-Signature");
  if (!secret || !signature) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const expected = await hmacSha256(secret, rawBody);
  if (!equalHex(signature, expected)) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401, headers: corsHeaders });
  }

  let payload: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("object required");
    payload = parsed as Record<string, unknown>;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: corsHeaders });
  }

  const eventType = text(
    req.headers.get("Sentry-Hook-Resource") ?? payload.action ?? payload.event ?? payload.type,
    "event.alert",
  );

  // The webhook is deliberately scoped to actionable Sentry alerts. Routine
  // event.created traffic should not become an incident flood.
  const level = getNested(payload, ["data", "event", "level"]) ?? payload.level;
  if (eventType !== "event.alert" && !["fatal", "error"].includes(text(level).toLowerCase())) {
    return new Response(JSON.stringify({ accepted: true, ignored: "non-actionable-event" }), {
      status: 200,
      headers: corsHeaders,
    });
  }

  const eventId = text(
    payload.id ??
      payload.event_id ??
      getNested(payload, ["data", "event", "eventID"]) ??
      getNested(payload, ["data", "event", "event_id"]) ??
      getNested(payload, ["data", "issue", "id"]),
  ) || `body:${await sha256(rawBody)}`;

  const title = text(
    getNested(payload, ["data", "issue", "title"]) ??
      getNested(payload, ["data", "event", "title"]) ??
      payload.title ??
      payload.message,
    "Sentry alert",
  );
  const operation = text(payload.type ?? payload.action, "sentry_alert").slice(0, 80) || "sentry_alert";
  const correlationId = text(
    getNested(payload, ["data", "issue", "id"]) ??
      getNested(payload, ["data", "event", "eventID"]),
  ) || null;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: incidentId, error } = await supabase.rpc("record_external_incident", {
    p_source: "sentry",
    p_external_event_id: eventId,
    p_event_type: eventType.slice(0, 120),
    p_operation: operation,
    p_severity: severityFromSentry(level),
    p_summary: clampSummary(title),
    p_correlation_id: correlationId,
  });

  if (error) {
    console.error("[sentry-incident-webhook] ingestion failed", error.message);
    return new Response(JSON.stringify({ error: "Incident ingestion failed" }), { status: 500, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ accepted: true, incident_id: incidentId }), {
    status: 200,
    headers: corsHeaders,
  });
});
