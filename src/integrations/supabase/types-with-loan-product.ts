import type { Database as BaseDatabase, Json } from './types';

export type ProductType =
  | 'loan_bank'
  | 'loan_microfinance'
  | 'salary_advance_microfinance';

type BaseBankProduct = BaseDatabase['public']['Tables']['bank_products'];

type BankProducts = {
  Row: BaseBankProduct['Row'] & { product_type: ProductType };
  Insert: Omit<BaseBankProduct['Insert'], 'product_type'> & { product_type?: ProductType };
  Update: Omit<BaseBankProduct['Update'], 'product_type'> & { product_type?: ProductType };
  Relationships: BaseBankProduct['Relationships'];
};

type AuditLogs = BaseDatabase['public']['Tables']['audit_logs'] & {
  Row: BaseDatabase['public']['Tables']['audit_logs']['Row'] & { action: string | null };
  Insert: BaseDatabase['public']['Tables']['audit_logs']['Insert'] & { action?: string | null };
  Update: BaseDatabase['public']['Tables']['audit_logs']['Update'] & { action?: string | null };
};

type AutomationRules = {
  Row: {
    id: string;
    name: string;
    description: string;
    trigger: string;
    action: string;
    enabled: boolean;
    run_count: number;
    config: Json;
    created_at: string;
    updated_at: string;
  };
  Insert: Omit<AutomationRules['Row'], 'id' | 'created_at' | 'updated_at' | 'run_count' | 'config' | 'description' | 'enabled'> & {
    id?: string;
    description?: string;
    enabled?: boolean;
    run_count?: number;
    config?: Json;
    created_at?: string;
    updated_at?: string;
  };
  Update: Partial<AutomationRules['Row']>;
  Relationships: [];
};

type LenderCommissionSettings = {
  Row: {
    id: string;
    lender_name: string;
    rate: number;
    flat_fee_zmw: number;
    model: string;
    active: boolean;
    effective_from: string | null;
    updated_by: string | null;
    created_at: string;
    updated_at: string;
  };
  Insert: Omit<LenderCommissionSettings['Row'], 'id' | 'created_at' | 'updated_at' | 'rate' | 'flat_fee_zmw' | 'model' | 'active'> & {
    id?: string;
    rate?: number;
    flat_fee_zmw?: number;
    model?: string;
    active?: boolean;
    created_at?: string;
    updated_at?: string;
  };
  Update: Partial<LenderCommissionSettings['Row']>;
  Relationships: [];
};

type SystemSettings = {
  Row: {
    key: string;
    value: Json;
    updated_by: string | null;
    updated_at: string;
  };
  Insert: {
    key: string;
    value?: Json;
    updated_by?: string | null;
    updated_at?: string;
  };
  Update: Partial<SystemSettings['Row']>;
  Relationships: [];
};

type AuthorizeApplicationHandoff = {
  Args: {
    _lender_product_id: string;
    _requested_amount: number;
    _signature_name: string;
    _term_months: number;
  };
  Returns: BaseDatabase['public']['Tables']['application_handoffs']['Row'];
  SetofOptions: {
    from: '*';
    to: 'application_handoffs';
    isOneToOne: true;
    isSetofReturn: false;
  };
};

export type Database = Omit<BaseDatabase, 'public'> & {
  public: Omit<BaseDatabase['public'], 'Tables' | 'Functions'> & {
    Tables: Omit<BaseDatabase['public']['Tables'], 'bank_products' | 'audit_logs'> & {
      bank_products: BankProducts;
      audit_logs: AuditLogs;
      automation_rules: AutomationRules;
      lender_commission_settings: LenderCommissionSettings;
      system_settings: SystemSettings;
    };
    Functions: BaseDatabase['public']['Functions'] & {
      authorize_application_handoff: AuthorizeApplicationHandoff;
    };
  };
};
