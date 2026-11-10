create or replace function public.evaluate_audit_event_for_incident(p_audit_log_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log public.audit_logs%rowtype;
  v_rule public.incident_event_rules%rowtype;
  v_incident_id uuid;
  v_action_id uuid;
  v_classification text;
  v_severity text;
begin
  select * into v_log from public.audit_logs where id = p_audit_log_id;
  if not found then raise exception 'Audit log % not found', p_audit_log_id; end if;

  select * into v_rule
  from public.incident_event_rules
  where enabled = true
    and lower(v_log.action_performed) = lower(action_pattern)
  order by case classification when 'critical_incident' then 1 when 'incident_eligible' then 2 else 3 end
  limit 1;

  if not found or v_rule.classification = 'audit_only' then return null; end if;

  v_classification := v_rule.classification;
  v_severity := coalesce(v_rule.default_severity, 'medium');

  select id into v_incident_id
  from public.incidents
  where correlation_id = p_audit_log_id::text
    and status <> 'resolved'
  limit 1;

  if v_incident_id is null then
    insert into public.incidents(operation, severity, status, summary, correlation_id, source, audit_log_id, occurred_at)
    values (
      v_log.action_performed,
      v_severity,
      'detected',
      left(coalesce(v_log.action_performed, 'Security event'), 240),
      p_audit_log_id::text,
      'audit_rule',
      p_audit_log_id,
      v_log.created_at
    ) returning id into v_incident_id;
  end if;

  insert into public.incident_actions(incident_id, audit_log_id, action_performed, table_name, record_id, actor_user_id, occurred_at)
  values (v_incident_id, p_audit_log_id, coalesce(v_log.action_performed, coalesce(v_log.action, 'unknown_action')), v_log.table_name, v_log.record_id, v_log.user_id, v_log.created_at)
  on conflict (incident_id, audit_log_id) do nothing
  returning id into v_action_id;

  return v_incident_id;
end;
$$;

revoke all on function public.evaluate_audit_event_for_incident(uuid) from public, anon, authenticated;
grant execute on function public.evaluate_audit_event_for_incident(uuid) to service_role;
