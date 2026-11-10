-- Expand borrower-facing application tracking to represent lender-controlled milestones.
ALTER TABLE public.application_handoffs
  DROP CONSTRAINT IF EXISTS application_handoffs_status_check;

ALTER TABLE public.application_handoffs
  ADD CONSTRAINT application_handoffs_status_check
  CHECK (status IN (
    'pending_authorization',
    'authorized',
    'preparing',
    'sent_to_lender',
    'lender_review',
    'additional_information_requested',
    'approved',
    'declined',
    'disbursed'
  ));

COMMENT ON COLUMN public.application_handoffs.status IS
  'Application lifecycle state. Riverbanc controls preparation/sending states; lender-controlled states begin at lender_review.';
