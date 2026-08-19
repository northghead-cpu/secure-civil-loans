import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "https://esm.sh/zod@3.23.8";
import {
  fetchCRBReport,
  CRBProviderError,
  CRBProviderNotConfiguredError,
} from "./provider.ts";

// Strict allowlist schema — rejects unknown keys, enforces NRC format & length bounds
const CRBRequestSchema = z.object({
  nrc_number: z
    .string()
    .trim()
    .min(8, "nrc_number too short")
    .max(20, "nrc_number too long")
    .regex(/^[0-9\/\s-]+$/, "nrc_number contains invalid characters"),
  full_name: z
    .string()
    .trim()
    .min(2, "full_name too short")
    .max(120, "full_name too long")
    .regex(/^[A-Za-z][A-Za-z\s'.\-]*$/, "full_name contains invalid characters"),
}).strict();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-request-id",
};

const badRequest = (message: string, details?: unknown) =>
  new Response(JSON.stringify({ error: "Bad Request", message, ...(details ? { details } : {}) }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

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

function scoreRating(score: number): string {
  if (score >= 700) return "EXCELLENT";
  if (score >= 600) return "GOOD";
  if (score >= 500) return "FAIR";
  if (score >= 400) return "POOR";
  return "VERY_POOR";
}

function riskAndRecommendation(score: number, adverseCount: number): { riskLevel: string; recommendation: string } {
  if (adverseCount === 0 && score >= 600) return { riskLevel: "LOW", recommendation: "APPROVE" };
  if (adverseCount === 0 && score >= 450) return { riskLevel: "MEDIUM", recommendation: "APPROVE_WITH_CONDITIONS" };
  if (score >= 300) return { riskLevel: "HIGH", recommendation: "REVIEW" };
  return { riskLevel: "VERY_HIGH", recommendation: "DECLINE" };
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
      { global: { headers: { Authorization: authHeader } } },
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
    if (rawBody.length > MAX_BODY_BYTES) {
      return new Response(JSON.stringify({ error: "Payload too large" }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      return badRequest("Request body must be valid JSON");
    }
    if (typeof json !== "object" || json === null || Array.isArray(json)) {
      return badRequest("Request body must be a JSON object");
    }

    const parsed = CRBRequestSchema.safeParse(json);
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      return badRequest("Schema validation failed", {
        fieldErrors: flat.fieldErrors,
        formErrors: flat.formErrors,
      });
    }

    const { nrc_number, full_name } = parsed.data;
    const normalizedNRC = nrc_number.replace(/[\s-]/g, "").toUpperCase();
    if (!/^\d{6}\/\d{2}\/\d{1}$/.test(normalizedNRC)) {
      return badRequest("Invalid NRC format. Expected: 123456/12/1");
    }

    let report;
    try {
      report = await fetchCRBReport({ nrc_number: normalizedNRC, full_name });
    } catch (error) {
      if (error instanceof CRBProviderNotConfiguredError) {
        return new Response(JSON.stringify({ error: "CRB service is not configured" }), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "300" },
        });
      }
      if (error instanceof CRBProviderError) {
        console.error("[crb-proxy] provider error:", error.message);
        return new Response(JSON.stringify({ error: "CRB service unavailable" }), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" },
        });
      }
      throw error;
    }

    const rating = scoreRating(report.credit_score);
    const { riskLevel, recommendation } = riskAndRecommendation(
      report.credit_score,
      report.adverse_count,
    );
    const status = report.status ?? (report.adverse_count > 0 ? "ADVERSE" : "CLEAR");
    const probabilityOfDefault = Math.min(99, Math.max(0, Math.round(report.probability_of_default ?? 0)));

    const summary: CRBSummary = {
      credit_score: report.credit_score,
      score_rating: rating,
      open_accounts: report.open_accounts,
      probability_of_default: probabilityOfDefault,
      risk_level: riskLevel,
      recommendation,
      status,
      summary: report.adverse_count > 0
        ? `Adverse records found: ${report.adverse_count} item(s). Total outstanding: K ${report.total_outstanding_zmw.toLocaleString()}`
        : "No adverse records found. Credit history is clear.",
      adverse_count: report.adverse_count,
      total_outstanding_zmw: report.total_outstanding_zmw,
      checked_at: new Date().toISOString(),
    };

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
    } catch (e) {
      console.error("[crb-proxy] audit log failed:", e);
    }

    return new Response(JSON.stringify({ success: true, data: summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("[crb-proxy] Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
