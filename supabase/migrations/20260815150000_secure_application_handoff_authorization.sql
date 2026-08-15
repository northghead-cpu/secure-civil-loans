begin;

revoke insert, update on public.application_handoffs from authenticated;
drop policy if exists "Users can create own application handoffs" on public.application_handoffs;
drop policy if exists "Users can authorize own application handoffs" on public.application_handoffs;

create table if not exists private.application_handoff_secrets (
  handoff_id uuid primary key references public.application_handoffs(id) on delete cascade,
  authorization_hash text not null,
  created_at timestamptz not null default now()
);

revoke all on private.application_handoff_secrets from public, anon, authenticated;

create or replace function private.authorize_application_handoff_internal(
  _user_id uuid,
  _lender_product_id uuid,
  _requested_amount numeric,
  _term_months integer,
  _signature_name text
)
returns public.application_handoffs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.bank_products;
  v_profile_full_name text;
  v_handoff public.application_handoffs;
  v_authorized_at timestamptz := clock_timestamp();
  v_authorization_text text;
  v_authorization_hash text;
begin
  if _user_id is null or _user_id <> (select auth.uid()) then raise exception 'Authentication required'; end if;
  if _requested_amount is null or _requested_amount <= 0 then raise exception 'Invalid requested amount'; end if;
  if _term_months is null or _term_months <= 0 then raise exception 'Invalid term'; end if;

  select * into v_product from public.bank_products where id = _lender_product_id and active = true;
  if not found then raise exception 'Selected loan product is unavailable'; end if;
  if _requested_amount < v_product.min_amount or _requested_amount > v_product.max_amount then raise exception 'Requested amount is outside the selected product limits'; end if;
  if _term_months > v_product.max_term_months then raise exception 'Requested term is outside the selected product limits'; end if;

  select trim(full_name) into v_profile_full_name from public.profiles where user_id = _user_id;
  if v_profile_full_name is null or length(v_profile_full_name) < 2 then raise exception 'Verified legal name is required'; end if;
  if lower(trim(coalesce(_signature_name, ''))) <> lower(v_profile_full_name) then raise exception 'Authorization signature must match your verified legal name'; end if;
  if not exists (select 1 from public.profiles where user_id = _user_id and consent_accepted = true) then raise exception 'Required Riverbanc consent has not been accepted'; end if;

  v_authorization_text := format('INFORMATION-SHARING AUTHORIZATION (handoff-v1-2026-08)\n\nI authorize Riverbanc Technology Limited to prepare and share my verified information with %s for my selected loan application.\n\nSelected product: %s\nRequested amount: ZMW %s\nSelected term: %s months\nAnnual interest rate: %s%%', v_product.bank_name, coalesce(v_product.product_name, v_product.bank_name), _requested_amount, _term_months, v_product.interest_rate);
  select encode(extensions.digest(concat_ws('|', _user_id::text, _lender_product_id::text, _requested_amount::text, _term_months::text, v_authorized_at::text, v_authorization_text), 'sha256'), 'hex') into v_authorization_hash;

  insert into public.application_handoffs (user_id, lender_product_id, lender_name, product_name, requested_amount, term_months, interest_rate, estimated_monthly_repayment, total_repayment, information_categories, authorization_text, authorization_version, authorized_at, authorization_signature, status)
  values (_user_id, _lender_product_id, v_product.bank_name, v_product.product_name, _requested_amount, _term_months, v_product.interest_rate, null, null, array['Identity information','Employment information','Income information','Verification results','Relevant supporting documents'], v_authorization_text, 'handoff-v1-2026-08', v_authorized_at, v_profile_full_name, 'authorized')
  returning * into v_handoff;

  insert into private.application_handoff_secrets(handoff_id, authorization_hash) values (v_handoff.id, v_authorization_hash);
  insert into public.audit_logs(user_id, role, action_performed, record_id, table_name, old_value, new_value)
  values (_user_id, 'borrower', 'application_handoff_authorized', v_handoff.id::text, 'application_handoffs', null, jsonb_build_object('lender_product_id', _lender_product_id, 'lender_name', v_product.bank_name, 'product_name', v_product.product_name, 'requested_amount', _requested_amount, 'term_months', _term_months, 'authorization_version', 'handoff-v1-2026-08'));
  return v_handoff;
end;
$$;

revoke all on function private.authorize_application_handoff_internal(uuid, uuid, numeric, integer, text) from public, anon, authenticated;
drop function if exists public.authorize_application_handoff(uuid, numeric, integer, text);
create or replace function public.authorize_application_handoff(_lender_product_id uuid, _requested_amount numeric, _term_months integer, _signature_name text)
returns public.application_handoffs
language sql
security invoker
set search_path = ''
as $$ select private.authorize_application_handoff_internal(auth.uid(), _lender_product_id, _requested_amount, _term_months, _signature_name); $$;
grant execute on function public.authorize_application_handoff(uuid, numeric, integer, text) to authenticated;

commit;
