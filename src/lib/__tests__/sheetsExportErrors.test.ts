import { describe, expect, it } from "vitest";
import { readSheetsExportErrorCode, sheetsExportErrorMessage, SHEETS_UNKNOWN_ERROR } from "../sheetsExportErrors";

describe("sheetsExportErrorMessage", () => {
  it("distinguishes MFA from role failure", () => {
    expect(sheetsExportErrorMessage("MFA_REQUIRED")).toMatch(/Two-factor/);
    expect(sheetsExportErrorMessage("FORBIDDEN")).toMatch(/admins/);
  });
  it("reports an unlinked connector", () => {
    expect(sheetsExportErrorMessage("CONNECTOR_NOT_LINKED")).toMatch(/not connected/);
  });
  it("separates provider failures from sync failures", () => {
    expect(sheetsExportErrorMessage("PROVIDER_ERROR")).not.toBe(sheetsExportErrorMessage("SYNC_FAILED"));
  });
  it("never echoes unknown server text", () => {
    expect(sheetsExportErrorMessage("sk_live_secret")).toBe(SHEETS_UNKNOWN_ERROR);
  });
});

describe("readSheetsExportErrorCode", () => {
  it("reads code from the error response body", async () => {
    const err = { context: { json: async () => ({ code: "MFA_REQUIRED" }) } };
    expect(await readSheetsExportErrorCode(err, null)).toBe("MFA_REQUIRED");
  });
});
