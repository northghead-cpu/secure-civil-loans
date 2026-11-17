import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.50.0";
import { extractText, getDocumentProxy } from "npm:unpdf@2.2.1";
import { analyseDocuments, readPayrollLayout } from "./analysis.mjs";
import {
  selectFinancialDocuments,
  markPreliminaryAnalysis,
} from "./document-policy.mjs";
const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
const hex = (b: ArrayBuffer) =>
  [...new Uint8Array(b)].map((v) => v.toString(16).padStart(2, "0")).join("");
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED" });
  const url = Deno.env.get("SUPABASE_URL"),
    service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !service) return json(503, { error: "CONFIGURATION_REQUIRED" });
  const db = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const isService = req.headers.get("authorization") === "Bearer " + service;
  if (!isService) {
    const secret = req.headers.get("x-cron-secret") ?? "";
    if (secret.length < 24 || secret.length > 512)
      return json(401, { error: "UNAUTHORISED" });
    const check = await db.rpc("financial_cron_authorized", {
      p_secret: secret,
    });
    if (check.error || check.data !== true)
      return json(401, { error: "UNAUTHORISED" });
  }
  let userId: string | null = null;
  const input = await req.json().catch(() => ({}));
  userId = typeof input.user_id === "string" ? input.user_id : null;
  const claim = await db.rpc("claim_financial_analysis", { p_user_id: userId });
  if (claim.error) return json(500, { error: "QUEUE_CLAIM_FAILED" });
  const job = claim.data?.[0];
  if (!job) return json(200, { processed: 0 });
  let result: Record<string, unknown> | null = null;
  try {
    const p = await db
      .from("profiles")
      .select("employee_number,kyc_status,account_status")
      .eq("user_id", job.user_id)
      .single();
    if (p.error) throw Error("PROFILE_LOOKUP_FAILED");
    const inventory = await db
      .from("kyc_documents")
      .select(
        "id,document_type,pay_period,storage_path,updated_at,validation_status",
      )
      .eq("user_id", job.user_id)
      .in("validation_status", ["VALID", "PENDING"])
      .in("document_type", ["PAYSLIP", "BANK_STATEMENT"])
      .order("updated_at", { ascending: false })
      .limit(100);
    if (inventory.error) throw Error("DOCUMENT_LOOKUP_FAILED");
    const docs = [];
    const candidates = inventory.data ?? [];
    const previewSources = selectFinancialDocuments(candidates);
    const verifiedSources = selectFinancialDocuments(candidates, true);
    // Read each file once, even if the preview and validated snapshots differ.
    const sources = [
      ...new Map(
        [...previewSources, ...verifiedSources].map((d) => [d.id, d]),
      ).values(),
    ];
    for (const d of sources) {
      if (!d.storage_path?.startsWith(job.user_id + "/"))
        throw Error("DOCUMENT_PATH_BINDING_FAILED");
      const download = await db.storage
        .from("kyc-documents")
        .download(d.storage_path);
      if (download.error || !download.data)
        throw Error("DOCUMENT_DOWNLOAD_FAILED");
      if (download.data.size > 12 * 1024 * 1024)
        throw Error("DOCUMENT_TOO_LARGE");
      const bytes = new Uint8Array(await download.data.arrayBuffer());
      const sha256 = hex(await crypto.subtle.digest("SHA-256", bytes));
      try {
        const pdf = await getDocumentProxy(bytes, {
          password: p.data.employee_number ?? undefined,
        });
        if (pdf.numPages > 40) throw Error("PAGE_LIMIT");
        const layout =
          d.document_type === "PAYSLIP" ? await readPayrollLayout(pdf) : null;
        const extracted = await extractText(pdf, { mergePages: true });
        docs.push({
          id: d.id,
          validation_status: d.validation_status,
          type: d.document_type,
          period: d.pay_period,
          text: extracted.text,
          layout,
          sha256,
        });
      } catch {
        docs.push({
          validation_status: d.validation_status,
          id: d.id,
          type: d.document_type,
          period: d.pay_period,
          text: "",
          sha256,
        });
      }
    }
    const handoffs = await db
      .from("application_handoffs")
      .select(
        "id,lender_name,requested_amount,term_months,estimated_monthly_repayment,information_categories,authorization_version,authorization_signature,authorized_at,status",
      )
      .eq("user_id", job.user_id)
      .not("authorized_at", "is", null)
      .in("status", [
        "authorized",
        "preparing",
        "sent_to_lender",
        "lender_review",
        "additional_information_requested",
        "pre_approved",
      ]);
    if (handoffs.error) throw Error("HANDOFF_LOOKUP_FAILED");
    const previewDocs = docs.filter((d) =>
      previewSources.some((s) => s.id === d.id),
    );
    const verifiedDocs = docs.filter((d) =>
      verifiedSources.some((s) => s.id === d.id),
    );
    const active = handoffs.data ?? [],
      base = analyseDocuments(
        previewDocs,
        p.data.employee_number,
        active[0]?.estimated_monthly_repayment ?? null,
      );
    result = {
      ...markPreliminaryAnalysis(base, previewSources),
      sourceGeneration: job.generation,
      analysedAt: new Date().toISOString(),
    };
    for (const handoff of active) {
      if (
        p.data.account_status !== "active" ||
        !["COMPLETED", "VERIFIED"].includes(p.data.kyc_status)
      )
        continue;
      const current = await db.rpc("financial_analysis_current", {
        p_user_id: job.user_id,
        p_generation: job.generation,
        p_lease: job.lease_token,
      });
      if (current.error) throw Error("LEASE_CHECK_FAILED");
      if (current.data !== true)
        return json(200, { processed: 1, current: false });
      const scope = (categories: string[] | null) =>
        Boolean(
          categories?.includes("financial_assessment") ||
          (handoff.authorization_signature &&
            categories?.includes("Income information") &&
            categories?.includes("Verification results") &&
            categories?.includes("Relevant supporting documents")),
        );
      if (!scope(handoff.information_categories)) continue;
      if (!handoff.authorization_signature) {
        const attestation = await db
          .from("audit_logs")
          .select("id")
          .eq("record_id", handoff.id)
          .eq("action", "financial_assessment_sharing_authorized")
          .limit(1);
        if (
          handoff.authorization_version !== "manual-owner-attestation-v1" ||
          attestation.error ||
          !attestation.data?.length
        )
          continue;
      }
      const recheck = await db
        .from("application_handoffs")
        .select("status,information_categories")
        .eq("id", handoff.id)
        .single();
      if (
        recheck.error ||
        !scope(recheck.data.information_categories) ||
        ["cancelled", "expired", "declined"].includes(recheck.data.status)
      )
        continue;
      const parsed = analyseDocuments(
        verifiedDocs,
        p.data.employee_number,
        handoff.estimated_monthly_repayment,
      );
      const sourceIds = verifiedDocs.map((d) => ({
        id: d.id,
        sha256: d.sha256,
        type: d.type,
        period: d.period,
      }));
      const assessment = {
        version: 1,
        status: parsed.status,
        period: parsed.period,
        proposedInstalment: handoff.estimated_monthly_repayment,
        termMonths: handoff.term_months,
        gross: parsed.gross,
        net: parsed.net,
        payrollDebt: parsed.payrollDebt,
        externalDebtLowerBound: parsed.externalDebtLowerBound,
        observedLivingExpenses: parsed.observedLivingExpenses,
        estimatedMonthlyExpenses: parsed.estimatedMonthlyExpenses,
        documentDebtRatioPercent: parsed.documentDebtRatioPercent,
        extractionQualityPercent: parsed.extractionQualityPercent,
        bankSummary: parsed.bankSummary,
        issues: parsed.issues,
        sources: sourceIds,
        analysedAt: new Date().toISOString(),
        notACreditDecision: true,
      };
      const tenantMap = {
        ...JSON.parse(Deno.env.get("RIVERBANC_HANDSHAKE_TENANT_MAP") ?? "{}"),
        ...JSON.parse(Deno.env.get("FINANCIAL_ASSESSMENT_TENANT_MAP") ?? "{}"),
      };
      const tenant = tenantMap[handoff.lender_name],
        secret = Deno.env.get("FINANCIAL_ASSESSMENT_HMAC_SECRET");
      if (!tenant || !secret || secret.length < 32)
        throw Error("ASSESSMENT_SYNC_NOT_CONFIGURED");
      const body = JSON.stringify({
        handoff_id: handoff.id,
        reference: "RBH-" + handoff.id,
        tenant_short_name: tenant,
        generation: job.generation,
        assessment,
      });
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const signature = hex(
        await crypto.subtle.sign(
          "HMAC",
          key,
          new TextEncoder().encode(
            "financial-assessment-v1." + timestamp + "." + body,
          ),
        ),
      );
      const sent = await fetch(
        "https://ueveurmphygyofwoyljj.supabase.co/functions/v1/financial-assessment-intake",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-riverbanc-timestamp": timestamp,
            "x-riverbanc-signature": signature,
          },
          body,
          redirect: "error",
          signal: AbortSignal.timeout(10000),
        },
      );
      const receipt = await sent.json().catch(() => ({}));
      if (!sent.ok || receipt.accepted !== true)
        throw Error("ASSESSMENT_SYNC_NOT_ACCEPTED");
    }
    const finish = await db.rpc("finish_financial_analysis", {
      p_user_id: job.user_id,
      p_generation: job.generation,
      p_lease: job.lease_token,
      p_result: result,
    });
    if (finish.error) throw Error("RESULT_PERSIST_FAILED");
    return json(200, {
      processed: 1,
      current: finish.data === true,
      status: base.status,
      issues: base.issues,
    });
  } catch (e) {
    const error =
      e instanceof Error && /^[A-Z_]+$/.test(e.message)
        ? e.message
        : "ANALYSIS_FAILED";
    await db.rpc("finish_financial_analysis", {
      p_user_id: job.user_id,
      p_generation: job.generation,
      p_lease: job.lease_token,
      p_result: result,
      p_error: error,
    });
    return json(502, { error });
  }
});
