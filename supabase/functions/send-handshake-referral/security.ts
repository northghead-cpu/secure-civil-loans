// Shared by the two referral endpoints. Keep copies identical across repositories.
export class RequestError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}

export async function readBoundedText(message: Request | Response, maxBytes: number, timeoutMs = 5000) {
  const length = message.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > maxBytes)) {
    throw new RequestError(413, "PAYLOAD_TOO_LARGE");
  }
  const reader = message.body?.getReader();
  if (!reader) return "";
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
    try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
    catch { throw new RequestError(400, "INVALID_ENCODING"); }
  } finally {
    clearTimeout(timer!);
    void reader.cancel().catch(() => {});
  }
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

export function parseObject(text: string, allowedKeys: readonly string[]) {
  let input: unknown;
  try { input = JSON.parse(text); } catch { throw new RequestError(400, "INVALID_JSON"); }
  if (!input || typeof input !== "object" || Array.isArray(input) ||
      Object.keys(input).some(key => !allowedKeys.includes(key))) {
    throw new RequestError(400, "INVALID_REQUEST");
  }
  return input as Record<string, unknown>;
}

export function handshakeTarget(value: string) {
  const target = new URL(value);
  if (target.origin !== "https://ueveurmphygyofwoyljj.supabase.co" ||
      target.pathname !== "/functions/v1/marketplace-intake" ||
      target.username || target.password || target.search || target.hash) {
    throw new Error("Invalid Handshake destination");
  }
  return target;
}

type RateClient = { rpc: (name: string, args: Record<string, string>) => PromiseLike<{ data: unknown; error: unknown }> };
export async function enforceRateLimit(client: RateClient, scope: string, subject: string) {
  const { data, error } = await client.rpc("consume_referral_api_limit", { p_scope: scope, p_subject: subject });
  if (error || !data || typeof data !== "object" || typeof (data as { allowed?: unknown }).allowed !== "boolean") {
    throw new RequestError(503, "RATE_LIMIT_UNAVAILABLE");
  }
  if (!(data as { allowed: boolean }).allowed) throw new RequestError(429, "RATE_LIMITED");
}
