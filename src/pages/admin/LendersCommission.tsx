import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Edit, Save, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface CommissionSettings {
  id: string;
  lender_name: string;
  rate: number;
  flat_fee_zmw: number;
  model: "Percentage Only" | "Flat Fee Only" | "Per Disbursement" | "Hybrid";
  active: boolean;
  effective_from: string | null;
}

const LendersCommission = () => {
  const [commissions, setCommissions] = useState<CommissionSettings[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<CommissionSettings | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const loadCommissions = async () => {
    setLoading(true);
    setError(null);
    const { data, error: queryError } = await supabase
      .from("lender_commission_settings")
      .select("id,lender_name,rate,flat_fee_zmw,model,active,effective_from")
      .order("lender_name");
    if (queryError) setError(queryError.message);
    else setCommissions((data ?? []) as CommissionSettings[]);
    setLoading(false);
  };

  useEffect(() => { void loadCommissions(); }, []);

  const startEditing = (index: number) => {
    setEditingIndex(index);
    setEditForm({ ...commissions[index] });
  };

  const cancelEditing = () => {
    setEditingIndex(null);
    setEditForm(null);
  };

  const saveChanges = async () => {
    if (!editForm) return;
    const { error: updateError } = await supabase
      .from("lender_commission_settings")
      .update({ rate: editForm.rate, flat_fee_zmw: editForm.flat_fee_zmw, model: editForm.model, updated_at: new Date().toISOString() })
      .eq("id", editForm.id);
    if (updateError) {
      toast.error(`Unable to save commission settings: ${updateError.message}`);
      return;
    }
    toast.success("Commission settings updated successfully");
    cancelEditing();
    await loadCommissions();
  };

  const openEditDialog = (index: number) => {
    setEditingIndex(index);
    setEditForm({ ...commissions[index] });
    setDialogOpen(true);
  };

  const handleDialogSave = async () => {
    await saveChanges();
    setDialogOpen(false);
  };

  const avgRate = useMemo(() => commissions.length ? commissions.reduce((sum, c) => sum + Number(c.rate), 0) / commissions.length : 0, [commissions]);
  const totalFlatFees = useMemo(() => commissions.reduce((sum, c) => sum + Number(c.flat_fee_zmw), 0), [commissions]);

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Commission Settings</h1>
        <p className="text-sm text-muted-foreground">Configure commission rates and payout models per lender. Settings are persisted in the database.</p>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading commission settings…</div>
          ) : error ? (
            <div className="p-10 text-sm text-destructive">Unable to load commission settings: {error}</div>
          ) : commissions.length === 0 ? (
            <div className="p-10 text-sm text-muted-foreground">No lender commission settings have been configured yet.</div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Lender</TableHead><TableHead>Rate (%)</TableHead><TableHead className="hidden sm:table-cell">Flat Fee (K)</TableHead><TableHead className="hidden md:table-cell">Model</TableHead><TableHead className="hidden lg:table-cell">Effective From</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {commissions.map((c, index) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.lender_name}</TableCell>
                    <TableCell>{editingIndex === index ? <Input type="number" step="0.1" min="0" max="100" value={editForm?.rate ?? 0} onChange={(e) => setEditForm({ ...editForm!, rate: Number(e.target.value) })} className="w-20 h-8" /> : c.rate}</TableCell>
                    <TableCell className="hidden sm:table-cell">{editingIndex === index ? <Input type="number" min="0" value={editForm?.flat_fee_zmw ?? 0} onChange={(e) => setEditForm({ ...editForm!, flat_fee_zmw: Number(e.target.value) })} className="w-24 h-8" /> : `K${Number(c.flat_fee_zmw).toLocaleString()}`}</TableCell>
                    <TableCell className="hidden md:table-cell">{editingIndex === index ? <select value={editForm?.model ?? "Percentage Only"} onChange={(e) => setEditForm({ ...editForm!, model: e.target.value as CommissionSettings["model"] })} className="h-8 px-2 rounded-md border border-input bg-background text-sm"><option>Percentage Only</option><option>Flat Fee Only</option><option>Per Disbursement</option><option>Hybrid</option></select> : c.model}</TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">{c.effective_from || "—"}</TableCell>
                    <TableCell className="text-right">{editingIndex === index ? <div className="flex gap-2 justify-end"><Button size="sm" variant="ghost" onClick={saveChanges}><Save className="h-4 w-4 text-success" /></Button><Button size="sm" variant="ghost" onClick={cancelEditing}><X className="h-4 w-4 text-destructive" /></Button></div> : <Button size="sm" variant="ghost" onClick={() => openEditDialog(index)}><Edit className="h-4 w-4" /></Button>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Configured Lenders</p><p className="text-2xl font-display font-bold">{commissions.length}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Avg Commission Rate</p><p className="text-2xl font-display font-bold">{avgRate.toFixed(2)}%</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Configured Flat Fees</p><p className="text-2xl font-display font-bold">K{totalFlatFees.toLocaleString()}</p></CardContent></Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle>Edit Commission Settings</DialogTitle></DialogHeader>
          {editForm && <div className="space-y-4 py-4"><div className="space-y-2"><Label>Lender</Label><Input value={editForm.lender_name} disabled className="bg-muted" /></div><div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Commission Rate (%)</Label><Input type="number" step="0.1" min="0" max="100" value={editForm.rate} onChange={(e) => setEditForm({ ...editForm, rate: Number(e.target.value) })} /></div><div className="space-y-2"><Label>Flat Fee (K)</Label><Input type="number" min="0" value={editForm.flat_fee_zmw} onChange={(e) => setEditForm({ ...editForm, flat_fee_zmw: Number(e.target.value) })} /></div></div><div className="space-y-2"><Label>Commission Model</Label><select value={editForm.model} onChange={(e) => setEditForm({ ...editForm, model: e.target.value as CommissionSettings["model"] })} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"><option>Percentage Only</option><option>Flat Fee Only</option><option>Per Disbursement</option><option>Hybrid</option></select></div></div>}
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button onClick={handleDialogSave}>Save Changes</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LendersCommission;
