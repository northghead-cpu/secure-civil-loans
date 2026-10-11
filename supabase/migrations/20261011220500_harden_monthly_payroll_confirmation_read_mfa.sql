-- Payroll reference and evidence metadata require both privileged role and MFA assurance.
drop policy if exists payroll_deduction_confirmations_admin_read
  on public.payroll_deduction_confirmations;

create policy payroll_deduction_confirmations_admin_read
  on public.payroll_deduction_confirmations
  for select
  to authenticated
  using (
    (select auth.jwt() ->> 'aal') = 'aal2'
    and (
      (select private.has_role('admin'::text))
      or (select private.has_role('super_admin'::text))
      or (select private.has_role('compliance_team'::text))
    )
  );

notify pgrst, 'reload schema';
