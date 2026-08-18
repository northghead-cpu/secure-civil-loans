import { describe, expect, it } from "vitest";
import { ROLE_PERMISSIONS } from "./useRBAC";

describe("Admin route capability boundaries", () => {
  it("keeps Super User operational and denies privileged routes", () => {
    const permissions = ROLE_PERMISSIONS.super_user;

    expect(permissions.canChangeSystemSettings).toBe(false);
    expect(permissions.canManageUsers).toBe(false);
    expect(permissions.canManageRoles).toBe(false);
    expect(permissions.canManageAutomations).toBe(false);
    expect(permissions.canManageCommissions).toBe(false);
    expect(permissions.canManagePayouts).toBe(false);
    expect(permissions.canPerformCreditChecks).toBe(false);
    expect(permissions.canManageLenderProducts).toBe(false);
  });

  it("keeps Admin out of system settings while allowing approved operational capabilities", () => {
    const permissions = ROLE_PERMISSIONS.admin;

    expect(permissions.canChangeSystemSettings).toBe(false);
    expect(permissions.canManageUsers).toBe(true);
    expect(permissions.canManageRoles).toBe(true);
    expect(permissions.canManageLenderProducts).toBe(true);
    expect(permissions.canManageCommissions).toBe(true);
  });

  it("keeps Super Admin as the only role with system configuration authority", () => {
    expect(ROLE_PERMISSIONS.super_admin.canChangeSystemSettings).toBe(true);
    expect(ROLE_PERMISSIONS.admin.canChangeSystemSettings).toBe(false);
    expect(ROLE_PERMISSIONS.super_user.canChangeSystemSettings).toBe(false);
    expect(ROLE_PERMISSIONS.compliance_team.canChangeSystemSettings).toBe(false);
    expect(ROLE_PERMISSIONS.data_entry_team.canChangeSystemSettings).toBe(false);
  });
});
