import type { Database as BaseDatabase } from './types';

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

type BillingRun = {
  Row: { id: string; billing_date: string; period_start: string; period_end: string; timezone: 'Africa/Lusaka'; amount: number; currency: 'ZMW'; status: 'pending' | 'running' | 'completed' | 'partial' | 'failed'; eligible_count: number; confirmed_count: number; transaction_count: number; receipt_count: number; delivery_failure_count: number; started_at: string | null; completed_at: string | null; error_message: string | null; created_at: string; updated_at: string };
  Insert: Partial<BillingRun['Row']> & Pick<BillingRun['Row'], 'billing_date' | 'period_start' | 'period_end'>;
  Update: Partial<BillingRun['Row']>;
  Relationships: [];
};

type BillingTransaction = {
  Row: { id: string; billing_run_id: string; user_id: string; period_start: string; period_end: string; amount: number; currency: 'ZMW'; payment_method: 'payroll'; payroll_reference: string; status: 'confirmed' | 'void'; confirmed_at: string; created_at: string };
  Insert: Partial<BillingTransaction['Row']>;
  Update: Partial<BillingTransaction['Row']>;
  Relationships: [];
};

type PaymentReceipt = {
  Row: { id: string; billing_transaction_id: string; user_id: string; receipt_number: string; customer_name: string; customer_email: string | null; amount: number; currency: 'ZMW'; billing_period_start: string; billing_period_end: string; payment_method: 'payroll'; payroll_reference: string; issued_at: string; document_path: string | null; created_at: string };
  Insert: Partial<PaymentReceipt['Row']>;
  Update: Partial<PaymentReceipt['Row']>;
  Relationships: [];
};

type ReceiptDelivery = {
  Row: { id: string; receipt_id: string; channel: 'dashboard' | 'email'; status: 'available' | 'pending' | 'sent' | 'failed'; attempt_count: number; last_attempt_at: string | null; delivered_at: string | null; error_code: string | null; error_message: string | null; created_at: string; updated_at: string };
  Insert: Partial<ReceiptDelivery['Row']>;
  Update: Partial<ReceiptDelivery['Row']>;
  Relationships: [];
};

type PaymentReceiptRpcRow = { id: string; receipt_number: string; amount: number; currency: 'ZMW'; billing_period_start: string; billing_period_end: string; payment_method: 'payroll'; payroll_reference: string; issued_at: string; document_path: string | null; email_delivery_status: 'available' | 'pending' | 'sent' | 'failed' | null };

export type Database = Omit<BaseDatabase, 'public'> & {
  public: Omit<BaseDatabase['public'], 'Tables' | 'Functions'> & {
    Tables: Omit<BaseDatabase['public']['Tables'], 'bank_products'> & { bank_products: BankProducts; billing_runs: BillingRun; billing_transactions: BillingTransaction; payment_receipts: PaymentReceipt; receipt_deliveries: ReceiptDelivery };
    Functions: BaseDatabase['public']['Functions'] & { get_my_payment_receipts: { Args: Record<string, never>; Returns: PaymentReceiptRpcRow[] } };
  };
};
