import { describe, expect, it } from "vitest";
import {
  buildIncidentEvent,
  type IncidentSeverity,
  type IncidentStatus,
} from "./incidentModel";

describe("incidentModel", () => {
  it("creates a minimal incident event without audit-log details or PII", () => {
    const incident = buildIncidentEvent({
      operation: "crb_check",
      severity: "high" satisfies IncidentSeverity,
      status: "detected" satisfies IncidentStatus,
      summary: "CRB provider unavailable",
      correlationId: "corr-123",
      details: {
        nrc_number: "123456/78/9",
        salary: 25000,
        raw_provider_response: { score: 700 },
      },
    });

    expect(incident).toMatchObject({
      operation: "crb_check",
      severity: "high",
      status: "detected",
      summary: "CRB provider unavailable",
      correlation_id: "corr-123",
    });
    expect(incident).not.toHaveProperty("details");
    expect(JSON.stringify(incident)).not.toContain("123456/78/9");
    expect(JSON.stringify(incident)).not.toContain("25000");
    expect(JSON.stringify(incident)).not.toContain("raw_provider_response");
  });

  it("accepts only the incident lifecycle states", () => {
    for (const status of [
      "detected",
      "acknowledged",
      "investigating",
      "resolved",
    ] satisfies IncidentStatus[]) {
      expect(
        buildIncidentEvent({
          operation: "underwriting",
          severity: "medium",
          status,
          summary: "Underwriting operation event",
        }).status,
      ).toBe(status);
    }
  });
});
