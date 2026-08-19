import * as Sentry from "@sentry/react";
import { scrubDeep } from "./sentry";

export type OperationalSeverity = "critical" | "high" | "medium" | "low";
export type OperationalStatus = "detected" | "acknowledged" | "investigating" | "resolved" | "reconciled";

export interface OperationalEvent {
  operation: string;
  severity: OperationalSeverity;
  status?: OperationalStatus;
  message: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

/** Privacy-first operational telemetry boundary. */
export function captureOperationalEvent(event: OperationalEvent): void {
  const metadata = scrubDeep(event.metadata ?? {});
  const correlationId = event.correlationId ?? crypto.randomUUID();

  Sentry.withScope((scope) => {
    scope.setTag("operational_event", "true");
    scope.setTag("operation", event.operation);
    scope.setTag("severity", event.severity);
    scope.setTag("status", event.status ?? "detected");
    scope.setTag("correlation_id", correlationId);
    scope.setContext("operational_event", {
      operation: event.operation,
      severity: event.severity,
      status: event.status ?? "detected",
      correlation_id: correlationId,
      metadata,
    });

    const error = new Error(event.message);
    error.name = `OperationalEvent:${event.operation}`;
    Sentry.captureException(error);
  });
}

export function operationalEventFromError(
  operation: string,
  severity: OperationalSeverity,
  error: unknown,
  metadata?: Record<string, unknown>,
): void {
  const message = error instanceof Error ? error.message : "Operation failed";
  captureOperationalEvent({ operation, severity, message, metadata });
}
