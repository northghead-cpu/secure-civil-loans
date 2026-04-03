import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminHero, AdminPageShell, adminCardClass } from "@/components/admin/AdminPageShell";
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
    <AdminPageShell>
      <AdminHero
        badge="Commission settlement"
        title="Payout operations for lender commissions and reconciliations"
        description="Track what has been processed, what is still waiting to settle, and which partners are holding the current month open."
        actions={
          <Button className="bg-white text-slate-950 hover:bg-white/90">
            <Send className="mr-1 h-4 w-4" /> Process Payouts
          </Button>
        }
        stats={[
          { label: "Total this month", value: "K36,300", meta: "Gross commission obligation" },
          { label: "Paid out", value: "K30,400", meta: "Settled to lenders" },
          { label: "Outstanding", value: "K5,900", meta: "Still awaiting release" },
        ]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className={adminCardClass}>
          <CardContent className="pt-6">
            <div className="text-2xl font-display font-bold text-foreground">K36,300</div>
            <p className="text-sm text-muted-foreground">Total This Month</p>
          </CardContent>
        </Card>
        <Card className={adminCardClass}>
          <CardContent className="pt-6">
            <div className="text-2xl font-display font-bold text-success">K30,400</div>
            <p className="text-sm text-muted-foreground">Paid Out</p>
          </CardContent>
        </Card>
        <Card className={adminCardClass}>
          <CardContent className="pt-6">
            <div className="text-2xl font-display font-bold text-warning">K5,900</div>
            <p className="text-sm text-muted-foreground">Outstanding</p>
          </CardContent>
        </Card>
      </div>

      <Card className={`${adminCardClass} overflow-hidden`}>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payout ID</TableHead>
                <TableHead>Lender</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Paid Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockPayouts.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium font-mono text-sm">{p.id}</TableCell>
                  <TableCell>{p.lender}</TableCell>
                  <TableCell className="font-medium">{p.amount}</TableCell>
                  <TableCell className="text-muted-foreground">{p.period}</TableCell>
                  <TableCell><Badge className={statusColors[p.status]}>{p.status}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{p.paidDate || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AdminPageShell>
  );
};

export default FinancialsPayouts;
