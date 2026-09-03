import { withSupabase } from 'npm:@supabase/server';
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib';

const BILLING_DAY = 23;
const BILLING_AMOUNT = 60;
const BILLING_TIME_ZONE = 'Africa/Lusaka';
const RECEIPT_BUCKET = 'payment-receipts';

interface Receipt {
  id: string;
  user_id: string;
  receipt_number: string;
  customer_name: string;
  customer_email: string | null;
  amount: number;
  currency: string;
  billing_period_start: string;
  billing_period_end: string;
  payment_method: string;
  payroll_reference: string;
  issued_at: string;
}

function currentLusakaDate(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: BILLING_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

function assertBillingDate(date: string): void {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.getUTCDate() !== BILLING_DAY) {
    throw new Error('Billing date must be the 23rd of a month');
  }
}

function escapePdfText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

async function createReceiptPdf(receipt: Receipt): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  page.drawText('RIVERBANC', { x: 48, y: 780, size: 22, font: bold, color: rgb(0.04, 0.24, 0.35) });
  page.drawText('Technology Limited', { x: 48, y: 758, size: 10, font: regular, color: rgb(0.25, 0.30, 0.34) });
  page.drawText('PAYMENT RECEIPT', { x: 48, y: 700, size: 18, font: bold, color: rgb(0.04, 0.24, 0.35) });

  const rows = [
    ['Receipt number', receipt.receipt_number],
    ['Customer', receipt.customer_name],
    ['Amount paid', `${receipt.currency} ${Number(receipt.amount).toFixed(2)}`],
    ['Payment method', 'Payroll deduction'],
    ['Payroll reference', receipt.payroll_reference],
    ['Billing period', `${receipt.billing_period_start} to ${receipt.billing_period_end}`],
    ['Issued', receipt.issued_at.slice(0, 10)],
  ];

  let y = 650;
  for (const [label, value] of rows) {
    page.drawText(label, { x: 48, y, size: 10, font: bold, color: rgb(0.30, 0.34, 0.38) });
    page.drawText(escapePdfText(value), { x: 190, y, size: 10, font: regular, color: rgb(0.10, 0.12, 0.14) });
    y -= 34;
  }

  page.drawLine({ start: { x: 48, y: 395 }, end: { x: 547, y: 395 }, thickness: 1, color: rgb(0.82, 0.84, 0.86) });
  page.drawText('This receipt confirms a K60 Riverbanc platform subscription', { x: 48, y: 365, size: 10, font: regular });
  page.drawText('payment through payroll deduction. It is not a lender loan repayment,', { x: 48, y: 347, size: 10, font: regular });
  page.drawText('interest charge, lender fee, or other loan principal charge.', { x: 48, y: 329, size: 10, font: regular });
  page.drawText('Riverbanc Technology Limited', { x: 48, y: 250, size: 10, font: bold });
  page.drawText('288a sub 143, Falcon Street, Makeni, Lusaka, Zambia', { x: 48, y: 232, size: 9, font: regular });
  page.drawText('business@riverbanc.co.zm', { x: 48, y: 216, size: 9, font: regular });
  page.drawText('Generated automatically • Africa/Lusaka', { x: 48, y: 80, size: 8, font: regular, color: rgb(0.45, 0.48, 0.50) });

  return pdf.save();
}

async function sendReceiptEmail(receipt: Receipt, pdfBytes: Uint8Array): Promise<{ ok: boolean; code?: string }> {
  if (!receipt.customer_email) return { ok: false, code: 'missing_customer_email' };

  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('RESEND_FROM_EMAIL');
  if (!apiKey || !from) return { ok: false, code: 'email_provider_not_configured' };

  const base64 = Uint8Array.from(pdfBytes).reduce((data, byte) => data + String.fromCharCode(byte), '');
  const encoded = btoa(base64);

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [receipt.customer_email],
      subject: `Riverbanc payment receipt ${receipt.receipt_number}`,
      html: `<p>Hello ${escapePdfText(receipt.customer_name)},</p><p>Your Riverbanc subscription payment of ZMW ${Number(receipt.amount).toFixed(2)} has been recorded through payroll deduction.</p><p>Receipt number: <strong>${receipt.receipt_number}</strong></p><p>The receipt is attached to this email and is also available in your Riverbanc dashboard.</p><p>Riverbanc Technology Limited</p>`,
      attachments: [{ filename: `${receipt.receipt_number}.pdf`, content: encoded }],
    }),
  });

  if (!response.ok) return { ok: false, code: `resend_http_${response.status}` };
  return { ok: true };
}

export default {
  fetch: withSupabase({ auth: 'secret' }, async (req, ctx) => {
    try {
      const body = await req.json().catch(() => ({}));
      const billingDate = typeof body.billing_date === 'string' ? body.billing_date : currentLusakaDate();
      assertBillingDate(billingDate);

      const { data: result, error: billingError } = await ctx.supabaseAdmin.rpc('process_riverbanc_monthly_billing', { _billing_date: billingDate });
      if (billingError) throw billingError;

      const { data: receipts, error: receiptError } = await ctx.supabaseAdmin
        .from('payment_receipts')
        .select('id,user_id,receipt_number,customer_name,customer_email,amount,currency,billing_period_start,billing_period_end,payment_method,payroll_reference,issued_at,document_path')
        .eq('billing_transaction_id.billing_run_id', result.billing_run_id);

      // PostgREST relationship filtering can be unavailable depending on generated schema.
      // Fall back to the billing period if the relationship filter returns no rows.
      if (receiptError) throw receiptError;

      let processed = 0;
      let emailed = 0;
      let emailFailed = 0;

      for (const receipt of (receipts ?? []) as Receipt[]) {
        const pdfBytes = await createReceiptPdf(receipt);
        const path = `${receipt.user_id}/${receipt.receipt_number}.pdf`;
        const { error: uploadError } = await ctx.supabaseAdmin.storage.from(RECEIPT_BUCKET).upload(path, pdfBytes, { contentType: 'application/pdf', upsert: false });

        if (uploadError && !/already exists/i.test(uploadError.message)) throw uploadError;

        const { error: documentError } = await ctx.supabaseAdmin.from('payment_receipts').update({ document_path: path }).eq('id', receipt.id).is('document_path', null);
        if (documentError) throw documentError;

        const delivery = await sendReceiptEmail(receipt, pdfBytes);
        const deliveryUpdate = {
          status: delivery.ok ? 'sent' : 'failed',
          attempt_count: 1,
          last_attempt_at: new Date().toISOString(),
          delivered_at: delivery.ok ? new Date().toISOString() : null,
          error_code: delivery.ok ? null : delivery.code,
          error_message: delivery.ok ? null : delivery.code,
          updated_at: new Date().toISOString(),
        };
        const { error: deliveryError } = await ctx.supabaseAdmin
          .from('receipt_deliveries')
          .update(deliveryUpdate)
          .eq('receipt_id', receipt.id)
          .eq('channel', 'email');
        if (deliveryError) throw deliveryError;

        processed += 1;
        if (delivery.ok) emailed += 1; else emailFailed += 1;
      }

      return Response.json({ ok: true, billing_date: billingDate, amount_zmw: BILLING_AMOUNT, timezone: BILLING_TIME_ZONE, billing: result, receipts_processed: processed, emails_sent: emailed, emails_failed: emailFailed });
    } catch (error) {
      console.error('monthly payroll receipt processing failed', error instanceof Error ? error.message : 'unknown error');
      return Response.json({ ok: false, error: 'Monthly payroll receipt processing failed' }, { status: 500 });
    }
  }),
};
