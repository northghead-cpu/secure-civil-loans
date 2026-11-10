import { describe, it, expect } from "vitest";
import { scrubDeep, scrubUrl, safeErrorEvent } from "@/lib/sentry";
describe("deny-by-default telemetry", () => {
  it("discards unknown values, including free text and numbers", () => {
    const out = scrubDeep({ note: "Jane earns 18500", diagnostic: { amount: 18500 }, email: "a@example.test", route: "/profile" });
    expect(out).toEqual({ note: "[redacted]", diagnostic: { amount: "[redacted]" }, email: "[redacted]", route: "/profile" });
  });
  it("drops all query/hash values and unknown path segments", () => {
    expect(scrubUrl("https://app/profile?anything=private#token")).toBe("/profile");
    expect(scrubUrl("https://app/customers/Jane-Banda")).toBe("[redacted]");
    expect(scrubUrl("not a URL Jane earns 18500")).toBe("[redacted]");
  });
  it("terminates cyclic objects", () => {
    const input: Record<string, unknown> = {}; input.cycle = input;
    expect(JSON.stringify(scrubDeep(input))).toContain("[redacted]");
  });
  it("reconstructs an event without arbitrary fields, breadcrumbs or frame context", () => {
    const out = safeErrorEvent({ type: undefined, message: "Jane earns 18500", user: { email: "jane@example.test" }, extra: { customer: "Jane" }, request: { url: "https://app/profile?case=Jane" }, breadcrumbs: [{ message: "Jane" }], exception: { values: [{ type: "Jane", value: "18500", stacktrace: { frames: [{ filename: "https://app/assets/index-abc.js?secret=Jane", lineno: 21, vars: { name: "Jane" }, context_line: "Jane" }, { filename: "https://app/customers/Jane" }] } }] } });
    const serialized = JSON.stringify(out);
    expect(serialized).not.toMatch(/Jane|18500|example.test|secret|context_line|breadcrumbs/);
    expect(out.exception?.values?.[0].stacktrace?.frames).toEqual([{ filename: "/assets/index-abc.js", lineno: 21, colno: undefined, in_app: true }]);
  });
});