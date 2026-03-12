import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Edit, Save } from "lucide-react";

const mockCommission = [
  { lender: "Stanbic Bank", rate: "2.5%", flat: "K50", model: "Per Disbursement", lastPayout: "K12,400", nextPayout: "2026-04-01" },
  { lender: "Zanaco", rate: "3.0%", flat: "K0", model: "Percentage Only", lastPayout: "K8,900", nextPayout: "2026-04-01" },
  { lender: "FNB Zambia", rate: "2.0%", flat: "K75", model: "Hybrid", lastPayout: "K5,200", nextPayout: "2026-04-01" },
  { lender: "Atlas Mara", rate: "2.8%", flat: "K0", model: "Percentage Only", lastPayout: "K6,700", nextPayout: "2026-04-01" },
  { lender: "Indo Zambia", rate: "2.2%", flat: "K30", model: "Hybrid", lastPayout: "K3,100", nextPayout: "2026-04-01" },
];

const LendersCommission = () => {
  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Commission Settings</h1>
        <p className="text-sm text-muted-foreground">Configure commission rates and payout models per lender</p>
      </div>

      <Card>
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
              {mockCommission.map((c) => (
                <TableRow key={c.lender}>
                  <TableCell className="font-medium">{c.lender}</TableCell>
                  <TableCell>{c.rate}</TableCell>
                  <TableCell>{c.flat}</TableCell>
                  <TableCell>{c.model}</TableCell>
                  <TableCell>{c.lastPayout}</TableCell>
                  <TableCell className="text-muted-foreground">{c.nextPayout}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost"><Edit className="h-4 w-4" /></Button>
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

export default LendersCommission;
