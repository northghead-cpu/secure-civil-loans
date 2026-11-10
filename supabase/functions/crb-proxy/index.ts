import { RequestError, readBoundedText, requireJson } from "../_shared/request-security.ts";
import { requirePrivilegedMfa } from "../_shared/privileged-auth.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { corsHeadersFor } from "../_shared/cors.ts";
import { z } from "https://esm.sh/zod@4.6.6";

export const CRBRequestSchema = z.object({
  nrc_number: z.string().trim().min(8, "nrc_number too short").max(20, "nrc_number too long").regex(/^[0-9\/\s-]+$/, "nrc_number contains invalid characters"),
  full_name: z.string().trim().min(2, "full_name too short").max(120, "full_name too long").regex(/^[A-Za-z][A-Za-z\s'.\-]*$/, "full_name contains invalid characters"),
}).strict();

const badRequest = (corsHeaders: Record<string, string>, message: string, details?: unknown) =>
  new Response(JSON.stringify({ error: "Bad Request", message, ...(details ? { details } : {}) }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const MAX_BODY_BYTES = 8 * 1024;
const FN_NAME = "crb-proxy";
async function checkAndRecord(admin: SupabaseClient, userId: string, nonce: string) {
  const { data, error } = await admin.rpc("consume_edge_request", {
    p_user_id: userId, p_function_name: FN_NAME, p_nonce: nonce,
  });
  if (error || !data || typeof data.allowed !== "boolean") return { error: "GUARD_UNAVAILABLE", limited: false, replay: false };
  return { limited: !data.allowed && !data.replay, replay: !!data.replay };
}

Deno.serve(async (req) => {
  const corsHeaders = corsHeadersFor(req, "POST");
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Allow": "POST" },
    });
  }

  const contentLength = parseInt(req.headers.get("content-length") ?? "0", 10);
  if (contentLength > MAX_BODY_BYTES) {
    return new Response(JSON.stringify({ error: "Payload too large" }), {
      status: 413,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const authorization = await requirePrivilegedMfa({
      auth: supabase.auth,
      accountForUser: async (id) => {
        const { data, error } = await supabase.from("profiles").select("account_status").eq("user_id", id).maybeSingle();
        return { data, error };
      },
      rolesForUser: async (id) => {
        const { data, error } = await supabase.from("user_roles").select("role")
          .eq("user_id", id).in("role", ["admin", "super_admin"]).limit(1);
        return { data: data as { role: string }[] | null, error };
      },
    }, authHeader);
    if (authorization.status) {
      return new Response(JSON.stringify({ error: authorization.code }), {
        status: authorization.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = { id: authorization.userId };

    const nonce = req.headers.get("x-request-id") ?? "";
    if (!/^[A-Za-z0-9._-]{16,128}$/.test(nonce)) {
      return new Response(JSON.stringify({ error: "Missing or invalid X-Request-Id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const guard = await checkAndRecord(adminClient, user.id, nonce);
    if (guard.error) {
      console.error("[crb-proxy] guard error:", guard.error);
      return new Response(JSON.stringify({ error: "Service unavailable" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (guard.limited) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" },
      });
    }
    if (guard.replay) {
      return new Response(JSON.stringify({ error: "Duplicate request" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    requireJson(req);
    const rawBody = await readBoundedText(req, MAX_BODY_BYTES);
    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      return badRequest(corsHeaders, "Request body must be valid JSON");
    }
    if (typeof json !== "object" || json === null || Array.isArray(json)) {
      return badRequest(corsHeaders, "Request body must be a JSON object");
    }

    const parsed = CRBRequestSchema.safeParse(json);
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      return badRequest(corsHeaders, "Schema validation failed", {
        fieldErrors: flat.fieldErrors,
        formErrors: flat.formErrors,
      });
    }

    const { nrc_number: nrcNumber, full_name: fullName } = parsed.data;
    const normalizedNRC = nrcNumber.replace(/[\s-]/g, "").toUpperCase();
    const nrcPattern = /^\d{6}\/\d{2}\/\d{1}$/;
    if (!nrcPattern.test(normalizedNRC)) {
      return new Response(JSON.stringify({ error: "Invalid NRC format. Expected: 123456/12/1" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // No provider contract is embedded or guessed here. TransUnion Zambia
    // requires contracted credentials, endpoint details and field mappings.
    // Until those are supplied through deployment secrets/configuration,
    // fail closed rather than returning synthetic credit information.
    console.warn("[crb-proxy] live bureau provider is not configured", { user_id: user.id });
    return new Response(JSON.stringify({
      error: "Credit bureau provider is not configured",
      code: "CRB_PROVIDER_NOT_CONFIGURED",
    }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "3600" },
    });
  } catch (error) {
    if (error instanceof RequestError) return new Response(JSON.stringify({ error: error.code }), { status: error.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    console.error("[crb-proxy] Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
