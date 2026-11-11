import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { spreadsheetId, SheetsSetupError, ProviderError } from "./google-sheets.mjs";
const id = "synthetic_workbook_123456789";
async function fixture(
  options: {
    action?: string;
    configured?: boolean;
    authorization?: boolean;
    denial?: string;
    target?: unknown;
    providerDenied?: boolean;
    allowSync?: boolean;
    fixedTarget?: string;
  } = {},
) {
  let handler!: (req: Request) => Promise<Response>;
  const provider = vi.fn(async (_path: string, _init?: RequestInit) => {
    if (options.providerDenied) throw new ProviderError(403);
    return { spreadsheetId: id, properties: { title: "Synthetic private report" }, sheets: [] };
  });
  const updates = vi.fn(async () => ({ error: null }));
  const from = vi.fn((table: string) => {
    if (table !== "report_sync_state" && !options.allowSync)
      throw new Error("Connection checks must never read customer tables");
    const rows =
      table === "profiles"
        ? [
            {
              id: "synthetic-profile",
              user_id: "synthetic-user",
              full_name: "Synthetic Borrower",
              email: "synthetic@example.invalid",
              phone: "+260000000000",
              nrc_number: "123456/78/9",
              password: "NEVER-EXPORT-PASSWORD",
              authorization_signature: "NEVER-EXPORT-SIGNATURE",
              created_at: "2026-11-01T00:00:00Z",
              updated_at: "2026-11-01T00:00:00Z",
            },
          ]
        : [];
    const q = {
      select: () => q,
      eq: () => q,
      order: () => q,
      limit: () => q,
      maybeSingle: async () => ({ data: null, error: null }),
      then: (resolve: (v: unknown) => void) =>
        Promise.resolve({ data: rows, error: null }).then(resolve),
      upsert: (value: unknown) => {
        if (!options.allowSync) throw new Error("Read-only check changed reporting state");
        return updates(value);
      },
    };
    return q;
  });
  const client = {
    auth: {},
    from,
    rpc: async () => ({ data: { allowed: true, replay: false }, error: null }),
  };
  const createClient = vi.fn(() => client);
  const parsed = ts.createSourceFile(
    "index.ts",
    readFileSync(new URL("./index.ts", import.meta.url), "utf8"),
    ts.ScriptTarget.ES2022,
    true,
  );
  const source = parsed.statements
    .filter((x) => !ts.isImportDeclaration(x))
    .map((x) => x.getFullText(parsed))
    .join("\n")
    .replace(/^export /gm, "");
  const env: Record<string, string> = {
    SUPABASE_URL: "https://example.invalid",
    SUPABASE_ANON_KEY: "dummy-public",
    SUPABASE_SERVICE_ROLE_KEY: "dummy-service",
    ...(options.fixedTarget ? { GOOGLE_CUSTOMER_SHEET_ID: options.fixedTarget } : {}),
  };
  runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
    }).outputText,
    {
      Request,
      Response,
      crypto,
      console,
      SheetsSetupError,
      ProviderError,
      parseSpreadsheetId: spreadsheetId,
      createClient,
      RequestError: class extends Error {},
      requireJson: () => {},
      readBoundedText: (req: Request) => req.text(),
      requirePrivilegedMfa: async () =>
        options.denial ? { status: 403, code: options.denial } : { userId: "synthetic-admin" },
      createSheetsConnection: () => ({
        status: () => ({
          configured: options.configured !== false,
          provider: "google_service_account",
          serviceAccountEmail: "reporting@synthetic.iam.gserviceaccount.com",
          setupCode: options.configured === false ? "GOOGLE_CREDENTIALS_MISSING" : null,
        }),
        request: provider,
      }),
      Deno: {
        env: { get: (k: string) => env[k] },
        serve: (f: typeof handler) => {
          handler = f;
        },
      },
    },
  );
  const response = await handler(
    new Request("https://example.invalid/sheets-export", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(options.authorization === false ? {} : { Authorization: "Bearer dummy" }),
      },
      body: JSON.stringify({
        action: options.action ?? "check",
        ...(options.target !== undefined
          ? { spreadsheetId: options.target }
          : { spreadsheetId: id }),
      }),
    }),
  );
  return { response, body: await response.json(), provider, from, createClient, updates };
}
describe("direct customer workbook connection", () => {
  it("status checks report setup without calling Google or reading customers", async () => {
    const r = await fixture({ action: "status", configured: false });
    expect(r.response.status).toBe(200);
    expect(r.body.setupCode).toBe("GOOGLE_CREDENTIALS_MISSING");
    expect(r.provider).not.toHaveBeenCalled();
    expect(r.from).toHaveBeenCalledExactlyOnceWith("report_sync_state");
  });
  it("authentication and MFA remain mandatory", async () => {
    const a = await fixture({ authorization: false });
    expect(a.response.status).toBe(401);
    expect(a.from).not.toHaveBeenCalled();
    const b = await fixture({ denial: "MFA_REQUIRED" });
    expect(b.response.status).toBe(403);
    expect(b.from).not.toHaveBeenCalled();
  });
  it("missing credentials stop sync before any customer read or Google call", async () => {
    const r = await fixture({ action: "sync", configured: false });
    expect(r.response.status).toBe(503);
    expect(r.body.code).toBe("GOOGLE_CREDENTIALS_MISSING");
    expect(r.from).not.toHaveBeenCalled();
    expect(r.provider).not.toHaveBeenCalled();
  });
  it("connection check verifies a supplied workbook without modifying reporting state", async () => {
    const r = await fixture();
    expect(r.response.status).toBe(200);
    expect(r.body.verified).toBe(true);
    expect(r.provider).toHaveBeenCalledOnce();
    expect(r.from).toHaveBeenCalledExactlyOnceWith("report_sync_state");
    expect(r.response.headers.get("cache-control")).toBe("no-store");
  });
  it("rejects invalid or mismatched workbook targets before customer reads", async () => {
    for (const target of [123, "https://attacker.invalid/secret"]) {
      const r = await fixture({ target });
      expect(r.response.status).toBe(400);
      expect(r.provider).not.toHaveBeenCalled();
    }
    const r = await fixture({ fixedTarget: "another_private_workbook_12345" });
    expect(r.body.code).toBe("WORKBOOK_MISMATCH");
    expect(r.provider).not.toHaveBeenCalled();
  });
  it("Google access denials remain sanitized and connection checks remain read-only", async () => {
    const r = await fixture({ providerDenied: true });
    expect(r.response.status).toBe(502);
    expect(r.body.code).toBe("PROVIDER_AUTH");
    expect(r.from).toHaveBeenCalledExactlyOnceWith("report_sync_state");
  });
});

it("exports all twelve tabs with RAW values while retaining NRC masking and secret exclusions", async () => {
  const r = await fixture({ action: "sync", allowSync: true });
  expect(r.response.status).toBe(200);
  expect(r.body.ok).toBe(true);
  const writes = r.provider.mock.calls.filter((call) => call[1]?.method === "PUT");
  expect(writes).toHaveLength(12);
  const bodies = JSON.stringify(writes);
  expect(bodies).not.toContain("123456/78/9");
  expect(bodies).toContain("******/**/9");
  expect(bodies).not.toContain("NEVER-EXPORT-PASSWORD");
  expect(bodies).not.toContain("NEVER-EXPORT-SIGNATURE");
  expect(writes.every((call) => call[0].includes("valueInputOption=RAW"))).toBe(true);
  expect(r.updates).toHaveBeenCalledWith(
    expect.objectContaining({ spreadsheet_id: id, last_error: null }),
  );
  expect(Object.keys(r.body.rowCounts)).toHaveLength(12);
});
