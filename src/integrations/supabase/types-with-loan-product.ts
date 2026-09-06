import type { Database as BaseDatabase, Json } from './types';

export type ProductType = 'loan_bank' | 'loan_microfinance' | 'salary_advance_microfinance';

type BaseBankProduct = BaseDatabase['public']['Tables']['bank_products'];
type BankProducts = {
  Row: BaseBankProduct['Row'] & { product_type: ProductType };
  Insert: Omit<BaseBankProduct['Insert'], 'product_type'> & { product_type?: ProductType };
  Update: Omit<BaseBankProduct['Update'], 'product_type'> & { product_type?: ProductType };
  Relationships: BaseBankProduct['Relationships'];
};

type AuditLogs = {
  Row: BaseDatabase['public']['Tables']['audit_logs']['Row'] & { action: string | null };
  Insert: BaseDatabase['public']['Tables']['audit_logs']['Insert'] & { action?: string | null };
  Update: BaseDatabase['public']['Tables']['audit_logs']['Update'] & { action?: string | null };
  Relationships: BaseDatabase['public']['Tables']['audit_logs']['Relationships'];
};

type AutomationRules = {
  Row: { action: string; config: Json; created_at: string; description: string; enabled: boolean; id: string; name: string; run_count: number; trigger: string; updated_at: string };
  Insert: { action: string; config?: Json; created_at?: string; description?: string; enabled?: boolean; id?: string; name: string; run_count?: number; trigger: string; updated_at?: string };
  Update: { action?: string; config?: Json; created_at?: string; description?: string; enabled?: boolean; id?: string; name?: string; run_count?: number; trigger?: string; updated_at?: string };
  Relationships: [];
};

type LenderCommissionSettings = {
  Row: { active: boolean; created_at: string; effective_from: string | null; flat_fee_zmw: number; id: string; lender_name: string; model: string; rate: number; updated_at: string; updated_by: string | null };
  Insert: { active?: boolean; created_at?: string; effective_from?: string | null; flat_fee_zmw?: number; id?: string; lender_name: string; model?: string; rate?: number; updated_at?: string; updated_by?: string | null };
  Update: { active?: boolean; created_at?: string; effective_from?: string | null; flat_fee_zmw?: number; id?: string; lender_name?: string; model?: string; rate?: number; updated_at?: string; updated_by?: string | null };
  Relationships: [];
};

type SystemSettings = {
  Row: { key: string; updated_at: string; updated_by: string | null; value: Json };
  Insert: { key: string; updated_at?: string; updated_by?: string | null; value?: Json };
  Update: { key?: string; updated_at?: string; updated_by?: string | null; value?: Json };
  Relationships: [];
};

type Incidents = {
  Row: { acknowledged_at: string | null; acknowledged_by: string | null; audit_log_id: string | null; correlation_id: string | null; created_at: string; id: string; investigating_at: string | null; investigating_by: string | null; occurred_at: string; operation: string; resolution_code: string | null; resolved_at: string | null; resolved_by: string | null; severity: string; source: string; status: string; summary: string; updated_at: string };
  Insert: { acknowledged_at?: string | null; acknowledged_by?: string | null; audit_log_id?: string | null; correlation_id?: string | null; created_at?: string; id?: string; investigating_at?: string | null; investigating_by?: string | null; occurred_at?: string; operation: string; resolution_code?: string | null; resolved_at?: string | null; resolved_by?: string | null; severity: string; source?: string; status?: string; summary: string; updated_at?: string };
  Update: { acknowledged_at?: string | null; acknowledged_by?: string | null; audit_log_id?: string | null; correlation_id?: string | null; created_at?: string; id?: string; investigating_at?: string | null; investigating_by?: string | null; occurred_at?: string; operation?: string; resolution_code?: string | null; resolved_at?: string | null; resolved_by?: string | null; severity?: string; source?: string; status?: string; summary?: string; updated_at?: string };
  Relationships: [];
};

type ApplicationHandoffs = {
  Row: { id: string; user_id: string; lender_name: string; product_name: string | null; requested_amount: number | null; term_months: number | null; interest_rate: number | null; estimated_monthly_repayment: number | null; total_repayment: number | null; status: string; created_at: string; updated_at: string };
  Insert: { id?: string; user_id: string; lender_name: string; product_name?: string | null; requested_amount?: number | null; term_months?: number | null; interest_rate?: number | null; estimated_monthly_repayment?: number | null; total_repayment?: number | null; status?: string; created_at?: string; updated_at?: string };
  Update: { id?: string; user_id?: string; lender_name?: string; product_name?: string | null; requested_amount?: number | null; term_months?: number | null; interest_rate?: number | null; estimated_monthly_repayment?: number | null; total_repayment?: number | null; status?: string; created_at?: string; updated_at?: string };
  Relationships: [];
};

type ExtendedFunctions = BaseDatabase['public']['Functions'] & {
  authorize_application_handoff: { Args: { _lender_product_id: string; _requested_amount: number; _signature_name: string; _term_months: number }; Returns: string };
};

type ExtendedTables = Omit<BaseDatabase['public']['Tables'], 'application_handoffs' | 'audit_logs' | 'automation_rules' | 'bank_products' | 'incidents' | 'lender_commission_settings' | 'system_settings'> & {
  application_handoffs: ApplicationHandoffs;
  audit_logs: AuditLogs;
  automation_rules: AutomationRules;
  bank_products: BankProducts;
  incidents: Incidents;
  lender_commission_settings: LenderCommissionSettings;
  system_settings: SystemSettings;
};

type ExtendedPublic = Omit<BaseDatabase['public'], 'Tables' | 'Functions'> & { Tables: ExtendedTables; Functions: ExtendedFunctions };
export type Database = Omit<BaseDatabase, 'public'> & { public: ExtendedPublic };
