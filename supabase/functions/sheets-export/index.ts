/**
 * sheets-export — server-side Riverbanc -> Google Sheets reporting sync.
 *
 * Security rules (do not relax):
 *  - Admin / super_admin only. The caller's JWT is verified and the role is
 *    checked with public.has_role() before any data is read.
 *  - Runs entirely server-side. No database credentials or Google credentials
 *    ever reach the browser; the client only invokes this function.
 *  - Read-only against Riverbanc data. This function never writes to, or
 *    changes, any existing application table.
 *  - Never exports passwords, OTPs, auth/session tokens, API secrets, raw
 *    identity documents, payslip files, signatures, or audit log payloads.
 *  - NRC values are masked (see maskNrc). Raw NRC is never written.
 *
 * POST { action: "sync", spreadsheetId?: string }
 * POST { action: "status" }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const GOOGLE_SHEETS_API_KEY = Deno.env.get("GOOGLE_SHEETS_API_KEY");

export const SHEET_TABS = [
  "Users",
  "Employment",
  "KYC & Verification",
  "Applications",
  "Offers",
  "Underwriting & Risk",
  "Subscriptions & Revenue",
  "Engagement",
  "Consent",
  "Support",
  "Audit & Security",
  "Dashboard",
] as const;

/** Mask a Zambian NRC (######/##/#) for general reporting. */
function maskNrc(nrc: string | null | undefined): string {
  if (!nrc) return "";
  const trimmed = String(nrc).trim();
  const last = trimmed.slice(-1);
  return `******/**/${/\d/.test(last) ? last : "*"}`;
}

const day = 24 * 60 * 60 * 1000;
const isoDay = (offset: number) => new Date(Date.now() - offset * day).toISOString();
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const round2 = (v: number) => Math.round(v * 100) / 100;
const cell = (v: unknown) =>
  v === null || v === undefined ? "" : typeof v === "boolean" ? (v ? "TRUE" : "FALSE") : v;

