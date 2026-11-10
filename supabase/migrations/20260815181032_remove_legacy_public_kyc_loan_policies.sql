-- Remove legacy public-role policies superseded by authenticated ownership policies.
-- Keep authorization explicit and aligned with current RBAC helpers.

drop policy if exists kyc_select on public.kyc;
drop policy if exists kyc_update_controlled on public.kyc;
drop policy if exists loan_select on public.loan_applications;
drop policy if exists loan_insert_user on public.loan_applications;
drop policy if exists loan_update_admin on public.loan_applications;

create policy loan_update_admin
on public.loan_applications
for update
to authenticated
using (
  has_role(auth.uid(), 'admin'::app_role)
  or has_role(auth.uid(), 'super_admin'::app_role)
  or has_role(auth.uid(), 'compliance_team'::app_role)
)
with check (
  has_role(auth.uid(), 'admin'::app_role)
  or has_role(auth.uid(), 'super_admin'::app_role)
  or has_role(auth.uid(), 'compliance_team'::app_role)
);
