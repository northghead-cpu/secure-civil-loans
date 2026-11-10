
create policy "edge_request_log_service_role_only"
on public.edge_request_log
as restrictive
for all
to service_role
using (true)
with check (true);

create policy "incident_ingestion_events_service_role_only"
on public.incident_ingestion_events
as restrictive
for all
to service_role
using (true)
with check (true);

create policy "reconciliation_checks_service_role_only"
on public.reconciliation_checks
as restrictive
for all
to service_role
using (true)
with check (true);

create policy "reconciliation_findings_service_role_only"
on public.reconciliation_findings
as restrictive
for all
to service_role
using (true)
with check (true);

create policy "reconciliation_runs_service_role_only"
on public.reconciliation_runs
as restrictive
for all
to service_role
using (true)
with check (true);
