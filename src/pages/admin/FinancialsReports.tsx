import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Reports</h1>
        <p className="text-sm text-muted-foreground">Generate and download financial and operational reports</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reports.map((report) => (
          <Card key={report.name}>
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
    </div>
  );
};

export default FinancialsReports;
