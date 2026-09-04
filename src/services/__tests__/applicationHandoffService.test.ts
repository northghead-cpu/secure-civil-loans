import { describe, expect, it } from "vitest";
import {
  HANDOFF_OPERATION_ROLES,
  LENDER_CONTROLLED_STATUSES,
  RIVERBANC_OPERATIONAL_STATUSES,
  canManageHandoffOperations,
  canTransitionRiverbancStatus,
  isLenderControlledStatus,
  isRiverbancOperationalStatus,
} from "../applicationHandoffService";

describe("applicationHandoffService", () => {
  it("limits handoff operations to the approved operational roles", () => {
    expect(canManageHandoffOperations("admin")).toBe(true);
    expect(canManageHandoffOperations("super_admin")).toBe(true);
    expect(canManageHandoffOperations("compliance_team")).toBe(true);
    expect(canManageHandoffOperations("super_user")).toBe(false);
    expect(canManageHandoffOperations("user")).toBe(false);
    expect(HANDOFF_OPERATION_ROLES).toEqual(["admin", "super_admin", "compliance_team"]);
  });

  it("separates Riverbanc operational statuses from lender-controlled milestones", () => {
    expect(RIVERBANC_OPERATIONAL_STATUSES).toEqual(["authorized", "preparing", "sent_to_lender"]);
    expect(isRiverbancOperationalStatus("preparing")).toBe(true);
    expect(isRiverbancOperationalStatus("approved")).toBe(false);
    expect(isLenderControlledStatus("lender_review")).toBe(true);
    expect(isLenderControlledStatus("additional_information_requested")).toBe(true);
    expect(isLenderControlledStatus("approved")).toBe(true);
    expect(isLenderControlledStatus("declined")).toBe(true);
    expect(isLenderControlledStatus("disbursed")).toBe(true);
    expect(LENDER_CONTROLLED_STATUSES).toContain("approved");
    expect(LENDER_CONTROLLED_STATUSES).toContain("disbursed");
  });

  it("allows only forward movement through Riverbanc operational stages", () => {
    expect(canTransitionRiverbancStatus("pending_authorization", "authorized")).toBe(true);
    expect(canTransitionRiverbancStatus("authorized", "preparing")).toBe(true);
    expect(canTransitionRiverbancStatus("preparing", "sent_to_lender")).toBe(true);
    expect(canTransitionRiverbancStatus("sent_to_lender", "preparing")).toBe(false);
    expect(canTransitionRiverbancStatus("authorized", "sent_to_lender")).toBe(false);
    expect(canTransitionRiverbancStatus("sent_to_lender", "approved")).toBe(false);
  });
});
