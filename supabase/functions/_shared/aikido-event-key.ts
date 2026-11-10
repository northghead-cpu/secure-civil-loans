/** Identity is bound to the complete signed provider event, not lossy coercion. */
export async function aikidoEventKey(payload: Record<string, unknown>): Promise<string> {
  const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical)
    : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0).map(([k,v]) => [k, canonical(v)])) : value;
  // Dispatch time is delivery metadata and may change on retry. Preserve native
  // number/string types of all event identifiers and the full event payload.
  const event = { ...payload }; delete event.dispatched_at;
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(canonical(event))));
  return "aikido:v2:" + Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2,"0")).join("");
}
