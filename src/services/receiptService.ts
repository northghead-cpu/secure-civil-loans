import { supabase } from "@/integrations/supabase/client";

export interface PaymentReceipt {
  id: string;
  receipt_number: string;
  amount: number;
  currency: string;
  billing_period_start: string;
  billing_period_end: string;
  payment_method: string;
  payroll_reference: string;
  issued_at: string;
  document_path: string | null;
  email_delivery_status: string | null;
}

export const receiptService = {
  async listMine(): Promise<PaymentReceipt[]> {
    const { data, error } = await supabase.rpc("get_my_payment_receipts");
    if (error) throw error;
    return (data ?? []) as PaymentReceipt[];
  },
};
