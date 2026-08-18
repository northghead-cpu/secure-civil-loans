import { describe, expect, it } from "vitest";

const menuGroups = [
  { label: "Overview", items: ["Dashboard"] },
  { label: "Operations", items: ["User Management", "KYC", "Applications", "History"] },
  { label: "Lender Network", items: ["Products", "Performance", "Commission"] },
  { label: "Financials", items: ["Revenue", "Payouts", "Reports", "Customer Data Sheet"] },
  { label: "Compliance & Risk", items: ["Risk Flags", "Audit Logs", "Payroll Integration", "Credit Bureau"] },
  { label: "Administration", items: ["Automations", "Role Permissions", "System Settings"] },
];

describe("Admin navigation information architecture", () => {
  it("contains exactly one Credit Bureau destination", () => {
    const creditBureauEntries = menuGroups.flatMap((group) => group.items).filter((item) => item === "Credit Bureau");
    expect(creditBureauEntries).toHaveLength(1);
  });

  it("uses the reconciled Admin group structure", () => {
    expect(menuGroups.map((group) => group.label)).toEqual([
      "Overview",
      "Operations",
      "Lender Network",
      "Financials",
      "Compliance & Risk",
      "Administration",
    ]);
  });
});
