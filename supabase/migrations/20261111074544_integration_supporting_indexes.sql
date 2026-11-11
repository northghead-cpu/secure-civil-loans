-- Add covering indexes only. Preserve all rows, policies and existing indexes.
set local lock_timeout='3s';
create index if not exists payroll_deduction_confirmations_confirmed_by_idx on public.payroll_deduction_confirmations(confirmed_by);
create index if not exists receipt_delivery_events_receipt_delivery_idx on public.receipt_delivery_events(receipt_delivery_id);
create index if not exists support_case_events_actor_idx on public.support_case_events(actor_id);
create index if not exists support_messages_sender_idx on public.support_messages(sender_id);
