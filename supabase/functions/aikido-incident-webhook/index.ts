import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const MAX_BODY_BYTES = 64 * 1024;
const MAX_DISPATCH_AGE_SECONDS = 30;
const corsHeaders = { "Content-Type": "application/json" };

type AikidoPayload = { event_type?: unknown; created_at?: unknown; dispatched_at?: unknown; workspace_id?: unknown; payload?: Record<string, unknown> };

function hex(bytes: ArrayBuffer): string { return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join(""); }
async function hmacSha256(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
}
function secureEqual(a: string, b: string): boolean { if (!a || !b || a.length !== b.length) return false; let diff = 0; for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i); return diff === 0; }
function text(value: unknown, fallback = ""): string { return typeof value === "string" ? value.trim() : fallback; }
function severity(value: unknown): "critical" | "high" | "medium" | "low" { switch (text(value).toLowerCase()) { case "critical": return "critical"; case "high": return "high"; case "medium": return "medium"; default: return "low"; } }
function clamp(value: string): string { return value.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 240) || "Aikido security event received"; }

const actionableEvents = new Set(["issue.open.created", "ci.gate.failed", "issue.sla.breached", "zen.attack", "zen.attack_wave", "zen.outbound.discovered", "scan.image.finished", "issue.severity.changed.manual"]);

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, Allow: "POST" } });
  const rawBody = await req.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) return new Response(JSON.stringify({ error: "Payload too large" }), { status: 413, headers: corsHeaders });

  const secret = Deno.env.get("AIKIDO_HMAC_SIGNING_SECRET");
  const signature = req.headers.get("X-Aikido-Webhook-Signature");
  if (!secret || !signature) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

  let payload: AikidoPayload;
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("object required");
    payload = parsed as AikidoPayload;
  } catch { return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: corsHeaders }); }

  const expected = await hmacSha256(secret, JSON.stringify(payload));
  if (!secureEqual(signature.trim().toLowerCase(), expected)) return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401, headers: corsHeaders });

  const dispatchedAt = Number(payload.dispatched_at);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(dispatchedAt) || Math.abs(now - dispatchedAt) > MAX_DISPATCH_AGE_SECONDS) return new Response(JSON.stringify({ error: "Stale webhook" }), { status: 401, headers: corsHeaders });

  const eventType = text(payload.event_type);
  if (!actionableEvents.has(eventType)) return new Response(JSON.stringify({ accepted: true, ignored: "non-actionable-event" }), { status: 200, headers: corsHeaders });

  const data = payload.payload ?? {};
  const issueId = data.issue_id;
  const workspaceId = payload.workspace_id;
  const externalEventId = `${text(workspaceId, "unknown")}:${text(issueId, "unknown")}:${eventType}:${text(payload.created_at, String(dispatchedAt))}`;
  const operation = eventType.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 80) || "aikido_event";
  const summary = clamp(`${eventType}${issueId !== undefined ? ` — issue ${String(issueId)}` : ""}${data.type ? ` (${String(data.type)})` : ""}`);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: incidentId, error } = await supabase.rpc("record_external_incident", {
    p_source: "aikido", p_external_event_id: externalEventId, p_event_type: eventType.slice(0, 120), p_operation: operation,
    p_severity: severity(data.severity), p_summary: summary, p_correlation_id: issueId === undefined ? null : `aikido:${String(issueId)}`,
  });
  if (error) { console.error("[aikido-incident-webhook] ingestion failed", error.message); return new Response(JSON.stringify({ error: "Incident ingestion failed" }), { status: 500, headers: corsHeaders }); }
  return new Response(JSON.stringify({ accepted: true, incident_id: incidentId }), { status: 200, headers: corsHeaders });
});
