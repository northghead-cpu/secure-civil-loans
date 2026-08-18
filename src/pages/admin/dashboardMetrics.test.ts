import { describe, expect, it } from "vitest";
import { getDashboardMetrics } from "./dashboardMetrics";

const rows: Record<string, { data: unknown[]; count?: number }> = {
  profiles: { data: [], count: 12 },
  loan_applications: { data: [{ status: "pending" }, { status: "approved" }, { status: "rejected" }] },
  subscription_authorizations: { data: [{ amount: 60 }, { amount: 60 }] },
  risk_flags: { data: [], count: 2 },
  audit_logs: { data: [{ action_performed: "KYC verified", action: null, role: "compliance_team", created_at: "2026-01-01T10:00:00Z", record_id: "1" }] },
  bank_products: { data: [{ bank_name: "Test Bank", active: true, product_type: "bank_loan" }, { bank_name: "Test Bank", active: false, product_type: "bank_loan" }] },
  payouts: { data: [{ id: "1", lender: "Test Bank", status: "failed" }] },
};

const fakeSupabase = {
  from(table: string) {
    const result = rows[table] ?? { data: [] };
    const chain = {
      select: () => chain,
      eq: () => chain,
      in: () => chain,
      neq: () => chain,
      gte: () => chain,
      order: () => chain,
      limit: () => chain,
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve({ data: result.data, count: result.count ?? null, error: null })),
    };
    return chain;
  },
};

describe("Admin Command Center metrics", () => {
  it("derives operational metrics from persisted Supabase records", async () => {
    const metrics = await getDashboardMetrics({ supabase: fakeSupabase as never });

    expect(metrics.activeBorrowers).toBe(12);
    expect(metrics.pendingApplications).toBe(0);
    expect(metrics.monthlySubscriptionValue).toBe(120);
    expect(metrics.riskAlerts).toBe(2);
    expect(metrics.priorityQueue).toHaveLength(2);
    expect(metrics.recentActivity).toHaveLength(1);
    expect(metrics.pipeline.find((stage) => stage.stage === "Approved")?.count).toBe(1);
    expect(metrics.lenderHealth[0]).toMatchObject({ name: "Test Bank", fill: 50 });
  });
});
