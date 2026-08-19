export const INCIDENT_SEVERITIES = ["critical", "high", "medium", "low"] as const;
export const INCIDENT_STATUSES = [
  "detected",
  "acknowledged",
  "investigating",
  "resolved",
] as const;

export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export interface IncidentEventInput {
  operation: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  summary: string;
  correlationId?: string;
  details?: unknown;
}

export interface IncidentEvent {
  operation: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  summary: string;
  correlation_id: string | null;
}

const MAX_SUMMARY_LENGTH = 240;
const MAX_OPERATION_LENGTH = 80;
const MAX_CORRELATION_ID_LENGTH = 128;

export function buildIncidentEvent(input: IncidentEventInput): IncidentEvent {
  const operation = input.operation.trim().slice(0, MAX_OPERATION_LENGTH);
  const summary = input.summary.trim().slice(0, MAX_SUMMARY_LENGTH);
  const correlation_id = input.correlationId?.trim().slice(0, MAX_CORRELATION_ID_LENGTH) || null;

  if (!operation) throw new Error("Incident operation is required");
  if (!summary) throw new Error("Incident summary is required");

  return {
    operation,
    severity: input.severity,
    status: input.status,
    summary,
    correlation_id,
  };
}
