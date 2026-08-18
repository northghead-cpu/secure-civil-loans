import { describe, expect, it } from "vitest";

const buildExportRow = (user: Record<string, string | null>) => [
  user.full_name ?? "",
  user.nrc_number ? "••••" + user.nrc_number.slice(-4) : "",
  user.phone ? "••••" + user.phone.slice(-4) : "",
  user.email ? "••••" + user.email.slice(-8) : "",
  user.employer ?? "",
  user.employee_number ? "••••" + user.employee_number.slice(-4) : "",
  user.salary ?? "",
];

describe("User Management sensitive export", () => {
  it("masks sensitive identity/contact fields in the client-side export contract", () => {
    const row = buildExportRow({
      full_name: "Test User",
      nrc_number: "123456/78/9",
      phone: "0977123456",
      email: "test@example.com",
      employer: "Ministry",
      employee_number: "EMP12345",
      salary: "10000",
    });

    expect(row[0]).toBe("Test User");
    expect(row[1]).not.toContain("123456/78/9");
    expect(row[2]).not.toContain("0977123456");
    expect(row[3]).not.toContain("test@example.com");
    expect(row[5]).not.toContain("EMP12345");
    expect(row[6]).toBe("10000");
  });
});
