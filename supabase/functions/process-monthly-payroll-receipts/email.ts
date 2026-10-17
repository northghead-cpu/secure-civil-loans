export interface EmailConfig {
  api_key: string;
  from_email: string;
}

export interface EmailResult {
  ok: boolean;
  code?: string;
  messageId?: string;
  retryable: boolean;
}

export interface ReceiptEmailInput {
  id: string;
  customer_email: string | null;
  customer_name: string;
  receipt_number: string;
  amount: number;
}

export async function sendReceiptEmail(
  receipt: ReceiptEmailInput,
  pdfBytes: Uint8Array,
  attemptNumber: number,
  emailConfig: EmailConfig,
): Promise<EmailResult> {
  if (!receipt.customer_email) return { ok: false, code: 'missing_customer_email', retryable: false };

  const apiKey = emailConfig.api_key;
  const from = emailConfig.from_email;
  if (!apiKey || !from) return { ok: false, code: 'email_provider_not_configured', retryable: true };

  const binary = Array.from(pdfBytes, (byte) => String.fromCharCode(byte)).join('');
  const encoded = btoa(binary);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `riverbanc-receipt-${receipt.id}-attempt-${attemptNumber}`,
    },
    body: JSON.stringify({
      from,
      to: [receipt.customer_email],
      subject: `Riverbanc payment receipt ${receipt.receipt_number}`,
      tags: [{ name: 'purpose', value: 'riverbanc-receipt' }],
      html: `<p>Hello ${escapeHtml(receipt.customer_name)},</p><p>Your Riverbanc subscription payment of ZMW ${Number(receipt.amount).toFixed(2)} has been recorded through payroll deduction.</p><p>Receipt number: <strong>${escapeHtml(receipt.receipt_number)}</strong></p><p>The receipt is attached to this email and is also available in your Riverbanc dashboard.</p><p>Riverbanc Technology Limited</p>`,
      attachments: [{ filename: `${receipt.receipt_number}.pdf`, content: encoded }],
    }),
  });

  if (!response.ok) {
    const retryable = response.status === 408 || response.status === 409 || response.status === 429 || response.status >= 500;
    return { ok: false, code: `resend_http_${response.status}`, retryable };
  }
  const responseBody = await response.json().catch(() => ({}));
  if (typeof responseBody.id !== 'string' || !responseBody.id) {
    return { ok: false, code: 'resend_message_id_missing', retryable: true };
  }
  return { ok: true, messageId: responseBody.id, retryable: false };
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
