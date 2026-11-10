import { afterEach, describe, expect, it, vi } from "vitest";
import { sendReceiptEmail, type EmailConfig, type ReceiptEmailInput } from "../../../supabase/functions/process-monthly-payroll-receipts/email.ts";

const receipt: ReceiptEmailInput = {
  id: "receipt-123",
  customer_email: "subscriber@example.test",
  customer_name: "Test Subscriber",
  receipt_number: "RB-TEST-123",
  amount: 60,
};
const emailConfig: EmailConfig = {
  api_key: "test-resend-key",
  from_email: "receipts@riverbanc.co.zm",
};
const pdfBytes = new Uint8Array([37, 80, 68, 70]);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("monthly receipt email delivery", () => {
  it("uses the resolved email configuration and marks successful sends non-retryable", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "msg_test_123" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendReceiptEmail(receipt, pdfBytes, 2, emailConfig);

    expect(result).toEqual({ ok: true, messageId: "msg_test_123", retryable: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer test-resend-key");
    expect(new Headers(init.headers).get("Idempotency-Key")).toBe("riverbanc-receipt-receipt-123");
    const body = JSON.parse(String(init.body));
    expect(body.from).toBe("receipts@riverbanc.co.zm");
    expect(body.to).toEqual(["subscriber@example.test"]);
  });

  it("binds retries to the same logical receipt idempotency key", async () => {
    const mock = vi.fn().mockImplementation(async()=>new Response(JSON.stringify({id:"msg_same"})));
    vi.stubGlobal("fetch",mock);
    await sendReceiptEmail(receipt,pdfBytes,1,emailConfig);
    await sendReceiptEmail(receipt,pdfBytes,2,emailConfig);
    expect(mock.mock.calls.map(([,init])=>new Headers(init.headers).get("Idempotency-Key"))).toEqual(["riverbanc-receipt-receipt-123","riverbanc-receipt-receipt-123"]);
  });

  it("does not call the provider when the customer email is missing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendReceiptEmail({ ...receipt, customer_email: null }, pdfBytes, 1, emailConfig);

    expect(result).toEqual({ ok: false, code: "missing_customer_email", retryable: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("marks transient provider failures as retryable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("busy", { status: 503 })));

    const result = await sendReceiptEmail(receipt, pdfBytes, 1, emailConfig);

    expect(result).toEqual({ ok: false, code: "resend_http_503", retryable: true });
  });

  it("does not retry permanent provider failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("invalid sender", { status: 400 })));

    const result = await sendReceiptEmail(receipt, pdfBytes, 1, emailConfig);

    expect(result).toEqual({ ok: false, code: "resend_http_400", retryable: false });
  });

  it("keeps a successful HTTP response without a provider message ID retryable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })));

    const result = await sendReceiptEmail(receipt, pdfBytes, 1, emailConfig);

    expect(result).toEqual({ ok: false, code: "resend_message_id_missing", retryable: true });
  });
});
