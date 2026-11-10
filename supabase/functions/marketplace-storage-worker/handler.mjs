const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const tokenHash = async (token) =>
  new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)),
  );
async function sameToken(a, b) {
  return timingSafeEqual(await tokenHash(a), await tokenHash(b));
}
export function makeHandler({ token, page, object, read, record }) {
  return async (req) => {
    const headers = {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, private",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    };
    const fail = (status, code) =>
      new Response(JSON.stringify({ error: code }), { status, headers });
    if (!token || !/^[A-Za-z0-9_-]{43,128}$/.test(token))
      return fail(503, "WORKER_NOT_CONFIGURED");
    if (req.headers.get("origin")) return fail(403, "SERVER_WORKER_ONLY");
    if (req.method !== "POST") return fail(405, "POST_REQUIRED");
    const supplied = req.headers
      .get("authorization")
      ?.match(/^Bearer ([A-Za-z0-9_-]{43,128})$/)?.[1];
    if (!supplied || !(await sameToken(supplied, token)))
      return fail(401, "AUTH_REQUIRED");
    if (req.headers.get("content-type")?.split(";")[0] !== "application/json")
      return fail(415, "JSON_REQUIRED");
    try {
      const reader = req.body?.getReader();
      if (!reader) return fail(400, "INVALID_REQUEST");
      let size = 0;
      const chunks = [];
      let timer;
      const deadline = new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error("BODY_TIMEOUT")), 5000);
      });
      try {
        for (;;) {
          const { done, value } = await Promise.race([reader.read(), deadline]);
          if (done) break;
          size += value.length;
          if (size > 4096) return fail(413, "REQUEST_TOO_LARGE");
          chunks.push(value);
        }
      } finally {
        clearTimeout(timer);
        await reader.cancel().catch(() => {});
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const c of chunks) {
        bytes.set(c, offset);
        offset += c.length;
      }
      const body = JSON.parse(new TextDecoder().decode(bytes));
      if (body.action === "page") {
        if (
          (body.after !== null && !UUID.test(body.after)) ||
          typeof body.before !== "string" ||
          !Number.isFinite(Date.parse(body.before))
        )
          return fail(400, "INVALID_REQUEST");
        return new Response(
          JSON.stringify(await page(body.after, body.before)),
          { headers },
        );
      }
      if (
        !UUID.test(body.id) ||
        typeof body.version !== "string" ||
        !body.version ||
        body.version.length > 128
      )
        return fail(400, "INVALID_REQUEST");
      if (body.action === "read") {
        const current = await object(body.id);
        if (!current || current.version !== body.version)
          return fail(409, "SOURCE_CHANGED");
        const data = await read(current);
        if (
          !data.length ||
          data.length > 10 * 1024 * 1024 ||
          data.length !== Number(current.metadata?.size)
        )
          return fail(409, "INVALID_SOURCE_SIZE");
        const latest = await object(body.id);
        if (!latest || latest.version !== body.version)
          return fail(409, "SOURCE_CHANGED");
        return new Response(data, {
          headers: { ...headers, "Content-Type": "application/octet-stream" },
        });
      }
      if (body.action === "scan") {
        await record(body);
        return new Response("null", { headers });
      }
      return fail(400, "INVALID_REQUEST");
    } catch {
      return fail(503, "WORKER_OPERATION_FAILED");
    }
  };
}
import { timingSafeEqual } from "node:crypto";
