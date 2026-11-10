import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';
import { receiptDisplayText } from './safety.ts';
export interface Receipt {
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
  document_path: string | null;
}

export async function createReceiptPdf(receipt: Receipt): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const supported = new Set(regular.getCharacterSet());

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
    page.drawText(receiptDisplayText(value, supported), { x: 190, y, size: 10, font: regular, color: rgb(0.10, 0.12, 0.14) });
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

  if (receiptDisplayText(receipt.customer_name, supported) !== receipt.customer_name) {
    page.drawText('Unsupported name characters are shown as ?; the original is retained in your account.', { x: 48, y: 285, size: 8, font: regular });
  }
  return pdf.save();
}


export async function createTestReceiptPdf(customerName: string, testRunId: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const supported = new Set(regular.getCharacterSet());
  page.drawText('RIVERBANC', { x: 48, y: 780, size: 22, font: bold, color: rgb(0.04, 0.24, 0.35) });
  page.drawText('Technology Limited', { x: 48, y: 758, size: 10, font: regular, color: rgb(0.25, 0.30, 0.34) });
  page.drawRectangle({ x: 42, y: 670, width: 511, height: 52, borderColor: rgb(0.72, 0.11, 0.11), borderWidth: 2 });
  page.drawText('TEST ONLY — NOT PROOF OF PAYMENT', { x: 70, y: 690, size: 16, font: bold, color: rgb(0.72, 0.11, 0.11) });
  page.drawText('Receipt PDF and email delivery test', { x: 48, y: 625, size: 15, font: bold, color: rgb(0.04, 0.24, 0.35) });
  const rows: [string, string][] = [
    ['Subscriber', customerName],
    ['Illustrative amount', 'ZMW 60.00 per month'],
    ['Payment status', 'NOT PAID — no payroll deduction confirmed'],
    ['Test run', testRunId],
    ['Billing period', 'Not assigned — test only'],
  ];
  let y = 575;
  for (const [label, value] of rows) {
    page.drawText(label, { x: 48, y, size: 10, font: bold, color: rgb(0.30, 0.34, 0.38) });
    page.drawText(receiptDisplayText(value, supported), { x: 190, y, size: 10, font: regular, color: rgb(0.10, 0.12, 0.14) });
    y -= 34;
  }
  page.drawLine({ start: { x: 48, y: 380 }, end: { x: 547, y: 380 }, thickness: 1, color: rgb(0.82, 0.84, 0.86) });
  page.drawText('No payment was received. No billing transaction or payment receipt was created.', { x: 48, y: 348, size: 9, font: bold, color: rgb(0.72, 0.11, 0.11) });
  page.drawText('This document is intentionally watermarked for testing and must not be used', { x: 48, y: 330, size: 9, font: regular });
  page.drawText('as proof of payment.', { x: 48, y: 314, size: 9, font: regular });
  page.drawText('Riverbanc Technology Limited', { x: 48, y: 250, size: 10, font: bold });
  page.drawText('Generated automatically for a non-financial pipeline test.', { x: 48, y: 80, size: 8, font: regular, color: rgb(0.45, 0.48, 0.50) });
  return pdf.save();
}
