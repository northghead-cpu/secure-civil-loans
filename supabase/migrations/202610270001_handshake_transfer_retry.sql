-- Persist the Marketplace-to-Handshake delivery state so borrowers can safely retry.
alter table public.application_handoffs
  add column if not exists handshake_transfer_status text not null default 'pending',
  add column if not exists handshake_transfer_last_attempt_at timestamptz,
  add column if not exists handshake_transfer_last_error text,
  add column if not exists handshake_accepted_at timestamptz;

alter table public.application_handoffs
  drop constraint if exists application_handoffs_handshake_transfer_status_check;
alter table public.application_handoffs
  add constraint application_handoffs_handshake_transfer_status_check
  check (handshake_transfer_status in ('pending', 'accepted'));

comment on column public.application_handoffs.handshake_transfer_status is
  'Whether the minimal referral was confirmed accepted by Riverbanc Handshake; distinct from lender delivery.';
comment on column public.application_handoffs.handshake_transfer_last_error is
  'Sanitized integration error code only; never stores applicant data or raw upstream responses.';
