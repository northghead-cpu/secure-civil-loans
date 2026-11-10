export class RequestError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}

export async function readBoundedBytes(message: Request | Response, maxBytes: number, timeoutMs = 5000): Promise<Uint8Array> {
  const length = message.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > maxBytes)) {
    throw new RequestError(413, "PAYLOAD_TOO_LARGE");
  }
  const reader = message.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new RequestError(408, "BODY_TIMEOUT")), timeoutMs);
  });
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), deadline]);
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new RequestError(413, "PAYLOAD_TOO_LARGE");
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return bytes;
  } finally {
    clearTimeout(timer!);
    void reader.cancel().catch(() => {});
  }
}

export async function readBoundedText(message: Request | Response, maxBytes: number, timeoutMs = 5000) {
  const bytes = await readBoundedBytes(message, maxBytes, timeoutMs);
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { throw new RequestError(400, "INVALID_ENCODING"); }
}

export function requireJson(req: Request) {
  if (req.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new RequestError(415, "JSON_REQUIRED");
  }
  if (req.headers.get("content-encoding") && req.headers.get("content-encoding") !== "identity") {
    throw new RequestError(415, "CONTENT_ENCODING_NOT_SUPPORTED");
  }
  const version = req.headers.get("x-riverbanc-api-version");
  if (version !== null && version !== "1") throw new RequestError(400, "UNSUPPORTED_API_VERSION");
}
