-- Harden Riverbanc's K60 subscription e-signature record.
-- The borrower-facing signature remains a typed legal name. The security boundary is
-- server-side: the authorization is created by a SECURITY DEFINER function, bound to
-- the authenticated user and an exact agreement hash, and the evidence fields are immutable.

alter table public.subscription_authorizations
  add column if not exists signature_method text not null default 'typed_name',
  add column if not exists agreement_version text not null default 'riverbanc-subscription-v1',
  add column if not exists agreement_hash text,
  add column if not exists signature_hash text;

alter table public.subscription_authorizations
  drop constraint if exists subscription_authorizations_signature_method_check;
alter table public.subscription_authorizations
  add constraint subscription_authorizations_signature_method_check
  check (signature_method in ('typed_name'));

create or replace function private.authorize_riverbanc_subscription_internal(_user_id uuid, _signed_name text)
returns public.subscription_authorizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.subscription_authorizations;
  v_signed_at timestamptz := clock_timestamp();
  v_agreement_version text := 'riverbanc-subscription-v1';
  v_agreement_text text := 'I authorize Riverbanc Technology Limited to deduct K60 per month from my payroll for my Riverbanc subscription. This subscription is separate from any loan principal, interest, fees or charges imposed by a financial institution.';
  v_agreement_hash text;
  v_signature_hash text;
begin
  if _user_id is null then raise exception 'Authentication required'; end if;
  if length(trim(coalesce(_signed_name, ''))) < 2 then raise exception 'A valid electronic signature is required'; end if;

  select encode(extensions.digest(v_agreement_text, 'sha256'), 'hex') into v_agreement_hash;
  select encode(extensions.digest(
    concat_ws('|', _user_id::text, v_agreement_version, v_agreement_hash, trim(_signed_name), to_char(v_signed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
    'sha256'
  ), 'hex') into v_signature_hash;

  update public.subscription_authorizations
  set status = 'revoked', revoked_at = v_signed_at, updated_at = v_signed_at
  where user_id = _user_id and status = 'active';

  insert into public.subscription_authorizations (
    user_id, signed_name, amount, currency, frequency, deduction_method, status, payroll_status,
    authorized_at, signature_method, agreement_version, agreement_hash, signature_hash
  ) values (
    _user_id, trim(_signed_name), 60.00, 'ZMW', 'monthly', 'payroll', 'active', 'pending',
    v_signed_at, 'typed_name', v_agreement_version, v_agreement_hash, v_signature_hash
  ) returning * into result;

  insert into public.audit_logs (user_id, role, action_performed, record_id, table_name, old_value, new_value)
  values (
    _user_id, 'borrower', 'subscription_authorized', result.id::text, 'subscription_authorizations', null,
    jsonb_build_object(
      'amount', result.amount, 'currency', result.currency, 'frequency', result.frequency,
      'deduction_method', result.deduction_method, 'payroll_status', result.payroll_status,
      'authorized_at', result.authorized_at, 'signature_method', result.signature_method,
      'agreement_version', result.agreement_version, 'agreement_hash', result.agreement_hash,
      'signature_hash', result.signature_hash
    )
  );

  return result;
end;
$$;

revoke execute on function public.authorize_riverbanc_subscription(text) from anon, authenticated;

create or replace function public.protect_subscription_authorization_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.user_id is distinct from new.user_id
     or old.signed_name is distinct from new.signed_name
     or old.amount is distinct from new.amount
     or old.currency is distinct from new.currency
     or old.frequency is distinct from new.frequency
     or old.deduction_method is distinct from new.deduction_method
     or old.signature_method is distinct from new.signature_method
     or old.agreement_version is distinct from new.agreement_version
     or old.agreement_hash is distinct from new.agreement_hash
     or old.signature_hash is distinct from new.signature_hash
     or old.authorized_at is distinct from new.authorized_at then
    raise exception 'Subscription authorization evidence is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_subscription_authorization_record on public.subscription_authorizations;
create trigger protect_subscription_authorization_record
before update on public.subscription_authorizations
for each row execute function public.protect_subscription_authorization_record();

revoke execute on function public.protect_subscription_authorization_record() from anon, authenticated;

update public.subscription_authorizations sa
set agreement_hash = encode(extensions.digest('I authorize Riverbanc Technology Limited to deduct K60 per month from my payroll for my Riverbanc subscription. This subscription is separate from any loan principal, interest, fees or charges imposed by a financial institution.', 'sha256'), 'hex')
where agreement_hash is null;
