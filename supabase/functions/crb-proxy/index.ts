import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CRBSummary {
  credit_score: number;
  score_rating: string;
  open_accounts: number;
  probability_of_default: number;
  risk_level: string;
  recommendation: string;
  status: string;
  summary: string;
  adverse_count: number;
  total_outstanding_zmw: number;
  checked_at: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse and validate input
    const body = await req.json();
    const { nrc_number, full_name } = body;

    if (!nrc_number || typeof nrc_number !== "string" || !nrc_number.trim()) {
      return new Response(
        JSON.stringify({ error: "nrc_number is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!full_name || typeof full_name !== "string" || !full_name.trim()) {
      return new Response(
        JSON.stringify({ error: "full_name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedNRC = nrc_number.replace(/[\s-]/g, "").toUpperCase();
    const nrcPattern = /^\d{6}\/\d{2}\/\d{1}$/;
    if (!nrcPattern.test(normalizedNRC)) {
      return new Response(
        JSON.stringify({ error: "Invalid NRC format. Expected: 123456/12/1" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---------------------------------------------------------------
    // TODO: Replace this block with actual TransUnion Zambia API call
    // const TRANSUNION_API_KEY = Deno.env.get("TRANSUNION_API_KEY");
    // const tuResponse = await fetch("https://api.transunion.co.zm/...", { ... });
    // const tuData = await tuResponse.json();
    // ---------------------------------------------------------------

    // Simulated TransUnion response (remove when integrating real API)
    const score = Math.floor(Math.random() * 600) + 200;
    const openAccounts = Math.floor(Math.random() * 8) + 1;
    const hasAdverse = Math.random() > 0.7;
    const adverseCount = hasAdverse ? Math.floor(Math.random() * 3) + 1 : 0;
    const totalOutstanding = hasAdverse ? Math.floor(Math.random() * 50000) + 5000 : 0;
    const dti = Math.random() * 0.6 + 0.1;
    const probabilityOfDefault = Math.min(99, Math.max(1, Math.round((1 - score / 999) * 100 + dti * 20)));

    let scoreRating: string;
    if (score >= 700) scoreRating = "EXCELLENT";
    else if (score >= 600) scoreRating = "GOOD";
    else if (score >= 500) scoreRating = "FAIR";
    else if (score >= 400) scoreRating = "POOR";
    else scoreRating = "VERY_POOR";

    let riskLevel: string;
    let recommendation: string;
    if (!hasAdverse && score >= 600) { riskLevel = "LOW"; recommendation = "APPROVE"; }
    else if (!hasAdverse && score >= 450) { riskLevel = "MEDIUM"; recommendation = "APPROVE_WITH_CONDITIONS"; }
    else if (score >= 300) { riskLevel = "HIGH"; recommendation = "REVIEW"; }
    else { riskLevel = "VERY_HIGH"; recommendation = "DECLINE"; }

    // Build summary-only response (no raw JSON to frontend)
    const summary: CRBSummary = {
      credit_score: score,
      score_rating: scoreRating,
      open_accounts: openAccounts,
      probability_of_default: probabilityOfDefault,
      risk_level: riskLevel,
      recommendation,
      status: hasAdverse ? "ADVERSE" : "CLEAR",
      summary: hasAdverse
        ? `Adverse records found: ${adverseCount} item(s). Total outstanding: K ${totalOutstanding.toLocaleString()}`
        : "No adverse records found. Credit history is clear.",
      adverse_count: adverseCount,
      total_outstanding_zmw: totalOutstanding,
      checked_at: new Date().toISOString(),
    };

    return new Response(JSON.stringify({ success: true, data: summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("[crb-proxy] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
