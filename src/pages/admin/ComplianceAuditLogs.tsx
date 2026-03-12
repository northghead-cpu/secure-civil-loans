import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollText } from "lucide-react";

const mockLogs = [
  { id: "AL001", actor: "Admin: Sarah K.", action: "Approved application", target: "John Mwale #APP-2847", timestamp: "2026-03-11 14:32", category: "application" },
  { id: "AL002", actor: "System", action: "CRB check completed", target: "Grace Banda #APP-2846", timestamp: "2026-03-11 13:15", category: "automation" },
  { id: "AL003", actor: "Admin: Sarah K.", action: "Updated commission rate", target: "Stanbic Bank", timestamp: "2026-03-11 11:45", category: "settings" },
  { id: "AL004", actor: "System", action: "Risk flag auto-raised", target: "Unknown user #RF002", timestamp: "2026-03-10 22:00", category: "risk" },
  { id: "AL005", actor: "Admin: Mike L.", action: "Rejected application", target: "Peter Zulu #APP-2840", timestamp: "2026-03-10 16:20", category: "application" },
  { id: "AL006", actor: "System", action: "Payout processed", target: "Zanaco — K8,900", timestamp: "2026-03-10 09:00", category: "financial" },
  { id: "AL007", actor: "Admin: Sarah K.", action: "KYC verified", target: "James Tembo", timestamp: "2026-03-09 15:30", category: "kyc" },
  { id: "AL008", actor: "System", action: "New user registered", target: "mary.phiri@email.com", timestamp: "2026-03-09 10:12", category: "user" },
];

const categoryColors: Record<string, string> = {
  application: "bg-info/10 text-info",
  automation: "bg-accent/10 text-accent",
  settings: "bg-muted text-muted-foreground",
  risk: "bg-destructive/10 text-destructive",
  financial: "bg-success/10 text-success",
  kyc: "bg-warning/10 text-warning",
  user: "bg-primary/10 text-primary",
};

const ComplianceAuditLogs = () => {
  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Audit Logs</h1>
        <p className="text-sm text-muted-foreground">Complete trail of all admin and system actions</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-mono text-xs">{log.id}</TableCell>
                  <TableCell className="font-medium">{log.actor}</TableCell>
                  <TableCell>{log.action}</TableCell>
                  <TableCell className="text-muted-foreground">{log.target}</TableCell>
                  <TableCell><Badge className={categoryColors[log.category]}>{log.category}</Badge></TableCell>
                  <TableCell className="text-muted-foreground text-sm">{log.timestamp}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ComplianceAuditLogs;
