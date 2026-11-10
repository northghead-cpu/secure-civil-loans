import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

/**
 * Client for the cached `reference-data` edge function.
 *
 * All resources here are non-sensitive (public catalogue, comparison maths,
 * underwriting/CRB reference tables). If the server-side cache is disabled the
 * function still returns fresh database reads — callers see no difference.
 */
export type ReferenceResource =
  | "catalogue"
  | "comparison"
  | "underwriting-reference"
  | "crb-reference";

async function invoke<T>(
  method: "GET" | "POST",
  query: Record<string, string> = {},
  body?: unknown,
): Promise<T> {
  const search = new URLSearchParams(query).toString();
  const { data, error } = await supabase.functions.invoke<{ data: T }>(
    `reference-data${search ? `?${search}` : ""}`,
    { method, ...(body ? { body } : {}) },
  );
  if (error) throw error;
  return (data as { data: T }).data;
}

export const referenceDataService = {
  getCatalogue: () => invoke<unknown[]>("GET", { resource: "catalogue" }),

  getComparison: (amount: number, termMonths: number) =>
    invoke<unknown[]>("GET", {
      resource: "comparison",
      amount: String(amount),
      term: String(termMonths),
    }),

  getUnderwritingReference: () =>
    invoke<Record<string, unknown>>("GET", { resource: "underwriting-reference" }),

  getCRBReference: () => invoke<Record<string, unknown>>("GET", { resource: "crb-reference" }),

  /**
   * Invalidate cached reads after an admin write. Best-effort: a failure here
   * only means entries expire on their TTL instead of immediately.
   */
  async invalidate(resource?: ReferenceResource): Promise<void> {
    try {
      await supabase.functions.invoke("reference-data", {
        method: "POST",
        body: { action: "invalidate", ...(resource ? { resource } : {}) },
      });
    } catch (e) {
      logger.warn("[referenceData] cache invalidation skipped");
    }
  },
};
