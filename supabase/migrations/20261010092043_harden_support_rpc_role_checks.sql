-- Fail closed if any role helper unexpectedly returns NULL.
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

  v_is_staff := coalesce((select private.has_role('admin')), false)
    or coalesce((select private.has_role('super_admin')), false)
    or coalesce((select private.has_role('super_user')), false)
    or coalesce((select private.has_role('compliance_team')), false);

  select * into v_case from public.support_cases where id = p_case_id for update;
  if not found then raise exception 'Support case not found'; end if;
  if v_case.user_id <> v_user_id and not coalesce(v_is_staff, false) then raise exception 'Access denied'; end if;
  if v_case.status = 'closed' then raise exception 'This case is closed'; end if;

  insert into public.support_messages (case_id, sender_id, body, is_staff_reply)
  values (p_case_id, v_user_id, btrim(p_message), v_is_staff)
  returning id into v_message_id;

  update public.support_cases
  set last_message_at = now(),
      updated_at = now(),
      status = case when not v_is_staff and status = 'resolved' then 'open' else status end
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
  if not coalesce(
    (select private.has_role('admin'))
    or (select private.has_role('super_admin'))
    or (select private.has_role('super_user'))
    or (select private.has_role('compliance_team')),
    false
  ) then raise exception 'Access denied'; end if;
  if p_status is null or p_status not in ('open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed') then
    raise exception 'Invalid case status';
  end if;
  if p_priority is null or p_priority not in ('normal', 'high', 'urgent') then
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

revoke all on function public.reply_support_case(uuid, text) from public, anon;
revoke all on function public.update_support_case(uuid, text, text) from public, anon;
grant execute on function public.reply_support_case(uuid, text) to authenticated;
grant execute on function public.update_support_case(uuid, text, text) to authenticated;
