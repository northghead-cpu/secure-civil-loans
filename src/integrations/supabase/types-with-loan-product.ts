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

type KycDocuments = {
  Row: { id: string; user_id: string; document_type: string; storage_path: string; pay_period: string | null; ocr_period: string | null; ocr_confidence: number | null; validation_status: string; rejection_reason: string | null; created_at: string; updated_at: string };
  Insert: { id?: string; user_id: string; document_type: string; storage_path: string; pay_period?: string | null; ocr_period?: string | null; ocr_confidence?: number | null; validation_status?: string; rejection_reason?: string | null; created_at?: string; updated_at?: string };
  Update: { id?: string; user_id?: string; document_type?: string; storage_path?: string; pay_period?: string | null; ocr_period?: string | null; ocr_confidence?: number | null; validation_status?: string; rejection_reason?: string | null; created_at?: string; updated_at?: string };
  Relationships: [];
};

type SubscriptionAuthorization = {
  Row: { id: string; user_id: string; amount: number; currency: string; frequency: string; deduction_method: string; status: string; payroll_status: string; signed_name: string | null; authorized_at: string | null; revoked_at: string | null; created_at: string; updated_at: string; signature_method: string | null; agreement_version: string | null; agreement_hash: string | null; signature_hash: string | null; payroll_reference: string | null; payroll_confirmed_at: string | null };
  Insert: Partial<SubscriptionAuthorization['Row']>;
  Update: Partial<SubscriptionAuthorization['Row']>;
  Relationships: [];
};
type BillingRun = {
  Row: { id: string; billing_date: string; period_start: string; period_end: string; timezone: string; amount: number; currency: string; status: string; eligible_count: number; confirmed_count: number; transaction_count: number; receipt_count: number; delivery_failure_count: number; started_at: string | null; completed_at: string | null; error_message: string | null; created_at: string; updated_at: string };
  Insert: Partial<BillingRun['Row']>;
  Update: Partial<BillingRun['Row']>;
  Relationships: [];
};
type BillingTransaction = {
  Row: { id: string; billing_run_id: string; user_id: string; period_start: string; period_end: string; amount: number; currency: string; payment_method: string; payroll_reference: string; status: string; confirmed_at: string | null; created_at: string };
  Insert: Partial<BillingTransaction['Row']>;
  Update: Partial<BillingTransaction['Row']>;
  Relationships: [];
};
type PaymentReceipt = {
  Row: { id: string; billing_transaction_id: string; user_id: string; receipt_number: string; customer_name: string; customer_email: string | null; amount: number; currency: string; billing_period_start: string; billing_period_end: string; payment_method: string; payroll_reference: string; issued_at: string; document_path: string | null; created_at: string };
  Insert: Partial<PaymentReceipt['Row']>;
  Update: Partial<PaymentReceipt['Row']>;
  Relationships: [];
};
type ReceiptDelivery = {
  Row: { id: string; receipt_id: string; channel: string; status: string; attempt_count: number; last_attempt_at: string | null; delivered_at: string | null; error_code: string | null; error_message: string | null; created_at: string; updated_at: string };
  Insert: Partial<ReceiptDelivery['Row']>;
  Update: Partial<ReceiptDelivery['Row']>;
  Relationships: [];
};
type PaymentReceiptRpcRow = { id: string; receipt_number: string; amount: number; currency: string; billing_period_start: string; billing_period_end: string; payment_method: string; payroll_reference: string; issued_at: string; document_path: string | null; email_delivery_status: string | null };

type ExtendedFunctions = BaseDatabase['public']['Functions'] & {
  authorize_riverbanc_subscription: { Args: { _signed_name: string }; Returns: SubscriptionAuthorization['Row'] };
  reconcile_riverbanc_subscription_payroll: { Args: { _authorization_id: string; _status: string; _payroll_reference: string | null; _evidence_confirmed: boolean }; Returns: SubscriptionAuthorization['Row'] };
  get_my_payment_receipts: { Args: Record<string, never>; Returns: PaymentReceiptRpcRow[] };
  authorize_application_handoff: { Args: { _lender_product_id: string; _requested_amount: number; _signature_name: string; _term_months: number }; Returns: string };
};

type ExtendedTables = BaseDatabase['public']['Tables'] & {
  kyc_documents: KycDocuments;
  application_handoffs: ApplicationHandoffs;
  audit_logs: AuditLogs;
  automation_rules: AutomationRules;
  bank_products: BankProducts;
  incidents: Incidents;
  lender_commission_settings: LenderCommissionSettings;
  system_settings: SystemSettings;
  subscription_authorizations: SubscriptionAuthorization;
  billing_runs: BillingRun;
  billing_transactions: BillingTransaction;
  payment_receipts: PaymentReceipt;
  receipt_deliveries: ReceiptDelivery;
};

type ExtendedPublic = Omit<BaseDatabase['public'], 'Tables' | 'Functions'> & { Tables: ExtendedTables; Functions: ExtendedFunctions };
export type Database = Omit<BaseDatabase, 'public'> & { public: ExtendedPublic };
