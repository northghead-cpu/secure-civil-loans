-- Server-side incident writer. The incident payload is deliberately minimal and
-- contains only the operational action summary, never audit-log details.

create or replace function public.record_incident(
  p_operation text,
  p_severity text,
  p_summary text,
  p_correlation_id text default null,
  p_source text default 'application',
  p_audit_log_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  incident_id uuid;
begin
  if p_operation is null or char_length(trim(p_operation)) not between 1 and 80 then
    raise exception 'invalid incident operation';
  end if;
  if p_severity not in ('critical', 'high', 'medium', 'low') then
    raise exception 'invalid incident severity';
  end if;
  if p_summary is null or char_length(trim(p_summary)) not between 1 and 240 then
    raise exception 'invalid incident summary';
  end if;
  if p_correlation_id is not null and char_length(p_correlation_id) > 128 then
    raise exception 'invalid incident correlation id';
  end if;

  insert into public.incidents (
    operation,
    severity,
    summary,
    correlation_id,
    source,
    audit_log_id
  )
  values (
    trim(p_operation),
    p_severity,
    trim(p_summary),
    nullif(trim(p_correlation_id), ''),
    coalesce(nullif(trim(p_source), ''), 'application'),
    p_audit_log_id
  )
  returning id into incident_id;

  return incident_id;
end;
$$;

revoke execute on function public.record_incident(text, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.record_incident(text, text, text, text, text, uuid) to service_role;
