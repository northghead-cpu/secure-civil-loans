import { describe, expect, it } from "vitest";
import { ADMIN_MENU_GROUPS } from "./AdminSidebar";

describe("Admin navigation information architecture", () => {
  it("contains exactly one Credit Bureau destination", () => {
    const creditBureauEntries = ADMIN_MENU_GROUPS.flatMap((group) => group.items).filter((item) => item.title === "Credit Bureau");
    expect(creditBureauEntries).toHaveLength(1);
  });

  it("uses the reconciled Admin group structure", () => {
    expect(ADMIN_MENU_GROUPS.map((group) => group.label)).toEqual([
      "Overview",
      "Operations",
      "Lender Network",
      "Financials",
      "Compliance & Risk",
      "Administration",
    ]);
  });
});
