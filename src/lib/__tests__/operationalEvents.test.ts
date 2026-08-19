import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const setTag = vi.fn();
  const setContext = vi.fn();
  const captureException = vi.fn();
  const withScope = vi.fn((callback: (scope: {
    setTag: typeof setTag;
    setContext: typeof setContext;
  }) => void) => callback({ setTag, setContext }));
  return { captureException, withScope, setTag, setContext };
});

vi.mock("@sentry/react", () => mocks);

import { captureOperationalEvent } from "../operationalEvents";

describe("operational events", () => {
  it("captures a structured event and scrubs sensitive metadata", () => {
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

    const contextCall = mocks.setContext.mock.calls.find(([key]) => key === "operational_event");
    expect(contextCall).toBeDefined();
    const context = contextCall?.[1] as { metadata: Record<string, unknown> };
    expect(context.metadata.nrc).toBe("[redacted]");
    expect(context.metadata.salary).toBe("[redacted]");
    expect(context.metadata.safe_code).toBe("PAYMENT_PROVIDER_UNAVAILABLE");
  });
});
