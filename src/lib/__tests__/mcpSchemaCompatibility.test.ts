import { describe, expect, it } from "vitest";
import { z } from "zod";
import affordability from "../mcp/tools/check-affordability";
import applications from "../mcp/tools/list-my-loan-applications";
import products from "../mcp/tools/list-lender-products";

describe("MCP tool schema compatibility after the Zod security upgrade", () => {
  it("publishes usable JSON schemas for each marketplace tool", () => {
    for (const tool of [affordability, applications, products]) {
      const schema = z.object(tool.inputSchema);
      const json = z.toJSONSchema(schema);
      expect(json.type).toBe("object");
      expect(Object.keys(json.properties ?? {})).toEqual(Object.keys(tool.inputSchema));
    }
  });
  it("preserves required affordability inputs and optional catalogue filters", () => {
    const schema = z.object(affordability.inputSchema);
    expect(schema.safeParse({ net_salary: 9000, amount: 10000, term_months: 12 }).success).toBe(true);
    expect(schema.safeParse({ amount: 10000, term_months: 12 }).success).toBe(false);
    expect(schema.safeParse({ net_salary: 9000, amount: 10000, term_months: 1.5 }).success).toBe(false);
    expect(z.object(applications.inputSchema).safeParse({}).success).toBe(true);
    expect(z.object(products.inputSchema).safeParse({}).success).toBe(true);
  });
});
