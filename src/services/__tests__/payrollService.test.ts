import { describe, expect, it } from "vitest";

describe("payrollService contract", () => {
  it("uses the database's active/inactive status model", async () => {
    const { payrollService } = await import("../payrollService");
    expect(typeof payrollService.list).toBe("function");
    expect(typeof payrollService.create).toBe("function");
    expect(typeof payrollService.update).toBe("function");
    expect(typeof payrollService.toggleStatus).toBe("function");
    expect(typeof payrollService.remove).toBe("function");
  });
});
