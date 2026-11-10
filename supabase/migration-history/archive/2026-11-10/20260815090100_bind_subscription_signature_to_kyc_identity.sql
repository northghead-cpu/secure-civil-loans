-- Bind the K60 electronic signature to the borrower's verified KYC identity snapshot.
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
  v_profile_full_name text;
  v_profile_nrc text;
  v_profile_employee_number text;
begin
  if _user_id is null then raise exception 'Authentication required'; end if;

  select trim(full_name), trim(nrc_number), trim(employee_number)
    into v_profile_full_name, v_profile_nrc, v_profile_employee_number
  from public.profiles
  where user_id = _user_id;

  if v_profile_full_name is null or length(v_profile_full_name) < 2 then raise exception 'Verified legal name is required'; end if;
  if length(trim(coalesce(_signed_name, ''))) < 2 then raise exception 'A valid electronic signature is required'; end if;
  if lower(trim(_signed_name)) <> lower(v_profile_full_name) then raise exception 'Electronic signature must match your verified legal name'; end if;

  select encode(extensions.digest(v_agreement_text, 'sha256'), 'hex') into v_agreement_hash;
  select encode(extensions.digest(
    concat_ws('|',
      _user_id::text,
      v_agreement_version,
      v_agreement_hash,
      v_profile_full_name,
      coalesce(v_profile_nrc, ''),
      coalesce(v_profile_employee_number, ''),
      to_char(v_signed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    ),
    'sha256'
  ), 'hex') into v_signature_hash;

  update public.subscription_authorizations
  set status = 'revoked', revoked_at = v_signed_at, updated_at = v_signed_at
  where user_id = _user_id and status = 'active';

  insert into public.subscription_authorizations (
    user_id, signed_name, amount, currency, frequency, deduction_method, status, payroll_status,
    authorized_at, signature_method, agreement_version, agreement_hash, signature_hash
  ) values (
    _user_id, v_profile_full_name, 60.00, 'ZMW', 'monthly', 'payroll', 'active', 'pending',
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
