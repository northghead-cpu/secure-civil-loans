import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CRBCheckSchema = z.object({
  nrc_number: z.string().trim().min(5, "NRC too short").max(20, "NRC too long"),
  full_name: z.string().trim().min(2, "Name too short").max(100, "Name too long"),
}).strict();

const errorResponse = (status: number, message: string, details?: unknown) =>
  new Response(JSON.stringify({ error: message, ...(details ? { details } : {}) }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return errorResponse(405, "Method not allowed");
  }

  try {
    // 1. VERIFY AUTH
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse(401, "Missing authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const anonClient = createClient(supabaseUrl, anonKey!);

    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return errorResponse(401, "Invalid or expired token");
    }

    // 2. VERIFY ADMIN ROLE
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "super_admin"])
      .maybeSingle();

    if (!roleRow) {
      return errorResponse(403, "Insufficient permissions. Admin access required.");
    }

    // 3. PARSE & VALIDATE REQUEST
    const rawBody = await req.text();
    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      return errorResponse(400, "Invalid JSON");
    }

    if (typeof json !== "object" || json === null || Array.isArray(json)) {
      return errorResponse(400, "Request body must be a JSON object");
    }

    const parsed = CRBCheckSchema.safeParse(json);
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      return errorResponse(400, "Validation failed", { fieldErrors: flat.fieldErrors });
    }

    const { nrc_number, full_name } = parsed.data;

    // 4. GET ENCRYPTED CRB API KEY FROM SECRETS
    const crbApiKey = Deno.env.get("CRB_API_KEY");
    if (!crbApiKey) {
      console.error("[crb-check] CRB_API_KEY not configured");
      return errorResponse(500, "Service misconfiguration");
    }

    // 5. CALL TRANSUNION CRB API SECURELY
    // This is a placeholder - replace with actual TransUnion endpoint
    const crbResponse = await fetch("https://api.transunion.co.zm/v1/crb-check", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${crbApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        nrc: nrc_number,
        name: full_name,
      }),
    }).catch((err) => {
      console.error("[crb-check] API call failed:", err);
      return null;
    });

    if (!crbResponse) {
      return errorResponse(503, "CRB service temporarily unavailable");
    }

    const crbData = await crbResponse.json();

    if (!crbResponse.ok) {
      console.error("[crb-check] CRB API error:", crbData);
      return errorResponse(502, "CRB check failed", crbData);
    }

    // 6. STORE AUDIT LOG
    await supabase
      .from("audit_logs")
      .insert({
        user_id: user.id,
        action: "CRB_CHECK",
        record_id: nrc_number,
        table_name: "crb_checks",
        new_value: JSON.stringify({ status: "checked", timestamp: new Date().toISOString() }),
      })
      .catch((err) => console.error("[crb-check] Audit log failed:", err));

    // 7. RETURN RESULT
    return new Response(
      JSON.stringify({
        status: "success",
        credit_score: crbData.credit_score ?? null,
        risk_level: crbData.risk_level ?? "UNKNOWN",
        flags: crbData.flags ?? [],
        checked_at: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("[crb-check] Unhandled error:", err);
    return errorResponse(500, "Internal server error");
  }
});
