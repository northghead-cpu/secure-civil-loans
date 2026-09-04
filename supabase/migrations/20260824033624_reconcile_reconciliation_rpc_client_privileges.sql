-- These reconciliation RPCs were present in production but are not part of
-- the canonical migration baseline. Preview databases may therefore not have
-- them when this historical hardening migration is replayed. Apply the
-- privilege restriction only when each function actually exists; never create
-- a guessed implementation just to satisfy the migration.
do $$
begin
  if to_regprocedure('public.run_reconciliation()') is not null then
    revoke execute on function public.run_reconciliation() from public, anon, authenticated;
    grant execute on function public.run_reconciliation() to service_role;
  end if;

  if to_regprocedure('public.record_reconciliation_test_finding(text, text)') is not null then
    revoke execute on function public.record_reconciliation_test_finding(text, text) from public, anon, authenticated;
    grant execute on function public.record_reconciliation_test_finding(text, text) to service_role;
  end if;

  if to_regprocedure('public.update_reconciliation_finding_status(uuid, text)') is not null then
    revoke execute on function public.update_reconciliation_finding_status(uuid, text) from public, anon, authenticated;
    grant execute on function public.update_reconciliation_finding_status(uuid, text) to service_role;
  end if;
end
$$;