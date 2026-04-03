import { AdminHero, AdminPageShell, adminCardClass } from "@/components/admin/AdminPageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingDown, TrendingUp } from "lucide-react";

const mockPerformance = [
  { lender: "Stanbic Bank", disbursed: 156, totalValue: "K2.4M", avgProcessing: "2.1 days", defaultRate: "3.2%", trend: "up" },
  { lender: "Zanaco", disbursed: 89, totalValue: "K1.1M", avgProcessing: "1.5 days", defaultRate: "2.8%", trend: "up" },
  { lender: "FNB Zambia", disbursed: 67, totalValue: "K580K", avgProcessing: "3.0 days", defaultRate: "4.1%", trend: "down" },
  { lender: "Atlas Mara", disbursed: 45, totalValue: "K1.8M", avgProcessing: "2.8 days", defaultRate: "2.5%", trend: "up" },
  { lender: "Indo Zambia", disbursed: 34, totalValue: "K450K", avgProcessing: "1.9 days", defaultRate: "3.0%", trend: "up" },
];

const summary = [
  { label: "Total disbursed", value: "391 loans" },
  { label: "Total value", value: "K6.33M" },
  { label: "Avg processing", value: "2.3 days" },
  { label: "Avg default rate", value: "3.1%" },
];

const LendersPerformance = () => {
  return (
    <AdminPageShell>
      <AdminHero
        badge="Partner performance"
        title="Lender performance across volume, turnaround, and default pressure"
        description="Compare lender output side by side so the team can see who is accelerating approvals and where operational drag is starting to show."
        stats={summary.map((item) => ({ ...item, meta: "Current reporting snapshot" }))}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {summary.map((item) => (
          <Card key={item.label} className={adminCardClass}>
            <CardContent className="pt-6">
              <div className="text-2xl font-display font-bold text-foreground">{item.value}</div>
              <p className="text-sm text-muted-foreground">{item.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className={`${adminCardClass} overflow-hidden`}>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lender</TableHead>
                <TableHead>Loans Disbursed</TableHead>
                <TableHead>Total Value</TableHead>
                <TableHead>Avg Processing</TableHead>
                <TableHead>Default Rate</TableHead>
                <TableHead>Trend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockPerformance.map((item) => (
                <TableRow key={item.lender}>
                  <TableCell className="font-medium">{item.lender}</TableCell>
                  <TableCell>{item.disbursed}</TableCell>
                  <TableCell>{item.totalValue}</TableCell>
                  <TableCell>{item.avgProcessing}</TableCell>
                  <TableCell>{item.defaultRate}</TableCell>
                  <TableCell>
                    {item.trend === "up" ? (
                      <TrendingUp className="h-4 w-4 text-success" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-destructive" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AdminPageShell>
  );
};

export default LendersPerformance;
