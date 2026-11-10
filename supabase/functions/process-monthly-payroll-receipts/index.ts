import { createReceiptPdf, createTestReceiptPdf, type Receipt } from "./pdf.ts";
import { runReceiptBatch } from "./safety.ts";
import { withSupabase } from 'npm:@supabase/server';
import { sendReceiptEmail, type EmailConfig, type EmailResult } from './email.ts';

const BILLING_DAY = 23;
const BILLING_AMOUNT = 60;
const BILLING_TIME_ZONE = 'Africa/Lusaka';
const RECEIPT_BUCKET = 'payment-receipts';
const MAX_EMAIL_ATTEMPTS = 5;

interface Delivery {
  attempt_count: number;
  status: string;
  retryable: boolean;
  provider_message_id: string | null;
}



async function getEmailConfig(supabaseAdmin: unknown): Promise<EmailConfig | null> {
  const client = supabaseAdmin as {
    rpc: (functionName: string) => Promise<{ data: unknown; error: { message?: string } | null }>;
  };
  const { data, error } = await client.rpc('get_riverbanc_email_config');
  if (error) throw error;
  const config = data as { configured?: boolean; api_key?: string; from_email?: string } | null;
  if (config?.configured === true && typeof config.api_key === 'string' && typeof config.from_email === 'string') {
    return { api_key: config.api_key, from_email: config.from_email };
  }
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL');
  return apiKey && fromEmail ? { api_key: apiKey, from_email: fromEmail } : null;
}


function currentLusakaDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BILLING_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function assertBillingDate(date: string): void {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.getUTCDate() !== BILLING_DAY) {
    throw new Error('Billing date must be the 23rd of a month');
  }
}