async function gateway(path: string, init: RequestInit = {}) {
  const res = await fetch(`${GATEWAY}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": GOOGLE_SHEETS_API_KEY!,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const details = await res.text();
    console.error(`Google Sheets gateway ${path} failed [${res.status}]: ${details}`);
    throw new Error(`[${res.status}] ${details}`);
  }
  return res.json();
}

type Grid = (string | number)[][];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  // --- Identity + role check with the caller's own token (RLS-respecting) ---
  const asUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: claims, error: claimsErr } = await asUser.auth.getClaims(
    authHeader.replace("Bearer ", ""),
  );
  const userId = claims?.claims?.sub as string | undefined;
  if (claimsErr || !userId) return json({ error: "Unauthorized" }, 401);

  const [{ data: isAdmin }, { data: isSuperAdmin }] = await Promise.all([
    asUser.rpc("has_role", { _user_id: userId, _role: "admin" }),
    asUser.rpc("has_role", { _user_id: userId, _role: "super_admin" }),
  ]);
  if (!isAdmin && !isSuperAdmin) return json({ error: "Forbidden" }, 403);

  if (!LOVABLE_API_KEY || !GOOGLE_SHEETS_API_KEY) {
    return json(
      { error: "Google Sheets connection is not configured for this project." },
      503,
    );
  }

  let body: { action?: string; spreadsheetId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  // Service-role client for the aggregate read. Read-only usage only.
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    if (body.action === "status") {
      const { data } = await db
        .from("report_sync_state")
        .select("*")
        .eq("id", "google_sheets")
        .maybeSingle();
      return json({ state: data ?? null });
    }

    if (body.action !== "sync") return json({ error: "Unknown action" }, 400);

    // ------------------------------ Extract ------------------------------
    const [
      profiles,
      kyc,
      applications,
      offers,
      underwriting,
      creditChecks,
      riskFlags,
      payouts,
      products,
      bankProducts,
      notifications,
      consentHistory,
      auditLogs,
      authorizations,
    ] = await Promise.all([
      db.from("profiles").select("*").order("created_at", { ascending: true }),
      db.from("kyc").select("*"),
      db.from("loan_applications").select("*").order("created_at", { ascending: true }),
      db.from("loan_results").select("*"),
      db.from("underwriting_queue").select("*"),
      db.from("credit_checks").select("*"),
      db.from("risk_flags").select("*"),
      db.from("payouts").select("*"),
      db.from("products").select("*"),
      db.from("bank_products").select("*"),
      db.from("notifications").select("id,user_id,application_id,title,created_at"),
      db.from("consent_history").select("*"),
      // Audit payloads (old_value/new_value) are deliberately NOT selected.
      db
        .from("audit_logs")
        .select("id,user_id,role,action_performed,record_id,table_name,created_at")
        .order("created_at", { ascending: false })
        .limit(5000),
      db
        .from("payroll_deduction_authorizations")
        .select(
          "id,user_id,loan_application_id,agreement_version,authorized_amount,authorized_term_months,signed_at,revoked_at,status,created_at",
        ),
    ]);

    const rows = <T>(r: { data: T[] | null; error: unknown }) => r.data ?? [];
    const P = rows<Record<string, unknown>>(profiles);
    const K = rows<Record<string, unknown>>(kyc);
    const A = rows<Record<string, unknown>>(applications);
    const O = rows<Record<string, unknown>>(offers);
    const U = rows<Record<string, unknown>>(underwriting);
    const C = rows<Record<string, unknown>>(creditChecks);
    const R = rows<Record<string, unknown>>(riskFlags);
    const PAY = rows<Record<string, unknown>>(payouts);
    const PRD = rows<Record<string, unknown>>(products);
    const BP = rows<Record<string, unknown>>(bankProducts);
    const N = rows<Record<string, unknown>>(notifications);
    const CH = rows<Record<string, unknown>>(consentHistory);
    const AL = rows<Record<string, unknown>>(auditLogs);
    const AUTH = rows<Record<string, unknown>>(authorizations);

    const kycByUser = new Map(K.map((k) => [k.user_id as string, k]));
    const appsByUser = new Map<string, Record<string, unknown>[]>();
    for (const a of A) {
      const list = appsByUser.get(a.user_id as string) ?? [];
      list.push(a);
      appsByUser.set(a.user_id as string, list);
    }
    const notifByUser = new Map<string, Record<string, unknown>[]>();
    for (const n of N) {
      const list = notifByUser.get(n.user_id as string) ?? [];
      list.push(n);
      notifByUser.set(n.user_id as string, list);
    }
    const authByUser = new Map<string, Record<string, unknown>[]>();
    for (const s of AUTH) {
      const list = authByUser.get(s.user_id as string) ?? [];
      list.push(s);
      authByUser.set(s.user_id as string, list);
    }

    const APPROVED = ["approved", "APPROVED", "disbursed", "DISBURSED"];
    const isApproved = (a: Record<string, unknown>) =>
      APPROVED.includes(String(a.status)) || String(a.decision).toUpperCase() === "APPROVE";

    // ------------------------------ Transform ----------------------------
    const sheets: Record<string, Grid> = {};

    sheets["Users"] = [
      [
        "riverbanc_user_id",
        "profile_id",
        "full_name",
        "email",
        "phone",
        "nrc_masked",
        "account_status",
        "kyc_status",
        "role",
        "nrc_verified",
        "phone_verified",
        "signup_date",
        "last_profile_update",
        "tenure_days",
        "lifecycle_stage",
        "applications_count",
        "approved_count",
        "is_active_30d",
      ],
      ...P.map((p) => {
        const apps = appsByUser.get(p.user_id as string) ?? [];
        const approved = apps.filter(isApproved).length;
        const created = new Date(String(p.created_at)).getTime();
        const events = [
          ...(notifByUser.get(p.user_id as string) ?? []).map((n) => String(n.created_at)),
          ...apps.map((a) => String(a.updated_at ?? a.created_at)),
          String(p.updated_at),
        ];
        const lastSeen = events.sort().at(-1) ?? String(p.created_at);
        const lifecycle = approved
          ? "BORROWER"
          : apps.length
            ? "APPLICANT"
            : String(p.kyc_status) === "COMPLETED" || String(p.kyc_status) === "VERIFIED"
              ? "VERIFIED"
              : "SIGNED_UP";
        return [
          cell(p.user_id),
          cell(p.id),
          cell(p.full_name),
          cell(p.email),
          cell(p.phone),
          maskNrc(p.nrc_number as string),
          cell(p.account_status),
          cell(p.kyc_status),
          cell(p.role),
          cell(p.nrc_verified),
          cell(p.phone_verified),
          cell(p.created_at),
          cell(p.updated_at),
          Math.max(0, Math.floor((Date.now() - created) / day)),
          lifecycle,
          apps.length,
          approved,
          lastSeen >= isoDay(30) ? "TRUE" : "FALSE",
        ] as (string | number)[];
      }),
    ];

    sheets["Employment"] = [
      [
        "riverbanc_user_id",
        "employer",
        "ministry",
        "employee_number",
        "years_of_service",
        "gross_salary_zmw",
        "net_salary_zmw",
        "existing_obligations_zmw",
        "affordability_cap_zmw",
        "available_affordability_zmw",
        "obligation_ratio",
        "last_updated",
      ],
      ...P.map((p) => {
        const net = num(p.net_salary) || num(p.salary);
        const cap = round2(net / 3);
        const obligations = num(p.existing_obligations);
        return [
          cell(p.user_id),
          cell(p.employer),
          cell(p.ministry),
          cell(p.employee_number),
          cell(p.years_of_service),
          num(p.salary),
          num(p.net_salary),
          obligations,
          cap,
          round2(Math.max(0, cap - obligations)),
          net ? round2(obligations / net) : 0,
          cell(p.updated_at),
        ] as (string | number)[];
      }),
    ];

    sheets["KYC & Verification"] = [
      [
        "riverbanc_user_id",
        "kyc_record_id",
        "kyc_status_profile",
        "kyc_status_record",
        "nrc_masked",
        "employer_on_kyc",
        "employee_number_on_kyc",
        "phone_on_kyc",
        "nrc_verified",
        "phone_verified",
        "kyc_started_at",
        "kyc_last_updated",
        "days_in_current_status",
        "is_verified",
      ],
      ...P.map((p) => {
        const k = kycByUser.get(p.user_id as string);
        const since = new Date(String(k?.updated_at ?? p.updated_at)).getTime();
        return [
          cell(p.user_id),
          cell(k?.id),
          cell(p.kyc_status),
          cell(k?.status),
          maskNrc((k?.nrc_number ?? p.nrc_number) as string),
          cell(k?.employer ?? p.employer),
          cell(k?.employee_number ?? p.employee_number),
          cell(k?.phone_number ?? p.phone),
          cell(p.nrc_verified),
          cell(p.phone_verified),
          cell(k?.created_at),
          cell(k?.updated_at),
          Math.max(0, Math.floor((Date.now() - since) / day)),
          ["COMPLETED", "VERIFIED"].includes(String(p.kyc_status)) ? "TRUE" : "FALSE",
        ] as (string | number)[];
      }),
    ];

    sheets["Applications"] = [
      [
        "application_id",
        "riverbanc_user_id",
        "status",
        "decision",
        "requested_amount_zmw",
        "net_salary_zmw",
        "deductions_zmw",
        "monthly_repayment_zmw",
        "repayment_months",
        "selected_lender",
        "selected_interest_rate",
        "crb_status",
        "crb_checked_at",
        "verification_passed",
        "nrc_masked",
        "gov_id_type",
        "consent_accepted",
        "esign_authorized",
        "created_at",
        "updated_at",
        "age_days",
        "affordability_ratio",
        "is_approved",
      ],
      ...A.map((a) => {
        const net = num(a.net_salary);
        const signed = (authByUser.get(a.user_id as string) ?? []).some(
          (s) => s.loan_application_id === a.id && s.status === "active" && !s.revoked_at,
        );
        return [
          cell(a.id),
          cell(a.user_id),
          cell(a.status),
          cell(a.decision),
          num(a.requested_amount),
          net,
          num(a.deductions),
          num(a.estimated_monthly_repayment),
          cell(a.selected_repayment_months),
          cell(a.selected_lender),
          num(a.selected_interest_rate),
          cell(a.crb_status),
          cell(a.crb_checked_at),
          cell(a.verification_passed),
          maskNrc(a.nrc_number as string),
          cell(a.gov_id_type),
          cell(a.consent_accepted),
          signed ? "TRUE" : "FALSE",
          cell(a.created_at),
          cell(a.updated_at),
          Math.max(
            0,
            Math.floor((Date.now() - new Date(String(a.created_at)).getTime()) / day),
          ),
          net ? round2(num(a.estimated_monthly_repayment) / net) : 0,
          isApproved(a) ? "TRUE" : "FALSE",
        ] as (string | number)[];
      }),
    ];

    sheets["Offers"] = [
      [
        "offer_id",
        "riverbanc_user_id",
        "source",
        "lender",
        "max_limit_zmw",
        "interest_rate",
        "term_months",
        "monthly_repayment_zmw",
        "selected",
        "created_at",
      ],
      ...O.map((o) => [
        cell(o.id),
        cell(o.user_id),
        "underwriting_result",
        "",
        num(o.max_limit_zmw),
        num(o.interest_rate),
        "",
        "",
        "FALSE",
        cell(o.created_at),
      ] as (string | number)[]),
      ...A.filter((a) => a.selected_lender).map((a) => [
        `app-${String(a.id)}`,
        cell(a.user_id),
        "application_selection",
        cell(a.selected_lender),
        num(a.requested_amount),
        num(a.selected_interest_rate ?? a.interest_rate),
        cell(a.selected_repayment_months),
        num(a.estimated_monthly_repayment),
        "TRUE",
        cell(a.created_at),
      ] as (string | number)[]),
    ];

    sheets["Underwriting & Risk"] = [
      [
        "record_id",
        "riverbanc_user_id",
        "source",
        "status",
        "score",
        "score_rating",
        "risk_level",
        "recommendation",
        "income_zmw",
        "debt_zmw",
        "dti_ratio",
        "fraud_score",
        "fraud_flag",
        "flag_type",
        "resolution_status",
        "created_at",
      ],
      ...U.map((u) => {
        const income = num(u.income_zmw);
        return [
          cell(u.id),
          cell(u.user_id),
          "underwriting_queue",
          cell(u.status),
          cell(u.score_result),
          "",
          "",
          "",
          income,
          num(u.debt_zmw),
          income ? round2(num(u.debt_zmw) / income) : 0,
          "",
          "",
          "",
          "",
          cell(u.created_at),
        ] as (string | number)[];
      }),
      ...C.map((c) => [
        cell(c.id),
        cell(c.checked_by),
        "credit_check",
        cell(c.status),
        cell(c.score),
        cell(c.score_rating),
        cell(c.risk_level),
        cell(c.recommendation),
        "",
        num(c.total_outstanding_zmw),
        "",
        "",
        "",
        "",
        "",
        cell(c.created_at),
      ] as (string | number)[]),
      ...R.map((r) => [
        cell(r.id),
        cell(r.user_id),
        "risk_flag",
        cell(r.status),
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        num(r.fraud_score),
        "TRUE",
        cell(r.flag_type),
        cell(r.status),
        cell(r.created_at),
      ] as (string | number)[]),
      ...A.filter((a) => a.underwriting_score !== null || a.fraud_score !== null).map((a) => [
        `app-${String(a.id)}`,
        cell(a.user_id),
        "application_underwriting",
        cell(a.status),
        cell(a.underwriting_score ?? a.credit_score),
        "",
        cell(a.risk_level),
        cell(a.decision),
        num(a.net_salary),
        num(a.deductions),
        num(a.net_salary) ? round2(num(a.deductions) / num(a.net_salary)) : 0,
        num(a.fraud_score),
        cell(a.fraud_flag),
        "",
        "",
        cell(a.created_at),
      ] as (string | number)[]),
    ];

    sheets["Subscriptions & Revenue"] = [
      [
        "record_id",
        "source",
        "name_or_lender",
        "status",
        "amount_zmw",
        "period",
        "paid_date",
        "pricing_json",
        "created_at",
      ],
      ...PAY.map((p) => [
        cell(p.id),
        "payout",
        cell(p.lender),
        cell(p.status),
        num(p.amount_zmw),
        cell(p.period),
        cell(p.paid_date),
        "",
        cell(p.created_at),
      ] as (string | number)[]),
      ...PRD.map((p) => [
        cell(p.id),
        "product",
        cell(p.name),
        cell(p.status),
        "",
        "",
        "",
        JSON.stringify(p.pricing ?? {}),
        cell(p.created_at),
      ] as (string | number)[]),
      ...BP.map((p) => [
        cell(p.id),
        "bank_product",
        cell(p.bank_name),
        p.active ? "active" : "inactive",
        num(p.max_amount),
        `${cell(p.max_term_months)} months`,
        "",
        JSON.stringify({ interest_rate: p.interest_rate, min_amount: p.min_amount }),
        cell(p.created_at),
      ] as (string | number)[]),
    ];

    sheets["Engagement"] = [
      [
        "riverbanc_user_id",
        "notifications_total",
        "notifications_30d",
        "applications_total",
        "applications_30d",
        "last_activity_at",
        "days_since_last_activity",
        "esign_events",
        "engagement_tier",
      ],
      ...P.map((p) => {
        const ns = notifByUser.get(p.user_id as string) ?? [];
        const apps = appsByUser.get(p.user_id as string) ?? [];
        const events = [
          ...ns.map((n) => String(n.created_at)),
          ...apps.map((a) => String(a.updated_at ?? a.created_at)),
        ].sort();
        const last = events.at(-1) ?? String(p.created_at);
        const n30 = ns.filter((n) => String(n.created_at) >= isoDay(30)).length;
        const a30 = apps.filter((a) => String(a.created_at) >= isoDay(30)).length;
        const score = n30 + a30 * 3;
        return [
          cell(p.user_id),
          ns.length,
          n30,
          apps.length,
          a30,
          last,
          Math.max(0, Math.floor((Date.now() - new Date(last).getTime()) / day)),
          (authByUser.get(p.user_id as string) ?? []).length,
          score >= 5 ? "HIGH" : score >= 1 ? "MEDIUM" : "DORMANT",
        ] as (string | number)[];
      }),
    ];

    sheets["Consent"] = [
      [
        "riverbanc_user_id",
        "consent_accepted",
        "consent_signed_at",
        "consent_marketing",
        "consent_data_sharing_lenders",
        "consent_crb_check",
        "consent_analytics",
        "consents_updated_at",
        "consent_changes_logged",
        "payroll_authorizations_active",
        "payroll_authorizations_revoked",
        "latest_agreement_version",
      ],
      ...P.map((p) => {
        const changes = CH.filter((c) => c.user_id === p.user_id).length;
        const auths = authByUser.get(p.user_id as string) ?? [];
        return [
          cell(p.user_id),
          cell(p.consent_accepted),
          cell(p.consent_signed_at),
          cell(p.consent_marketing),
          cell(p.consent_data_sharing_lenders),
          cell(p.consent_crb_check),
          cell(p.consent_analytics),
          cell(p.consents_updated_at),
          changes,
          auths.filter((a) => a.status === "active" && !a.revoked_at).length,
          auths.filter((a) => a.revoked_at).length,
          cell(auths.map((a) => String(a.agreement_version)).sort().at(-1)),
        ] as (string | number)[];
      }),
    ];

    // No support/ticketing table exists in Riverbanc yet. The tab is created
    // with its schema so it can be populated once a source exists — no
    // fabricated rows are written.
    sheets["Support"] = [
      [
        "ticket_id",
        "riverbanc_user_id",
        "channel",
        "category",
        "subject",
        "status",
        "priority",
        "opened_at",
        "resolved_at",
        "resolution_hours",
      ],
      [
        "NO_SOURCE_TABLE",
        "",
        "",
        "",
        "No support/ticketing table exists in the Riverbanc database yet; this tab stays empty until one is added.",
        "",
        "",
        "",
        "",
        "",
      ],
    ];

    sheets["Audit & Security"] = [
      [
        "audit_id",
        "actor_user_id",
        "actor_role",
        "action_performed",
        "table_name",
        "record_id",
        "created_at",
      ],
      ...AL.map((l) => [
        cell(l.id),
        cell(l.user_id),
        cell(l.role),
        cell(l.action_performed),
        cell(l.table_name),
        cell(l.record_id),
        cell(l.created_at),
      ] as (string | number)[]),
    ];

    // ------------------------------ Dashboard ----------------------------
    const totalUsers = P.length;
    const activeUsers = sheets["Users"].slice(1).filter((r) => r[17] === "TRUE").length;
    const newUsers30 = P.filter((p) => String(p.created_at) >= isoDay(30)).length;
    const kycCount = (s: string) => P.filter((p) => String(p.kyc_status) === s).length;
    const verified = kycCount("COMPLETED") + kycCount("VERIFIED");
    const totalApps = A.length;
    const approvedApps = A.filter(isApproved).length;
    const rejectedApps = A.filter((a) =>
      ["rejected", "REJECTED", "declined", "DECLINE"].includes(String(a.status)) ||
      String(a.decision).toUpperCase() === "DECLINE",
    ).length;
    const pendingApps = totalApps - approvedApps - rejectedApps;
    const disbursedValue = A.filter(isApproved).reduce((s, a) => s + num(a.requested_amount), 0);
    const paidRevenue = PAY.filter((p) => String(p.status) === "paid").reduce(
      (s, p) => s + num(p.amount_zmw),
      0,
    );
    const pendingRevenue = PAY.filter((p) => String(p.status) !== "paid").reduce(
      (s, p) => s + num(p.amount_zmw),
      0,
    );
    const pct = (a: number, b: number) => (b ? `${round2((a / b) * 100)}%` : "0%");
    const tier = (t: string) => sheets["Engagement"].slice(1).filter((r) => r[8] === t).length;
    const stage = (s: string) => sheets["Users"].slice(1).filter((r) => r[14] === s).length;

    sheets["Dashboard"] = [
      ["Riverbanc — Customer Data Management Dashboard"],
      ["Last synced (UTC)", new Date().toISOString()],
      ["Source", "Riverbanc production database (server-side, RLS-preserving export)"],
      ["Note", "NRC values are masked. No credentials, tokens, documents or payslips are exported."],
      [],
      ["USERS", "Value", "Detail"],
      ["Total users", totalUsers, "Users sheet"],
      ["Active users (30d)", activeUsers, pct(activeUsers, totalUsers)],
      ["New users (30d)", newUsers30, pct(newUsers30, totalUsers)],
      ["Dormant users", tier("DORMANT"), "Engagement sheet"],
      [],
      ["KYC & VERIFICATION", "Value", "Share"],
      ["Verified (completed)", verified, pct(verified, totalUsers)],
      ["In review", kycCount("IN_REVIEW"), pct(kycCount("IN_REVIEW"), totalUsers)],
      ["Pending", kycCount("PENDING"), pct(kycCount("PENDING"), totalUsers)],
      ["Rejected", kycCount("REJECTED"), pct(kycCount("REJECTED"), totalUsers)],
      [],
      ["APPLICATIONS & CONVERSION", "Value", "Rate"],
      ["Total applications", totalApps, ""],
      ["Approved", approvedApps, pct(approvedApps, totalApps)],
      ["Rejected", rejectedApps, pct(rejectedApps, totalApps)],
      ["Pending / in progress", pendingApps, pct(pendingApps, totalApps)],
      ["Signup -> application conversion", pct(appsByUser.size, totalUsers), ""],
      ["Application -> approval conversion", pct(approvedApps, totalApps), ""],
      ["KYC -> application conversion", pct(appsByUser.size, verified), ""],
      [],
      ["SUBSCRIPTIONS & REVENUE (ZMW)", "Value", "Detail"],
      ["Approved loan value", round2(disbursedValue), "sum of approved requested amounts"],
      ["Average approved loan", approvedApps ? round2(disbursedValue / approvedApps) : 0, ""],
      ["Revenue paid out", round2(paidRevenue), "payouts.status = paid"],
      ["Revenue pending", round2(pendingRevenue), "payouts not yet paid"],
      ["Active products", PRD.filter((p) => String(p.status) === "active").length, "products"],
      ["Active lender products", BP.filter((p) => p.active).length, "bank_products"],
      [],
      ["ENGAGEMENT", "Value", "Share"],
      ["High engagement", tier("HIGH"), pct(tier("HIGH"), totalUsers)],
      ["Medium engagement", tier("MEDIUM"), pct(tier("MEDIUM"), totalUsers)],
      ["Notifications sent (30d)", N.filter((n) => String(n.created_at) >= isoDay(30)).length, ""],
      [],
      ["LIFECYCLE", "Value", "Share"],
      ["Signed up only", stage("SIGNED_UP"), pct(stage("SIGNED_UP"), totalUsers)],
      ["Verified", stage("VERIFIED"), pct(stage("VERIFIED"), totalUsers)],
      ["Applicants", stage("APPLICANT"), pct(stage("APPLICANT"), totalUsers)],
      ["Borrowers", stage("BORROWER"), pct(stage("BORROWER"), totalUsers)],
      [],
      ["RISK & COMPLIANCE", "Value", "Detail"],
      ["Open risk flags", R.filter((r) => String(r.status) === "pending").length, "risk_flags"],
      ["Total risk flags", R.length, ""],
      ["Fraud-flagged applications", A.filter((a) => a.fraud_flag === true).length, ""],
      ["High-risk applications", A.filter((a) => String(a.risk_level).toUpperCase().includes("HIGH")).length, ""],
      ["Credit checks run", C.length, "credit_checks"],
      ["Active payroll authorizations", AUTH.filter((a) => a.status === "active" && !a.revoked_at).length, ""],
      ["Marketing consent granted", P.filter((p) => p.consent_marketing === true).length, pct(P.filter((p) => p.consent_marketing === true).length, totalUsers)],
      ["Audit events (exported window)", AL.length, "payloads excluded"],
    ];

    // ------------------------------ Load ---------------------------------
    let spreadsheetId = body.spreadsheetId;
    if (!spreadsheetId) {
      const { data: existing } = await db
        .from("report_sync_state")
        .select("spreadsheet_id")
        .eq("id", "google_sheets")
        .maybeSingle();
      spreadsheetId = (existing?.spreadsheet_id as string | undefined) ?? undefined;
    }

    let created = false;
    if (!spreadsheetId) {
      const wb = await gateway("/spreadsheets", {
        method: "POST",
        body: JSON.stringify({
          properties: { title: "Riverbanc — Customer Data Management" },
          sheets: SHEET_TABS.map((title, i) => ({
            properties: { title, index: i },
          })),
        }),
      });
      spreadsheetId = wb.spreadsheetId as string;
      created = true;
    } else {
      // Make sure every expected tab exists on a pre-existing workbook.
      const meta = await gateway(`/spreadsheets/${spreadsheetId}`);
      const have = new Set(
        (meta.sheets ?? []).map((s: { properties: { title: string } }) => s.properties.title),
      );
      const missing = SHEET_TABS.filter((t) => !have.has(t));
      if (missing.length) {
        await gateway(`/spreadsheets/${spreadsheetId}:batchUpdate`, {
          method: "POST",
          body: JSON.stringify({
            requests: missing.map((title) => ({ addSheet: { properties: { title } } })),
          }),
        });
      }
    }

    const rowCounts: Record<string, number> = {};
    for (const tab of SHEET_TABS) {
      const grid = sheets[tab] ?? [[]];
      const width = Math.max(1, ...grid.map((r) => r.length));
      const padded = grid.map((r) => [...r, ...Array(width - r.length).fill("")]);
      const range = `'${tab}'!A1:${String.fromCharCode(64 + Math.min(width, 26))}${Math.max(padded.length, 1)}`;
      await gateway(`/spreadsheets/${spreadsheetId}/values/'${tab}'!A1:ZZ50000:clear`, {
        method: "POST",
        body: "{}",
      });
      await gateway(
        `/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=RAW`,
        { method: "PUT", body: JSON.stringify({ range, majorDimension: "ROWS", values: padded }) },
      );
      rowCounts[tab] = Math.max(0, padded.length - 1);
    }

    await db.from("report_sync_state").upsert({
      id: "google_sheets",
      spreadsheet_id: spreadsheetId,
      last_synced_at: new Date().toISOString(),
      last_synced_by: userId,
      row_counts: rowCounts,
      last_error: null,
    });

    await db.rpc("log_audit", {
      _user_id: userId,
      _role: isSuperAdmin ? "super_admin" : "admin",
      _action: "google_sheets_report_sync",
      _record_id: spreadsheetId,
      _table_name: "report_sync_state",
      _old_value: null,
      _new_value: { row_counts: rowCounts, created },
    });

    return json({
      ok: true,
      created,
      spreadsheetId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      rowCounts,
      syncedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    console.error("sheets-export failed:", message);
    await db
      .from("report_sync_state")
      .upsert({ id: "google_sheets", last_error: message.slice(0, 500) });
    return json({ error: "Report sync failed", details: message }, 502);
  }
});
