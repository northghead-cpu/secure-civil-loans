/**
 * Production-safe logger.
 *
 * In production builds (`import.meta.env.PROD`) all log/info/debug calls are
 * suppressed so no diagnostic data leaks to the browser console — where an
 * attacker sitting at the victim's machine (or a malicious extension) could
 * read it. `warn` and `error` remain so operational issues stay visible, but
 * callers should pass sanitized values only (see `sanitizeError`).
 *
 * Do NOT import `console.*` directly from application code. Use this module.
 */
const isProd = typeof import.meta !== "undefined" && !!import.meta.env?.PROD;

type Args = unknown[];

export const logger = {
  debug: (...args: Args) => {
    if (!isProd) console.debug(...args);
  },
  log: (...args: Args) => {
    if (!isProd) console.log(...args);
  },
  info: (...args: Args) => {
    if (!isProd) console.info(...args);
  },
  warn: (...args: Args) => {
    if (!isProd) console.warn(...args);
  },
  /**
   * Emitted in all environments. Callers MUST sanitize the payload — never
   * pass raw error objects, Supabase responses, JWTs, or PII.
   */
  error: (message: string, meta?: Record<string, unknown>) => {
    if (isProd) {
      // Minimal envelope, no stack, no PII.
      console.error(`[app] ${message}`);
    } else {
      console.error(`[app] ${message}`, meta ?? "");
    }
  },
};
