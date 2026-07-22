import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "https://esm.sh/zod@3.23.8";

const MAX_AMOUNT_ZMW = 100_000_000; // 100M ZMW upper bound sanity cap
const ProcessLoanSchema = z.object({
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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_BODY_BYTES = 4 * 1024;
const RATE_LIMIT_WINDOW_SEC = 60;
const RATE_LIMIT_MAX = 20;
const NONCE_TTL_SEC = 5 * 60;
const FN_NAME = "process-loan";

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

    // Verify the user
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    if (!anonKey) {
      return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const anonClient = createClient(supabaseUrl, anonKey);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify admin/super_admin role
    const { data: roleRow } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'super_admin'])
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (rateLimited(user.id)) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" },
      });
    }
    const nonce = req.headers.get("x-request-id") ?? "";
    if (!/^[A-Za-z0-9._-]{16,128}$/.test(nonce)) {
      return new Response(JSON.stringify({ error: "Missing or invalid X-Request-Id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (isReplay(`${user.id}:${nonce}`)) {
      return new Response(JSON.stringify({ error: "Duplicate request" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawBody = await req.text();
    if (rawBody.length > MAX_BODY_BYTES) {
      return new Response(JSON.stringify({ error: "Payload too large" }), {
        status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
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
    console.error('[process-loan] unhandled error:', err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
