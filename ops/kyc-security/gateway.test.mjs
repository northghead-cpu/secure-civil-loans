import { test } from "node:test";
import assert from "node:assert/strict";
import { makeHandler } from "../../supabase/functions/marketplace-storage-worker/handler.mjs";
const token = "synthetic-only-worker-credential".repeat(2),
  id = "11111111-1111-4111-8111-111111111111";
const req = (body, headers = {}) =>
  new Request("https://example.invalid/worker", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
function fixture(overrides = {}) {
  const calls = [];
  const handler = makeHandler({
    token,
    async page() {
      calls.push("page");
      return [];
    },
    async object() {
      return { id, version: "v1", metadata: { size: 4 } };
    },
    async read() {
      calls.push("read");
      return new Uint8Array([1, 2, 3, 4]);
    },
    async record() {
      calls.push("record");
    },
    ...overrides,
  });
  return { handler, calls };
}
test("Missing worker secret leaves the gateway disabled", async () => {
  const { handler, calls } = fixture({ token: undefined });
  assert.equal(
    (
      await handler(
        req({ action: "page", after: null, before: new Date().toISOString() }),
      )
    ).status,
    503,
  );
  assert.deepEqual(calls, []);
});
test("User JWTs and incorrect credentials cannot become worker authority", async () => {
  const { handler, calls } = fixture();
  assert.equal(
    (await handler(req({}, { Authorization: "Bearer eyJ.invalid.jwt" })))
      .status,
    401,
  );
  assert.deepEqual(calls, []);
});
test("Browser-origin calls are rejected", async () => {
  const { handler, calls } = fixture();
  assert.equal(
    (await handler(req({}, { Origin: "https://www.riverbanc.co.zm" }))).status,
    403,
  );
  assert.deepEqual(calls, []);
});
test("Authorized worker can list its bounded source page", async () => {
  const { handler, calls } = fixture();
  const response = await handler(
    req({ action: "page", after: null, before: new Date().toISOString() }),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), []);
  assert.deepEqual(calls, ["page"]);
});
test("Exact-version object downloads have private no-store headers", async () => {
  const { handler, calls } = fixture();
  const response = await handler(req({ action: "read", id, version: "v1" }));
  assert.equal(response.status, 200);
  assert.equal((await response.arrayBuffer()).byteLength, 4);
  assert.ok(response.headers.get("cache-control").includes("no-store"));
  assert.deepEqual(calls, ["read"]);
});
test("Changed versions cannot be read", async () => {
  const { handler, calls } = fixture();
  assert.equal(
    (await handler(req({ action: "read", id, version: "wrong" }))).status,
    409,
  );
  assert.deepEqual(calls, []);
});
test("Changes during a fetch block the returned bytes", async () => {
  let n = 0;
  const { handler } = fixture({
    async object() {
      return { version: ++n === 1 ? "v1" : "v2", metadata: { size: 4 } };
    },
  });
  assert.equal(
    (await handler(req({ action: "read", id, version: "v1" }))).status,
    409,
  );
});
test("Source object size is checked before release", async () => {
  const { handler } = fixture({
    async read() {
      return new Uint8Array([1]);
    },
  });
  assert.equal(
    (await handler(req({ action: "read", id, version: "v1" }))).status,
    409,
  );
});
test("Oversized request bodies fail before any operation", async () => {
  const { handler, calls } = fixture();
  assert.equal((await handler(req({ value: "x".repeat(5000) }))).status, 413);
  assert.deepEqual(calls, []);
});
test("Internal failures do not disclose source paths or credentials", async () => {
  const { handler } = fixture({
    async record() {
      throw Error("sensitive internal source path");
    },
  });
  const response = await handler(req({ action: "scan", id, version: "v1" }));
  assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes("sensitive"));
});
