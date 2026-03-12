import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const mockHistory = [
  { id: "1", user: "John Mwale", action: "Application approved", date: "2026-03-10", details: "Loan K15,000 — 12 months", status: "approved" },
  { id: "2", user: "Grace Banda", action: "Application rejected", date: "2026-03-09", details: "Failed CRB check", status: "rejected" },
  { id: "3", user: "Peter Zulu", action: "Loan disbursed", date: "2026-03-08", details: "K8,000 via Stanbic", status: "completed" },
  { id: "4", user: "Mary Phiri", action: "KYC re-submitted", date: "2026-03-07", details: "Updated NRC document", status: "pending" },
  { id: "5", user: "James Tembo", action: "Early repayment", date: "2026-03-06", details: "K5,200 remaining balance", status: "completed" },
  { id: "6", user: "Sarah Mulenga", action: "Application submitted", date: "2026-03-05", details: "K20,000 — 24 months", status: "pending" },
];

const statusColors: Record<string, string> = {
  approved: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive",
  completed: "bg-info/10 text-info",
  pending: "bg-warning/10 text-warning",
};

const UsersHistory = () => {
  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">User History</h1>
        <p className="text-sm text-muted-foreground">Complete activity log across all users</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockHistory.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.user}</TableCell>
                  <TableCell>{item.action}</TableCell>
                  <TableCell className="text-muted-foreground">{item.details}</TableCell>
                  <TableCell><Badge className={statusColors[item.status]}>{item.status}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{item.date}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default UsersHistory;
