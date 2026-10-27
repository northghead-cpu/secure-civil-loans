import { describe, expect, it } from "vitest";
import {
  canRetryHandshakeTransfer,
  handshakeTransferMessage,
} from "./handshakeTransfer";

describe("Handshake referral retry", () => {
  it("allows retries for authorized handoffs awaiting confirmation", () => {
    expect(canRetryHandshakeTransfer("authorized", "pending")).toBe(true);
    expect(canRetryHandshakeTransfer("preparing", "pending")).toBe(true);
    expect(canRetryHandshakeTransfer("preparing", null)).toBe(true);
  });

  it("does not allow retry after confirmed acceptance", () => {
    expect(canRetryHandshakeTransfer("preparing", "accepted")).toBe(false);
  });

  it("does not allow retry after the handoff leaves the authorized states", () => {
    expect(canRetryHandshakeTransfer("sent_to_lender", "pending")).toBe(false);
    expect(canRetryHandshakeTransfer("approved", "pending")).toBe(false);
  });

  it("explains confirmed acceptance without implying lender delivery", () => {
    expect(handshakeTransferMessage("accepted", null)).toContain(
      "does not mean the lender has received a full application",
    );
  });

  it("explains rejection and retryable failures", () => {
    expect(
      handshakeTransferMessage("pending", "HANDSHAKE_REFERRAL_REJECTED"),
    ).toContain("rejected");
    expect(handshakeTransferMessage("pending", "HANDSHAKE_UNREACHABLE")).toContain(
      "You can retry",
    );
  });
});
