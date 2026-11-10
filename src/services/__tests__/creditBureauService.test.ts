import { describe, expect, it } from "vitest";
import { performCRBCheck } from "../creditBureauService";

describe("creditBureauService", () => {
  it("fails closed without a configured bureau and never returns mock-data metadata", async () => {
    const result = await performCRBCheck({
      nrcNumber: "123456/12/1",
      fullName: "Test Applicant",
    });

    expect(result.success).toBe(false);
    expect(result.report).toBeUndefined();
    expect(result.error).toBe("Credit bureau provider is not configured");
    expect(result).not.toHaveProperty("mockData");
  });
});
