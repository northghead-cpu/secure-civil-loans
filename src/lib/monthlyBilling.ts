export const BILLING_AMOUNT_ZMW = 60;
export const BILLING_DAY = 23;
export const BILLING_TIME_ZONE = 'Africa/Lusaka';

export type SubscriptionStatus = 'active' | 'revoked';
export type PayrollStatus = 'pending' | 'submitted' | 'confirmed' | 'failed';

export interface SubscriptionBillingState {
  status: SubscriptionStatus;
  payroll_status: PayrollStatus;
}

/**
 * A Riverbanc receipt represents an actual confirmed payroll deduction.
 * An active subscription authorization by itself is never proof of payment.
 */
export function isEligibleForPaidReceipt(
  subscription: SubscriptionBillingState,
): boolean {
  return (
    subscription.status === 'active' &&
    subscription.payroll_status === 'confirmed'
  );
}

export interface BillingPeriod {
  start: string;
  end: string;
}

/**
 * The 23rd starts the next monthly subscription period; the period ends on
 * the day before the following 23rd.
 */
export function getBillingPeriod(billingDate: string): BillingPeriod {
  const date = new Date(`${billingDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.getUTCDate() !== BILLING_DAY) {
    throw new Error('Billing date must be the 23rd of a month');
  }

  const nextMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, BILLING_DAY));
  nextMonth.setUTCDate(nextMonth.getUTCDate() - 1);

  return {
    start: billingDate,
    end: nextMonth.toISOString().slice(0, 10),
  };
}

export function formatReceiptNumber(billingDate: string, sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error('Receipt sequence must be a positive integer');
  }
  const compactDate = billingDate.replace(/-/g, '').slice(0, 6);
  return `RB-${compactDate}-${String(sequence).padStart(8, '0')}`;
}
