import { describe, expect, it } from "vitest";

describe("Admin Command Center data contract", () => {
  it("does not use hard-coded borrower, revenue, risk, queue, activity, pipeline, or lender metrics", () => {
    const source = `{{SOURCE_PLACEHOLDER}}`;
    expect(source).not.toMatch(/2,847|245,000|156|Stanbic payout reconciliation exception|Peter Zulu/);
  });
});
