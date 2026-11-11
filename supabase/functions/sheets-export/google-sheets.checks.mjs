import test from "node:test";
import assert from "node:assert/strict";
import {
  createSheetsConnection,
  spreadsheetId,
  SheetsSetupError,
  ProviderError,
} from "./google-sheets.mjs";
const id = "synthetic_workbook_123456789";
const keyPair = await crypto.subtle.generateKey(
  {
    name: "RSASSA-PKCS1-v1_5",
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: "SHA-256",
  },
  true,
  ["sign", "verify"],
);
const pem = Buffer.from(await crypto.subtle.exportKey("pkcs8", keyPair.privateKey)).toString(
  "base64",
);
const account = {
  type: "service_account",
  client_email: "reporting@synthetic-project.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\n" + pem + "\n-----END PRIVATE KEY-----\n",
  token_uri: "https://attacker.invalid/steal",
};
const secret = JSON.stringify(account);
const decode = (value) => JSON.parse(Buffer.from(value, "base64url").toString());
test("workbook IDs and links normalize without allowing arbitrary destinations", () => {
  assert.equal(spreadsheetId(id), id);
  assert.equal(spreadsheetId(`https://docs.google.com/spreadsheets/d/${id}/edit#gid=0`), id);
  for (const v of [
    "https://attacker.invalid/" + id,
    "https://docs.google.com.attacker.invalid/spreadsheets/d/" + id,
    "../escape",
    `${id}/values/other`,
    "https://docs.google.com/spreadsheets/d/e/2PACX/edit",
  ]) {
    assert.throws(() => spreadsheetId(v), SheetsSetupError);
  }
  assert.throws(
    () => spreadsheetId(""),
    (e) => e.code === "WORKBOOK_REQUIRED",
  );
});
test("missing, malformed and wrong credential types fail closed without requests", async () => {
  for (const value of [
    undefined,
    "{",
    JSON.stringify({ ...account, type: "authorized_user" }),
    JSON.stringify({ ...account, client_email: "attacker@example.invalid" }),
  ]) {
    let called = false;
    const api = createSheetsConnection({
      secret: value,
      fetcher: async () => {
        called = true;
      },
    });
    assert.equal(api.status().configured, false);
    await assert.rejects(api.request(`/spreadsheets/${id}`), SheetsSetupError);
    assert.equal(called, false);
  }
});
test("direct OAuth JWT is correctly signed, scoped and pinned; token is cached", async () => {
  let requests = 0,
    tokens = 0;
  let clock = Date.now();
  const api = createSheetsConnection({
    secret,
    now: () => clock,
    fetcher: async (url, init) => {
      requests++;
      assert.equal(init.redirect, "error");
      if (url === "https://oauth2.googleapis.com/token") {
        tokens++;
        const assertion = init.body.get("assertion"),
          parts = assertion.split(".");
        assert.equal(decode(parts[0]).alg, "RS256");
        const claims = decode(parts[1]);
        assert.equal(claims.aud, "https://oauth2.googleapis.com/token");
        assert.equal(claims.scope, "https://www.googleapis.com/auth/spreadsheets");
        assert.equal(claims.sub, undefined);
        assert.equal(claims.exp - claims.iat, 3600);
        assert.equal(
          await crypto.subtle.verify(
            "RSASSA-PKCS1-v1_5",
            keyPair.publicKey,
            Buffer.from(parts[2], "base64url"),
            new TextEncoder().encode(parts[0] + "." + parts[1]),
          ),
          true,
        );
        return Response.json({ access_token: "dummy-access-token", expires_in: 3600 });
      }
      assert.ok(url.startsWith(`https://sheets.googleapis.com/v4/spreadsheets/${id}`));
      assert.equal(init.headers.Authorization, "Bearer dummy-access-token");
      return Response.json({ spreadsheetId: id });
    },
  });
  await Promise.all([api.request(`/spreadsheets/${id}`), api.request(`/spreadsheets/${id}`)]);
  assert.equal(tokens, 1);
  assert.equal(requests, 3);
  clock += 3590 * 1000;
  await api.request(`/spreadsheets/${id}`);
  assert.equal(tokens, 2);
  const status = JSON.stringify(api.status());
  assert.ok(!status.includes(pem));
  assert.ok(!status.includes("dummy-access-token"));
});
test("invalid API paths are rejected before signing or contacting Google", async () => {
  let calls = 0;
  const api = createSheetsConnection({
    secret,
    fetcher: async () => {
      calls++;
    },
  });
  for (const p of [
    "https://attacker.invalid/steal",
    "/spreadsheets",
    `/spreadsheets/${id}/../other`,
    `/spreadsheets/${id}#bad`,
  ])
    await assert.rejects(api.request(p), SheetsSetupError);
  assert.equal(calls, 0);
});
test("private-key import errors and OAuth errors disclose fixed codes only", async () => {
  const invalid = createSheetsConnection({
    secret: JSON.stringify({
      ...account,
      private_key: "-----BEGIN PRIVATE KEY-----\nBAD\n-----END PRIVATE KEY-----",
    }),
  });
  await assert.rejects(
    invalid.request(`/spreadsheets/${id}`),
    (e) => e.code === "GOOGLE_CREDENTIALS_INVALID" && !e.message.includes("BAD"),
  );
  const denied = createSheetsConnection({
    secret,
    fetcher: async () => Response.json({ error: "PRIVATE-SECRET" }, { status: 400 }),
  });
  await assert.rejects(
    denied.request(`/spreadsheets/${id}`),
    (e) => e instanceof ProviderError && e.status === 401 && !e.message.includes("PRIVATE"),
  );
});
test("provider bodies are discarded and failed writes are not retried", async () => {
  let writes = 0;
  const api = createSheetsConnection({
    secret,
    fetcher: async (url) => {
      if (url === "https://oauth2.googleapis.com/token")
        return Response.json({ access_token: "dummy", expires_in: 3600 });
      writes++;
      return new Response("CUSTOMER-PRIVATE-CELL-CONTENT", { status: 403 });
    },
  });
  await assert.rejects(
    api.request(`/spreadsheets/${id}/values:batchUpdate`, { method: "POST", body: "{}" }),
    (e) => e.status === 403 && !e.message.includes("CUSTOMER"),
  );
  assert.equal(writes, 1);
});
