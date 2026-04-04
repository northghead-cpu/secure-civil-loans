import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link2, RefreshCw } from "lucide-react";

const integrations = [
  { employer: "Ministry of Education", type: "API", status: "connected", lastSync: "2026-03-11 08:00", employees: 1240 },
  { employer: "Ministry of Health", type: "API", status: "connected", lastSync: "2026-03-11 08:00", employees: 890 },
  { employer: "Zambia Police Service", type: "CSV Upload", status: "connected", lastSync: "2026-03-10 14:00", employees: 560 },
  { employer: "ZESCO", type: "API", status: "error", lastSync: "2026-03-09 08:00", employees: 340 },
  { employer: "Zambia Revenue Authority", type: "Manual", status: "pending", lastSync: null, employees: 0 },
];

const statusColors: Record<string, string> = {
  connected: "bg-success/10 text-success",
  error: "bg-destructive/10 text-destructive",
  pending: "bg-warning/10 text-warning",
};

const CompliancePayroll = () => {
  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Payroll Integration</h1>
          <p className="text-sm text-muted-foreground">Manage employer payroll connections for salary verification</p>
        </div>
        <Button><Link2 className="w-4 h-4 mr-1" /> Add Integration</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-display font-bold text-foreground">5</div>
            <p className="text-sm text-muted-foreground">Total Integrations</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-display font-bold text-success">3</div>
            <p className="text-sm text-muted-foreground">Active Connections</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-display font-bold text-foreground">3,030</div>
            <p className="text-sm text-muted-foreground">Employees Covered</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employer</TableHead>
                <TableHead className="hidden sm:table-cell">Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Last Sync</TableHead>
                <TableHead className="hidden sm:table-cell">Employees</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {integrations.map((i) => (
                <TableRow key={i.employer}>
                  <TableCell className="font-medium">{i.employer}</TableCell>
                  <TableCell className="hidden sm:table-cell">{i.type}</TableCell>
                  <TableCell><Badge className={statusColors[i.status]}>{i.status}</Badge></TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{i.lastSync || "—"}</TableCell>
                  <TableCell className="hidden sm:table-cell">{i.employees.toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost"><RefreshCw className="h-4 w-4" /></Button>
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

export default CompliancePayroll;
