import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminHero, AdminPageShell, adminCardClass } from "@/components/admin/AdminPageShell";
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
  const employeesCovered = integrations.reduce((sum, integration) => sum + integration.employees, 0);

  return (
    <AdminPageShell>
      <AdminHero
        badge="Salary verification"
        title="Payroll integrations powering employer and payslip validation"
        description="Monitor connection health, sync freshness, and how much of the borrower base is covered by direct payroll sources."
        actions={
          <Button className="bg-white text-slate-950 hover:bg-white/90">
            <Link2 className="mr-1 h-4 w-4" /> Add Integration
          </Button>
        }
        stats={[
          { label: "Total integrations", value: integrations.length.toString(), meta: "Configured employer connections" },
          { label: "Active connections", value: integrations.filter((integration) => integration.status === "connected").length.toString(), meta: "Healthy payroll sources" },
          { label: "Employees covered", value: employeesCovered.toLocaleString(), meta: "Users reachable through payroll checks" },
        ]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className={adminCardClass}>
          <CardContent className="pt-6">
            <div className="text-2xl font-display font-bold text-foreground">5</div>
            <p className="text-sm text-muted-foreground">Total Integrations</p>
          </CardContent>
        </Card>
        <Card className={adminCardClass}>
          <CardContent className="pt-6">
            <div className="text-2xl font-display font-bold text-success">3</div>
            <p className="text-sm text-muted-foreground">Active Connections</p>
          </CardContent>
        </Card>
        <Card className={adminCardClass}>
          <CardContent className="pt-6">
            <div className="text-2xl font-display font-bold text-foreground">3,030</div>
            <p className="text-sm text-muted-foreground">Employees Covered</p>
          </CardContent>
        </Card>
      </div>

      <Card className={`${adminCardClass} overflow-hidden`}>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employer</TableHead>
                <TableHead>Integration Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Sync</TableHead>
                <TableHead>Employees</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {integrations.map((i) => (
                <TableRow key={i.employer}>
                  <TableCell className="font-medium">{i.employer}</TableCell>
                  <TableCell>{i.type}</TableCell>
                  <TableCell><Badge className={statusColors[i.status]}>{i.status}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{i.lastSync || "-"}</TableCell>
                  <TableCell>{i.employees.toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost"><RefreshCw className="h-4 w-4" /></Button>
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

export default CompliancePayroll;
