create index if not exists incidents_acknowledged_by_idx on public.incidents (acknowledged_by);
create index if not exists incidents_investigating_by_idx on public.incidents (investigating_by);
create index if not exists incidents_resolved_by_idx on public.incidents (resolved_by);
create index if not exists lender_commission_settings_updated_by_idx on public.lender_commission_settings (updated_by);
create index if not exists system_settings_updated_by_idx on public.system_settings (updated_by);

drop policy if exists lender_commission_settings_super_admin_write on public.lender_commission_settings;
drop policy if exists system_settings_super_admin_write on public.system_settings;
create policy lender_commission_settings_super_admin_insert on public.lender_commission_settings for insert to authenticated with check ((select private.has_role((select auth.uid()), 'super_admin'::app_role)));
create policy lender_commission_settings_super_admin_update on public.lender_commission_settings for update to authenticated using ((select private.has_role((select auth.uid()), 'super_admin'::app_role))) with check ((select private.has_role((select auth.uid()), 'super_admin'::app_role)));
create policy lender_commission_settings_super_admin_delete on public.lender_commission_settings for delete to authenticated using ((select private.has_role((select auth.uid()), 'super_admin'::app_role)));
create policy system_settings_super_admin_insert on public.system_settings for insert to authenticated with check ((select private.has_role((select auth.uid()), 'super_admin'::app_role)));
create policy system_settings_super_admin_update on public.system_settings for update to authenticated using ((select private.has_role((select auth.uid()), 'super_admin'::app_role))) with check ((select private.has_role((select auth.uid()), 'super_admin'::app_role)));
create policy system_settings_super_admin_delete on public.system_settings for delete to authenticated using ((select private.has_role((select auth.uid()), 'super_admin'::app_role)));

drop policy if exists incident_event_rules_admin_read on public.incident_event_rules;
create policy incident_event_rules_admin_read on public.incident_event_rules for select to authenticated using (
  (select exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role in ('admin'::app_role, 'super_admin'::app_role)
  ))
);
