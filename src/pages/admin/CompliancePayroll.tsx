import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRBAC } from "@/hooks/useRBAC";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { RefreshCw, Edit, Trash2, Plus, ToggleRight, ToggleLeft, Loader2 } from "lucide-react";
import { payrollService, type PayrollIntegration } from "@/services/payrollService";

type IntegrationStatus = "active" | "inactive";
type IntegrationType = "API" | "CSV Upload" | "Manual";

type PayrollConfig = { type?: IntegrationType; employees?: number; lastSync?: string; notes?: string };

const statusColors: Record<IntegrationStatus, string> = {
  active: "bg-success/10 text-success border-success/20",
  inactive: "bg-muted/10 text-muted-foreground border-muted-foreground/20",
};

const CompliancePayroll = () => {
  const { hasRole, logAction } = useRBAC();
  const { user } = useAuth();
  const isSuperAdmin = hasRole("super_admin");
  const [integrations, setIntegrations] = useState<PayrollIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<PayrollIntegration | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ providerName: "", type: "API" as IntegrationType, apiEndpoint: "", notes: "", employees: "" });

  const loadIntegrations = async () => {
    setLoading(true);
    setError(null);
    try {
      setIntegrations(await payrollService.list());
    } catch (queryError) {
      setError(queryError instanceof Error ? queryError.message : "Unable to load payroll integrations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadIntegrations(); }, []);

  const getMeta = (integration: PayrollIntegration) => {
    const config = (integration.config ?? {}) as PayrollConfig;
    return {
      type: config.type ?? "API",
      employees: typeof config.employees === "number" ? config.employees : 0,
      lastSync: typeof config.lastSync === "string" ? config.lastSync : null,
      notes: typeof config.notes === "string" ? config.notes : "",
    };
  };

  const stats = useMemo(() => ({
    total: integrations.length,
    active: integrations.filter((i) => i.status === "active").length,
    employees: integrations.reduce((sum, i) => sum + getMeta(i).employees, 0),
    inactive: integrations.filter((i) => i.status === "inactive").length,
  }), [integrations]);

  const openAddModal = () => {
    setEditingIntegration(null);
    setFormData({ providerName: "", type: "API", apiEndpoint: "", notes: "", employees: "" });
    setShowModal(true);
  };

  const openEditModal = (integration: PayrollIntegration) => {
    if (!isSuperAdmin) return toast.error("Only Super Admins can edit integrations");
    const meta = getMeta(integration);
    setEditingIntegration(integration);
    setFormData({ providerName: integration.provider_name, type: meta.type, apiEndpoint: integration.api_endpoint ?? "", notes: meta.notes, employees: String(meta.employees || "") });
    setShowModal(true);
  };

  const saveIntegration = async () => {
    if (!isSuperAdmin) return toast.error("Only Super Admins can manage integrations");
    if (!formData.providerName.trim()) return toast.error("Provider name is required");
    if (!user) return toast.error("You must be signed in to manage integrations");
    setSaving(true);
    try {
      const config = { type: formData.type, notes: formData.notes, employees: Number(formData.employees || 0) };
      const payload = { provider_name: formData.providerName.trim(), api_endpoint: formData.type === "API" ? formData.apiEndpoint.trim() || null : null, config };
      const saved = editingIntegration
        ? await payrollService.update(editingIntegration.id, payload)
        : await payrollService.create({ ...payload, status: "inactive" }, user.id);
      await logAction(editingIntegration ? "update_payroll_integration" : "add_payroll_integration", saved.id, "payroll_integrations", editingIntegration, saved);
      toast.success(editingIntegration ? "Integration updated" : "Integration added as inactive");
      setShowModal(false);
      await loadIntegrations();
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Unable to save integration");
    } finally {
      setSaving(false);
    }
  };

  const toggleIntegration = async (integration: PayrollIntegration) => {
    if (!isSuperAdmin) return toast.error("Only Super Admins can change integration status");
    try {
      const updated = await payrollService.toggleStatus(integration.id, integration.status);
      await logAction("toggle_payroll_integration", integration.id, "payroll_integrations", { status: integration.status }, { status: updated.status });
      await loadIntegrations();
    } catch (toggleError) {
      toast.error(toggleError instanceof Error ? toggleError.message : "Unable to change integration status");
    }
  };

  const deleteIntegration = async (integration: PayrollIntegration) => {
    if (!isSuperAdmin) return toast.error("Only Super Admins can delete integrations");
    if (!confirm(`Delete the ${integration.provider_name} payroll integration?`)) return;
    try {
      await payrollService.remove(integration.id);
      await logAction("delete_payroll_integration", integration.id, "payroll_integrations", integration, null);
      toast.success("Integration deleted");
      await loadIntegrations();
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : "Unable to delete integration");
    }
  };

  const testConnection = async () => {
    if (!isSuperAdmin) return toast.error("Only Super Admins can test connections");
    toast.info("Connection testing requires a configured payroll provider endpoint; no simulated success is reported.");
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><div><h1 className="text-2xl font-display font-bold text-foreground">Payroll Integration</h1><p className="text-sm text-muted-foreground">Manage recorded employer payroll connections for salary verification.</p></div>{isSuperAdmin && <Button onClick={openAddModal}><Plus className="w-4 h-4 mr-1" /> Add Integration</Button>}</div>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4"><Card><CardContent className="pt-6"><div className="text-2xl font-display font-bold">{stats.total}</div><p className="text-sm text-muted-foreground">Total Integrations</p></CardContent></Card><Card><CardContent className="pt-6"><div className="text-2xl font-display font-bold text-success">{stats.active}</div><p className="text-sm text-muted-foreground">Active Connections</p></CardContent></Card><Card><CardContent className="pt-6"><div className="text-2xl font-display font-bold">{stats.employees.toLocaleString()}</div><p className="text-sm text-muted-foreground">Employees Covered</p></CardContent></Card><Card><CardContent className="pt-6"><div className="text-2xl font-display font-bold text-muted-foreground">{stats.inactive}</div><p className="text-sm text-muted-foreground">Inactive Connections</p></CardContent></Card></div>
      <Card><CardContent className="p-0 overflow-x-auto">{loading ? <div className="flex justify-center items-center gap-2 p-10 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading integrations…</div> : error ? <div className="p-10 text-sm text-destructive">Unable to load integrations: {error}</div> : integrations.length === 0 ? <div className="p-10 text-sm text-muted-foreground">No payroll integrations have been configured yet.</div> : <Table><TableHeader><TableRow><TableHead>Provider</TableHead><TableHead className="hidden sm:table-cell">Type</TableHead><TableHead>Status</TableHead><TableHead className="hidden md:table-cell">Last Sync</TableHead><TableHead className="hidden sm:table-cell">Employees</TableHead>{isSuperAdmin && <TableHead className="text-right">Actions</TableHead>}</TableRow></TableHeader><TableBody>{integrations.map((integration) => { const meta = getMeta(integration); return <TableRow key={integration.id}><TableCell className="font-medium">{integration.provider_name}</TableCell><TableCell className="hidden sm:table-cell"><Badge variant="secondary">{meta.type}</Badge></TableCell><TableCell><Badge className={statusColors[integration.status]}>{integration.status}</Badge></TableCell><TableCell className="hidden md:table-cell text-muted-foreground">{meta.lastSync || "—"}</TableCell><TableCell className="hidden sm:table-cell">{meta.employees.toLocaleString()}</TableCell>{isSuperAdmin && <TableCell className="text-right"><div className="flex gap-1 justify-end"><Button size="sm" variant="ghost" onClick={() => void testConnection()} title="Test Connection"><RefreshCw className="h-4 w-4" /></Button><Button size="sm" variant="ghost" onClick={() => openEditModal(integration)}><Edit className="h-4 w-4" /></Button><Button size="sm" variant="ghost" onClick={() => void toggleIntegration(integration)}>{integration.status === "inactive" ? <ToggleLeft className="h-4 w-4" /> : <ToggleRight className="h-4 w-4 text-success" />}</Button><Button size="sm" variant="ghost" onClick={() => void deleteIntegration(integration)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button></div></TableCell>}</TableRow>; })}</TableBody></Table>}</CardContent></Card>
      <Dialog open={showModal} onOpenChange={setShowModal}><DialogContent className="sm:max-w-[500px]"><DialogHeader><DialogTitle>{editingIntegration ? "Edit Integration" : "Add New Integration"}</DialogTitle></DialogHeader><div className="space-y-4 py-4"><div className="space-y-2"><Label>Provider Name *</Label><Input value={formData.providerName} onChange={(e) => setFormData((p) => ({ ...p, providerName: e.target.value }))} /></div><div className="space-y-2"><Label>Integration Type *</Label><select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={formData.type} onChange={(e) => setFormData((p) => ({ ...p, type: e.target.value as IntegrationType }))}><option>API</option><option>CSV Upload</option><option>Manual</option></select></div>{formData.type === "API" && <div className="space-y-2"><Label>API Endpoint URL</Label><Input type="url" value={formData.apiEndpoint} onChange={(e) => setFormData((p) => ({ ...p, apiEndpoint: e.target.value }))} /></div>}<div className="space-y-2"><Label>Employees Covered</Label><Input type="number" min="0" value={formData.employees} onChange={(e) => setFormData((p) => ({ ...p, employees: e.target.value }))} /></div><div className="space-y-2"><Label>Notes</Label><textarea className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm" value={formData.notes} onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))} /></div></div><DialogFooter><Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button><Button onClick={() => void saveIntegration()} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Save</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
};

export default CompliancePayroll;
