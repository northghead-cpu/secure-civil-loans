-- Incident Center subscribes to incident lifecycle changes. RLS remains the
-- authorization boundary for authenticated admin subscribers.
alter publication supabase_realtime add table public.incidents;
