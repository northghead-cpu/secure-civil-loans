import { describe, expect, it } from 'vitest';
import {
  BILLING_AMOUNT_ZMW,
  BILLING_DAY,
  isEligibleForPaidReceipt,
} from './monthlyBilling';

describe('monthly payroll billing rules', () => {
  it('uses the fixed Riverbanc subscription amount and billing day', () => {
    expect(BILLING_AMOUNT_ZMW).toBe(60);
    expect(BILLING_DAY).toBe(23);
  });

  it('allows a paid receipt only for an active authorization with confirmed payroll', () => {
    expect(
      isEligibleForPaidReceipt({ status: 'active', payroll_status: 'confirmed' }),
    ).toBe(true);
  });

  it('does not treat authorization alone as payment', () => {
    expect(
      isEligibleForPaidReceipt({ status: 'active', payroll_status: 'pending' }),
    ).toBe(false);
  });

  it('rejects submitted payroll until deduction is confirmed', () => {
    expect(
      isEligibleForPaidReceipt({ status: 'active', payroll_status: 'submitted' }),
    ).toBe(false);
  });

  it('rejects failed payroll and revoked subscriptions', () => {
    expect(
      isEligibleForPaidReceipt({ status: 'active', payroll_status: 'failed' }),
    ).toBe(false);
    expect(
      isEligibleForPaidReceipt({ status: 'revoked', payroll_status: 'confirmed' }),
    ).toBe(false);
  });
});
