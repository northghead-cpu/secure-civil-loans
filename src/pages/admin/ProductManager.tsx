import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, ToggleLeft, ToggleRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useRBAC } from "@/hooks/useRBAC";
import { adminProductService, type ProductInput } from "@/services/adminProductService";
import { isFeatureEnabled } from "@/config/features";

const ProductManager = () => {
  const { user } = useAuth();
  const { hasRole, logAction } = useRBAC();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductInput>({ name: "", description: "", status: "active" });

  const isSuperAdmin = hasRole("super_admin");

  if (!isFeatureEnabled("enableAdminControls")) {
    return <div className="p-6 text-muted-foreground">This feature is currently disabled.</div>;
  }

  if (!isSuperAdmin) {
    return <div className="p-6 text-destructive font-medium">Access denied — Super Admin only.</div>;
  }

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["admin-products"],
    queryFn: () => adminProductService.list(),
  });

  const saveMutation = useMutation({
    mutationFn: async (input: ProductInput) => {
      if (editingId) {
        return adminProductService.update(editingId, input);
      }
      return adminProductService.create(input, user!.id);
    },
    onSuccess: (product) => {
      const action = editingId ? "product_updated" : "product_created";
      logAction(action, product.id, "products", null, product);
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast.success(editingId ? "Product updated" : "Product created");
      closeDialog();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      adminProductService.toggleStatus(id, status),
    onSuccess: (product) => {
      logAction("product_status_toggled", product.id, "products", null, { status: product.status });
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast.success(`Product ${product.status === "active" ? "activated" : "deactivated"}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setForm({ name: "", description: "", status: "active" });
  };

  const openEdit = (p: { id: string; name: string; description: string | null; status: string }) => {
    setEditingId(p.id);
    setForm({ name: p.name, description: p.description ?? "", status: p.status as "active" | "inactive" });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    saveMutation.mutate(form);
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-foreground">Product Manager</h1>
          <p className="text-sm text-muted-foreground">Manage platform products</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Add Product
        </Button>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : products.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground">No products yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="hidden sm:table-cell max-w-[200px] truncate">{p.description || "—"}</TableCell>
                    <TableCell>
                      <Badge className={p.status === "active" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}>
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(p)}><Edit className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => toggleMutation.mutate({ id: p.id, status: p.status })}>
                          {p.status === "active" ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingId ? "Edit Product" : "New Product"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Description</Label><Textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as "active" | "inactive" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {editingId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductManager;
