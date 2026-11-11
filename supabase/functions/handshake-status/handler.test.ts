import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { signStatus, verifyStatus, validateStatus } from "./protocol.mjs";
const id = "11111111-1111-4111-8111-111111111111";
const secret = "synthetic-key-for-tests-at-least-32-characters";
async function fixture(
  patch: { badSignature?: boolean; tenant?: string; rpcCode?: string; version?: number } = {},
) {
  const input = {
    event_id: id + ":1",
    handoff_id: id,
    handshake_id: id,
    row_id: id,
    tenant_short_name: patch.tenant ?? "Test",
    status: "pre_approved",
    version: patch.version ?? 1,
  };
  const raw = JSON.stringify(input),
    time = String(Math.floor(Date.now() / 1000));
  const rpc = vi.fn(async () => ({
    data: { accepted: true },
    error: patch.rpcCode ? { code: patch.rpcCode } : null,
  }));
  const q = {
    select: () => q,
    eq: () => q,
    maybeSingle: async () => ({ data: { lender_name: "Synthetic Lender" }, error: null }),
  };
  const env: Record<string, string> = {
    SUPABASE_URL: "https://example.invalid",
    SUPABASE_SERVICE_ROLE_KEY: "dummy",
    RIVERBANC_HANDSHAKE_HMAC_SECRET: secret,
    RIVERBANC_HANDSHAKE_TENANT_MAP: JSON.stringify({ "Synthetic Lender": "Test" }),
  };
  let handler!: (req: Request) => Promise<Response>;
  const parsed = ts.createSourceFile(
    "index.ts",
    readFileSync(new URL("./index.ts", import.meta.url), "utf8"),
    ts.ScriptTarget.ES2022,
    true,
  );
  const source = parsed.statements
    .filter((x) => !ts.isImportDeclaration(x))
    .map((x) => x.getFullText(parsed))
    .join("\n");
  runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
    }).outputText,
    {
      Request,
      Response,
      TextEncoder,
      crypto,
      verifyStatus,
      validateStatus,
      RequestError: class extends Error {},
      readBoundedText: (r: Request) => r.text(),
      requireJson: () => {},
      enforceRateLimit: async () => {},
      createClient: () => ({ from: () => q, rpc }),
      Deno: {
        env: { get: (k: string) => env[k] },
        serve: (f: typeof handler) => {
          handler = f;
        },
      },
    },
  );
  const response = await handler(
    new Request("https://example.invalid/handshake-status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-riverbanc-timestamp": time,
        "x-riverbanc-signature": patch.badSignature
          ? "0".repeat(64)
          : await signStatus(time, raw, secret),
      },
      body: raw,
    }),
  );
  return { response, rpc };
}
describe("authenticated status callback", () => {
  it("rejects invalid signatures before database access", async () => {
    const r = await fixture({ badSignature: true });
    expect(r.response.status).toBe(401);
    expect(r.rpc).not.toHaveBeenCalled();
  });
  it("binds every callback to the selected lender", async () => {
    const r = await fixture({ tenant: "Other" });
    expect(r.response.status).toBe(403);
    expect(r.rpc).not.toHaveBeenCalled();
  });
  it("applies valid preapproval without treating it as final approval", async () => {
    const r = await fixture();
    expect(r.response.status).toBe(200);
    expect(r.rpc).toHaveBeenCalledWith(
      "apply_handshake_status",
      expect.objectContaining({
        p_status: "pre_approved",
        p_version: 1,
        p_expected_lender: "Synthetic Lender",
      }),
    );
  });
  it("surfaces version conflicts for controlled retries", async () => {
    expect((await fixture({ rpcCode: "23505" })).response.status).toBe(409);
  });
  it("rejects malformed version identities", async () => {
    const r = await fixture({ version: 2 });
    expect(r.response.status).toBe(400);
    expect(r.rpc).not.toHaveBeenCalled();
  });
});
