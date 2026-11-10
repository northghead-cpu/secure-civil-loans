import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "./client";

// For tables/functions not yet in the generated database types (support cases,
// monthly payroll reconciliation). Same client and session; no extra privileges.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const untypedDb = supabase as unknown as SupabaseClient<any, "public", any>;
