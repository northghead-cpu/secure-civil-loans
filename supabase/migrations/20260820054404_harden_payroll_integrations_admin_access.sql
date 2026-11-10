create policy payroll_integrations_admin_read on public.payroll_integrations
for select to authenticated
using ((select private.has_role((select auth.uid()), 'admin'::app_role)) or (select private.has_role((select auth.uid()), 'super_admin'::app_role)));

create policy payroll_integrations_super_admin_insert on public.payroll_integrations
for insert to authenticated
with check ((select private.has_role((select auth.uid()), 'super_admin'::app_role)));

create policy payroll_integrations_super_admin_update on public.payroll_integrations
for update to authenticated
using ((select private.has_role((select auth.uid()), 'super_admin'::app_role)))
with check ((select private.has_role((select auth.uid()), 'super_admin'::app_role)));

create policy payroll_integrations_super_admin_delete on public.payroll_integrations
for delete to authenticated
using ((select private.has_role((select auth.uid()), 'super_admin'::app_role)));
