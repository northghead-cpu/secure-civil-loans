import { timingSafeEqual, createHmac, createHash } from "node:crypto";
export const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
export const sign = (secret, text) =>
  createHmac("sha256", secret).update(text).digest("hex");
export function verify(secret, text, supplied) {
  return (
    /^[a-f0-9]{64}$/.test(supplied || "") &&
    timingSafeEqual(
      Buffer.from(sign(secret, text), "hex"),
      Buffer.from(supplied, "hex"),
    )
  );
}
export const requestText = (timestamp, body) =>
  `v1.kyc-export.${timestamp}.${body}`;
export const responseText = (body, hash, fingerprint) =>
  `v1.kyc-package.${body.request_id}.${body.attempt_id}.${hash}.${fingerprint}`;
export const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export async function bounded(stream, max, ms = 10000) {
  if (!stream) throw Error("BODY_REQUIRED");
  const reader = stream.getReader();
  const chunks = [];
  let size = 0,
    timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Error("BODY_TIMEOUT")), ms);
  });
  try {
    for (;;) {
      const { done, value } = await Promise.race([reader.read(), deadline]);
      if (done) break;
      size += value.length;
      if (size > max) throw Error("BODY_LIMIT");
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
  return bytes;
}
// Deterministic STORE-only ZIP: no external names, links, paths or compression.
export function zip(entries) {
  const records = [],
    central = [];
  let offset = 0;
  const table = Uint32Array.from({ length: 256 }, (_, i) => {
    let c = i;
    for (let n = 0; n < 8; n++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    return c >>> 0;
  });
  const crc = (bytes) => {
    let c = 0xffffffff;
    for (const b of bytes) c = (c >>> 8) ^ table[(c ^ b) & 255];
    return (c ^ 0xffffffff) >>> 0;
  };
  const header = (size) => {
    const b = new Uint8Array(size);
    return [b, new DataView(b.buffer)];
  };
  const names = new Set();
  for (const [name, data] of entries) {
    if (
      !/^[A-Za-z0-9_-]+\.(pdf|png|jpg|jpeg|json)$/.test(name) ||
      names.has(name)
    )
      throw Error("ZIP_NAME");
    names.add(name);
    const n = new TextEncoder().encode(name),
      check = crc(data);
    const [h, v] = header(30);
    v.setUint32(0, 0x04034b50, true);
    v.setUint16(4, 20, true);
    v.setUint16(12, 33, true);
    v.setUint32(14, check, true);
    v.setUint32(18, data.length, true);
    v.setUint32(22, data.length, true);
    v.setUint16(26, n.length, true);
    records.push(h, n, data);
    const [c, w] = header(46);
    w.setUint32(0, 0x02014b50, true);
    w.setUint16(4, 20, true);
    w.setUint16(6, 20, true);
    w.setUint16(14, 33, true);
    w.setUint32(16, check, true);
    w.setUint32(20, data.length, true);
    w.setUint32(24, data.length, true);
    w.setUint16(28, n.length, true);
    w.setUint32(42, offset, true);
    central.push(c, n);
    offset += h.length + n.length + data.length;
  }
  const centralSize = central.reduce((n, b) => n + b.length, 0);
  const [end, e] = header(22);
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, entries.length, true);
  e.setUint16(10, entries.length, true);
  e.setUint32(12, centralSize, true);
  e.setUint32(16, offset, true);
  const all = [...records, ...central, end],
    size = all.reduce((n, b) => n + b.length, 0);
  if (size > 26214400) throw Error("ZIP_LIMIT");
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const b of all) {
    bytes.set(b, at);
    at += b.length;
  }
  return bytes;
}
