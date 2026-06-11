import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PayrollIntegrationSchema = z.object({
  action: z.enum(["test", "create", "update", "delete", "list"]),
  provider_name: z.string().trim().min(2, "Provider name too short").max(100, "Provider name too long").optional(),
  api_endpoint: z.string().url("Invalid URL").optional(),
  status: z.enum(["active", "inactive"]).optional(),
  integration_id: z.string().uuid("Invalid UUID").optional(),
}).strict();

const errorResponse = (status: number, message: string, details?: unknown) =>
  new Response(JSON.stringify({ error: message, ...(details ? { details } : {}) }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return errorResponse(405, "Method not allowed");
  }

  try {
    // 1. VERIFY AUTH
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse(401, "Missing authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const anonClient = createClient(supabaseUrl, anonKey!);

    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return errorResponse(401, "Invalid or expired token");
    }

    // 2. VERIFY SUPER_ADMIN ROLE (stricter than regular admin)
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!roleRow) {
      return errorResponse(403, "Insufficient permissions. Super Admin access required.");
    }

    // 3. PARSE & VALIDATE REQUEST
    const rawBody = await req.text();
    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      return errorResponse(400, "Invalid JSON");
    }

    if (typeof json !== "object" || json === null || Array.isArray(json)) {
      return errorResponse(400, "Request body must be a JSON object");
    }

    const parsed = PayrollIntegrationSchema.safeParse(json);
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      return errorResponse(400, "Validation failed", { fieldErrors: flat.fieldErrors });
    }

    const { action, provider_name, api_endpoint, status, integration_id } = parsed.data;

    // 4. HANDLE ACTIONS
    if (action === "test") {
      // Test connection to payroll provider
      if (!api_endpoint) {
        return errorResponse(400, "api_endpoint required for test action");
      }

      try {
        const testResponse = await fetch(`${api_endpoint}/health`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${Deno.env.get("PAYROLL_API_KEY") || "test"}`,
          },
        }).catch(() => null);

        if (!testResponse) {
          return new Response(
            JSON.stringify({
              status: "failed",
              message: "Could not reach payroll provider endpoint",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            status: "success",
            message: "Connection test successful",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (err) {
        return errorResponse(503, "Payroll provider is unavailable", { error: String(err) });
      }
    }

    if (action === "create") {
      if (!provider_name || !api_endpoint) {
        return errorResponse(400, "provider_name and api_endpoint required for create action");
      }

      const { data, error } = await supabase
        .from("payroll_integrations")
        .insert([
          {
            provider_name,
            api_endpoint,
            status: status || "inactive",
            created_by: user.id,
            config: { encrypted_key: true },
          },
        ])
        .select()
        .single();

      if (error) {
        return errorResponse(500, "Failed to create integration", { error: error.message });
      }

      await logAudit(supabase, user.id, "PAYROLL_INTEGRATION_CREATE", data.id, data);

      return new Response(
        JSON.stringify({ status: "success", integration: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "update") {
      if (!integration_id) {
        return errorResponse(400, "integration_id required for update action");
      }

      const updatePayload: Record<string, unknown> = {};
      if (provider_name) updatePayload.provider_name = provider_name;
      if (api_endpoint) updatePayload.api_endpoint = api_endpoint;
      if (status) updatePayload.status = status;

      const { data, error } = await supabase
        .from("payroll_integrations")
        .update(updatePayload)
        .eq("id", integration_id)
        .select()
        .single();

      if (error) {
        return errorResponse(500, "Failed to update integration", { error: error.message });
      }

      await logAudit(supabase, user.id, "PAYROLL_INTEGRATION_UPDATE", integration_id, updatePayload);

      return new Response(
        JSON.stringify({ status: "success", integration: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete") {
      if (!integration_id) {
        return errorResponse(400, "integration_id required for delete action");
      }

      const { error } = await supabase
        .from("payroll_integrations")
        .delete()
        .eq("id", integration_id);

      if (error) {
        return errorResponse(500, "Failed to delete integration", { error: error.message });
      }

      await logAudit(supabase, user.id, "PAYROLL_INTEGRATION_DELETE", integration_id, { deleted: true });

      return new Response(
        JSON.stringify({ status: "success", message: "Integration deleted" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "list") {
      const { data, error } = await supabase
        .from("payroll_integrations")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        return errorResponse(500, "Failed to list integrations", { error: error.message });
      }

      return new Response(
        JSON.stringify({ status: "success", integrations: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return errorResponse(400, "Unknown action");
  } catch (err) {
    console.error("[payroll-integration] Unhandled error:", err);
    return errorResponse(500, "Internal server error");
  }
});

async function logAudit(
  supabase: any,
  userId: string,
  action: string,
  recordId: string,
  changes: unknown
) {
  await supabase
    .from("audit_logs")
    .insert({
      user_id: userId,
      action,
      record_id: recordId,
      table_name: "payroll_integrations",
      new_value: JSON.stringify(changes),
    })
    .catch((err: any) => console.error("[payroll-integration] Audit log failed:", err));
}
