-- Apply ONLY after the Marketplace frontend using authenticated document fetches
-- has been merged, deployed and smoke-tested. Old signed-link UIs will fail closed.
-- Private bucket flags must remain false. Service-role server jobs bypass RLS.
create policy marketplace_sensitive_storage_authenticated_reads
on storage.objects as restrictive for select to authenticated
using (
  bucket_id not in ('kyc-documents','payslips','payment-receipts')
  or storage.allow_any_operation(array[
    'object.list','object.list_v2','object.get_authenticated',
    'object.get_authenticated_info','object.head_authenticated_info','object.info_authenticated'
  ])
);
-- This denies new sign/sign_many/image-sign requests and direct Data API object
-- listing without a Storage operation. Previously signed URLs are not revoked by
-- an RLS change; let their existing expiry elapse or contact Supabase support.
