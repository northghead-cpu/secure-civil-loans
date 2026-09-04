-- Incident functions were present in production but are not part of the
-- canonical migration baseline. A preview branch can therefore lack one or
-- both functions. Harden only functions that actually exist; do not invent a
-- replacement implementation merely to satisfy a historical privilege fix.
do $$
begin
  if to_regprocedure('public.record_incident(text, text, text, text, text, uuid)') is not null then
    alter function public.record_incident(text, text, text, text, text, uuid)
      set search_path = pg_catalog, public, private;
  end if;

  if to_regprocedure('public.record_incident_action(uuid, uuid)') is not null then
    alter function public.record_incident_action(uuid, uuid)
      set search_path = pg_catalog, public, private;
  end if;
end
$$;