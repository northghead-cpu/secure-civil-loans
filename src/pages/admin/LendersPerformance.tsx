import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, TrendingDown } from "lucide-react";

const mockPerformance = [
  { lender: "Stanbic Bank", disbursed: 156, totalValue: "K2.4M", avgProcessing: "2.1 days", defaultRate: "3.2%", trend: "up" },
  { lender: "Zanaco", disbursed: 89, totalValue: "K1.1M", avgProcessing: "1.5 days", defaultRate: "2.8%", trend: "up" },
  { lender: "FNB Zambia", disbursed: 67, totalValue: "K580K", avgProcessing: "3.0 days", defaultRate: "4.1%", trend: "down" },
  { lender: "Atlas Mara", disbursed: 45, totalValue: "K1.8M", avgProcessing: "2.8 days", defaultRate: "2.5%", trend: "up" },
  { lender: "Indo Zambia", disbursed: 34, totalValue: "K450K", avgProcessing: "1.9 days", defaultRate: "3.0%", trend: "up" },
];

const LendersPerformance = () => {
  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Lender Performance</h1>
        <p className="text-sm text-muted-foreground">Track lender metrics and KPIs</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Disbursed", value: "391 loans" },
          { label: "Total Value", value: "K6.33M" },
          { label: "Avg Processing", value: "2.3 days" },
          { label: "Avg Default Rate", value: "3.1%" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-6">
              <div className="text-2xl font-display font-bold text-foreground">{s.value}</div>
              <p className="text-sm text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
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
              {mockPerformance.map((p) => (
                <TableRow key={p.lender}>
                  <TableCell className="font-medium">{p.lender}</TableCell>
                  <TableCell>{p.disbursed}</TableCell>
                  <TableCell>{p.totalValue}</TableCell>
                  <TableCell>{p.avgProcessing}</TableCell>
                  <TableCell>{p.defaultRate}</TableCell>
                  <TableCell>
                    {p.trend === "up" ? (
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
    </div>
  );
};

export default LendersPerformance;
