export type HandshakeTransferStatus = "pending" | "accepted";

export function canRetryHandshakeTransfer(
  handoffStatus: string,
  transferStatus: string | null | undefined,
): boolean {
  return (
    ["authorized", "preparing", "sent_to_lender"].includes(handoffStatus) &&
    transferStatus !== "accepted"
  );
}

export function handshakeTransferMessage(
  transferStatus: string | null | undefined,
  lastError: string | null | undefined,
): string {
  if (transferStatus === "accepted") {
    return "Handshake accepted the referral. This does not mean the lender has received a full application or made a lending decision.";
  }
  if (lastError === "HANDSHAKE_REFERRAL_REJECTED") {
    return "Handshake rejected the referral. The connection or tenant configuration may need attention before retrying.";
  }
  if (lastError) {
    return "Handshake receipt is not confirmed. You can retry the transfer.";
  }
  return "The referral is awaiting confirmation from Handshake.";
}
