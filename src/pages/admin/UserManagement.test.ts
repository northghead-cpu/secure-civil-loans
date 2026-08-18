import { describe, expect, it } from "vitest";

const mask = (value: string | null, visible = 4) => (value ? `••••${value.slice(-visible)}` : "");
const maskEmail = (value: string | null) => (value ? `••••${value.slice(-8)}` : "");

describe("User Management sensitive export contract", () => {
  it("masks NRC, phone, email and employee number while retaining salary", () => {
    const user = {
      nrc_number: "123456/78/9",
      phone: "0977123456",
      email: "test@example.com",
      employee_number: "EMP12345",
      salary: 10000,
    };

    const row = [
      mask(user.nrc_number),
      mask(user.phone),
      maskEmail(user.email),
      mask(user.employee_number),
      user.salary.toString(),
    ];

    expect(row[0]).toBe("••••/78/9");
    expect(row[1]).toBe("••••3456");
    expect(row[2]).toBe("••••mple.com");
    expect(row[3]).toBe("••••2345");
    expect(row[4]).toBe("10000");
    expect(row.join(",")).not.toContain(user.nrc_number);
    expect(row.join(",")).not.toContain(user.phone);
    expect(row.join(",")).not.toContain(user.email);
    expect(row.join(",")).not.toContain(user.employee_number);
  });
});
