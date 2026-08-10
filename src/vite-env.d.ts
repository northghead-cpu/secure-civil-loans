/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Sentry DSN. Monitoring stays disabled when absent. Publishable value. */
  readonly VITE_SENTRY_DSN?: string;
  /** Overrides the environment tag sent to Sentry (defaults to prod/development). */
  readonly VITE_SENTRY_ENVIRONMENT?: string;
  /** Release identifier (commit SHA or version) used for release tagging. */
  readonly VITE_SENTRY_RELEASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
