import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AdminSettingsSchema = z.object({
  action: z.enum(["get", "set"]),
  key: z.string().regex(/^[a-z_]+$/, "Key must be lowercase with underscores").optional(),
  value: z.any().optional(),
}).strict();

const ALLOWED_SETTING_KEYS = [
  "crb_api_key",
  "payroll_api_key",
  "session_timeout_minutes",
  "ip_whitelist_enabled",
  "maintenance_mode",
  "platform_name",
  "support_email",
];

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

    // 2. VERIFY SUPER_ADMIN ROLE
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

    const parsed = AdminSettingsSchema.safeParse(json);
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      return errorResponse(400, "Validation failed", { fieldErrors: flat.fieldErrors });
    }

    const { action, key, value } = parsed.data;

    // 4. HANDLE ACTIONS
    if (action === "get") {
      const { data, error } = await supabase
        .from("admin_settings")
        .select("key, value")
        .in("key", ALLOWED_SETTING_KEYS);

      if (error) {
        return errorResponse(500, "Failed to retrieve settings", { error: error.message });
      }

      const settings: Record<string, unknown> = {};
      (data || []).forEach((row: any) => {
        settings[row.key] = row.value;
      });

      return new Response(
        JSON.stringify({ status: "success", settings }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "set") {
      if (!key || !ALLOWED_SETTING_KEYS.includes(key)) {
        return errorResponse(400, `Invalid key. Allowed: ${ALLOWED_SETTING_KEYS.join(", ")}`);
      }

      const { data, error } = await supabase
        .from("admin_settings")
        .upsert(
          { key, value },
          { onConflict: "key" }
        )
        .select()
        .single();

      if (error) {
        return errorResponse(500, "Failed to save setting", { error: error.message });
      }

      await logAudit(supabase, user.id, "ADMIN_SETTING_UPDATE", key, { key, value });

      return new Response(
        JSON.stringify({ status: "success", setting: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return errorResponse(400, "Unknown action");
  } catch (err) {
    console.error("[admin-settings] Unhandled error:", err);
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
      table_name: "admin_settings",
      new_value: JSON.stringify(changes),
    })
    .catch((err: any) => console.error("[admin-settings] Audit log failed:", err));
}
