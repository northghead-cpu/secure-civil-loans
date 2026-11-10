-- Restore the loan-application scoring/decision columns that exist in
-- production but were never captured in the repository migration chain.
--
-- This migration intentionally precedes 20260505062122, whose trigger
-- references these fields during migration replay.

ALTER TABLE public.loan_applications
  ADD COLUMN IF NOT EXISTS credit_score numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS risk_level text DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS fraud_score numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fraud_flag boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS underwriting_score numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS decision text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS interest_rate numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS decision_reason text;
