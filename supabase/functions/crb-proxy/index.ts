import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "https://esm.sh/zod@3.23.8";

const CRBRequestSchema = z.object({
  nrc_number: z.string().trim().min(8, "nrc_number too short").max(20, "nrc_number too long").regex(/^[0-9\/\s-]+$/, "nrc_number contains invalid characters"),
  full_name: z.string().trim().min(2, "full_name too short").max(120, "full_name too long").regex(/^[A-Za-z][A-Za-z\s'.\-]*$/, "full_name contains invalid characters"),
}).strict();

const badRequest = (corsHeaders: Record<string, string>, message: string, details?: unknown) =>
  new Response(JSON.stringify({ error: "Bad Request", message, ...(details ? { details } : {}) }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-id",
};

const MAX_BODY_BYTES = 8 * 1024;
const RATE_LIMIT_WINDOW_SEC = 60;
const RATE_LIMIT_MAX = 10;
const NONCE_TTL_SEC = 5 * 60;
const FN_NAME = "crb-proxy";

async function pruneOld(admin: ReturnType<typeof createClient>) {
  const cutoff = new Date(Date.now() - NONCE_TTL_SEC * 1000).toISOString();
  await admin.from("edge_request_log").delete().lt("created_at", cutoff);
}

async function checkAndRecord(
  admin: ReturnType<typeof createClient>,
  userId: string,
  nonce: string,
): Promise<{ limited: boolean; replay: boolean; error?: string }> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_SEC * 1000).toISOString();
  const { count, error: countErr } = await admin
    .from("edge_request_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("function_name", FN_NAME)
    .gte("created_at", windowStart);
  if (countErr) return { limited: false, replay: false, error: countErr.message };
  if ((count ?? 0) >= RATE_LIMIT_MAX) return { limited: true, replay: false };

  const { error: insErr } = await admin
    .from("edge_request_log")
    .insert({ user_id: userId, function_name: FN_NAME, nonce });
  if (insErr) {
    if ((insErr as { code?: string }).code === "23505") return { limited: false, replay: true };
    return { limited: false, replay: false, error: insErr.message };
  }
  return { limited: false, replay: false };
}

Deno.serve(async (req) => {
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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "super_admin"])
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
    pruneOld(adminClient).catch(() => {});

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

    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return new Response(JSON.stringify({ error: "Payload too large" }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
    console.error("[crb-proxy] Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
