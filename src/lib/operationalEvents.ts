import { captureException, withScope } from "@sentry/react";
import { scrubDeep } from "@/lib/sentry";

export type OperationalEventSeverity = "low" | "medium" | "high" | "critical";

export interface OperationalEventInput {
  operation: string;
  severity: OperationalEventSeverity;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * Capture a structured operational event without allowing regulated metadata
 * to bypass the application's Sentry privacy boundary.
 */
export function captureOperationalEvent({
  operation,
  severity,
  message,
  metadata,
}: OperationalEventInput): void {
  const error = new Error(message);
  error.name = `OperationalEvent:${operation}`;

  withScope((scope) => {
    scope.setTag("operation", operation);
    scope.setTag("severity", severity);

    if (metadata) {
      scope.setContext("operational_event", scrubDeep(metadata));
    }

    captureException(error);
  });
}
