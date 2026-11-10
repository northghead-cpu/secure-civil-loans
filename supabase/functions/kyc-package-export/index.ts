import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { makeExport } from "./handler.mjs";
const url = Deno.env.get("SUPABASE_URL");
if (url !== "https://zdpeaxkormwjrgllwalq.supabase.co")
  throw Error("MARKETPLACE_REQUIRED");
const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
let tenantMap;
try {
  tenantMap = JSON.parse(
    Deno.env.get("RIVERBANC_HANDSHAKE_TENANT_MAP") || "null",
  );
} catch {
  tenantMap = null;
}
Deno.serve(
  makeExport({
    secret: Deno.env.get("RIVERBANC_HANDSHAKE_HMAC_SECRET"),
    tenantMap,
    async context(id: string, lender: string, nonce: string | null) {
      const { data, error } = await admin.rpc(
        "marketplace_kyc_release_context",
        { p_handoff_id: id, p_lender_name: lender, p_nonce: nonce },
      );
      if (error) throw Error("SOURCE_DENIED");
      return data;
    },
    async read(path: string) {
      const { data, error } = await admin.storage
        .from("kyc-documents")
        .download(path);
      if (error || !data || data.size > 5242880) throw Error("READ");
      return new Uint8Array(await data.arrayBuffer());
    },
    async audit(request: string, handoff: string, hash: string, fp: string) {
      const { error } = await admin
        .from("audit_logs")
        .insert({
          role: "system",
          action_performed: "handshake_kyc_package_prepared",
          record_id: handoff,
          table_name: "application_handoffs",
          new_value: {
            request_id: request,
            package_sha256: hash,
            source_fingerprint: fp,
          },
        });
      if (error) throw Error("AUDIT");
    },
  }),
);
