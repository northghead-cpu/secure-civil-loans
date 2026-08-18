import { describe, expect, it } from "vitest";
import { getDashboardMetrics } from "./dashboardMetrics";

describe("Admin Command Center metrics", () => {
  it("derives operational metrics from persisted Supabase records", async () => {
    const metrics = await getDashboardMetrics({ supabase: null as never });

    expect(metrics).toHaveProperty("activeBorrowers");
    expect(metrics).toHaveProperty("pendingApplications");
    expect(metrics).toHaveProperty("monthlySubscriptionValue");
    expect(metrics).toHaveProperty("riskAlerts");
    expect(metrics).toHaveProperty("priorityQueue");
    expect(metrics).toHaveProperty("recentActivity");
    expect(metrics).toHaveProperty("pipeline");
    expect(metrics).toHaveProperty("lenderHealth");
  });
});
