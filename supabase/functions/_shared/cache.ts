/**
 * Upstash Redis REST cache helper for Supabase Edge Functions.
 *
 * Design rules:
 *  - OPTIONAL: enabled only when UPSTASH_REDIS_REST_URL and
 *    UPSTASH_REDIS_REST_TOKEN are both present. Otherwise every helper is a
 *    no-op and callers fall through to the database. No behaviour change.
 *  - FAIL-OPEN: any network/HTTP/parse failure is swallowed (logged only) and
 *    treated as a cache miss. A cache outage must never break a request.
 *  - NON-SENSITIVE ONLY: never pass PII, KYC documents, auth sessions/tokens,
 *    or customer-specific financial data to these helpers. Use it for public
 *    catalogues, reference data and expensive aggregate reads.
 */

const REST_URL = Deno.env.get("UPSTASH_REDIS_REST_URL")?.replace(/\/+$/, "");
const REST_TOKEN = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");

/** Key prefix so multiple environments can share one Upstash database. */
const NAMESPACE = Deno.env.get("CACHE_NAMESPACE") ?? "riverbanc:dev";

/** Configurable TTLs (seconds). Env overrides allow tuning without redeploy. */
const num = (name: string, fallback: number) => {
  const raw = Deno.env.get(name);
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const CACHE_TTL = {
  /** Lender product catalogue / bank products. */
  catalogue: num("CACHE_TTL_CATALOGUE", 300),
  /** Public comparison results (derived from the catalogue). */
  comparison: num("CACHE_TTL_COMPARISON", 120),
  /** Underwriting reference data (bands, rate tables, limits). */
  reference: num("CACHE_TTL_REFERENCE", 900),
  /** CRB *reference* lookups only (score-band tables, never a person's file). */
  crbReference: num("CACHE_TTL_CRB_REFERENCE", 3600),
  /** Expensive aggregate read queries. */
  aggregate: num("CACHE_TTL_AGGREGATE", 60),
} as const;

const MAX_ATTEMPTS = num("CACHE_MAX_ATTEMPTS", 3);
const TIMEOUT_MS = num("CACHE_TIMEOUT_MS", 1500);

export const cacheEnabled = (): boolean => Boolean(REST_URL && REST_TOKEN);

const key = (k: string) => `${NAMESPACE}:${k}`;

/** Upstash REST pipeline-free single command with retry + backoff. */
async function command<T = unknown>(args: (string | number)[]): Promise<T | null> {
  if (!cacheEnabled()) return null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(REST_URL!, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${REST_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(args),
        signal: controller.signal,
      });
      clearTimeout(timer);

      // 4xx (auth/bad command) will not succeed on retry — bail out quietly.
      if (res.status >= 400 && res.status < 500) {
        console.warn(`[cache] command rejected (${res.status})`);
        return null;
      }
      if (!res.ok) throw new Error(`upstash ${res.status}`);

      const body = (await res.json()) as { result?: T; error?: string };
      if (body.error) {
        console.warn("[cache] upstash error response");
        return null;
      }
      return (body.result ?? null) as T | null;
    } catch (_e) {
      clearTimeout(timer);
      if (attempt === MAX_ATTEMPTS) {
        console.warn("[cache] unavailable, falling back to origin");
        return null;
      }
      await new Promise((r) => setTimeout(r, 100 * 2 ** (attempt - 1)));
    }
  }
  return null;
}

export async function cacheGet<T>(k: string): Promise<T | null> {
  const raw = await command<string>(["GET", key(k)]);
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(k: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    await command(["SET", key(k), JSON.stringify(value), "EX", Math.max(1, ttlSeconds)]);
  } catch {
    /* fail-open */
  }
}

export async function cacheDel(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await command(["DEL", ...keys.map(key)]);
}

/**
 * Delete every key matching a glob pattern (e.g. `catalogue:*`).
 * Uses SCAN so it stays safe on large keyspaces.
 */
export async function cacheDelPattern(pattern: string): Promise<number> {
  if (!cacheEnabled()) return 0;
  let cursor = "0";
  let deleted = 0;
  do {
    const res = await command<[string, string[]]>([
      "SCAN",
      cursor,
      "MATCH",
      key(pattern),
      "COUNT",
      200,
    ]);
    if (!res || !Array.isArray(res)) break;
    cursor = res[0];
    const found = res[1] ?? [];
    if (found.length) {
      // Already fully-qualified keys — call DEL directly.
      await command(["DEL", ...found]);
      deleted += found.length;
    }
  } while (cursor !== "0");
  return deleted;
}

/**
 * Read-through helper: return the cached value or compute + store it.
 * `loader` errors propagate to the caller (a broken origin is a real error).
 */
export async function cached<T>(
  k: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<{ data: T; hit: boolean }> {
  const hitValue = await cacheGet<T>(k);
  if (hitValue !== null) return { data: hitValue, hit: true };
  const data = await loader();
  if (data !== null && data !== undefined) {
    await cacheSet(k, data, ttlSeconds);
  }
  return { data, hit: false };
}
