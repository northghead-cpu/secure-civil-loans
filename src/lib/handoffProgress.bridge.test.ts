import { expect, it } from "vitest";
import { handoffProgress, handoffStatusLabel } from "./handoffProgress";
it("keeps preapproval pending final lender approval", () => {
  expect(handoffProgress("pre_approved").current).not.toBeNull();
  expect(handoffStatusLabel("pre_approved")).toContain("final lender approval pending");
  expect(handoffProgress("approved").current).toBeNull();
});
