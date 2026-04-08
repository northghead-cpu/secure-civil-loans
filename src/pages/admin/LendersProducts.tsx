import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRBAC } from "@/hooks/useRBAC";
import { toast } from "sonner";
import { Plus, Edit, ToggleLeft, ToggleRight } from "lucide-react";

interface Product {
  id: string;
  lender: string;
  product: string;
  rate: string;
  maxTerm: string;
  maxAmount: string;
  status: "active" | "paused" | "inactive";
}

const mockProducts: Product[] = [
  { id: "1", lender: "Stanbic Bank", product: "Personal Loan", rate: "28%", maxTerm: "36 months", maxAmount: "K50,000", status: "active" },
  { id: "2", lender: "Zanaco", product: "Salary Advance", rate: "22%", maxTerm: "12 months", maxAmount: "K20,000", status: "active" },
  { id: "3", lender: "FNB Zambia", product: "Emergency Loan", rate: "32%", maxTerm: "6 months", maxAmount: "K10,000", status: "active" },
  { id: "4", lender: "Atlas Mara", product: "Civil Servant Loan", rate: "25%", maxTerm: "48 months", maxAmount: "K80,000", status: "paused" },
  { id: "5", lender: "Indo Zambia", product: "Teacher's Loan", rate: "24%", maxTerm: "24 months", maxAmount: "K30,000", status: "active" },
];

const LendersProducts = () => {
  const { permissions, logAction, hasRole } = useRBAC();
  const [products, setProducts] = useState<Product[]>(mockProducts);
  const isSuperAdmin = hasRole("super_admin");
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    lender: "",
    product: "",
    rate: "",
    maxTerm: "",
    maxAmount: "",
  });

  const canManageProducts = permissions.canEditLoanApplications || isSuperAdmin;

  const openAddModal = () => {
    setEditingProduct(null);
    setFormData({ lender: "", product: "", rate: "", maxTerm: "", maxAmount: "" });
    setShowModal(true);
  };

  const openEditModal = (product: Product) => {
    if (!isSuperAdmin) {
      toast.error("Only Super Admins can edit products");
      return;
    }
    setEditingProduct(product);
    setFormData({
      lender: product.lender,
      product: product.product,
      rate: product.rate,
      maxTerm: product.maxTerm,
      maxAmount: product.maxAmount,
    });
    setShowModal(true);
  };

  const toggleProductStatus = async (product: Product) => {
    if (!isSuperAdmin) {
      toast.error("Only Super Admins can toggle product status");
      return;
    }
    try {
      const newStatus = product.status === "active" ? "paused" : "active";
      await logAction(
        "toggle_product_status",
        product.id,
        "lender_products",
        { status: product.status },
        { status: newStatus }
      );
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, status: newStatus } : p))
      );
      toast.success(`Product ${newStatus === "active" ? "activated" : "deactivated"}`);
    } catch (error) {
      toast.error("Failed to update product status");
    }
  };

  const handleSave = async () => {
    if (!formData.lender || !formData.product || !formData.rate) {
      toast.error("Please fill in all required fields");
      return;
    }
    setSaving(true);
    try {
      if (editingProduct) {
        // Edit existing product
        await logAction(
          "update_product",
          editingProduct.id,
          "lender_products",
          editingProduct,
          { ...editingProduct, ...formData }
        );
        setProducts((prev) =>
          prev.map((p) =>
            p.id === editingProduct.id ? { ...p, ...formData } : p
          )
        );
        toast.success("Product updated successfully");
      } else {
        // Add new product
        const newProduct: Product = {
          id: `prod_${Date.now()}`,
          ...formData,
          status: "active",
        };
        await logAction("add_product", newProduct.id, "lender_products", null, newProduct);
        setProducts((prev) => [...prev, newProduct]);
        toast.success("Product added successfully");
      }
      setShowModal(false);
    } catch (error) {
      toast.error("Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Loan Products</h1>
          <p className="text-sm text-muted-foreground">
            Manage lender products and terms
            {isSuperAdmin && <span className="ml-2 text-xs text-primary">(Super Admin: Full Access)</span>}
          </p>
        </div>
        {isSuperAdmin && (
          <Button onClick={openAddModal}>
            <Plus className="w-4 h-4 mr-1" /> Add Product
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lender</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead className="hidden sm:table-cell">Max Term</TableHead>
                <TableHead className="hidden md:table-cell">Max Amount</TableHead>
                <TableHead>Status</TableHead>
                {isSuperAdmin && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.lender}</TableCell>
                  <TableCell>{p.product}</TableCell>
                  <TableCell>{p.rate}</TableCell>
                  <TableCell className="hidden sm:table-cell">{p.maxTerm}</TableCell>
                  <TableCell className="hidden md:table-cell">{p.maxAmount}</TableCell>
                  <TableCell>
                    <Badge className={p.status === "active" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}>
                      {p.status}
                    </Badge>
                  </TableCell>
                  {isSuperAdmin && (
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => openEditModal(p)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => toggleProductStatus(p)}>
                          {p.status === "active" ? (
                            <ToggleRight className="h-4 w-4 text-success" />
                          ) : (
                            <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Super Admin Product Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? "Edit Product" : "Add New Product"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="lender">Lender Name *</Label>
              <Input
                id="lender"
                value={formData.lender}
                onChange={(e) => setFormData((p) => ({ ...p, lender: e.target.value }))}
                placeholder="e.g. Stanbic Bank"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product">Product Name *</Label>
              <Input
                id="product"
                value={formData.product}
                onChange={(e) => setFormData((p) => ({ ...p, product: e.target.value }))}
                placeholder="e.g. Personal Loan"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rate">Interest Rate *</Label>
                <Input
                  id="rate"
                  value={formData.rate}
                  onChange={(e) => setFormData((p) => ({ ...p, rate: e.target.value }))}
                  placeholder="e.g. 25%"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxTerm">Max Term</Label>
                <Input
                  id="maxTerm"
                  value={formData.maxTerm}
                  onChange={(e) => setFormData((p) => ({ ...p, maxTerm: e.target.value }))}
                  placeholder="e.g. 36 months"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxAmount">Max Amount</Label>
              <Input
                id="maxAmount"
                value={formData.maxAmount}
                onChange={(e) => setFormData((p) => ({ ...p, maxAmount: e.target.value }))}
                placeholder="e.g. K50,000"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingProduct ? "Update Product" : "Add Product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LendersProducts;
