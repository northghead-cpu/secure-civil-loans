import { supabase } from "@/integrations/supabase/client";

/**
 * Secure service layer for invoking Supabase Edge Functions.
 * All sensitive operations (API key handling, admin configs) are performed server-side.
 */

export interface CRBCheckRequest {
  nrc_number: string;
  full_name: string;
}

export interface CRBCheckResult {
  status: "success" | "failed";
  credit_score: number | null;
  risk_level: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";
  flags: string[];
  checked_at: string;
}

export interface PayrollIntegrationRequest {
  action: "test" | "create" | "update" | "delete" | "list";
  provider_name?: string;
  api_endpoint?: string;
  status?: "active" | "inactive";
  integration_id?: string;
}

export interface AdminSettingsRequest {
  action: "get" | "set";
  key?: string;
  value?: unknown;
}

export const edgeFunctionService = {
  /**
   * Perform a CRB credit check via secure Edge Function.
   * The actual TransUnion API credentials are stored server-side.
   */
  async checkCRB(request: CRBCheckRequest): Promise<CRBCheckResult> {
    const { data, error } = await supabase.functions.invoke("crb-check", {
      body: request,
    });

    if (error) {
      console.error("[CRB Check] Error:", error);
      throw new Error(`CRB check failed: ${error.message}`);
    }

    return data as CRBCheckResult;
  },

  /**
   * Manage payroll integrations via secure Edge Function.
   * Payroll API keys are never exposed to the frontend.
   */
  async managePayrollIntegration(request: PayrollIntegrationRequest): Promise<any> {
    const { data, error } = await supabase.functions.invoke("payroll-integration", {
      body: request,
    });

    if (error) {
      console.error("[Payroll Integration] Error:", error);
      throw new Error(`Payroll integration operation failed: ${error.message}`);
    }

    return data;
  },

  /**
   * Test payroll provider connection.
   */
  async testPayrollConnection(api_endpoint: string): Promise<{ status: string; message: string }> {
    return this.managePayrollIntegration({
      action: "test",
      api_endpoint,
    });
  },

  /**
   * Create a new payroll integration.
   */
  async createPayrollIntegration(
    provider_name: string,
    api_endpoint: string,
    status: "active" | "inactive" = "inactive"
  ): Promise<any> {
    return this.managePayrollIntegration({
      action: "create",
      provider_name,
      api_endpoint,
      status,
    });
  },

  /**
   * List all payroll integrations.
   */
  async listPayrollIntegrations(): Promise<any[]> {
    const response = await this.managePayrollIntegration({
      action: "list",
    });
    return response.integrations || [];
  },

  /**
   * Update a payroll integration.
   */
  async updatePayrollIntegration(
    integration_id: string,
    updates: Partial<{ provider_name: string; api_endpoint: string; status: "active" | "inactive" }>
  ): Promise<any> {
    return this.managePayrollIntegration({
      action: "update",
      integration_id,
      ...updates,
    });
  },

  /**
   * Delete a payroll integration.
   */
  async deletePayrollIntegration(integration_id: string): Promise<any> {
    return this.managePayrollIntegration({
      action: "delete",
      integration_id,
    });
  },

  /**
   * Get admin settings via secure Edge Function.
   * All sensitive configurations are stored server-side.
   */
  async getAdminSettings(): Promise<Record<string, unknown>> {
    const { data, error } = await supabase.functions.invoke("admin-settings", {
      body: { action: "get" },
    });

    if (error) {
      console.error("[Admin Settings] Error:", error);
      throw new Error(`Failed to retrieve admin settings: ${error.message}`);
    }

    return data.settings || {};
  },

  /**
   * Set an admin setting via secure Edge Function.
   * Only super admins can modify settings via this endpoint.
   */
  async setAdminSetting(key: string, value: unknown): Promise<any> {
    const { data, error } = await supabase.functions.invoke("admin-settings", {
      body: { action: "set", key, value },
    });

    if (error) {
      console.error("[Admin Settings] Error:", error);
      throw new Error(`Failed to save admin setting: ${error.message}`);
    }

    return data.setting;
  },
};
