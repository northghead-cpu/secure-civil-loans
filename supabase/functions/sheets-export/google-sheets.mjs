// Direct Google API access. Credentials never leave the server or enter logs.
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API_ORIGIN = "https://sheets.googleapis.com";
const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const encoder = new TextEncoder();
export class SheetsSetupError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}
export class ProviderError extends Error {
  constructor(status) {
    super("GOOGLE_SHEETS_REQUEST_FAILED");
    this.status = status;
  }
}
export function spreadsheetId(value) {
  let id = typeof value === "string" ? value.trim() : "";
  if (id.startsWith("https://")) {
    let url;
    try {
      url = new URL(id);
    } catch {
      throw new SheetsSetupError("INVALID_WORKBOOK");
    }
    if (url.origin !== "https://docs.google.com" || url.username || url.password)
      throw new SheetsSetupError("INVALID_WORKBOOK");
    id = /^\/spreadsheets\/d\/([A-Za-z0-9_-]{10,200})(?:\/edit|\/)?$/.exec(url.pathname)?.[1] ?? "";
  }
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(id))
    throw new SheetsSetupError(id ? "INVALID_WORKBOOK" : "WORKBOOK_REQUIRED");
  return id;
}
function base64url(bytes) {
  if (typeof bytes === "string") bytes = encoder.encode(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
export function createSheetsConnection({ secret, fetcher = fetch, now = Date.now }) {
  let account = null,
    setupCode = "GOOGLE_CREDENTIALS_MISSING";
  if (secret?.trim()) {
    setupCode = "GOOGLE_CREDENTIALS_INVALID";
    try {
      const parsed = JSON.parse(secret);
      if (
        parsed?.type === "service_account" &&
        typeof parsed.client_email === "string" &&
        /^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+\.iam\.gserviceaccount\.com$/.test(parsed.client_email) &&
        typeof parsed.private_key === "string" &&
        /^-----BEGIN PRIVATE KEY-----[\s\S]+-----END PRIVATE KEY-----\s*$/.test(parsed.private_key)
      ) {
        account = parsed;
        setupCode = null;
      }
    } catch {
      /* Report a fixed setup code; never echo the credential. */
    }
  }
  let cached = null;
  let pending = null;
  const status = () => ({
    configured: !!account,
    provider: "google_service_account",
    serviceAccountEmail: account?.client_email ?? null,
    setupCode,
  });
  async function token() {
    if (!account) throw new SheetsSetupError(setupCode);
    if (cached && cached.expiresAt > now() + 60000) return cached.value;
    if (pending) return pending;
    pending = (async () => {
      try {
        const seconds = Math.floor(now() / 1000);
        const claim = base64url(
          JSON.stringify({
            iss: account.client_email,
            scope: SCOPE,
            aud: TOKEN_URL,
            iat: seconds,
            exp: seconds + 3600,
          }),
        );
        const unsigned = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" })) + "." + claim;
        const pem = account.private_key.replace(
          /-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,
          "",
        );
        let key;
        try {
          key = await crypto.subtle.importKey(
            "pkcs8",
            Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)),
            { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
            false,
            ["sign"],
          );
          if (key.algorithm.modulusLength < 2048) throw Error();
        } catch {
          throw new SheetsSetupError("GOOGLE_CREDENTIALS_INVALID");
        }
        const signature = await crypto.subtle.sign(
          "RSASSA-PKCS1-v1_5",
          key,
          encoder.encode(unsigned),
        );
        const response = await fetcher(TOKEN_URL, {
          method: "POST",
          redirect: "error",
          signal: AbortSignal.timeout(15000),
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
            assertion: unsigned + "." + base64url(new Uint8Array(signature)),
          }),
        });
        const result = await response.json().catch(() => ({}));
        if (
          !response.ok ||
          typeof result.access_token !== "string" ||
          !Number.isFinite(result.expires_in) ||
          result.expires_in <= 0
        )
          throw new ProviderError(401);
        cached = {
          value: result.access_token,
          expiresAt: now() + Math.min(result.expires_in, 3600) * 1000,
        };
        return cached.value;
      } catch (error) {
        if (error instanceof SheetsSetupError || error instanceof ProviderError) throw error;
        throw new ProviderError(503);
      }
    })();
    try {
      return await pending;
    } finally {
      pending = null;
    }
  }
  async function request(path, init = {}) {
    // The caller builds paths from validated workbook IDs and fixed tab names.
    // Never honor an arbitrary URL or redirect from configuration or a provider.
    if (
      !/^\/spreadsheets\/[A-Za-z0-9_-]{10,200}(?:[/?:]|$)/.test(path) ||
      path.includes("..") ||
      path.includes("#") ||
      /[\r\n]/.test(path)
    )
      throw new SheetsSetupError("INVALID_WORKBOOK");
    const url = new URL(API_ORIGIN + "/v4" + path);
    if (url.origin !== API_ORIGIN) throw new SheetsSetupError("INVALID_WORKBOOK");
    try {
      const response = await fetcher(url.toString(), {
        ...init,
        redirect: "error",
        signal: AbortSignal.timeout(15000),
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + (await token()) },
      });
      if (!response.ok) {
        if (response.status === 401) cached = null;
        // Discard raw provider bodies, which may contain private cell values.
        await response.body?.cancel();
        throw new ProviderError(response.status);
      }
      return await response.json();
    } catch (error) {
      if (error instanceof SheetsSetupError || error instanceof ProviderError) throw error;
      throw new ProviderError(503);
    }
  }
  return { status, request };
}
