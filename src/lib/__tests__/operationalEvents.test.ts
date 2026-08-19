import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  captureException: vi.fn(),
  withScope: vi.fn((callback: (scope: {
    setTag: (key: string, value: string) => void;
    setContext: (key: string, value: unknown) => void;
  }) => void) => callback({ setTag: vi.fn(), setContext: vi.fn() })),
}));

vi.mock("@sentry/react", () => mocks);

import { captureOperationalEvent } from "../operationalEvents";

describe("operational events", () => {
  it("captures a structured event without transmitting sensitive metadata", () => {
    captureOperationalEvent({
      operation: "subscription.payment",
      severity: "high",
      message: "Payment provider failed",
      metadata: {
        nrc: "123456/78/1",
        salary: 12000,
        safe_code: "PAYMENT_PROVIDER_UNAVAILABLE",
      },
    });

    expect(mocks.withScope).toHaveBeenCalledTimes(1);
    expect(mocks.captureException).toHaveBeenCalledTimes(1);
    const error = mocks.captureException.mock.calls[0][0] as Error;
    expect(error.name).toBe("OperationalEvent:subscription.payment");
    expect(error.message).toBe("Payment provider failed");
  });
});
