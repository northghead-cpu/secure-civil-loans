create table private.financial_analysis_jobs(
 user_id uuid primary key references auth.users(id), generation bigint not null default 1,
 state text not null default 'pending' check(state in ('pending','processing','done')),
 requested_at timestamptz not null default now(),next_attempt_at timestamptz not null default now(),
 lease_token uuid, leased_at timestamptz,attempts integer not null default 0,last_error text,
 result jsonb, completed_at timestamptz);
alter table private.financial_analysis_jobs enable row level security;
revoke all on private.financial_analysis_jobs from public,anon,authenticated;
grant all on private.financial_analysis_jobs to service_role;
create or replace function private.enqueue_financial_analysis() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into private.financial_analysis_jobs(user_id) values(new.user_id)
 on conflict(user_id) do update set generation=financial_analysis_jobs.generation+1,state='pending',
 requested_at=now(),next_attempt_at=now(),last_error=null,lease_token=null;
 return new;
end $$;
revoke all on function private.enqueue_financial_analysis() from public,anon,authenticated;
create trigger financial_documents_changed after insert or update on public.kyc_documents
 for each row execute function private.enqueue_financial_analysis();
create trigger financial_handoff_changed after insert or update of information_categories,authorization_signature,authorized_at,requested_amount,term_months,status on public.application_handoffs
 for each row execute function private.enqueue_financial_analysis();
create or replace function public.financial_cron_authorized(p_secret text) returns boolean
language plpgsql security definer set search_path='' as $$
declare expected text;
begin
 if auth.role() is distinct from 'service_role' then raise insufficient_privilege;end if;
 select decrypted_secret into expected from vault.decrypted_secrets where name='riverbanc_cron_secret';
 return expected is not null and length(expected)>=24 and p_secret is not null
 and extensions.digest(expected,'sha256')=extensions.digest(p_secret,'sha256');
end $$;
create or replace function public.claim_financial_analysis(p_user_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $
declare result jsonb;
begin
 if auth.role() is distinct from 'service_role' then raise insufficient_privilege;end if;
 with chosen as(select user_id from private.financial_analysis_jobs
 where (p_user_id is null or user_id=p_user_id) and
 ((state='pending' and next_attempt_at<=now()) or (state='processing' and leased_at<now()-interval '5 minutes'))
 order by requested_at for update skip locked limit 1), updated as (
 update private.financial_analysis_jobs j set state='processing',lease_token=gen_random_uuid(),leased_at=now(),attempts=attempts+1
 from chosen c where j.user_id=c.user_id returning j.*)
 select coalesce(jsonb_agg(to_jsonb(updated)),'[]'::jsonb) into result from updated;
 return result;
end $;
create or replace function public.finish_financial_analysis(p_user_id uuid,p_generation bigint,p_lease uuid,p_result jsonb,p_error text default null)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.role() is distinct from 'service_role' then raise insufficient_privilege;end if;
 update private.financial_analysis_jobs set state=case when p_error is null then 'done' else 'pending' end,
 result=coalesce(p_result,result),last_error=p_error,completed_at=case when p_error is null then now() end,
 next_attempt_at=now()+interval '10 minutes'
 where user_id=p_user_id and generation=p_generation and lease_token=p_lease;
 return found;
end $$;
revoke all on function public.financial_cron_authorized(text),public.claim_financial_analysis(uuid),
 public.finish_financial_analysis(uuid,bigint,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.financial_cron_authorized(text),public.claim_financial_analysis(uuid),
 public.finish_financial_analysis(uuid,bigint,uuid,jsonb,text) to service_role;
insert into private.financial_analysis_jobs(user_id) select distinct user_id from public.kyc_documents on conflict do nothing;

create or replace function public.financial_analysis_current(p_user_id uuid,p_generation bigint,p_lease uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if auth.role() is distinct from 'service_role' then raise insufficient_privilege;end if;
 return exists(select 1 from private.financial_analysis_jobs where user_id=p_user_id and generation=p_generation and lease_token=p_lease and state='processing');
end $$;
revoke all on function public.financial_analysis_current(uuid,bigint,uuid) from public,anon,authenticated;
grant execute on function public.financial_analysis_current(uuid,bigint,uuid) to service_role;
