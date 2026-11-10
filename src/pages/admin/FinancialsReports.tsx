import { csvCell } from "@/lib/csv";
import { readAllRows } from "@/lib/readAllRows";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AdminHero,
  AdminPageShell,
  adminCardClass,
} from "@/components/admin/AdminPageShell";
import { Download, FileBarChart, Calendar, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import BillingReconciliationPanel from "@/components/admin/BillingReconciliationPanel";

const reports = [
  {
    name: "Recorded Commission Payouts",
    description:
      "Recorded payout activity; revenue streams are excluded unless supported by a financial ledger.",
    type: "Financial",
    source: "payouts",
  },
  {
    name: "Subscription Receipt Ledger",
    description:
      "Issued Riverbanc K60 payroll subscription receipts and delivery status.",
    type: "Financial",
    source: "payment_receipts",
  },
  {
    name: "Legacy Application Register",
    description: "Recorded loan applications and selected lender details.",
    type: "Operations",
    source: "loan_applications",
  },
  {
    name: "Legacy Application Risk Data",
    description:
      "Recorded risk and decision data. No default rate is fabricated where the source does not contain one.",
    type: "Risk",
    source: "loan_applications",
  },
  {
    name: "Commission Configuration",
    description: "Persisted commission configuration by lender.",
    type: "Financial",
    source: "lender_commission_settings",
  },
  {
    name: "KYC Compliance Report",
    description: "Recorded KYC verification status and timestamps.",
    type: "Compliance",
    source: "profiles",
  },
  {
    name: "User Acquisition Report",
    description:
      "Recorded account creation activity without exposing unnecessary PII.",
    type: "Growth",
    source: "profiles",
  },
] as const;

type Report = (typeof reports)[number];

const toCsv = (rows: Record<string, unknown>[]) => {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = csvCell;
  return [
    headers.map(csvCell).join(","),
    ...rows.map((row) =>
      headers.map((header) => escape(row[header])).join(","),
    ),
  ].join("\n");
};

const FinancialsReports = () => {
  const [exporting, setExporting] = useState<string | null>(null);
  const periodLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date()),
    [],
  );

  const exportReport = async (report: Report) => {
    setExporting(report.name);
    try {
      let rows: Record<string, unknown>[] = [];
      if (report.source === "payouts") {
        rows = await readAllRows<Record<string, unknown>>((from, to) => supabase
          .from("payouts")
          .select("id,lender,amount_zmw,period,status,paid_date,created_at")
          .order("created_at", { ascending: false }).order("id").range(from, to));
      } else if (report.source === "payment_receipts") {
        rows = await readAllRows<Record<string, unknown>>((from, to) => supabase
          .from("payment_receipts")
          .select(
            "id,receipt_number,customer_name,amount,currency,billing_period_start,billing_period_end,payment_method,payroll_reference,issued_at,document_path",
          )
          .order("issued_at", { ascending: false }).order("id").range(from, to));
      } else if (report.source === "loan_applications") {
        rows = await readAllRows<Record<string, unknown>>((from, to) => supabase
          .from("loan_applications")
          .select(
            "id,status,requested_amount,selected_lender,selected_interest_rate,selected_repayment_months,estimated_monthly_repayment,risk_level,fraud_score,underwriting_score,decision,created_at,updated_at",
          )
          .order("created_at", { ascending: false }).order("id").range(from, to));
      } else if (report.source === "lender_commission_settings") {
        rows = await readAllRows<Record<string, unknown>>((from, to) => supabase
          .from("lender_commission_settings")
          .select(
            "id,lender_name,rate,flat_fee_zmw,model,active,effective_from,created_at,updated_at",
          )
          .order("lender_name").order("id").range(from, to));
      } else {
        rows = await readAllRows<Record<string, unknown>>((from, to) => supabase
          .from("profiles")
          .select(
            "id,user_id,employer,employee_number,account_status,kyc_status,created_at,updated_at",
          )
          .order("created_at", { ascending: false }).order("id").range(from, to));
      }

      if (!rows.length) {
        toast.info("There is no recorded data available for this report yet.");
        return;
      }
      const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${report.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success(`${report.name} exported`);
    } catch (error) {
      toast.error(
        `Unable to export report: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setExporting(null);
    }
  };

  return (
    <AdminPageShell>
      <AdminHero
        badge="Reporting library"
        title="Operational and financial reports ready for export"
        description="Export recorded application, payout, KYC, commission, risk and account data without fabricated periods or figures."
        stats={[
          {
            label: "Report templates",
            value: reports.length.toString(),
            meta: "Available exports",
          },
          {
            label: "Financial packs",
            value: reports
              .filter((r) => r.type === "Financial")
              .length.toString(),
            meta: "Ledger-backed or configuration-backed",
          },
          {
            label: "Report scope",
            value: "All recorded dates",
            meta: "No month filter applied",
          },
        ]}
      />
      <BillingReconciliationPanel />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reports.map((report) => (
          <Card key={report.name} className={adminCardClass}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <FileBarChart className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-display font-semibold text-foreground text-sm">
                      {report.name}
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {report.description}
                  </p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" /> All recorded dates
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void exportReport(report)}
                  disabled={exporting !== null}
                >
                  {exporting === report.name ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-1" />
                  )}{" "}
                  Export
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AdminPageShell>
  );
};

export default FinancialsReports;
