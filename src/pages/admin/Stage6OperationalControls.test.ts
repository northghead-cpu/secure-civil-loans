import { describe, expect, it } from "vitest";
import { ROLE_PERMISSIONS } from "@/hooks/useRBAC";

describe("Stage 6 operational control boundaries", () => {
  it("keeps Super User out of payout, automation, role, approval, and system changes", () => {
    const permissions = ROLE_PERMISSIONS.super_user;
    expect(permissions.canManagePayouts).toBe(false);
    expect(permissions.canManageAutomations).toBe(false);
    expect(permissions.canManageRoles).toBe(false);
    expect(permissions.canApproveChanges).toBe(false);
    expect(permissions.canChangeSystemSettings).toBe(false);
  });

  it("keeps Admin operational capabilities while preserving system-settings restriction", () => {
    const permissions = ROLE_PERMISSIONS.admin;
    expect(permissions.canManagePayouts).toBe(true);
    expect(permissions.canManageAutomations).toBe(true);
    expect(permissions.canApproveChanges).toBe(true);
    expect(permissions.canChangeSystemSettings).toBe(false);
  });

  it("keeps Super Admin as the only role with system configuration authority", () => {
    expect(ROLE_PERMISSIONS.super_admin.canChangeSystemSettings).toBe(true);
    for (const role of ["admin", "super_user", "compliance_team", "data_entry_team"] as const) {
      expect(ROLE_PERMISSIONS[role].canChangeSystemSettings).toBe(false);
    }
  });
});
