import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { makeHandler } from "./handler.mjs";
const url = Deno.env.get("SUPABASE_URL")!;
if (url !== "https://zdpeaxkormwjrgllwalq.supabase.co")
  throw new Error("MARKETPLACE_PROJECT_REQUIRED");
const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
});
async function rpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await admin.rpc(name, args);
  if (error) throw Error("WORKER_RPC_FAILED");
  return data;
}
Deno.serve(
  makeHandler({
    token: Deno.env.get("MARKETPLACE_KYC_WORKER_TOKEN"),
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
        throw Error("BUCKET_DENIED");
      const { data, error } = await admin.storage
        .from(item.bucket_id)
      .download(item.name);
      if (error || !data || data.size > 10 * 1024 * 1024)
        throw Error("SOURCE_UNAVAILABLE");
      return new Uint8Array(await data.arrayBuffer());
    },
    record: (body: {
      id: string;
      version: string;
      sha256: string;
      verdict: string;
      engine: string;
      definitions_at: string;
    }) =>
      rpc("record_marketplace_storage_scan", {
        p_id: body.id,
        p_version: body.version,
        p_sha256: body.sha256,
        p_verdict: body.verdict,
        p_engine: body.engine,
        p_definitions_at: body.definitions_at,
      }),
  }),
);
