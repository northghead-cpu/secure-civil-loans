import { describe, expect, it, vi } from "vitest";

const { captureException, withScope, setTag, setContext } = vi.hoisted(() => ({
  captureException: vi.fn(),
  withScope: vi.fn(),
  setTag: vi.fn(),
  setContext: vi.fn(),
}));

withScope.mockImplementation((callback: (scope: {
  setTag: typeof setTag;
  setContext: typeof setContext;
}) => void) => callback({ setTag, setContext }));

vi.mock("@sentry/react", () => ({ captureException, withScope }));

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

    expect(withScope).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledTimes(1);
    const error = captureException.mock.calls[0][0] as Error;
    expect(error.name).toBe("OperationalEvent:subscription.payment");
    expect(error.message).toBe("Payment provider failed");
    expect(setTag).toHaveBeenCalledWith("operational_event", "subscription.payment");
    expect(setContext).toHaveBeenCalledWith("operational_event", {
      nrc: "[redacted]",
      salary: "[redacted]",
      safe_code: "PAYMENT_PROVIDER_UNAVAILABLE",
    });
  });
});
