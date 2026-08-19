export interface CRBProviderRequest {
  nrc_number: string;
  full_name: string;
}

export interface CRBProviderResponse {
  credit_score: number;
  open_accounts: number;
  adverse_count: number;
  total_outstanding_zmw: number;
  probability_of_default?: number;
  status?: string;
}

export class CRBProviderNotConfiguredError extends Error {
  constructor() {
    super("CRB provider is not configured");
    this.name = "CRBProviderNotConfiguredError";
  }
}

export class CRBProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CRBProviderError";
  }
}

/**
 * Production adapter boundary for the CRB provider.
 *
 * The provider endpoint/request contract is intentionally configuration-driven.
 * Once CRB supplies the production API contract and credentials, only the
 * adapter implementation/configuration needs to be completed; callers should
 * not need to change their Riverbanc-facing contract.
 */
export async function fetchCRBReport(
  request: CRBProviderRequest,
): Promise<CRBProviderResponse> {
  const endpoint = Deno.env.get("CRB_API_URL");
  const apiKey = Deno.env.get("CRB_API_KEY");

  if (!endpoint || !apiKey) {
    throw new CRBProviderNotConfiguredError();
  }

  // Provider-specific request/response mapping belongs here once CRB's
  // production API contract is supplied. Never fabricate bureau results.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new CRBProviderError(`CRB provider returned HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data || typeof data !== "object") {
      throw new CRBProviderError("CRB provider returned an invalid response");
    }

    throw new CRBProviderError(
      "CRB provider response mapping is not configured; refusing to interpret an unknown production contract",
    );
  } catch (error) {
    if (error instanceof CRBProviderError || error instanceof CRBProviderNotConfiguredError) {
      throw error;
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new CRBProviderError("CRB provider request timed out");
    }
    throw new CRBProviderError("CRB provider request failed");
  } finally {
    clearTimeout(timeout);
  }
}
