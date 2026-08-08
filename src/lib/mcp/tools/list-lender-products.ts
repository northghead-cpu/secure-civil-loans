import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_lender_products",
  title: "List lender products",
  description:
    "List active Riverbanc lender loan products with interest rates, amount ranges and terms, for comparison.",
  inputSchema: {
    amount: z.number().optional().describe("Optional loan amount in ZMW to filter products that support it."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ amount }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("bank_products")
      .select("id, bank_name, interest_rate, min_amount, max_amount, max_term_months, processing_days")
      .eq("active", true)
      .order("interest_rate", { ascending: true });

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const products = (data ?? []).filter((p) => {
      if (amount === undefined) return true;
      const min = p.min_amount ?? 0;
      const max = p.max_amount ?? Number.MAX_SAFE_INTEGER;
      return amount >= min && amount <= max;
    });

    return {
      content: [
        {
          type: "text",
          text: products.length ? JSON.stringify(products, null, 2) : "No matching lender products.",
        },
      ],
      structuredContent: { products },
    };
  },
});
