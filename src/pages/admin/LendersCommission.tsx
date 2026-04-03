import { AdminHero, AdminPageShell, adminCardClass } from "@/components/admin/AdminPageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Edit } from "lucide-react";

const mockCommission = [
  { lender: "Stanbic Bank", rate: "2.5%", flat: "K50", model: "Per Disbursement", lastPayout: "K12,400", nextPayout: "2026-04-01" },
  { lender: "Zanaco", rate: "3.0%", flat: "K0", model: "Percentage Only", lastPayout: "K8,900", nextPayout: "2026-04-01" },
  { lender: "FNB Zambia", rate: "2.0%", flat: "K75", model: "Hybrid", lastPayout: "K5,200", nextPayout: "2026-04-01" },
  { lender: "Atlas Mara", rate: "2.8%", flat: "K0", model: "Percentage Only", lastPayout: "K6,700", nextPayout: "2026-04-01" },
  { lender: "Indo Zambia", rate: "2.2%", flat: "K30", model: "Hybrid", lastPayout: "K3,100", nextPayout: "2026-04-01" },
];

const LendersCommission = () => {
  return (
    <AdminPageShell>
      <AdminHero
        badge="Pricing controls"
        title="Commission settings by lender, model, and payout cycle"
        description="Keep pricing aligned with partner contracts and make the payout schedule visible before reconciliation begins."
        stats={[
          { label: "Lenders configured", value: mockCommission.length.toString(), meta: "Partner pricing records" },
          { label: "Average rate", value: "2.5%", meta: "Across the current configuration" },
          { label: "Next payout", value: "2026-04-01", meta: "Shared schedule in sample data" },
        ]}
      />

      <Card className={`${adminCardClass} overflow-hidden`}>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lender</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Flat Fee</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Last Payout</TableHead>
                <TableHead>Next Payout</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockCommission.map((item) => (
                <TableRow key={item.lender}>
                  <TableCell className="font-medium">{item.lender}</TableCell>
                  <TableCell>{item.rate}</TableCell>
                  <TableCell>{item.flat}</TableCell>
                  <TableCell>{item.model}</TableCell>
                  <TableCell>{item.lastPayout}</TableCell>
                  <TableCell className="text-muted-foreground">{item.nextPayout}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost">
                      <Edit className="h-4 w-4" />
                    </Button>
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

export default LendersCommission;
