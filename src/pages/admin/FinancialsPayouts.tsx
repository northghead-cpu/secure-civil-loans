import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Send } from "lucide-react";

const mockPayouts = [
  { id: "P001", lender: "Stanbic Bank", amount: "K12,400", period: "Feb 2026", status: "paid", paidDate: "2026-03-05" },
  { id: "P002", lender: "Zanaco", amount: "K8,900", period: "Feb 2026", status: "paid", paidDate: "2026-03-05" },
  { id: "P003", lender: "FNB Zambia", amount: "K5,200", period: "Feb 2026", status: "pending", paidDate: null },
  { id: "P004", lender: "Atlas Mara", amount: "K6,700", period: "Feb 2026", status: "processing", paidDate: null },
  { id: "P005", lender: "Indo Zambia", amount: "K3,100", period: "Feb 2026", status: "paid", paidDate: "2026-03-06" },
];

const statusColors: Record<string, string> = {
  paid: "bg-success/10 text-success",
  pending: "bg-warning/10 text-warning",
  processing: "bg-info/10 text-info",
};

const FinancialsPayouts = () => {
  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Payouts</h1>
          <p className="text-sm text-muted-foreground">Manage lender commission payouts</p>
        </div>
        <Button><Send className="w-4 h-4 mr-1" /> Process Payouts</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-display font-bold text-foreground">K36,300</div>
            <p className="text-sm text-muted-foreground">Total This Month</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-display font-bold text-success">K30,400</div>
            <p className="text-sm text-muted-foreground">Paid Out</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-display font-bold text-warning">K5,900</div>
            <p className="text-sm text-muted-foreground">Outstanding</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="hidden sm:table-cell">Payout ID</TableHead>
                <TableHead>Lender</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead className="hidden md:table-cell">Period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Paid Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockPayouts.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="hidden sm:table-cell font-medium font-mono text-sm">{p.id}</TableCell>
                  <TableCell>{p.lender}</TableCell>
                  <TableCell className="font-medium">{p.amount}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{p.period}</TableCell>
                  <TableCell><Badge className={statusColors[p.status]}>{p.status}</Badge></TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">{p.paidDate || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default FinancialsPayouts;
