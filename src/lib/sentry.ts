/** Error telemetry contains no free text, customer context, URLs or replay. */
import * as Sentry from "@sentry/react";
const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const REDACTED = "[redacted]";
const SAFE_CODES = new Set(["PAYMENT_PROVIDER_UNAVAILABLE"]);
const ROUTES = new Set(["/", "/login", "/profile", "/support", "/compare", "/forgot-password", "/reset-password", "/admin"]);

/** Unknown paths, queries and fragments are not safe telemetry. */
export function scrubUrl(value: string): string {
  try {
    const url = new URL(value, "https://placeholder.invalid");
    if (/^\/assets\/[A-Za-z0-9_.-]+\.js$/.test(url.pathname)) return url.pathname;
    return ROUTES.has(url.pathname) ? url.pathname : REDACTED;
  } catch { return REDACTED; }
}

/** Deny unknown fields and values, including numeric or free-form PII. */
export function scrubDeep<T>(input: T, depth = 0): T {
  if (depth > 8) return REDACTED as T;
  if (input === null || input === undefined) return input;
  if (Array.isArray(input)) return input.map(item => scrubDeep(item, depth + 1)) as T;
  if (typeof input !== "object") return REDACTED as T;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    result[key] = key === "safe_code" && typeof value === "string" && SAFE_CODES.has(value) ? value
      : key === "route" && typeof value === "string" ? scrubUrl(value)
      : value !== null && typeof value === "object" ? scrubDeep(value, depth + 1) : REDACTED;
  }
  return result as T;
}

/** Build a fresh event: upstream additions cannot silently broaden collection. */
export function safeErrorEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  const values = event.exception?.values?.map(exception => ({
    type: "Error",
    value: "Client error; inspect the application using the bundle location",
    stacktrace: {
      frames: exception.stacktrace?.frames?.flatMap(frame => {
        const filename = typeof frame.filename === "string" ? scrubUrl(frame.filename) : REDACTED;
        if (!filename.startsWith("/assets/")) return [];
        return [{ filename,
          lineno: Number.isSafeInteger(frame.lineno) ? frame.lineno : undefined,
          colno: Number.isSafeInteger(frame.colno) ? frame.colno : undefined,
          in_app: true,
        }];
      }),
    },
  }));
  return {
    type: undefined,
    event_id: /^[a-f0-9]{32}$/i.test(event.event_id ?? "") ? event.event_id : undefined,
    timestamp: typeof event.timestamp === "number" && Number.isFinite(event.timestamp) ? event.timestamp : undefined,
    platform: "javascript",
    release: import.meta.env.VITE_SENTRY_RELEASE,
    environment: import.meta.env.PROD ? "production" : "development",
    level: "error",
    message: "Riverbanc client error",
    exception: values?.length ? { values } : undefined,
    tags: { app: "riverbanc", surface: "web" },
  };
}

export const isSentryEnabled = (): boolean => !!DSN;
export function initSentry(): void {
  if (!DSN) return;
  Sentry.init({
    dsn: DSN,
    environment: import.meta.env.PROD ? "production" : "development",
    release: import.meta.env.VITE_SENTRY_RELEASE,
    sendDefaultPii: false,
    // Replay, browser tracing and breadcrumbs can contain customer text. Keep
    // them disabled until each has a reviewed, independently tested contract.
    defaultIntegrations: false,
    integrations: [Sentry.globalHandlersIntegration(), Sentry.browserApiErrorsIntegration()],
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    beforeSend(event, hint) {
      if (hint) hint.attachments = [];
      return safeErrorEvent(event);
    },
    beforeBreadcrumb: () => null,
    beforeSendTransaction: () => null,
    beforeSendSpan(span) { return { ...span, description: REDACTED, data: {} }; },
  });
}
