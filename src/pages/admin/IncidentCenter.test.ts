import { describe, expect, it } from "vitest";
import { buildIncidentStatusUpdate } from "./IncidentCenter";

describe("Incident Center lifecycle updates", () => {
  it("records the acting admin when an incident is acknowledged", () => {
    const now = "2026-09-05T10:00:00.000Z";

    expect(buildIncidentStatusUpdate("detected", "admin-1", now)).toEqual({
      status: "acknowledged",
      updated_at: now,
      acknowledged_at: now,
      acknowledged_by: "admin-1",
    });
  });

  it("records the acting admin and resolution code when an incident is resolved", () => {
    const now = "2026-09-05T10:05:00.000Z";

    expect(buildIncidentStatusUpdate("investigating", "admin-1", now)).toEqual({
      status: "resolved",
      updated_at: now,
      resolved_at: now,
      resolved_by: "admin-1",
      resolution_code: "admin_resolved",
    });
  });

  it("does not produce an update for an already resolved incident", () => {
    expect(buildIncidentStatusUpdate("resolved", "admin-1", "2026-09-05T10:10:00.000Z")).toBeNull();
  });
});
