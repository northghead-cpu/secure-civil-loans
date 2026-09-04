import { describe, expect, it } from "vitest";

describe("receiptService contract", async () => {
  it("exposes borrower-scoped receipt retrieval only", async () => {
    const { receiptService } = await import("../receiptService");
    expect(Object.keys(receiptService)).toEqual(["listMine"]);
  });
});
