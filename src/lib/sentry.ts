/**
 * Sentry error monitoring — privacy-first configuration for Riverbanc.
 *
 * REGULATORY CONSTRAINT (Zambia DPA 2021 + Riverbanc architecture):
 * Infratel is the sole store of customer PII. Sentry is a third-party
 * processor outside that boundary, so it MUST NEVER receive:
 *   NRC numbers, employee numbers, payslips / payroll data, salaries,
 *   KYC documents or fields, CRB data, loan application contents,
 *   auth tokens / JWTs / API keys, emails, phone numbers, names.
 *
 * The whole integration is therefore *deny-by-default*:
 *   - `sendDefaultPii: false` — no IP, no user identity, no cookies
 *   - request bodies and headers are stripped from every event
 *   - every event, breadcrumb, URL, and span is passed through a
 *     redaction pass (`scrubDeep`) before it leaves the browser
 *   - session replay masks all text and blocks all media by default
 *   - Sentry is fully disabled unless `VITE_SENTRY_DSN` is set
 *
 * Do NOT loosen any of the flags below without a DPIA review.
 */
import * as Sentry from "@sentry/react";

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const ENVIRONMENT =
  (import.meta.env.VITE_SENTRY_ENVIRONMENT as string | undefined) ??
  (import.meta.env.PROD ? "production" : "development");
const RELEASE = import.meta.env.VITE_SENTRY_RELEASE as string | undefined;

const REDACTED = "[redacted]";

/** Keys whose values are regulated/PII and must never be transmitted. */
const SENSITIVE_KEY_PATTERN =
  /(nrc|employee[_-]?number|employee[_-]?no|payslip|payroll|salary|net[_-]?pay|gross[_-]?pay|deduction|kyc|crb|credit[_-]?score|bureau|loan[_-]?application|application[_-]?data|dob|date[_-]?of[_-]?birth|id[_-]?number|passport|licen[cs]e|bank[_-]?account|account[_-]?number|signature|token|jwt|access[_-]?token|refresh[_-]?token|api[_-]?key|apikey|secret|password|authorization|auth|cookie|session|bearer|email|phone|msisdn|mobile|full[_-]?name|first[_-]?name|last[_-]?name|address|user[_-]?id|document|file|base64)/i;

/** Value shapes that look like regulated identifiers or credentials. */
const SENSITIVE_VALUE_PATTERNS: RegExp[] = [
  /\b\d{6}\/\d{2}\/\d\b/g, // Zambian NRC, e.g. 123456/78/1
  /\bey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, // JWT
  /\bsb-[A-Za-z0-9-]+-auth-token\b/g, // Supabase storage key
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, // email
  /\b(?:\+?26|0)9[5-7]\d{7}\b/g, // Zambian mobile number
  /\bdata:[a-z/+.-]+;base64,[A-Za-z0-9+/=]+/gi, // inline document/image payloads
];

/** Query/hash params stripped from any URL before transmission. */
const SENSITIVE_PARAM_PATTERN =
  /^(access_token|refresh_token|token|code|id_token|api_?key|apikey|secret|password|email|phone|nrc|employee_number|signature|next)$/i;

function scrubString(value: string): string {
  let out = value;
  for (const pattern of SENSITIVE_VALUE_PATTERNS) {
    out = out.replace(pattern, REDACTED);
  }
  return out;
}

/** Strip identifying query/hash params but keep the path for triage. */
export function scrubUrl(url: string): string {
  if (!url) return url;
  try {
    const parsed = new URL(url, "https://placeholder.invalid");
    parsed.searchParams.forEach((_v, key) => {
      if (SENSITIVE_PARAM_PATTERN.test(key)) parsed.searchParams.set(key, REDACTED);
    });
    if (parsed.hash) parsed.hash = "";
    const rebuilt = parsed.host === "placeholder.invalid"
      ? `${parsed.pathname}${parsed.search}`
      : parsed.toString();
    return scrubString(rebuilt);
  } catch {
    return scrubString(url.split("#")[0]);
  }
}

/**
 * Recursively redact sensitive keys and value shapes from any structure.
 * Unknown keys are kept (they aid triage) but their values are still
 * pattern-scrubbed, so a stray NRC or JWT can't ride along.
 */
