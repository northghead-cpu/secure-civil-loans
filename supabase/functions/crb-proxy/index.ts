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

// --- Hardening: replay + rate-limit (in-memory, per-instance) ---
const MAX_BODY_BYTES = 8 * 1024; // 8 KB is plenty for {nrc, name}
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10; // per user per minute
const NONCE_TTL_MS = 5 * 60_000; // 5 min replay window
const rateBuckets = new Map<string, number[]>();
const seenNonces = new Map<string, number>();

const rateLimited = (userId: string): boolean => {
  const now = Date.now();
  const arr = (rateBuckets.get(userId) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (arr.length >= RATE_LIMIT_MAX) { rateBuckets.set(userId, arr); return true; }
  arr.push(now); rateBuckets.set(userId, arr); return false;
};

const isReplay = (nonce: string): boolean => {
  const now = Date.now();
  for (const [k, t] of seenNonces) if (now - t > NONCE_TTL_MS) seenNonces.delete(k);
  if (seenNonces.has(nonce)) return true;
  seenNonces.set(nonce, now); return false;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json", "Allow": "POST" },
    });
  }
  const contentLength = parseInt(req.headers.get("content-length") ?? "0", 10);
  if (contentLength > MAX_BODY_BYTES) {
    return new Response(JSON.stringify({ error: "Payload too large" }), {
      status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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

    // Verify admin/super_admin role
    const { data: roleRow } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'super_admin'])
      .maybeSingle();
    if (!roleRow) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limit per admin
    if (rateLimited(user.id)) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" },
      });
    }

    // Replay protection: require X-Request-Id (UUID-like nonce) — single-use within 5 min
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

    // Parse and validate input
    const rawBody = await req.text();
    if (rawBody.length > MAX_BODY_BYTES) {
      return new Response(JSON.stringify({ error: "Payload too large" }), {
        status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let body: Record<string, unknown>;
    try { body = JSON.parse(rawBody); } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { nrc_number, full_name } = body as { nrc_number?: string; full_name?: string };

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

    // Audit log: record who ran the inquiry (best-effort, never blocks response)
    try {
      await supabase.rpc("log_audit", {
        _user_id: user.id,
        _role: roleRow.role,
        _action: "crb_inquiry",
        _record_id: normalizedNRC,
        _table_name: "crb_proxy",
        _old_value: null,
        _new_value: { status: summary.status, score_rating: summary.score_rating, request_id: nonce },
      });
    } catch (e) { console.error("[crb-proxy] audit log failed:", e); }

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
