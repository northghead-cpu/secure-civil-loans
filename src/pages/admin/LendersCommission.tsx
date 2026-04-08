import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit, Save, X } from "lucide-react";
import { toast } from "sonner";

interface CommissionSettings {
  lender: string;
  rate: string;
  flat: string;
  model: string;
  lastPayout: string;
  nextPayout: string;
}

const LendersCommission = () => {
  const [commissions, setCommissions] = useState<CommissionSettings[]>([
    { lender: "Stanbic Bank", rate: "2.5", flat: "50", model: "Per Disbursement", lastPayout: "K12,400", nextPayout: "2026-04-01" },
    { lender: "Zanaco", rate: "3.0", flat: "0", model: "Percentage Only", lastPayout: "K8,900", nextPayout: "2026-04-01" },
    { lender: "FNB Zambia", rate: "2.0", flat: "75", model: "Hybrid", lastPayout: "K5,200", nextPayout: "2026-04-01" },
    { lender: "Atlas Mara", rate: "2.8", flat: "0", model: "Percentage Only", lastPayout: "K6,700", nextPayout: "2026-04-01" },
    { lender: "Indo Zambia", rate: "2.2", flat: "30", model: "Hybrid", lastPayout: "K3,100", nextPayout: "2026-04-01" },
  ]);

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<CommissionSettings | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const startEditing = (index: number) => {
    setEditingIndex(index);
    setEditForm({ ...commissions[index] });
  };

  const cancelEditing = () => {
    setEditingIndex(null);
    setEditForm(null);
  };

  const saveChanges = (index: number) => {
    if (!editForm) return;
    
    const updated = [...commissions];
    updated[index] = {
      ...editForm,
      rate: editForm.rate,
      flat: editForm.flat,
    };
    setCommissions(updated);
    setEditingIndex(null);
    setEditForm(null);
    toast.success("Commission settings updated successfully");
  };

  const openEditDialog = (index: number) => {
    setEditingIndex(index);
    setEditForm({ ...commissions[index] });
    setDialogOpen(true);
  };

  const handleDialogSave = () => {
    if (!editForm || editingIndex === null) return;
    
    const updated = [...commissions];
    updated[editingIndex] = { ...editForm };
    setCommissions(updated);
    setDialogOpen(false);
    setEditingIndex(null);
    setEditForm(null);
    toast.success("Commission settings updated successfully");
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Commission Settings</h1>
        <p className="text-sm text-muted-foreground">Configure commission rates and payout models per lender</p>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lender</TableHead>
                <TableHead>Rate (%)</TableHead>
                <TableHead className="hidden sm:table-cell">Flat Fee (K)</TableHead>
                <TableHead className="hidden md:table-cell">Model</TableHead>
                <TableHead className="hidden lg:table-cell">Last Payout</TableHead>
                <TableHead className="hidden lg:table-cell">Next Payout</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {commissions.map((c, index) => (
                <TableRow key={c.lender}>
                  <TableCell className="font-medium">{c.lender}</TableCell>
                  <TableCell>
                    {editingIndex === index ? (
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={editForm?.rate || ""}
                        onChange={(e) => setEditForm({ ...editForm!, rate: e.target.value })}
                        className="w-20 h-8"
                      />
                    ) : (
                      c.rate
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {editingIndex === index ? (
                      <Input
                        type="number"
                        min="0"
                        value={editForm?.flat || ""}
                        onChange={(e) => setEditForm({ ...editForm!, flat: e.target.value })}
                        className="w-20 h-8"
                      />
                    ) : (
                      `K${c.flat}`
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {editingIndex === index ? (
                      <select
                        value={editForm?.model || ""}
                        onChange={(e) => setEditForm({ ...editForm!, model: e.target.value })}
                        className="h-8 px-2 rounded-md border border-input bg-background text-sm"
                      >
                        <option value="Percentage Only">Percentage Only</option>
                        <option value="Flat Fee Only">Flat Fee Only</option>
                        <option value="Per Disbursement">Per Disbursement</option>
                        <option value="Hybrid">Hybrid</option>
                      </select>
                    ) : (
                      c.model
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">{c.lastPayout}</TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">{c.nextPayout}</TableCell>
                  <TableCell className="text-right">
                    {editingIndex === index ? (
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => saveChanges(index)}>
                          <Save className="h-4 w-4 text-success" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelEditing}>
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => startEditing(index)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Summary Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Lenders</p>
            <p className="text-2xl font-display font-bold">{commissions.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Avg Commission Rate</p>
            <p className="text-2xl font-display font-bold">
              {(commissions.reduce((acc, c) => acc + parseFloat(c.rate), 0) / commissions.length).toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Flat Fees</p>
            <p className="text-2xl font-display font-bold">
              K{commissions.reduce((acc, c) => acc + parseFloat(c.flat), 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Commission Settings</DialogTitle>
          </DialogHeader>
          {editForm && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Lender</Label>
                <Input value={editForm.lender} disabled className="bg-muted" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Commission Rate (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={editForm.rate}
                    onChange={(e) => setEditForm({ ...editForm, rate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Flat Fee (K)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={editForm.flat}
                    onChange={(e) => setEditForm({ ...editForm, flat: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Commission Model</Label>
                <select
                  value={editForm.model}
                  onChange={(e) => setEditForm({ ...editForm, model: e.target.value })}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="Percentage Only">Percentage Only</option>
                  <option value="Flat Fee Only">Flat Fee Only</option>
                  <option value="Per Disbursement">Per Disbursement</option>
                  <option value="Hybrid">Hybrid</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Last Payout</Label>
                  <Input value={editForm.lastPayout} disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>Next Payout</Label>
                  <Input value={editForm.nextPayout} disabled className="bg-muted" />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleDialogSave}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LendersCommission;
