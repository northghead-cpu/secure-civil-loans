-- Keep the identity snapshot used for subscription e-signatures stable after KYC verification.
create or replace function public.protect_profile_security_fields()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  if not (private.has_role('admin') or private.has_role('super_admin')) then
    new.kyc_status := old.kyc_status;
    new.nrc_verified := old.nrc_verified;
    new.phone_verified := old.phone_verified;
    new.account_status := old.account_status;

    if upper(coalesce(old.kyc_status, '')) in ('VERIFIED', 'COMPLETED') then
      new.full_name := old.full_name;
      new.nrc_number := old.nrc_number;
      new.employee_number := old.employee_number;
    end if;
  end if;
  return new;
end;
$$;