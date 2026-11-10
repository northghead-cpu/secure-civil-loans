create function private.marketplace_security_source_object(p_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  if (auth.jwt()->>'role') is distinct from 'service_role' then raise exception 'Storage worker required' using errcode='42501';end if;
  select jsonb_build_object('id',id,'bucket_id',bucket_id,'name',name,'version',version,'metadata',metadata)
    into result from storage.objects where id=p_id and bucket_id in ('kyc-documents','payslips','payment-receipts');
  return result;
end $$;
revoke all on function private.marketplace_security_source_object(uuid) from public,anon,authenticated;
grant execute on function private.marketplace_security_source_object(uuid) to service_role;
create function public.marketplace_security_source_object(p_id uuid)
returns jsonb language sql security invoker set search_path='' as $$select private.marketplace_security_source_object($1)$$;
revoke all on function public.marketplace_security_source_object(uuid) from public,anon,authenticated;
grant execute on function public.marketplace_security_source_object(uuid) to service_role;
