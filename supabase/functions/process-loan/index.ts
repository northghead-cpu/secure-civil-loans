import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!);
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

    const body = await req.json();
    const { zmw_client_id, income_zmw, debt_zmw } = body;

    if (!zmw_client_id || income_zmw == null || debt_zmw == null) {
      return new Response(JSON.stringify({ error: "Missing required fields: zmw_client_id, income_zmw, debt_zmw" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (typeof income_zmw !== "number" || typeof debt_zmw !== "number" || income_zmw < 0 || debt_zmw < 0) {
      return new Response(JSON.stringify({ error: "income_zmw and debt_zmw must be non-negative numbers" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call the scoring function
    const { data: scoreData, error: scoreError } = await supabase
      .rpc("calculate_zmw_underwriting", { p_income: income_zmw, p_debt: debt_zmw });

    if (scoreError || !scoreData || scoreData.length === 0) {
      return new Response(JSON.stringify({ error: scoreError?.message || "Scoring failed" }), {
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
