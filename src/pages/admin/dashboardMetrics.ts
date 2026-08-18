import { supabase as defaultSupabase } from "@/integrations/supabase/client";

type QueryClient = typeof defaultSupabase;

export interface DashboardMetrics {
  activeBorrowers: number;
  pendingApplications: number;
  monthlySubscriptionValue: number;
  riskAlerts: number;
  priorityQueue: Array<{ title: string; owner: string; eta: string; badge: string; badgeClass: string }>;
  recentActivity: Array<{ action: string; user: string; time: string; tone: string }>;
  pipeline: Array<{ stage: string; count: number; share: number; tone: string }>;
  lenderHealth: Array<{ name: string; fill: number; subtitle: string }>;
}

const MONTHLY_MEMBER_FEE_ZMW = 60;

const formatTime = (value: string) =>
  new Intl.DateTimeFormat("en-ZM", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));

export async function getDashboardMetrics({ supabase = defaultSupabase }: { supabase?: QueryClient | null } = {}): Promise<DashboardMetrics> {
  if (!supabase) throw new Error("Supabase client is required");

  const [borrowers, pending, subscriptions, risks, applications, auditLogs, lenders, payouts] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("account_status", "active"),
    supabase.from("loan_applications").select("id", { count: "exact", head: true }).in("status", ["pending", "reviewing", "processing"]),
    supabase.from("subscription_authorizations").select("id").eq("status", "active"),
    supabase.from("risk_flags").select("id", { count: "exact", head: true }).neq("status", "resolved"),
    supabase.from("loan_applications").select("status"),
    supabase.from("audit_logs").select("action_performed, action, role, created_at, record_id").order("created_at", { ascending: false }).limit(6),
    supabase.from("bank_products").select("bank_name, active, product_type"),
    supabase.from("payouts").select("id, lender, status").in("status", ["pending", "processing", "failed"]),
  ]);

  const errors = [borrowers, pending, subscriptions, risks, applications, auditLogs, lenders, payouts].filter((result) => result.error);
  if (errors.length) throw new Error(errors[0].error?.message ?? "Failed to load Command Center metrics");

  // Riverbanc membership is a fixed K60 monthly fee. Monthly subscription value is
  // therefore the active member count multiplied by the current membership fee.
  const monthlySubscriptionValue = (subscriptions.data ?? []).length * MONTHLY_MEMBER_FEE_ZMW;
  const applicationRows = applications.data ?? [];
  const totalApplications = applicationRows.length || 1;
  const stages = [
    ["Submitted", "pending", "bg-sky-500"],
    ["KYC review", "reviewing", "bg-cyan-400"],
    ["CRB check", "processing", "bg-violet-500"],
    ["Approved", "approved", "bg-emerald-500"],
    ["Rejected", "rejected", "bg-rose-500"],
  ] as const;
  const pipeline = stages.map(([stage, status, tone]) => {
    const count = applicationRows.filter((row) => row.status === status).length;
    return { stage, count, share: Math.round((count / totalApplications) * 100), tone };
  });

  const payoutRows = payouts.data ?? [];
  const failedPayouts = payoutRows.filter((row) => row.status === "failed").length;
  const priorityQueue = [
    ...(risks.count ? [{ title: `${risks.count} unresolved risk alert${risks.count === 1 ? "" : "s"}`, owner: "Compliance team", eta: "Review now", badge: "Risk", badgeClass: "bg-rose-500/15 text-rose-200 border-rose-400/20" }] : []),
    ...(pending.count ? [{ title: `${pending.count} application${pending.count === 1 ? "" : "s"} awaiting review`, owner: "Credit operations", eta: "Review today", badge: "Needs review", badgeClass: "bg-amber-400/15 text-amber-100 border-amber-300/20" }] : []),
    ...(failedPayouts ? [{ title: `${failedPayouts} failed payout${failedPayouts === 1 ? "" : "s"} require attention`, owner: "Finance desk", eta: "Review now", badge: "Finance exception", badgeClass: "bg-sky-500/15 text-sky-100 border-sky-400/20" }] : []),
  ].slice(0, 3);

  const recentActivity = (auditLogs.data ?? []).map((row) => ({
    action: row.action_performed || row.action || "Platform event",
    user: row.role || "Authorized operator",
    time: formatTime(row.created_at),
    tone: "bg-primary",
  }));

  const lenderHealth = (lenders.data ?? []).reduce<DashboardMetrics["lenderHealth"]>((acc, product) => {
    const existing = acc.find((item) => item.name === product.bank_name);
    if (existing) return acc;
    const activeCount = (lenders.data ?? []).filter((item) => item.bank_name === product.bank_name && item.active).length;
    const totalCount = (lenders.data ?? []).filter((item) => item.bank_name === product.bank_name).length;
    acc.push({ name: product.bank_name, fill: totalCount ? Math.round((activeCount / totalCount) * 100) : 0, subtitle: `${activeCount} of ${totalCount} product${totalCount === 1 ? "" : "s"} active` });
    return acc;
  }, []).slice(0, 3);

  return { activeBorrowers: borrowers.count ?? 0, pendingApplications: pending.count ?? 0, monthlySubscriptionValue, riskAlerts: risks.count ?? 0, priorityQueue, recentActivity, pipeline, lenderHealth };
}