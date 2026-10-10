-- Customer support case management. Additive only; no lending workflow changes.
create table if not exists public.support_cases (
  id uuid primary key default gen_random_uuid(),
  case_number text not null unique default ('RB-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null check (char_length(btrim(subject)) between 5 and 160),
  category text not null check (category in ('account', 'kyc', 'application', 'loan_comparison', 'subscription', 'privacy', 'technical', 'other')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed')),
  priority text not null default 'normal' check (priority in ('normal', 'high', 'urgent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.support_cases(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete restrict,
  body text not null check (char_length(btrim(body)) between 1 and 10000),
  is_staff_reply boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.support_case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.support_cases(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('case_created', 'message_added', 'status_changed', 'priority_changed')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists support_cases_user_updated_idx on public.support_cases (user_id, last_message_at desc);
create index if not exists support_cases_status_updated_idx on public.support_cases (status, last_message_at desc);
create index if not exists support_messages_case_created_idx on public.support_messages (case_id, created_at);
create index if not exists support_case_events_case_created_idx on public.support_case_events (case_id, created_at);

alter table public.support_cases enable row level security;
alter table public.support_messages enable row level security;
alter table public.support_case_events enable row level security;

drop policy if exists support_cases_read_own_or_staff on public.support_cases;
create policy support_cases_read_own_or_staff on public.support_cases
for select to authenticated
using (
  user_id = (select auth.uid())
  or (select private.has_role('admin'))
  or (select private.has_role('super_admin'))
  or (select private.has_role('super_user'))
  or (select private.has_role('compliance_team'))
);

drop policy if exists support_messages_read_own_or_staff on public.support_messages;
create policy support_messages_read_own_or_staff on public.support_messages
for select to authenticated
using (
  exists (
    select 1 from public.support_cases c
    where c.id = support_messages.case_id
      and (
        c.user_id = (select auth.uid())
        or (select private.has_role('admin'))
        or (select private.has_role('super_admin'))
        or (select private.has_role('super_user'))
        or (select private.has_role('compliance_team'))
      )
  )
);

drop policy if exists support_case_events_read_own_or_staff on public.support_case_events;
create policy support_case_events_read_own_or_staff on public.support_case_events
for select to authenticated
using (
  exists (
    select 1 from public.support_cases c
    where c.id = support_case_events.case_id
      and (
        c.user_id = (select auth.uid())
        or (select private.has_role('admin'))
        or (select private.has_role('super_admin'))
        or (select private.has_role('super_user'))
        or (select private.has_role('compliance_team'))
      )
  )
);

revoke all on public.support_cases from anon, authenticated;
revoke all on public.support_messages from anon, authenticated;
revoke all on public.support_case_events from anon, authenticated;
grant select on public.support_cases, public.support_messages, public.support_case_events to authenticated;

create or replace function public.record_support_case_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_table_name = 'support_cases' and tg_op = 'INSERT' then
    insert into public.support_case_events (case_id, actor_id, event_type, details)
    values (new.id, auth.uid(), 'case_created', jsonb_build_object('category', new.category));
  elsif tg_table_name = 'support_cases' and tg_op = 'UPDATE' then
    if old.status is distinct from new.status then
      insert into public.support_case_events (case_id, actor_id, event_type, details)
      values (new.id, auth.uid(), 'status_changed', jsonb_build_object('from', old.status, 'to', new.status));
    end if;
    if old.priority is distinct from new.priority then
      insert into public.support_case_events (case_id, actor_id, event_type, details)
      values (new.id, auth.uid(), 'priority_changed', jsonb_build_object('from', old.priority, 'to', new.priority));
    end if;
  elsif tg_table_name = 'support_messages' and tg_op = 'INSERT' then
    insert into public.support_case_events (case_id, actor_id, event_type, details)
    values (new.case_id, new.sender_id, 'message_added', jsonb_build_object('message_id', new.id, 'staff_reply', new.is_staff_reply));
  end if;
  return new;
end;
$$;

drop trigger if exists support_cases_event_log on public.support_cases;
create trigger support_cases_event_log
after insert or update of status, priority on public.support_cases
for each row execute function public.record_support_case_event();

drop trigger if exists support_messages_event_log on public.support_messages;
create trigger support_messages_event_log
after insert on public.support_messages
for each row execute function public.record_support_case_event();

create or replace function public.create_support_case(p_subject text, p_category text, p_message text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_case_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_subject is null or char_length(btrim(p_subject)) not between 5 and 160 then
    raise exception 'Subject must be between 5 and 160 characters';
  end if;
  if p_message is null or char_length(btrim(p_message)) not between 1 and 10000 then
    raise exception 'Message must be between 1 and 10000 characters';
  end if;
  if p_category is null or p_category not in ('account', 'kyc', 'application', 'loan_comparison', 'subscription', 'privacy', 'technical', 'other') then
    raise exception 'Invalid support category';
  end if;

  insert into public.support_cases (user_id, subject, category)
  values (v_user_id, btrim(p_subject), p_category)
  returning id into v_case_id;

  insert into public.support_messages (case_id, sender_id, body, is_staff_reply)
  values (v_case_id, v_user_id, btrim(p_message), false);

  return v_case_id;
end;
$$;

create or replace function public.reply_support_case(p_case_id uuid, p_message text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_case public.support_cases%rowtype;
  v_is_staff boolean;
  v_message_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_message is null or char_length(btrim(p_message)) not between 1 and 10000 then
    raise exception 'Message must be between 1 and 10000 characters';
  end if;

  v_is_staff := (select private.has_role('admin'))
    or (select private.has_role('super_admin'))
    or (select private.has_role('super_user'))
    or (select private.has_role('compliance_team'));

  select * into v_case from public.support_cases where id = p_case_id for update;
  if not found then raise exception 'Support case not found'; end if;
  if v_case.user_id <> v_user_id and not v_is_staff then raise exception 'Access denied'; end if;
  if v_case.status = 'closed' then raise exception 'This case is closed'; end if;

  insert into public.support_messages (case_id, sender_id, body, is_staff_reply)
  values (p_case_id, v_user_id, btrim(p_message), v_is_staff)
  returning id into v_message_id;

  update public.support_cases
  set last_message_at = now(),
      updated_at = now(),
      status = case when not v_is_staff and status = 'resolved' then 'open' else status end,
      closed_at = case when v_is_staff and status = 'closed' then now() else closed_at end
  where id = p_case_id;

  return v_message_id;
end;
$$;

create or replace function public.update_support_case(p_case_id uuid, p_status text, p_priority text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not (
    (select private.has_role('admin'))
    or (select private.has_role('super_admin'))
    or (select private.has_role('super_user'))
    or (select private.has_role('compliance_team'))
  ) then raise exception 'Access denied'; end if;
  if p_status not in ('open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed') then
    raise exception 'Invalid case status';
  end if;
  if p_priority not in ('normal', 'high', 'urgent') then
    raise exception 'Invalid case priority';
  end if;

  update public.support_cases
  set status = p_status,
      priority = p_priority,
      updated_at = now(),
      closed_at = case when p_status = 'closed' then coalesce(closed_at, now()) else null end
  where id = p_case_id;
  if not found then raise exception 'Support case not found'; end if;
end;
$$;

revoke all on function public.record_support_case_event() from public, anon, authenticated;
revoke all on function public.create_support_case(text, text, text) from public, anon;
revoke all on function public.reply_support_case(uuid, text) from public, anon;
revoke all on function public.update_support_case(uuid, text, text) from public, anon;
grant execute on function public.create_support_case(text, text, text) to authenticated;
grant execute on function public.reply_support_case(uuid, text) to authenticated;
grant execute on function public.update_support_case(uuid, text, text) to authenticated;
