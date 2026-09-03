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
