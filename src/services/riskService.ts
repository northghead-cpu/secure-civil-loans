import { supabase } from "@/integrations/supabase/client";

export interface RiskFlag {
  id: string;
  application_id: string;
  user_id: string;
  flag_type: string;
  fraud_score: number;
  flags: unknown[];
  status: "pending" | "approved" | "rejected" | "needs_review";
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
}

export type RiskResolution = "approved" | "rejected" | "needs_review";

export const riskService = {
  async list(statusFilter?: string): Promise<RiskFlag[]> {
    let query = supabase
      .from("risk_flags")
      .select("*")
      .order("created_at", { ascending: false });

    if (statusFilter && statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as RiskFlag[];
  },

  async resolve(
    id: string,
    resolution: RiskResolution,
    notes: string,
    resolvedBy: string
  ): Promise<RiskFlag> {
    const { data, error } = await supabase
      .from("risk_flags")
      .update({
        status: resolution,
        resolution_notes: notes,
        resolved_by: resolvedBy,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as RiskFlag;
  },
};
