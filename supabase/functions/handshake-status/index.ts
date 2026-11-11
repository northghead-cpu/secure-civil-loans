import { createClient } from "npm:@supabase/supabase-js@2.50.0";
import {
  RequestError,
  readBoundedText,
  requireJson,
  enforceRateLimit,
} from "../send-handshake-referral/security.ts";
import { verifyStatus, validateStatus } from "./protocol.mjs";
const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
Deno.serve(async (req: Request) => {
  try {
    if (req.method !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED" });
    if (req.headers.has("Origin")) return json(403, { error: "SERVER_TO_SERVER_ONLY" });
    const url = Deno.env.get("SUPABASE_URL"),
      key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
      secret = Deno.env.get("RIVERBANC_HANDSHAKE_HMAC_SECRET"),
      mapRaw = Deno.env.get("RIVERBANC_HANDSHAKE_TENANT_MAP");
    if (!url || !key || !secret || secret.length < 32 || !mapRaw)
      return json(503, { error: "STATUS_NOT_CONFIGURED" });
    requireJson(req);
    const raw = await readBoundedText(req, 4096);
    if (
      !(await verifyStatus(
        req.headers.get("x-riverbanc-timestamp") ?? "",
        raw,
        req.headers.get("x-riverbanc-signature") ?? "",
        secret,
      ))
    )
      return json(401, { error: "INVALID_SIGNATURE" });
    const input = JSON.parse(raw);
    if (!validateStatus(input)) return json(400, { error: "INVALID_STATUS_PAYLOAD" });
    const admin = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await enforceRateLimit(admin, "sender_global", "all");
    const { data: h, error: lookup } = await admin
      .from("application_handoffs")
      .select("lender_name")
      .eq("id", input.handoff_id)
      .maybeSingle();
    if (lookup) return json(503, { error: "HANDOFF_LOOKUP_UNAVAILABLE" });
    const map = JSON.parse(mapRaw);
    if (
      !h ||
      !map ||
      typeof map !== "object" ||
      Array.isArray(map) ||
      !Object.hasOwn(map, h.lender_name) ||
      map[h.lender_name] !== input.tenant_short_name
    )
      return json(403, { error: "TENANT_BINDING_MISMATCH" });
    const hash = [
      ...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw))),
    ]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("");
    const { data, error } = await admin.rpc("apply_handshake_status", {
      p_handoff_id: input.handoff_id,
      p_handshake_id: input.handshake_id,
      p_status: input.status,
      p_version: input.version,
      p_payload_hash: hash,
      p_expected_lender: h.lender_name,
    });
    if (error)
      return json(
        error.code === "23505"
          ? 409
          : error.code === "42501"
            ? 403
            : error.code === "22023"
              ? 400
              : 503,
        { error: "STATUS_NOT_APPLIED" },
      );
    return json(200, data);
  } catch (error) {
    return json(
      error instanceof RequestError ? error.status : error instanceof SyntaxError ? 400 : 500,
      { error: error instanceof RequestError ? error.code : "STATUS_REQUEST_FAILED" },
    );
  }
});
