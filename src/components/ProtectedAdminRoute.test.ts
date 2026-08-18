import { describe, expect, it } from "vitest";
import { ROLE_PERMISSIONS } from "@/hooks/useRBAC";

const protectedCapabilities = [
  "canManageUsers",
  "canManageLenderProducts",
  "canManageCommissions",
  "canManagePayouts",
  "canManageAutomations",
  "canManageRoles",
  "canExportCustomerData",
  "canPerformCreditChecks",
  "canChangeSystemSettings",
] as const;

describe("Admin route capability boundaries", () => {
  it("keeps Super User out of privileged Admin routes", () => {
    for (const capability of protectedCapabilities) {
      expect(ROLE_PERMISSIONS.super_user[capability]).toBe(false);
    }
  });

  it("keeps Super Admin authorized for all protected Admin capabilities", () => {
    for (const capability of protectedCapabilities) {
      expect(ROLE_PERMISSIONS.super_admin[capability]).toBe(true);
    }
  });

  it("keeps ordinary users outside the Admin capability model", () => {
    for (const capability of protectedCapabilities) {
      expect(ROLE_PERMISSIONS.user[capability]).toBe(false);
    }
  });
});
