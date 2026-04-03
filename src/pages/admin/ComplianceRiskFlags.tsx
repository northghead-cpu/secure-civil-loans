import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminHero, AdminPageShell, adminCardClass } from "@/components/admin/AdminPageShell";
import { Eye, CheckCircle2 } from "lucide-react";

const mockFlags = [
  { id: "RF001", user: "John Mwale", type: "Duplicate NRC", severity: "high", date: "2026-03-11", status: "open" },
  { id: "RF002", user: "Unknown", type: "Suspicious document", severity: "critical", date: "2026-03-10", status: "open" },
  { id: "RF003", user: "Grace Banda", type: "Income mismatch", severity: "medium", date: "2026-03-09", status: "investigating" },
  { id: "RF004", user: "Peter Zulu", type: "Multiple applications", severity: "low", date: "2026-03-08", status: "resolved" },
  { id: "RF005", user: "Mary Phiri", type: "CRB adverse listing", severity: "high", date: "2026-03-07", status: "open" },
];

const severityColors: Record<string, string> = {
  critical: "bg-destructive/10 text-destructive",
  high: "bg-destructive/10 text-destructive",
  medium: "bg-warning/10 text-warning",
  low: "bg-info/10 text-info",
};

const statusColors: Record<string, string> = {
  open: "bg-destructive/10 text-destructive",
  investigating: "bg-warning/10 text-warning",
  resolved: "bg-success/10 text-success",
};

const ComplianceRiskFlags = () => {
  return (
    <AdminPageShell>
      <AdminHero
        badge="Risk monitoring"
        title="Flag resolution queue for fraud, credit, and compliance exceptions"
        description="Watch high-severity issues, separate false positives from real fraud signals, and keep active investigations moving."
        stats={[
          { label: "Critical", value: "2", meta: "Immediate intervention required" },
          { label: "Open", value: "3", meta: "Still awaiting owner action" },
          { label: "Investigating", value: "1", meta: "Assigned and in progress" },
          { label: "Resolved", value: "1", meta: "Closed after review" },
        ]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className={adminCardClass}>
          <CardContent className="pt-6">
            <div className="text-2xl font-display font-bold text-destructive">2</div>
            <p className="text-sm text-muted-foreground">Critical</p>
          </CardContent>
        </Card>
        <Card className={adminCardClass}>
          <CardContent className="pt-6">
            <div className="text-2xl font-display font-bold text-warning">3</div>
            <p className="text-sm text-muted-foreground">Open</p>
          </CardContent>
        </Card>
        <Card className={adminCardClass}>
          <CardContent className="pt-6">
            <div className="text-2xl font-display font-bold text-info">1</div>
            <p className="text-sm text-muted-foreground">Investigating</p>
          </CardContent>
        </Card>
        <Card className={adminCardClass}>
          <CardContent className="pt-6">
            <div className="text-2xl font-display font-bold text-success">1</div>
            <p className="text-sm text-muted-foreground">Resolved</p>
          </CardContent>
        </Card>
      </div>

      <Card className={`${adminCardClass} overflow-hidden`}>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Flag ID</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockFlags.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-mono text-sm">{f.id}</TableCell>
                  <TableCell className="font-medium">{f.user}</TableCell>
                  <TableCell>{f.type}</TableCell>
                  <TableCell><Badge className={severityColors[f.severity]}>{f.severity}</Badge></TableCell>
                  <TableCell><Badge className={statusColors[f.status]}>{f.status}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{f.date}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="ghost"><Eye className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" className="text-success"><CheckCircle2 className="h-4 w-4" /></Button>
                    </div>
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

export default ComplianceRiskFlags;
