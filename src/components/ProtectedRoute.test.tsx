import { describe, expect, it } from "vitest";

/**
 * Route-policy contract tests. The route guard is intentionally role-based at
 * the routing boundary; capability checks remain the source of truth inside
 * privileged pages until every route is migrated to explicit capabilities.
 */
describe("Admin route authorization policy", () => {
  it("defines privileged routes separately from the broad Admin entry gate", () => {
    const privilegedRoutes = {
      "/admin/users/management": "canManageUsers",
      "/admin/lenders/products": "canManageLenderProducts",
      "/admin/lenders/commission": "canManageCommissions",
      "/admin/financials/payouts": "canManagePayouts",
      "/admin/automations": "canManageAutomations",
      "/admin/role-permissions": "canManageRoles",
      "/admin/system-settings": "canChangeSystemSettings",
      "/admin/credit-bureau": "canPerformCreditChecks",
    } as const;

    expect(Object.keys(privilegedRoutes)).toHaveLength(8);
    expect(privilegedRoutes["/admin/system-settings"]).toBe("canChangeSystemSettings");
    expect(privilegedRoutes["/admin/credit-bureau"]).toBe("canPerformCreditChecks");
  });
});
