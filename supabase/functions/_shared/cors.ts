const ALLOWED_RIVERBANC_ORIGINS = new Set([
  "https://riverbanc.co.zm",
  "https://www.riverbanc.co.zm",
  "https://riverbanc-tech-git-main-riverbank1.vercel.app",
  "https://riverbanc-tech-riverbank1.vercel.app",
  "https://secure-civil-loans.vercel.app",
  "https://riverbanc-tech-l8vpknneo-riverbank1.vercel.app",
]);

/** Build per-request CORS headers; never reflect an untrusted Origin. */
export function corsHeadersFor(req: Request, methods: string): Record<string, string> {
  const origin = req.headers.get("origin");
  return {
    ...(origin && ALLOWED_RIVERBANC_ORIGINS.has(origin)
      ? { "Access-Control-Allow-Origin": origin }
      : {}),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-id",
    "Access-Control-Allow-Methods": methods,
    "Vary": "Origin",
  };
}
