revoke execute on function public.authorize_application_handoff(uuid, numeric, integer, text) from public, anon;
grant execute on function public.authorize_application_handoff(uuid, numeric, integer, text) to authenticated;