export function scrubDeep<T>(input: T, depth = 0): T {
  if (depth > 8 || input == null) return input;
  if (typeof input === "string") return scrubString(input) as unknown as T;
  if (typeof input !== "object") return input;
  if (Array.isArray(input)) {
    return input.map((item) => scrubDeep(item, depth + 1)) as unknown as T;
  }
  const source = input as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      result[key] = REDACTED;
      continue;
    }
    if (/^(url|href|origin|referrer|location|path)$/i.test(key) && typeof value === "string") {
      result[key] = scrubUrl(value);
      continue;
    }
    result[key] = scrubDeep(value, depth + 1);
  }
  return result as unknown as T;
}

export const isSentryEnabled = (): boolean => !!DSN;

export function initSentry(): void {
  if (!DSN) {
    // No DSN configured — monitoring stays off. Never throw here; the app
    // must run identically with or without Sentry.
    return;
  }

  Sentry.init({
    dsn: DSN,
    environment: ENVIRONMENT,
    release: RELEASE,

    // ---- Privacy switches (do not change) ----
    sendDefaultPii: false, // no IP address, cookies, or user identity
    // Breadcrumbs that can carry regulated data are disabled outright.
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.breadcrumbsIntegration({
        console: false, // console args may contain profile/KYC objects
        dom: { serializeAttribute: [] }, // no input values or data-* payloads
        fetch: true,
        xhr: true,
        history: true,
      }),
      Sentry.replayIntegration({
        maskAllText: true,
        maskAllInputs: true,
        blockAllMedia: true,
        networkDetailAllowUrls: [], // never record request/response bodies
        networkCaptureBodies: false,
        networkRequestHeaders: [],
        networkResponseHeaders: [],
      }),
    ],

    // ---- Sampling: cheap in prod, verbose locally ----
    tracesSampleRate: ENVIRONMENT === "production" ? 0.1 : 1.0,
    replaysSessionSampleRate: 0, // never record healthy sessions
    replaysOnErrorSampleRate: ENVIRONMENT === "production" ? 0.1 : 0,
    sampleRate: 1.0,

    // Only report frames from our own bundles.
    denyUrls: [/extensions\//i, /^chrome:\/\//i, /^moz-extension:\/\//i],
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      "Non-Error promise rejection captured",
      /Failed to fetch dynamically imported module/i,
    ],

    beforeSend(event) {
      // Identity is never attached, whatever upstream code tried to set.
      delete event.user;
      delete event.server_name;

      if (event.request) {
        delete event.request.data; // HTTP request bodies
        delete event.request.cookies;
        delete event.request.headers;
        delete event.request.env;
        if (event.request.url) event.request.url = scrubUrl(event.request.url);
        if (event.request.query_string) event.request.query_string = REDACTED;
      }

      event.extra = scrubDeep(event.extra);
      event.contexts = scrubDeep(event.contexts);
      event.tags = scrubDeep(event.tags);
      if (event.message) event.message = scrubString(event.message);
      if (event.exception?.values) {
        for (const value of event.exception.values) {
          if (value.value) value.value = scrubString(value.value);
        }
      }
      return event;
    },

    beforeBreadcrumb(breadcrumb) {
      // Drop breadcrumb classes that habitually carry regulated payloads.
      if (breadcrumb.category === "console") return null;
      if (breadcrumb.category === "ui.input") return null;
      if (breadcrumb.data?.url && typeof breadcrumb.data.url === "string") {
        breadcrumb.data.url = scrubUrl(breadcrumb.data.url);
      }
      if (breadcrumb.message) breadcrumb.message = scrubString(breadcrumb.message);
      breadcrumb.data = scrubDeep(breadcrumb.data);
      return breadcrumb;
    },

    beforeSendTransaction(event) {
      delete event.user;
      if (event.request) {
        delete event.request.data;
        delete event.request.headers;
        delete event.request.cookies;
        if (event.request.url) event.request.url = scrubUrl(event.request.url);
      }
      event.contexts = scrubDeep(event.contexts);
      event.tags = scrubDeep(event.tags);
      if (event.transaction) event.transaction = scrubUrl(event.transaction);
      return event;
    },

    beforeSendSpan(span) {
      span.description = span.description ? scrubUrl(span.description) : span.description;
      span.data = scrubDeep(span.data);
      return span;
    },
  });

  // Non-identifying deployment context only.
  Sentry.setTags({ app: "riverbanc", surface: "web" });
}
