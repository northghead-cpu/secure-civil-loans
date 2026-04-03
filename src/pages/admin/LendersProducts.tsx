import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminHero, AdminPageShell, adminCardClass } from "@/components/admin/AdminPageShell";
import { Plus, Edit, ToggleLeft } from "lucide-react";

const mockProducts = [
  { id: "1", lender: "Stanbic Bank", product: "Personal Loan", rate: "28%", maxTerm: "36 months", maxAmount: "K50,000", status: "active" },
  { id: "2", lender: "Zanaco", product: "Salary Advance", rate: "22%", maxTerm: "12 months", maxAmount: "K20,000", status: "active" },
  { id: "3", lender: "FNB Zambia", product: "Emergency Loan", rate: "32%", maxTerm: "6 months", maxAmount: "K10,000", status: "active" },
  { id: "4", lender: "Atlas Mara", product: "Civil Servant Loan", rate: "25%", maxTerm: "48 months", maxAmount: "K80,000", status: "paused" },
  { id: "5", lender: "Indo Zambia", product: "Teacher's Loan", rate: "24%", maxTerm: "24 months", maxAmount: "K30,000", status: "active" },
];

const LendersProducts = () => {
  const activeProducts = mockProducts.filter((product) => product.status === "active").length;

  return (
    <AdminPageShell>
      <AdminHero
        badge="Partner catalog"
        title="Loan product controls for lenders and employer-specific offers"
        description="Review terms, pause products when risk changes, and keep the marketplace inventory aligned with lender appetite."
        actions={
          <Button className="bg-white text-slate-950 hover:bg-white/90">
            <Plus className="mr-1 h-4 w-4" /> Add Product
          </Button>
        }
        stats={[
          { label: "Products listed", value: mockProducts.length.toString(), meta: "Visible in the marketplace" },
          { label: "Active products", value: activeProducts.toString(), meta: "Currently accepting applications" },
          { label: "Paused", value: (mockProducts.length - activeProducts).toString(), meta: "Temporarily disabled" },
        ]}
      />

      <Card className={`${adminCardClass} overflow-hidden`}>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lender</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Interest Rate</TableHead>
                <TableHead>Max Term</TableHead>
                <TableHead>Max Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockProducts.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.lender}</TableCell>
                  <TableCell>{p.product}</TableCell>
                  <TableCell>{p.rate}</TableCell>
                  <TableCell>{p.maxTerm}</TableCell>
                  <TableCell>{p.maxAmount}</TableCell>
                  <TableCell>
                    <Badge className={p.status === "active" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}>
                      {p.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="ghost"><Edit className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost"><ToggleLeft className="h-4 w-4" /></Button>
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

export default LendersProducts;
