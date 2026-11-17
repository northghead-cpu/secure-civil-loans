import { it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import FinancialAnalysisPreview from "./FinancialAnalysisPreview";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/untyped", () => ({ untypedDb: { rpc } }));
beforeEach(() => { rpc.mockReset(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });
it("labels pending figures, leaves expenses unknown and never changes KYC", async () => {
  rpc.mockResolvedValue({data:{state:"done",current:true,assessment:{
    gross:10000,net:3000,payrollDebt:4000,externalDebtLowerBound:500,
    estimatedMonthlyExpenses:null,documentDebtRatioPercent:55,
    extractionQualityPercent:63,documentReviewPending:true,issues:["DOCUMENT_REVIEW_PENDING"]
  }},error:null});
  render(<FinancialAnalysisPreview userId="borrower"/>);
  expect(await screen.findByText("Preliminary figures — document review pending.")).toBeInTheDocument();
  expect(screen.getByText("Unknown")).toBeInTheDocument();
  expect(rpc.mock.calls.every(([name]) => name === "get_financial_analysis_preview")).toBe(true);
});
it("hides stale figures while the latest documents are processing", async () => {
  rpc.mockResolvedValue({data:{state:"pending",current:false,assessment:{gross:98765}},error:null});
  render(<FinancialAnalysisPreview userId="borrower"/>);
  expect(await screen.findByRole("status")).toHaveTextContent("Analysing");
  expect(screen.queryByText(/98,765/)).not.toBeInTheDocument();
});
it("stops polling after the panel closes", async () => {
  vi.useFakeTimers();
  rpc.mockResolvedValue({data:{state:"pending",current:false},error:null});
  const view=render(<FinancialAnalysisPreview userId="borrower"/>);
  await act(async()=>{await Promise.resolve();});
  view.unmount();
  await act(async()=>{await vi.advanceTimersByTimeAsync(15000);});
  expect(rpc).toHaveBeenCalledTimes(1);
});
