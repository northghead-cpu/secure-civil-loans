import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { makeBackupSource } from "./handler.mjs";
const url = Deno.env.get("SUPABASE_URL");
if (url !== "https://zdpeaxkormwjrgllwalq.supabase.co")
  throw Error("MARKETPLACE_REQUIRED");
const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    fetch: (input, init) =>
      fetch(input, {
        ...init,
        cache: "no-store",
        signal: init?.signal ?? AbortSignal.timeout(20000),
      }),
  },
});
async function rpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await admin.rpc(name, args);
  if (error) throw Error("RPC");
  return data;
}
Deno.serve(
  makeBackupSource({
    token: Deno.env.get("MARKETPLACE_BACKUP_SOURCE_TOKEN"),
    publicKey: Deno.env.get("MARKETPLACE_BACKUP_PUBLIC_KEY"),
    page: (after: string | null, before: string) =>
      rpc("marketplace_security_source_page", {
        p_after: after,
        p_before: before,
      }),
    object: (id: string) =>
      rpc("marketplace_security_source_object", { p_id: id }),
    async read(item: { bucket_id: string; name: string }) {
      if (
        !["kyc-documents", "payslips", "payment-receipts"].includes(
          item.bucket_id,
        )
      )
        throw Error("BUCKET");
      const { data, error } = await admin.storage
        .from(item.bucket_id)
        .download(item.name);
      if (error || !data || data.size > 2 * 1024 * 1024) throw Error("READ");
      return new Uint8Array(await data.arrayBuffer());
    },
  }),
);
