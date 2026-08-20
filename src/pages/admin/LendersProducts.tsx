import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRBAC } from "@/hooks/useRBAC";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Edit, ToggleLeft, ToggleRight, Loader2 } from "lucide-react";

type ProductType = "loan_bank" | "loan_microfinance" | "salary_advance_microfinance";
const PRODUCT_TYPE_LABELS: Record<ProductType, string> = { loan_bank: "Loan — Bank", loan_microfinance: "Loan — Microfinance", salary_advance_microfinance: "Salary Advance — Microfinance" };
interface Product { id: string; bank_name: string; product_type: ProductType; interest_rate: number; max_term_months: number; max_amount: number; min_amount: number; processing_days: number; active: boolean; }

const EMPTY_FORM = { lender: "", productType: "loan_bank" as ProductType, rate: "", minAmount: "", maxTerm: "", maxAmount: "", processingDays: "" };

const LendersProducts = () => {
  const { permissions, hasRole, logAction } = useRBAC();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const isSuperAdmin = hasRole("super_admin");
  const canManageProducts = permissions.canEditLoanApplications || isSuperAdmin;

  const loadProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("bank_products").select("id, bank_name, product_type, interest_rate, max_term_months, max_amount, min_amount, processing_days, active").order("bank_name");
    if (error) toast.error(`Failed to load loan products: ${error.message}`);
    else {
      const validProducts = (data ?? []).filter((p) => ["loan_bank", "loan_microfinance", "salary_advance_microfinance"].includes(p.product_type)).map((p) => ({ ...p, product_type: p.product_type as ProductType }));
      setProducts(validProducts);
    }
    setLoading(false);
  };

  useEffect(() => { void loadProducts(); }, []);

  const openAddModal = () => {
    if (!isSuperAdmin) return toast.error("Only Super Admins can add products");
    setEditingProduct(null);
    setFormData(EMPTY_FORM);
    setShowModal(true);
  };

  const openEditModal = (product: Product) => {
    if (!isSuperAdmin) return toast.error("Only Super Admins can edit products");
    setEditingProduct(product);
    setFormData({ lender: product.bank_name, productType: product.product_type, rate: String(product.interest_rate), minAmount: String(product.min_amount), maxTerm: String(product.max_term_months), maxAmount: String(product.max_amount), processingDays: String(product.processing_days) });
    setShowModal(true);
  };

  const toggleProductStatus = async (product: Product) => {
    if (!isSuperAdmin) return toast.error("Only Super Admins can toggle product status");
    const { error } = await supabase.from("bank_products").update({ active: !product.active }).eq("id", product.id);
    if (error) return toast.error(`Failed to update product status: ${error.message}`);
    await logAction("toggle_product_status", product.id, "bank_products", { active: product.active }, { active: !product.active });
    setProducts((prev) => prev.map((p) => p.id === product.id ? { ...p, active: !p.active } : p));
    toast.success(`Product ${!product.active ? "activated" : "paused"}`);
  };

  const handleSave = async () => {
    if (!canManageProducts) return toast.error("You do not have permission to manage loan products");
    const rate = Number(formData.rate), minAmount = Number(formData.minAmount), maxAmount = Number(formData.maxAmount), maxTerm = Number(formData.maxTerm), processingDays = Number(formData.processingDays || 0);
    if (!formData.lender.trim() || !Number.isFinite(rate) || rate <= 0 || !Number.isFinite(minAmount) || minAmount < 0 || !Number.isFinite(maxAmount) || maxAmount <= minAmount || !Number.isInteger(maxTerm) || maxTerm <= 0 || !Number.isInteger(processingDays) || processingDays < 0) return toast.error("Enter valid lender, rate, amount, term and processing values");
    setSaving(true);
    const payload = { bank_name: formData.lender.trim(), product_type: formData.productType, interest_rate: rate, min_amount: minAmount, max_amount: maxAmount, max_term_months: maxTerm, processing_days: processingDays, active: true };
    const result = editingProduct ? await supabase.from("bank_products").update(payload).eq("id", editingProduct.id).select().single() : await supabase.from("bank_products").insert(payload).select().single();
    if (result.error) toast.error(`Failed to save loan product: ${result.error.message}`);
    else { await logAction(editingProduct ? "update_product" : "add_product", result.data.id, "bank_products", editingProduct, result.data); toast.success(editingProduct ? "Product updated" : "Product added"); setShowModal(false); await loadProducts(); }
    setSaving(false);
  };

  return <div className="space-y-6 max-w-7xl">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><div><h1 className="text-2xl font-display font-bold text-foreground">Loan Products</h1><p className="text-sm text-muted-foreground">Manage verified bank, microfinance and salary advance products</p></div>{isSuperAdmin && <Button onClick={openAddModal}><Plus className="w-4 h-4 mr-1" /> Add Product</Button>}</div>
    <Card><CardContent className="p-0 overflow-x-auto">{loading ? <div className="p-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div> : <Table><TableHeader><TableRow><TableHead>Lender</TableHead><TableHead>Product Type</TableHead><TableHead>Rate</TableHead><TableHead className="hidden sm:table-cell">Min Amount</TableHead><TableHead className="hidden sm:table-cell">Max Term</TableHead><TableHead className="hidden md:table-cell">Max Amount</TableHead><TableHead>Status</TableHead>{isSuperAdmin && <TableHead className="text-right">Actions</TableHead>}</TableRow></TableHeader><TableBody>{products.map((p) => <TableRow key={p.id}><TableCell className="font-medium">{p.bank_name}</TableCell><TableCell><Badge variant="outline">{PRODUCT_TYPE_LABELS[p.product_type] ?? "Unclassified"}</Badge></TableCell><TableCell>{p.interest_rate}%</TableCell><TableCell className="hidden sm:table-cell">K{p.min_amount.toLocaleString()}</TableCell><TableCell className="hidden sm:table-cell">{p.max_term_months} months</TableCell><TableCell className="hidden md:table-cell">K{p.max_amount.toLocaleString()}</TableCell><TableCell><Badge className={p.active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}>{p.active ? "active" : "paused"}</Badge></TableCell>{isSuperAdmin && <TableCell className="text-right"><div className="flex gap-1 justify-end"><Button size="sm" variant="ghost" onClick={() => openEditModal(p)}><Edit className="h-4 w-4" /></Button><Button size="sm" variant="ghost" onClick={() => toggleProductStatus(p)}>{p.active ? <ToggleRight className="h-4 w-4 text-success" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}</Button></div></TableCell>}</TableRow>)}{products.length === 0 && <TableRow><TableCell colSpan={isSuperAdmin ? 8 : 7} className="text-center py-10 text-muted-foreground">No verified loan products have been added yet.</TableCell></TableRow>}</TableBody></Table>}</CardContent></Card>
    <Dialog open={showModal} onOpenChange={setShowModal}><DialogContent className="sm:max-w-[500px]"><DialogHeader><DialogTitle>{editingProduct ? "Edit Loan Product" : "Add New Loan Product"}</DialogTitle></DialogHeader><div className="space-y-4 py-4"><div className="space-y-2"><Label htmlFor="productType">Product Type *</Label><Select value={formData.productType} onValueChange={(value: ProductType) => setFormData((p) => ({ ...p, productType: value }))}><SelectTrigger id="productType"><SelectValue placeholder="Select product type" /></SelectTrigger><SelectContent><SelectItem value="loan_bank">Loan — Bank</SelectItem><SelectItem value="loan_microfinance">Loan — Microfinance</SelectItem><SelectItem value="salary_advance_microfinance">Salary Advance — Microfinance</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label htmlFor="lender">Lender Name *</Label><Input id="lender" value={formData.lender} onChange={(e) => setFormData((p) => ({ ...p, lender: e.target.value }))} /></div><div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label htmlFor="rate">Annual Interest Rate % *</Label><Input id="rate" type="number" min="0.01" step="0.01" value={formData.rate} onChange={(e) => setFormData((p) => ({ ...p, rate: e.target.value }))} /></div><div className="space-y-2"><Label htmlFor="processingDays">Processing Days</Label><Input id="processingDays" type="number" min="0" step="1" value={formData.processingDays} onChange={(e) => setFormData((p) => ({ ...p, processingDays: e.target.value }))} /></div></div><div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label htmlFor="minAmount">Minimum Amount *</Label><Input id="minAmount" type="number" min="0" step="100" value={formData.minAmount} onChange={(e) => setFormData((p) => ({ ...p, minAmount: e.target.value }))} /></div><div className="space-y-2"><Label htmlFor="maxAmount">Maximum Amount *</Label><Input id="maxAmount" type="number" min="0" step="100" value={formData.maxAmount} onChange={(e) => setFormData((p) => ({ ...p, maxAmount: e.target.value }))} /></div></div><div className="space-y-2"><Label htmlFor="maxTerm">Maximum Term (months) *</Label><Input id="maxTerm" type="number" min="1" step="1" value={formData.maxTerm} onChange={(e) => setFormData((p) => ({ ...p, maxTerm: e.target.value }))} /></div><p className="text-xs text-muted-foreground">Select the classification carefully. Compare Loans uses this classification to place verified products in the correct borrower section.</p></div><DialogFooter><Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button><Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : editingProduct ? "Update Product" : "Add Product"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
};

export default LendersProducts;
