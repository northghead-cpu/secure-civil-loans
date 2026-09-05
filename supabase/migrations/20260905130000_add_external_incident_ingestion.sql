-- External incident ingestion is intentionally metadata-only.
-- Provider payloads are validated at the edge and never stored here because
-- they may contain data outside Riverbanc's operational incident boundary.

create table if not exists public.incident_ingestion_events (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('sentry', 'aikido')),
  external_event_id text not null,
  event_type text not null,
  incident_id uuid references public.incidents(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (source, external_event_id)
);

create index if not exists incident_ingestion_events_incident_idx
  on public.incident_ingestion_events (incident_id);

alter table public.incident_ingestion_events enable row level security;
revoke all on public.incident_ingestion_events from anon, authenticated;

authority: service_role only

create or replace function public.record_external_incident(
  p_source text,
  p_external_event_id text,
  p_event_type text,
  p_operation text,
  p_severity text,
  p_summary text,
  p_correlation_id text default null,
  p_source_url text default null,
  p_occurred_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_incident_id uuid;
begin
  if p_source not in ('sentry', 'aikido') then
    raise exception 'invalid external incident source';
  end if;
  if p_external_event_id is null or char_length(trim(p_external_event_id)) not between 1 and 256 then
    raise exception 'invalid external event id';
  end if;
  if p_event_type is null or char_length(trim(p_event_type)) not between 1 and 120 then
    raise exception 'invalid external event type';
  end if;
  if p_source_url is not null and char_length(p_source_url) > 2048 then
    raise exception 'invalid external incident source url';
  end if;

  select incident_id into v_incident_id
  from public.incident_ingestion_events
  where source = p_source and external_event_id = trim(p_external_event_id);

  if v_incident_id is not null then
    return v_incident_id;
  end if;

  v_incident_id := public.record_incident(
    p_operation,
    p_severity,
    p_summary,
    p_correlation_id,
    p_source,
    null
  );

  insert into public.incident_ingestion_events (
    source, external_event_id, event_type, incident_id
  ) values (
    p_source, trim(p_external_event_id), trim(p_event_type), v_incident_id
  );

  return v_incident_id;
exception
  when unique_violation then
    select incident_id into v_incident_id
    from public.incident_ingestion_events
    where source = p_source and external_event_id = trim(p_external_event_id);
    if v_incident_id is null then raise; end if;
    return v_incident_id;
end;
$$;

revoke execute on function public.record_external_incident(text, text, text, text, text, text, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.record_external_incident(text, text, text, text, text, text, text, text, timestamptz)
  to service_role;

-- Keep the table inaccessible through the Data API; only the privileged
-- ingestion function can create or inspect delivery records.
