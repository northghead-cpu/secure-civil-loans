import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AdminHero, AdminPageShell, adminCardClass } from "@/components/admin/AdminPageShell";
import { Download, FileBarChart, Calendar } from "lucide-react";

const reports = [
  { name: "Monthly Revenue Summary", description: "Breakdown of all revenue streams", period: "March 2026", type: "Financial" },
  { name: "Loan Disbursement Report", description: "All loans disbursed with lender details", period: "March 2026", type: "Operations" },
  { name: "Default Rate Analysis", description: "Default trends by lender and product", period: "Q1 2026", type: "Risk" },
  { name: "Commission Reconciliation", description: "Commission earned vs paid per lender", period: "February 2026", type: "Financial" },
  { name: "KYC Compliance Report", description: "KYC verification stats and turnaround times", period: "March 2026", type: "Compliance" },
  { name: "User Acquisition Report", description: "New user signups and conversion rates", period: "March 2026", type: "Growth" },
];

const FinancialsReports = () => {
  return (
    <AdminPageShell>
      <AdminHero
        badge="Reporting library"
        title="Operational and financial reports ready for export"
        description="Package revenue, compliance, lending, and growth data into a report set the team can distribute without rebuilding the same views."
        stats={[
          { label: "Report templates", value: reports.length.toString(), meta: "Predefined exports available" },
          { label: "Financial packs", value: reports.filter((report) => report.type === "Financial").length.toString(), meta: "Revenue and reconciliation sets" },
          { label: "Operational packs", value: reports.filter((report) => report.type !== "Financial").length.toString(), meta: "Risk, growth, and compliance" },
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reports.map((report) => (
          <Card key={report.name} className={adminCardClass}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <FileBarChart className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-display font-semibold text-foreground text-sm">{report.name}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">{report.description}</p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" /> {report.period}
                  </div>
                </div>
                <Button size="sm" variant="outline">
                  <Download className="h-4 w-4 mr-1" /> Export
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
