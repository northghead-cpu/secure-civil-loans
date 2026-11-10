import { getSupabaseConfig } from "@/integrations/supabase/config";

/** A staging backend must never send recovery sessions to the production app. */
export function recoveryRedirect(origin = window.location.origin): string {
  const productionBackend = getSupabaseConfig().url === "https://zdpeaxkormwjrgllwalq.supabase.co";
  return `${productionBackend && import.meta.env.PROD ? "https://riverbanc.co.zm" : origin}/reset-password`;
}
