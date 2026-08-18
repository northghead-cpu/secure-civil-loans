import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("User Management sensitive export", () => {
  it("masks NRC, phone, email, and employee number in the real export implementation", () => {
    const source = readFileSync(resolve(process.cwd(), "src/pages/admin/UserManagement.tsx"), "utf8");
    const exportStart = source.indexOf("const exportCSV = () =>");
    const exportEnd = source.indexOf("const statusCounts", exportStart);
    const exportSource = source.slice(exportStart, exportEnd);

    expect(exportSource).toContain("mask(user.nrc_number)");
    expect(exportSource).toContain("mask(user.phone)");
    expect(exportSource).toContain("maskEmail(user.email)");
    expect(exportSource).toContain("mask(user.employee_number)");
    expect(exportSource).not.toContain("user.nrc_number ?? \"\"");
    expect(exportSource).not.toContain("user.phone ?? \"\"");
    expect(exportSource).not.toContain("user.email ?? \"\"");
    expect(exportSource).not.toContain("user.employee_number ?? \"\"");
  });
});
