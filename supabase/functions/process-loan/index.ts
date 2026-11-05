import { RequestError, readBoundedText, requireJson } from "../_shared/request-security.ts";
import { requirePrivilegedMfa } from "../_shared/privileged-auth.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { corsHeadersFor } from "../_shared/cors.ts";
import { z } from "https://esm.sh/zod@4.6.6";

const MAX_AMOUNT_ZMW = 100_000_000; // 100M ZMW upper bound sanity cap
export const ProcessLoanSchema = z.object({
  zmw_client_id: z
    .string()
    .trim()
    .min(3, "zmw_client_id too short")
    .max(64, "zmw_client_id too long")
    .regex(/^[A-Za-z0-9_\-]+$/, "zmw_client_id must be alphanumeric (with _ or -)"),
  income_zmw: z
    .number()
    .finite("income_zmw must be a finite number")
    .nonnegative("income_zmw must be >= 0")
    .max(MAX_AMOUNT_ZMW, `income_zmw exceeds max ${MAX_AMOUNT_ZMW}`),
  debt_zmw: z
    .number()
    .finite("debt_zmw must be a finite number")
    .nonnegative("debt_zmw must be >= 0")
    .max(MAX_AMOUNT_ZMW, `debt_zmw exceeds max ${MAX_AMOUNT_ZMW}`),
}).strict();

const badRequest = (corsHeaders: Record<string, string>, message: string, details?: unknown) =>
  new Response(JSON.stringify({ error: "Bad Request", message, ...(details ? { details } : {}) }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const MAX_BODY_BYTES = 4 * 1024;
const FN_NAME = "process-loan";
async function checkAndRecord(admin: SupabaseClient, userId: string, nonce: string) {
  const { data, error } = await admin.rpc("consume_edge_request", {
    p_user_id: userId, p_function_name: FN_NAME, p_nonce: nonce,
  });
  if (error || !data || typeof data.allowed !== "boolean") return { error: "GUARD_UNAVAILABLE", limited: false, replay: false };
  return { limited: !data.allowed && !data.replay, replay: !!data.replay };
}

Deno.serve(async (req) => {
  const corsHeaders = corsHeadersFor(req, "POST");
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json", "Allow": "POST" },
    });
  }
  if (parseInt(req.headers.get("content-length") ?? "0", 10) > MAX_BODY_BYTES) {
    return new Response(JSON.stringify({ error: "Payload too large" }), {
      status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const asUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const authorization = await requirePrivilegedMfa({
      auth: asUser.auth,
      accountForUser: async (id) => {
        const { data, error } = await asUser.from("profiles").select("account_status").eq("user_id", id).maybeSingle();
        return { data, error };
      },
      rolesForUser: async (id) => {
        const { data, error } = await asUser.from("user_roles").select("role")
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
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const guard = await checkAndRecord(supabase, user.id, nonce);
    if (guard.error) {
      console.error("[process-loan] guard error:", guard.error);
      return new Response(JSON.stringify({ error: "Service unavailable" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (guard.limited) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" },
      });
    }
    if (guard.replay) {
      return new Response(JSON.stringify({ error: "Duplicate request" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    requireJson(req);
    const rawBody = await readBoundedText(req, MAX_BODY_BYTES);
    let json: unknown;
    try { json = JSON.parse(rawBody); } catch {
      return badRequest(corsHeaders, "Request body must be valid JSON");
    }
    if (typeof json !== "object" || json === null || Array.isArray(json)) {
      return badRequest(corsHeaders, "Request body must be a JSON object");
    }
    const parsed = ProcessLoanSchema.safeParse(json);
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      return badRequest(corsHeaders, "Schema validation failed", {
        fieldErrors: flat.fieldErrors,
        formErrors: flat.formErrors,
      });
    }
    const { zmw_client_id, income_zmw, debt_zmw } = parsed.data;

    // Insert into underwriting_queue
    const { error: insertError } = await supabase
      .from("underwriting_queue")
      .upsert({
        user_id: user.id,
        zmw_client_id,
        income_zmw,
        debt_zmw,
        status: "processing",
      }, { onConflict: "zmw_client_id" });

    if (insertError) {
      console.error("[process-loan] insert error:", insertError);
      return new Response(JSON.stringify({ error: "Processing failed. Please try again." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call the scoring function
    const { data: scoreData, error: scoreError } = await supabase
      .rpc("calculate_zmw_underwriting", { p_income: income_zmw, p_debt: debt_zmw });

    if (scoreError || !scoreData || scoreData.length === 0) {
      console.error("[process-loan] scoring error:", scoreError);
      return new Response(JSON.stringify({ error: "Processing failed. Please try again." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { calculated_score, max_limit } = scoreData[0];

    // Determine interest rate based on score
    let interest_rate = 25.0;
    if (calculated_score >= 600) interest_rate = 15.0;
    else if (calculated_score >= 400) interest_rate = 20.0;

    // Update underwriting queue with score
    await supabase
      .from("underwriting_queue")
      .update({ score_result: calculated_score, status: "completed" })
      .eq("zmw_client_id", zmw_client_id);

    // Upsert loan result
    await supabase
      .from("loan_results")
      .upsert({
        zmw_client_id,
        user_id: user.id,
        max_limit_zmw: max_limit,
        interest_rate,
      }, { onConflict: "zmw_client_id" });

    return new Response(JSON.stringify({
      score: calculated_score,
      max_limit_zmw: max_limit,
      interest_rate,
      status: "completed",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    if (err instanceof RequestError) return new Response(JSON.stringify({ error: err.code }), { status: err.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    console.error('[process-loan] unhandled error:', err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
