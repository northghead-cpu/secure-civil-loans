import { useEffect, useState } from "react";
import { untypedDb } from "@/integrations/supabase/untyped";

type Assessment = {
  gross: number | null;
  net: number | null;
  payrollDebt: number | null;
  externalDebtLowerBound: number | null;
  estimatedMonthlyExpenses: number | null;
  documentDebtRatioPercent: number | null;
  extractionQualityPercent: number | null;
  documentReviewPending: boolean;
  issues: string[];
};
type Preview = {
  state: string;
  current?: boolean;
  retryPending?: boolean;
  assessment?: Assessment | null;
};
const money = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value)
    ? new Intl.NumberFormat("en-ZM", {
        style: "currency",
        currency: "ZMW",
      }).format(value)
    : "Unknown";
export default function FinancialAnalysisPreview({
  userId,
}: {
  userId: string;
}) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    setPreview(null);
    setError(false);
    const refresh = async () => {
      try {
        const response = await untypedDb.rpc("get_financial_analysis_preview", {
          _user_id: userId,
        });
        if (!active) return;
        if (response.error) throw response.error;
        setPreview(response.data as Preview);
        setError(false);
      } catch {
        if (active) {
          setError(true);
          setPreview(null);
        }
      } finally {
        if (active) timer = setTimeout(() => void refresh(), 5000);
      }
    };
    void refresh();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [userId]);
  const a = preview?.current ? preview.assessment : null;
  return (
    <section
      className="rounded border p-3 space-y-2"
      aria-label="Automatic financial analysis"
    >
      <h3 className="font-semibold">Automatic financial analysis</h3>
      {error ? (
        <p role="alert">
          Analysis could not load. Your staff session may need refreshing.
        </p>
      ) : !a ? (
        <p role="status">
          {preview?.retryPending
            ? "Analysis will retry automatically."
            : preview?.state === "not_started"
              ? "Waiting for financial documents."
              : "Analysing the latest documents…"}
        </p>
      ) : (
        <>
          <p className="text-sm">
            {a.documentReviewPending
              ? "Preliminary figures — document review pending."
              : "Document-derived figures — affordability review required."}
          </p>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt>Gross salary</dt>
            <dd>{money(a.gross)}</dd>
            <dt>Net salary</dt>
            <dd>{money(a.net)}</dd>
            <dt>Identified payroll debt</dt>
            <dd>{money(a.payrollDebt)}</dd>
            <dt>External debt lower bound</dt>
            <dd>{money(a.externalDebtLowerBound)}</dd>
            <dt>Estimated monthly expenses</dt>
            <dd>{money(a.estimatedMonthlyExpenses)}</dd>
            <dt>Provisional document debt ratio</dt>
            <dd>
              {a.documentDebtRatioPercent == null
                ? "Unknown"
                : a.documentDebtRatioPercent + "%"}
            </dd>
            <dt>Extraction quality</dt>
            <dd>
              {a.extractionQualityPercent == null
                ? "Unknown"
                : a.extractionQualityPercent + "%"}
            </dd>
          </dl>
          {!!a.issues?.length && (
            <p className="text-sm">
              Review flags:{" "}
              {a.issues
                .map((issue) => issue.toLowerCase().replace(/_/g, " "))
                .join("; ")}
              .
            </p>
          )}
        </>
      )}
      <p className="text-xs text-muted-foreground">
        Missing amounts remain unknown. Extraction quality is not a credit
        score. Image-only or unreadable PDFs need further review; these figures
        do not approve a loan.
      </p>
    </section>
  );
}
