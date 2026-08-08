import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_my_loan_applications",
  title: "List my loan applications",
  description:
    "List the signed-in user's Riverbanc loan applications with status, requested amount, selected lender and decision.",
  inputSchema: {
    limit: z.number().int().optional().describe("Maximum applications to return (default 10, max 50)."),
    status: z.string().optional().describe("Optional status filter, e.g. PENDING, APPROVED, DECLINED."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, status }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const take = Math.min(Math.max(limit ?? 10, 1), 50);
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("loan_applications")
      .select(
        "id, status, decision, decision_reason, requested_amount, selected_lender, selected_interest_rate, selected_repayment_months, estimated_monthly_repayment, created_at, updated_at",
      )
      .eq("user_id", ctx.getUserId())
      .order("created_at", { ascending: false })
      .limit(take);

    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [
        {
          type: "text",
          text: data?.length ? JSON.stringify(data, null, 2) : "No loan applications found.",
        },
      ],
      structuredContent: { applications: data ?? [] },
    };
  },
});
