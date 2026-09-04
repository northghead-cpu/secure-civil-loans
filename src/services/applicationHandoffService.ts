import { supabase } from "@/integrations/supabase/client";

export const HANDOFF_OPERATION_ROLES = ["admin", "super_admin", "compliance_team"] as const;
export type HandoffOperationRole = (typeof HANDOFF_OPERATION_ROLES)[number];

export const LENDER_CONTROLLED_STATUSES = [
  "lender_review",
  "additional_information_requested",
  "approved",
  "declined",
  "disbursed",
] as const;

export const HANDOFF_STATUSES = [
  "pending_authorization",
  "authorized",
  "preparing",
  "sent_to_lender",
  ...LENDER_CONTROLLED_STATUSES,
] as const;

export interface ApplicationHandoffRecord {
  id: string;
  user_id: string;
  lender_name: string;
  product_name: string | null;
  requested_amount: number | null;
  term_months: number | null;
  interest_rate: number | null;
  estimated_monthly_repayment: number | null;
  total_repayment: number | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export const canManageHandoffOperations = (role: string | null | undefined): role is HandoffOperationRole =>
  Boolean(role && (HANDOFF_OPERATION_ROLES as readonly string[]).includes(role));

export const isLenderControlledStatus = (status: string): boolean =>
  (LENDER_CONTROLLED_STATUSES as readonly string[]).includes(status);

const HANDOFF_SELECT = "id, user_id, lender_name, product_name, requested_amount, term_months, interest_rate, estimated_monthly_repayment, total_repayment, status, created_at, updated_at";

export const listApplicationHandoffs = async (): Promise<ApplicationHandoffRecord[]> => {
  const { data, error } = await (supabase as any)
    .from("application_handoffs")
    .select(HANDOFF_SELECT)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ApplicationHandoffRecord[];
};

export const updateApplicationHandoffStatus = async (
  handoffId: string,
  status: string,
): Promise<ApplicationHandoffRecord> => {
  if (!(HANDOFF_STATUSES as readonly string[]).includes(status)) {
    throw new Error("Unsupported application handoff status.");
  }

  const { data, error } = await (supabase as any)
    .from("application_handoffs")
    .update({ status })
    .eq("id", handoffId)
    .select(HANDOFF_SELECT)
    .single();

  if (error) throw error;
  return data as ApplicationHandoffRecord;
};
