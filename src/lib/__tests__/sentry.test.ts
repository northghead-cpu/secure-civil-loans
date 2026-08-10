import { describe, it, expect } from "vitest";
import { scrubDeep, scrubUrl } from "@/lib/sentry";

describe("sentry redaction", () => {
  it("redacts regulated keys", () => {
    const out = scrubDeep({
      nrc_number: "123456/78/1",
      employee_number: "EMP-1",
      salary: 18500,
      kyc_status: "VERIFIED",
      crb_score: 640,
      payslip_url: "https://x/y.pdf",
      loan_application: { amount: 5000 },
      access_token: "abc",
      authorization: "Bearer abc",
      password: "hunter2",
      email: "a@b.com",
      phone: "0977123456",
      full_name: "Jane Banda",
      route: "/profile",
    }) as Record<string, unknown>;

    for (const key of [
      "nrc_number", "employee_number", "salary", "kyc_status", "crb_score",
      "payslip_url", "loan_application", "access_token", "authorization",
      "password", "email", "phone", "full_name",
    ]) {
      expect(out[key], key).toBe("[redacted]");
    }
    expect(out.route).toBe("/profile");
  });

  it("redacts sensitive value shapes under harmless keys", () => {
    const out = scrubDeep({
      note: "customer nrc 123456/78/1 said hi",
      blob: "data:image/png;base64,AAAABBBBCCCC",
      jwt: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcdefghijk",
      contact: "someone@example.com",
      cell: "+260977123456",
    }) as Record<string, string>;

    expect(out.note).toBe("customer nrc [redacted] said hi");
    expect(out.blob).toBe("[redacted]");
    expect(out.contact).toBe("[redacted]");
    expect(out.cell).toBe("[redacted]");
  });

  it("scrubs tokens and hashes out of urls", () => {
    expect(scrubUrl("https://app/reset?access_token=abc&code=xyz&page=2")).toBe(
      "https://app/reset?access_token=%5Bredacted%5D&code=%5Bredacted%5D&page=2",
    );
    expect(scrubUrl("https://app/x#access_token=abc")).toBe("https://app/x");
  });

  it("handles nested structures and arrays without throwing", () => {
    const out = scrubDeep({ a: [{ nrc: "1" }, { ok: "fine" }] }) as {
      a: Array<Record<string, string>>;
    };
    expect(out.a[0].nrc).toBe("[redacted]");
    expect(out.a[1].ok).toBe("fine");
  });
});