function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function sendTestReceiptEmail(
  recipient: string,
  customerName: string,
  pdfBytes: Uint8Array,
  userId: string,
  testRunId: string,
  emailConfig: EmailConfig,
): Promise<EmailResult> {
  const apiKey = emailConfig.api_key;
  const from = emailConfig.from_email;
  const binary = Array.from(pdfBytes, (byte) => String.fromCharCode(byte)).join('');
  const encoded = btoa(binary);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `riverbanc-test-receipt-${userId}-${testRunId}`,
    },
    body: JSON.stringify({
      from,
      to: [recipient],
      subject: 'TEST ONLY — Riverbanc receipt PDF pipeline (not proof of payment)',
      tags: [{ name: 'purpose', value: 'riverbanc-receipt-test' }],
      html: `<p style="color:#b91c1c;font-weight:bold">TEST ONLY — NOT PROOF OF PAYMENT</p><p>Hello ${escapeHtml(customerName)},</p><p>This tests Riverbanc's production PDF generator and email delivery path. No payment was received, and no billing transaction or payment receipt was created.</p>`,
      text: 'TEST ONLY — NOT PROOF OF PAYMENT. This tests Riverbanc\'s production PDF generator and email delivery path. No payment was received, and no billing transaction or payment receipt was created.',
      attachments: [{ filename: `TEST-ONLY-${testRunId}.pdf`, content: encoded }],
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

export default {
  fetch: withSupabase({ auth: 'secret' }, async (req, ctx) => {
    try {
      const body = await req.json().catch(() => ({}));
      if (body.mode === 'test_email') {
        const userId = typeof body.test_user_id === 'string' ? body.test_user_id : '';
        const testRunId = typeof body.test_run_id === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(body.test_run_id) ? body.test_run_id : '';
        if (!userId || !testRunId) {
          return Response.json({ ok: false, error: 'Test mode requires test_user_id and a unique test_run_id' }, { status: 400 });
        }
        const { data: authorization, error: authorizationError } = await ctx.supabaseAdmin
          .from('subscription_authorizations')
          .select('user_id')
          .eq('user_id', userId)
          .eq('status', 'active')
          .maybeSingle();
        if (authorizationError) throw authorizationError;
        if (!authorization) return Response.json({ ok: false, error: 'Active subscription authorization not found' }, { status: 404 });
        const { data: profile, error: profileError } = await ctx.supabaseAdmin
          .from('profiles')
          .select('full_name,email')
          .eq('user_id', userId)
          .maybeSingle();
        if (profileError) throw profileError;
        if (!profile?.email) return Response.json({ ok: false, error: 'Registered email is unavailable' }, { status: 400 });
        const customerName = profile.full_name || 'Riverbanc Subscriber';
        const emailConfig = await getEmailConfig(ctx.supabaseAdmin);
        if (!emailConfig) {
          return Response.json({ ok: false, error: 'email_provider_not_configured', test_only: true, payment_record_created: false }, { status: 503 });
        }
        const pdfBytes = await createTestReceiptPdf(customerName, testRunId);
        const emailResult = await sendTestReceiptEmail(profile.email, customerName, pdfBytes, userId, testRunId, emailConfig);
        return Response.json({
          ok: emailResult.ok,
          test_only: true,
          payment_record_created: false,
          billing_transaction_created: false,
          payment_receipt_created: false,
          email_status: emailResult.ok ? 'sent' : 'failed',
          provider_message_id: emailResult.messageId ?? null,
          error_code: emailResult.code ?? null,
        }, { status: emailResult.ok ? 200 : 502 });
      }
      const billingDate = typeof body.billing_date === 'string' ? body.billing_date : currentLusakaDate();
      assertBillingDate(billingDate);

      const { data: result, error: billingError } = await ctx.supabaseAdmin.rpc('process_riverbanc_monthly_billing', { _billing_date: billingDate });
      if (billingError) throw billingError;

      const { data: transactions, error: transactionError } = await ctx.supabaseAdmin
        .from('billing_transactions')
        .select('id')
        .eq('billing_run_id', result.billing_run_id);
      if (transactionError) throw transactionError;

      const transactionIds = (transactions ?? []).map((row) => row.id);
      if (!transactionIds.length) return Response.json({ ok: true, billing_date: billingDate, amount_zmw: BILLING_AMOUNT, timezone: BILLING_TIME_ZONE, billing: result, receipts_processed: 0, emails_sent: 0, emails_failed: 0 });

      const { data: receipts, error: receiptError } = await ctx.supabaseAdmin
        .from('payment_receipts')
        .select('id,user_id,receipt_number,customer_name,customer_email,amount,currency,billing_period_start,billing_period_end,payment_method,payroll_reference,issued_at,document_path')
        .in('billing_transaction_id', transactionIds);
      if (receiptError) throw receiptError;

      const receiptIds = (receipts ?? []).map((receipt) => receipt.id);
      const emailConfig = await getEmailConfig(ctx.supabaseAdmin);
      if (!emailConfig) {
        return Response.json({
          ok: false,
          error: 'email_provider_not_configured',
          billing_run_id: result.billing_run_id,
          transactions: transactionIds.length,
          receipts: receipts.length,
          emails_sent: 0,
        }, { status: 503 });
      }
      const { data: deliveries, error: deliveryLookupError } = await ctx.supabaseAdmin
        .from('receipt_deliveries')
        .select('receipt_id,attempt_count,status,retryable,provider_message_id')
        .in('receipt_id', receiptIds)
        .eq('channel', 'email');
      if (deliveryLookupError) throw deliveryLookupError;
      const deliveryMap = new Map<string, Delivery>((deliveries ?? []).map((row) => [row.receipt_id, row]));

      let processed = 0;
      let emailed = 0;
      let emailFailed = 0;

      await runReceiptBatch((receipts ?? []) as Receipt[], async (receipt) => {
        const delivery = deliveryMap.get(receipt.id);
        if (!delivery) throw new Error('Receipt email delivery ledger row is missing');
        if (delivery.status === 'sent' || !delivery.retryable || delivery.attempt_count >= MAX_EMAIL_ATTEMPTS) return;

        const nextAttempt = delivery.attempt_count + 1;
        let pdfBytes: Uint8Array;
        if (receipt.document_path) {
          const { data: existingPdf, error: downloadError } = await ctx.supabaseAdmin.storage.from(RECEIPT_BUCKET).download(receipt.document_path);
          if (downloadError || !existingPdf) throw downloadError ?? new Error('Receipt document unavailable');
          pdfBytes = new Uint8Array(await existingPdf.arrayBuffer());
        } else {
          pdfBytes = await createReceiptPdf(receipt);
          const path = `${receipt.user_id}/${receipt.receipt_number}.pdf`;
          const { error: uploadError } = await ctx.supabaseAdmin.storage.from(RECEIPT_BUCKET).upload(path, pdfBytes, { contentType: 'application/pdf', upsert: false });
          if (uploadError && !/already exists/i.test(uploadError.message)) throw uploadError;
          const { error: documentError } = await ctx.supabaseAdmin.from('payment_receipts').update({ document_path: path }).eq('id', receipt.id).is('document_path', null);
          if (documentError) throw documentError;
        }

        const deliveryResult = await sendReceiptEmail(receipt, pdfBytes, nextAttempt, emailConfig);
        const now = new Date().toISOString();
        const deliveryUpdate = {
          status: deliveryResult.ok ? 'sent' : 'failed',
          attempt_count: nextAttempt,
          last_attempt_at: now,
          delivered_at: null,
          provider_message_id: deliveryResult.messageId ?? delivery.provider_message_id,
          retryable: deliveryResult.retryable,
          error_code: deliveryResult.ok ? null : deliveryResult.code,
          error_message: deliveryResult.ok ? null : deliveryResult.code,
          updated_at: now,
        };
        const { error: deliveryError } = await ctx.supabaseAdmin
          .from('receipt_deliveries')
          .update(deliveryUpdate)
          .eq('receipt_id', receipt.id)
          .eq('channel', 'email');
        if (deliveryError) throw deliveryError;

        processed += 1;
        if (deliveryResult.ok) emailed += 1; else emailFailed += 1;
      }, async (receipt) => {
        emailFailed += 1;
        const delivery = deliveryMap.get(receipt.id);
        if (!delivery) throw new Error('Receipt delivery ledger row missing');
        const nextAttempt = delivery.attempt_count + 1;
        const { error } = await ctx.supabaseAdmin.from('receipt_deliveries').update({
          status: 'failed', attempt_count: nextAttempt, last_attempt_at: new Date().toISOString(),
          retryable: nextAttempt < MAX_EMAIL_ATTEMPTS, error_code: 'receipt_processing_failed',
          error_message: 'Receipt document or delivery processing failed', updated_at: new Date().toISOString(),
        }).eq('receipt_id', receipt.id).eq('channel', 'email').eq('attempt_count', delivery.attempt_count);
        if (error) throw new Error('Receipt failure could not be recorded');
      });

      let unresolvedEmailFailures = 0;
      if (receiptIds.length) {
        const { data: failedDeliveries, error: failedDeliveryError } = await ctx.supabaseAdmin
          .from('receipt_deliveries')
          .select('id')
          .in('receipt_id', receiptIds)
          .eq('channel', 'email')
          .eq('status', 'failed');
        if (failedDeliveryError) throw failedDeliveryError;
        unresolvedEmailFailures = failedDeliveries?.length ?? 0;
      }
      const { error: runUpdateError } = await ctx.supabaseAdmin
        .from('billing_runs')
        .update({ delivery_failure_count: unresolvedEmailFailures, updated_at: new Date().toISOString() })
        .eq('id', result.billing_run_id);
      if (runUpdateError) throw runUpdateError;

      return Response.json({ ok: true, billing_date: billingDate, amount_zmw: BILLING_AMOUNT, timezone: BILLING_TIME_ZONE, billing: result, receipts_processed: processed, emails_sent: emailed, emails_failed: emailFailed });
    } catch (error) {
      console.error('monthly payroll receipt processing failed', error instanceof Error ? error.message : 'unknown error');
      return Response.json({ ok: false, error: 'Monthly payroll receipt processing failed' }, { status: 500 });
    }
  }),
};
