import {
  sha,
  sign,
  verify,
  requestText,
  responseText,
  UUID,
  bounded,
  zip,
} from "./protocol.mjs";
export function makeExport({
  secret,
  tenantMap,
  context,
  read,
  audit,
  now = Date.now,
}) {
  return async (req) => {
    const headers = {
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    };
    const fail = (status, error) =>
      new Response(JSON.stringify({ error }), {
        status,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    if (!secret || secret.length < 32 || !tenantMap)
      return fail(503, "KYC_SOURCE_NOT_CONFIGURED");
    if (req.method !== "POST" || req.headers.has("origin"))
      return fail(403, "SERVER_ONLY");
    if (now() >= Date.parse("2026-11-30T22:00:00Z"))
      return fail(503, "PILOT_ENDED");
    try {
      if (req.headers.get("content-type")?.split(";")[0] !== "application/json")
        return fail(415, "JSON_REQUIRED");
      const raw = new TextDecoder("utf8", { fatal: true }).decode(
        await bounded(req.body, 4096),
      );
      const timestamp = req.headers.get("x-riverbanc-timestamp") || "";
      if (
        !/^\d{10}$/.test(timestamp) ||
        Math.abs(now() / 1000 - Number(timestamp)) > 60 ||
        !verify(
          secret,
          requestText(timestamp, raw),
          req.headers.get("x-riverbanc-signature"),
        )
      )
        return fail(401, "SIGNATURE_REQUIRED");
      const body = JSON.parse(raw);
      if (
        Object.keys(body).sort().join(",") !==
          "attempt_id,operation,package_fingerprint,reference,request_id,tenant_short_name" ||
        !["prepare", "check"].includes(body.operation) ||
        !UUID.test(body.request_id) ||
        !UUID.test(body.attempt_id) ||
        !/^RBH-[0-9a-f-]{36}$/.test(body.reference) ||
        !UUID.test(body.reference.slice(4)) ||
        !/^[a-f0-9]{64}$/.test(body.package_fingerprint)
      )
        return fail(400, "INVALID_REQUEST");
      const lenders = Object.keys(tenantMap).filter(
        (name) => tenantMap[name] === body.tenant_short_name,
      );
      if (lenders.length !== 1) return fail(403, "LENDER_MAPPING_REQUIRED");
      const initial = await context(
        body.reference.slice(4),
        lenders[0],
        body.operation === "prepare" ? body.attempt_id : null,
      );
      if (
        !initial ||
        !Array.isArray(initial.documents) ||
        initial.documents.length !== 6
      )
        return fail(409, "VERIFIED_PACKAGE_REQUIRED");
      if (body.operation === "check")
        return new Response(
          JSON.stringify({ source_fingerprint: initial.source_fingerprint }),
          {
            headers: {
              ...headers,
              "Content-Type": "application/json",
              "X-KYC-Signature": sign(
                secret,
                responseText(body, "check", initial.source_fingerprint),
              ),
            },
          },
        );
      const entries = [],
        manifest = [];
      let total = 0;
      for (const d of initial.documents) {
        if (
          !UUID.test(d.id) ||
          !["NRC", "GOV_ID", "PAYSLIP", "INTRODUCTORY_LETTER"].includes(
            d.type,
          ) ||
          !/\.(pdf|png|jpe?g)$/.test(d.path) ||
          !Number.isSafeInteger(d.size) ||
          d.size < 1 ||
          d.size > 5242880
        )
          throw Error("INVALID_DOCUMENT");
        const bytes = await read(d.path);
        total += bytes.length;
        if (
          bytes.length !== d.size ||
          total > 20971520 ||
          sha(bytes) !== d.sha256
        )
          throw Error("DOCUMENT_CHANGED");
        const ext = d.path.split(".").pop();
        const filename = `${d.type}${d.period ? "-" + d.period : ""}.${ext}`;
        entries.push([filename, bytes]);
        manifest.push({ filename, sha256: d.sha256, size: d.size });
      }
      const latest = await context(body.reference.slice(4), lenders[0], null);
      if (latest.source_fingerprint !== initial.source_fingerprint)
        throw Error("SOURCE_CHANGED");
      entries.push([
        "borrower-details.json",
        new TextEncoder().encode(JSON.stringify(initial.borrower)),
      ]);
      entries.push([
        "manifest.json",
        new TextEncoder().encode(
          JSON.stringify({
            format: "Riverbanc-KYC-v1",
            request_id: body.request_id,
            source_fingerprint: initial.source_fingerprint,
            verification: "exact-source-document-clean-scans",
            documents: manifest,
          }),
        ),
      ]);
      const bytes = zip(entries),
        hash = sha(bytes);
      await audit(
        body.request_id,
        body.reference.slice(4),
        hash,
        initial.source_fingerprint,
      );
      return new Response(bytes, {
        headers: {
          ...headers,
          "Content-Type": "application/zip",
          "X-KYC-SHA256": hash,
          "X-KYC-Source-Fingerprint": initial.source_fingerprint,
          "X-KYC-Signature": sign(
            secret,
            responseText(body, hash, initial.source_fingerprint),
          ),
        },
      });
    } catch {
      return fail(409, "KYC_SOURCE_NOT_READY");
    }
  };
}
