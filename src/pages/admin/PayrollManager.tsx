import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, ToggleLeft, ToggleRight, Loader2, Link2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useRBAC } from "@/hooks/useRBAC";
import { payrollService, type PayrollIntegrationInput } from "@/services/payrollService";
import { isFeatureEnabled } from "@/config/features";

const PayrollManager = () => {
  const { user } = useAuth();
  const { hasRole, logAction } = useRBAC();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PayrollIntegrationInput>({ provider_name: "", api_endpoint: "", status: "active" });

  const isSuperAdmin = hasRole("super_admin");

  if (!isFeatureEnabled("enableAdminControls")) {
    return <div className="p-6 text-muted-foreground">This feature is currently disabled.</div>;
  }

  if (!isSuperAdmin) {
    return <div className="p-6 text-destructive font-medium">Access denied — Super Admin only.</div>;
  }

  const { data: integrations = [], isLoading } = useQuery({
    queryKey: ["payroll-integrations"],
    queryFn: () => payrollService.list(),
  });

  const saveMutation = useMutation({
    mutationFn: async (input: PayrollIntegrationInput) => {
      if (editingId) return payrollService.update(editingId, input);
      return payrollService.create(input, user!.id);
    },
    onSuccess: (integration) => {
      const action = editingId ? "payroll_integration_updated" : "payroll_integration_created";
      logAction(action, integration.id, "payroll_integrations", null, integration);
      queryClient.invalidateQueries({ queryKey: ["payroll-integrations"] });
      toast.success(editingId ? "Integration updated" : "Integration created");
      closeDialog();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      payrollService.toggleStatus(id, status),
    onSuccess: (integration) => {
      logAction("payroll_integration_toggled", integration.id, "payroll_integrations", null, { status: integration.status });
      queryClient.invalidateQueries({ queryKey: ["payroll-integrations"] });
      toast.success(`Integration ${integration.status === "active" ? "enabled" : "disabled"}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setForm({ provider_name: "", api_endpoint: "", status: "active" });
  };

  const openEdit = (p: { id: string; provider_name: string; api_endpoint: string | null; status: string }) => {
    setEditingId(p.id);
    setForm({ provider_name: p.provider_name, api_endpoint: p.api_endpoint ?? "", status: p.status as "active" | "inactive" });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.provider_name.trim()) { toast.error("Provider name is required"); return; }
    saveMutation.mutate(form);
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-foreground">Payroll Manager</h1>
          <p className="text-sm text-muted-foreground">Manage payroll provider integrations</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Add Integration
        </Button>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : integrations.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground">No integrations configured.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead className="hidden sm:table-cell">API Endpoint</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {integrations.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Link2 className="h-4 w-4 text-muted-foreground" />
                        {i.provider_name}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell font-mono text-xs max-w-[200px] truncate">{i.api_endpoint || "—"}</TableCell>
                    <TableCell>
                      <Badge className={i.status === "active" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}>
                        {i.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(i)}><Edit className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => toggleMutation.mutate({ id: i.id, status: i.status })}>
                          {i.status === "active" ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
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
          <DialogHeader><DialogTitle>{editingId ? "Edit Integration" : "New Integration"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Provider Name</Label><Input value={form.provider_name} onChange={(e) => setForm({ ...form, provider_name: e.target.value })} /></div>
            <div><Label>API Endpoint</Label><Input value={form.api_endpoint ?? ""} onChange={(e) => setForm({ ...form, api_endpoint: e.target.value })} placeholder="https://..." /></div>
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

export default PayrollManager;
