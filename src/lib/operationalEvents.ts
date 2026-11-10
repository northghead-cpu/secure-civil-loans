import * as Sentry from "@sentry/react";
import { scrubDeep } from "./sentry";

export type OperationalEventSeverity = "low" | "medium" | "high" | "critical";

export interface OperationalEvent {
  operation: string;
  severity?: OperationalEventSeverity;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * Capture a structured operational event while preserving Riverbanc's
 * Sentry privacy boundary. Metadata is scrubbed before it enters Sentry.
 */
export function captureOperationalEvent(event: OperationalEvent): void {
  const operation = event.operation.trim() || "unknown";
  const error = new Error(event.message);
  error.name = `OperationalEvent:${operation}`;

  Sentry.withScope((scope) => {
    scope.setTag("operational_event", operation);
    if (event.severity) scope.setTag("severity", event.severity);
    if (event.metadata) {
      scope.setContext("operational_event", scrubDeep(event.metadata));
    }
    Sentry.captureException(error);
  });
}
