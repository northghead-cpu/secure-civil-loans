/**
 * reference-data — cached, non-sensitive read API.
 *
 * Serves the lender product catalogue, public comparison results and
 * underwriting / CRB *reference* tables through an optional Upstash Redis
 * cache (see ../_shared/cache.ts). When Upstash env vars are absent the
 * function behaves exactly as before: straight database reads.
 *
 * Nothing customer-specific is ever cached here — no PII, no KYC data,
 * no per-borrower CRB files, no session data.
 *
 * GET  ?resource=catalogue|comparison|underwriting-reference|crb-reference
 * POST { action: "invalidate", resource?: "..." }   (admin/super_admin only)
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  CACHE_TTL,
  cacheDelPattern,
  cacheEnabled,
  cached,
} from "../_shared/cache.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extra },
  });

const RESOURCES = ["catalogue", "comparison", "underwriting-reference", "crb-reference"] as const;
type Resource = (typeof RESOURCES)[number];

/** Static underwriting reference data (no PII, safe to cache and share). */
const UNDERWRITING_REFERENCE = {
  affordability_rule: { max_share_of_net_salary: 1 / 3, jurisdiction: "ZM" },
  dti_bands: [
    { max_dti: 0.3, score_adjustment: 200, label: "LOW" },
    { max_dti: 0.5, score_adjustment: 0, label: "MEDIUM" },
    { max_dti: 1, score_adjustment: -100, label: "HIGH" },
  ],
  term_options_months: [12, 24, 36, 48, 60, 72],
  currency: "ZMW",
};

/** CRB score-band reference table — generic bands only, never a person's file. */
const CRB_REFERENCE = {
  score_bands: [
    { min: 700, rating: "EXCELLENT", risk_level: "LOW" },
    { min: 600, rating: "GOOD", risk_level: "LOW" },
    { min: 500, rating: "FAIR", risk_level: "MEDIUM" },
    { min: 400, rating: "POOR", risk_level: "HIGH" },
    { min: 0, rating: "VERY_POOR", risk_level: "VERY_HIGH" },
  ],
  recommendations: ["APPROVE", "APPROVE_WITH_CONDITIONS", "REVIEW", "DECLINE"],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: claims, error: claimsErr } = await supabase.auth.getClaims(
    authHeader.replace("Bearer ", ""),
  );
  if (claimsErr || !claims?.claims?.sub) return json({ error: "Unauthorized" }, 401);
  const userId = claims.claims.sub as string;

  try {
    // ---------------- Cache invalidation (after writes) ----------------
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (body?.action !== "invalidate") return json({ error: "Unsupported action" }, 400);

      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .in("role", ["admin", "super_admin"])
        .maybeSingle();
      if (!roleRow) return json({ error: "Forbidden" }, 403);

      const resource = typeof body.resource === "string" ? body.resource : null;
      if (resource && !RESOURCES.includes(resource as Resource)) {
        return json({ error: "Unknown resource" }, 400);
      }
      const patterns = resource
        ? [`${resource}:*`]
        : RESOURCES.map((r) => `${r}:*`);
      let purged = 0;
      for (const p of patterns) purged += await cacheDelPattern(p);
      return json({ success: true, cache_enabled: cacheEnabled(), purged });
    }

    if (req.method !== "GET") {
      return json({ error: "Method not allowed" }, 405, { Allow: "GET, POST" });
    }

    // ---------------- Cached reads ----------------
    const url = new URL(req.url);
    const resource = (url.searchParams.get("resource") ?? "catalogue") as Resource;
    if (!RESOURCES.includes(resource)) return json({ error: "Unknown resource" }, 400);

    let payload: unknown;
    let hit = false;

    if (resource === "catalogue") {
      const res = await cached("catalogue:active", CACHE_TTL.catalogue, async () => {
        const { data, error } = await supabase
          .from("bank_products")
          .select("id, bank_name, interest_rate, min_amount, max_amount, max_term_months, processing_days")
          .eq("active", true)
          .order("interest_rate", { ascending: true });
        if (error) throw error;
        return data ?? [];
      });
      payload = res.data;
      hit = res.hit;
    } else if (resource === "comparison") {
      const amount = Math.min(
        5_000_000,
        Math.max(1, Number.parseInt(url.searchParams.get("amount") ?? "100000", 10) || 100000),
      );
      const term = Math.min(
        120,
        Math.max(1, Number.parseInt(url.searchParams.get("term") ?? "60", 10) || 60),
      );
      const res = await cached(
        `comparison:${amount}:${term}`,
        CACHE_TTL.comparison,
        async () => {
          const { data, error } = await supabase
            .from("bank_products")
            .select("id, bank_name, interest_rate, min_amount, max_amount, max_term_months, processing_days")
            .eq("active", true);
          if (error) throw error;
          return (data ?? [])
            .filter((p) => amount >= (p.min_amount ?? 0) && amount <= (p.max_amount ?? Infinity))
            .map((p) => {
              const months = Math.min(term, p.max_term_months ?? term);
              const rate = Number(p.interest_rate ?? 0) / 100;
              const monthly = (amount * (1 + rate * (months / 12))) / months;
              return {
                ...p,
                term_months: months,
                monthly_payment: Math.round(monthly),
                total_cost: Math.round(monthly * months),
              };
            })
            .sort((a, b) => a.monthly_payment - b.monthly_payment);
        },
      );
      payload = res.data;
      hit = res.hit;
    } else if (resource === "underwriting-reference") {
      const res = await cached(
        "underwriting-reference:v1",
        CACHE_TTL.reference,
        async () => UNDERWRITING_REFERENCE,
      );
      payload = res.data;
      hit = res.hit;
    } else {
      const res = await cached("crb-reference:v1", CACHE_TTL.crbReference, async () => CRB_REFERENCE);
      payload = res.data;
      hit = res.hit;
    }

    return json(
      { success: true, resource, data: payload },
      200,
      {
        "X-Cache": cacheEnabled() ? (hit ? "HIT" : "MISS") : "DISABLED",
        "Cache-Control": "private, max-age=30",
      },
    );
  } catch (e) {
    console.error("[reference-data] error:", e instanceof Error ? e.message : "unknown");
    return json({ error: "Internal server error" }, 500);
  }
});
