-- Resolve the Resend sending key only inside a service-role call; keep it in Vault, never client code.
create or replace function public.get_riverbanc_email_config()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $email_config$
declare
  v_api_key text;
  v_from_email text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role only';
  end if;

  select decrypted_secret into v_api_key
  from vault.decrypted_secrets
  where name = 'riverbanc_resend_api_key'
  limit 1;

  select decrypted_secret into v_from_email
  from vault.decrypted_secrets
  where name = 'riverbanc_resend_from_email'
  limit 1;

  return jsonb_build_object(
    'configured', v_api_key is not null and v_from_email is not null,
    'api_key', v_api_key,
    'from_email', v_from_email
  );
end;
$email_config$;

revoke all on function public.get_riverbanc_email_config() from public, anon, authenticated;
grant execute on function public.get_riverbanc_email_config() to service_role;

notify pgrst, 'reload schema';
