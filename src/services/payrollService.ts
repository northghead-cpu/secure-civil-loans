import { supabase } from "@/integrations/supabase/client";

export interface PayrollIntegration {
  id: string;
  provider_name: string;
  api_endpoint: string | null;
  status: "active" | "inactive";
  config: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PayrollIntegrationInput {
  provider_name: string;
  api_endpoint?: string;
  status?: "active" | "inactive";
  config?: Record<string, unknown>;
}

export const payrollService = {
  async list(): Promise<PayrollIntegration[]> {
    const { data, error } = await supabase
      .from("payroll_integrations")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as PayrollIntegration[];
  },

  async create(input: PayrollIntegrationInput, userId: string): Promise<PayrollIntegration> {
    const { data, error } = await supabase
      .from("payroll_integrations")
      .insert({ ...input, created_by: userId })
      .select()
      .single();
    if (error) throw error;
    return data as PayrollIntegration;
  },

  async update(id: string, input: Partial<PayrollIntegrationInput>): Promise<PayrollIntegration> {
    const { data, error } = await supabase
      .from("payroll_integrations")
      .update(input)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as PayrollIntegration;
  },

  async toggleStatus(id: string, currentStatus: string): Promise<PayrollIntegration> {
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    return this.update(id, { status: newStatus as "active" | "inactive" });
  },
};
