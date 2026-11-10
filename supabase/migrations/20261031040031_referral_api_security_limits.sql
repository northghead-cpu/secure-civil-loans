-- Apply before deploying the hardened referral Edge Functions.
-- Additive: preserves every existing table and business record.
create schema if not exists private;
create table if not exists private.referral_api_limits (
  scope text not null,
  subject text not null,
  window_started_at timestamptz not null,
  hits integer not null check (hits > 0),
  primary key (scope, subject)
);
alter table private.referral_api_limits enable row level security;
revoke all on private.referral_api_limits from public, anon, authenticated;

create or replace function private.consume_referral_api_limit(p_scope text, p_subject text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_limit integer;
  v_now timestamptz := clock_timestamp();
  v_row private.referral_api_limits%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise insufficient_privilege using message = 'SERVICE_ROLE_REQUIRED';
  end if;
  v_limit := case p_scope
    when 'sender_user' then 20
    when 'sender_global' then 120
    when 'intake_global' then 120
    when 'intake_tenant' then 60
    else null end;
  if v_limit is null or p_subject is null or p_subject !~ '^[A-Za-z0-9_-]{1,80}$'
     or (p_scope in ('sender_global','intake_global') and p_subject <> 'all')
     or (p_scope = 'sender_user' and p_subject !~ '^[0-9a-f-]{36}$') then
    raise exception using errcode = '22023', message = 'INVALID_RATE_LIMIT_SCOPE';
  end if;
  -- A single atomic upsert serializes concurrent requests across all isolates.
  -- Reuse one row per subject; no scheduled deletion of data is required.
  insert into private.referral_api_limits as limits(scope, subject, window_started_at, hits)
  values(p_scope, p_subject, v_now, 1)
  on conflict(scope, subject) do update set
    window_started_at = case when limits.window_started_at <= v_now - interval '60 seconds'
      then v_now else limits.window_started_at end,
    hits = case when limits.window_started_at <= v_now - interval '60 seconds'
      then 1 else least(limits.hits + 1, v_limit + 1) end
  returning * into v_row;
  return jsonb_build_object('allowed', v_row.hits <= v_limit, 'retry_after',
    greatest(1, ceil(extract(epoch from v_row.window_started_at + interval '60 seconds' - v_now)))::integer);
end $$;
revoke all on function private.consume_referral_api_limit(text,text) from public, anon, authenticated;
grant execute on function private.consume_referral_api_limit(text,text) to service_role;

create or replace function public.consume_referral_api_limit(p_scope text, p_subject text)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.consume_referral_api_limit(p_scope, p_subject)
$$;
revoke all on function public.consume_referral_api_limit(text,text) from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function public.consume_referral_api_limit(text,text) to service_role;
