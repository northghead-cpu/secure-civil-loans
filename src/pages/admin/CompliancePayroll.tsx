import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRBAC } from "@/hooks/useRBAC";
import { toast } from "sonner";
import { Link2, RefreshCw, Edit, Trash2, Plus, ToggleRight, ToggleLeft, Loader2 } from "lucide-react";

type IntegrationStatus = "connected" | "error" | "pending" | "disabled";
type IntegrationType = "API" | "CSV Upload" | "Manual";

interface PayrollIntegration {
  id: string;
  employer: string;
  type: IntegrationType;
  status: IntegrationStatus;
  lastSync: string | null;
  employees: number;
  apiEndpoint?: string;
  apiKey?: string;
  notes?: string;
}

const mockIntegrations: PayrollIntegration[] = [
  { id: "1", employer: "Ministry of Education", type: "API", status: "connected", lastSync: "2026-03-11 08:00", employees: 1240, apiEndpoint: "https://api.moe.gov.zm/payroll" },
  { id: "2", employer: "Ministry of Health", type: "API", status: "connected", lastSync: "2026-03-11 08:00", employees: 890, apiEndpoint: "https://api.moh.gov.zm/payroll" },
  { id: "3", employer: "Zambia Police Service", type: "CSV Upload", status: "connected", lastSync: "2026-03-10 14:00", employees: 560 },
  { id: "4", employer: "ZESCO", type: "API", status: "error", lastSync: "2026-03-09 08:00", employees: 340, apiEndpoint: "https://api.zesco.gov.zm/payroll" },
  { id: "5", employer: "Zambia Revenue Authority", type: "Manual", status: "pending", lastSync: null, employees: 0 },
];

const statusColors: Record<IntegrationStatus, string> = {
  connected: "bg-success/10 text-success border-success/20",
  error: "bg-destructive/10 text-destructive border-destructive/20",
  pending: "bg-warning/10 text-warning border-warning/20",
  disabled: "bg-muted/10 text-muted-foreground border-muted-foreground/20",
};

const typeColors: Record<IntegrationType, string> = {
  API: "bg-info/10 text-info",
  "CSV Upload": "bg-amber-500/10 text-amber-600",
  Manual: "bg-muted text-muted-foreground",
};

const CompliancePayroll = () => {
  const { permissions, logAction, hasRole, highestRole } = useRBAC();
  const [integrations, setIntegrations] = useState<PayrollIntegration[]>(mockIntegrations);
  const isSuperAdmin = hasRole("super_admin");
  const [showModal, setShowModal] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<PayrollIntegration | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    employer: "",
    type: "API" as IntegrationType,
    apiEndpoint: "",
    apiKey: "",
    notes: "",
  });

  // Stats
  const stats = {
    total: integrations.length,
    active: integrations.filter((i) => i.status === "connected").length,
    employees: integrations.reduce((sum, i) => sum + i.employees, 0),
    errors: integrations.filter((i) => i.status === "error").length,
  };

  const openAddModal = () => {
    setEditingIntegration(null);
    setFormData({ employer: "", type: "API", apiEndpoint: "", apiKey: "", notes: "" });
    setShowModal(true);
  };

  const openEditModal = (integration: PayrollIntegration) => {
    if (!isSuperAdmin) {
      toast.error("Only Super Admins can edit integrations");
      return;
    }
    setEditingIntegration(integration);
    setFormData({
      employer: integration.employer,
      type: integration.type,
      apiEndpoint: integration.apiEndpoint || "",
      apiKey: integration.apiKey || "",
      notes: integration.notes || "",
    });
    setShowModal(true);
  };

  const toggleIntegrationStatus = async (integration: PayrollIntegration) => {
    if (!isSuperAdmin) {
      toast.error("Only Super Admins can toggle integration status");
      return;
    }
    try {
      const newStatus: IntegrationStatus = integration.status === "disabled" ? "pending" : "disabled";
      await logAction(
        "toggle_integration_status",
        integration.id,
        "payroll_integrations",
        { status: integration.status },
        { status: newStatus }
      );
      setIntegrations((prev) =>
        prev.map((i) => (i.id === integration.id ? { ...i, status: newStatus } : i))
      );
      toast.success(`Integration ${newStatus === "disabled" ? "disabled" : "enabled"}`);
    } catch (error) {
      toast.error("Failed to update integration status");
    }
  };

  const deleteIntegration = async (integration: PayrollIntegration) => {
    if (!isSuperAdmin) {
      toast.error("Only Super Admins can delete integrations");
      return;
    }
    if (!confirm(`Are you sure you want to delete the integration for ${integration.employer}?`)) {
      return;
    }
    try {
      await logAction(
        "delete_integration",
        integration.id,
        "payroll_integrations",
        integration,
        null
      );
      setIntegrations((prev) => prev.filter((i) => i.id !== integration.id));
      toast.success("Integration deleted successfully");
    } catch (error) {
      toast.error("Failed to delete integration");
    }
  };

  const handleSave = async () => {
    if (!formData.employer) {
      toast.error("Please enter the employer name");
      return;
    }
    
    setSaving(true);
    try {
      if (editingIntegration) {
        // Update existing
        const updated: PayrollIntegration = {
          ...editingIntegration,
          ...formData,
        };
        await logAction(
          "update_integration",
          editingIntegration.id,
          "payroll_integrations",
          editingIntegration,
          updated
        );
        setIntegrations((prev) =>
          prev.map((i) => (i.id === editingIntegration.id ? updated : i))
        );
        toast.success("Integration updated successfully");
      } else {
        // Add new
        const newIntegration: PayrollIntegration = {
          id: `int_${Date.now()}`,
          employer: formData.employer,
          type: formData.type,
          status: "pending",
          lastSync: null,
          employees: 0,
          apiEndpoint: formData.type === "API" ? formData.apiEndpoint : undefined,
          apiKey: formData.type === "API" ? formData.apiKey : undefined,
          notes: formData.notes,
        };
        await logAction("add_integration", newIntegration.id, "payroll_integrations", null, newIntegration);
        setIntegrations((prev) => [...prev, newIntegration]);
        toast.success("Integration added successfully");
      }
      setShowModal(false);
    } catch (error) {
      toast.error("Failed to save integration");
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async (integration: PayrollIntegration) => {
    if (!isSuperAdmin) {
      toast.error("Only Super Admins can test connections");
      return;
    }
    toast.loading("Testing connection...", { id: "test-connection" });
    try {
      // Simulate API test
      await new Promise((resolve) => setTimeout(resolve, 2000));
      toast.success("Connection successful!", { id: "test-connection" });
      await logAction("test_integration", integration.id, "payroll_integrations", null, { tested: true });
    } catch (error) {
      toast.error("Connection failed", { id: "test-connection" });
    }
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Payroll Integration</h1>
          <p className="text-sm text-muted-foreground">
            Manage employer payroll connections for salary verification
            {isSuperAdmin && <span className="ml-2 text-xs text-primary">(Super Admin: Full Access)</span>}
          </p>
        </div>
        {isSuperAdmin && (
          <Button onClick={openAddModal}>
            <Plus className="w-4 h-4 mr-1" /> Add Integration
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-display font-bold text-foreground">{stats.total}</div>
            <p className="text-sm text-muted-foreground">Total Integrations</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-display font-bold text-success">{stats.active}</div>
            <p className="text-sm text-muted-foreground">Active Connections</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-display font-bold text-foreground">{stats.employees.toLocaleString()}</div>
            <p className="text-sm text-muted-foreground">Employees Covered</p>
          </CardContent>
        </Card>
        {stats.errors > 0 && (
          <Card className="border-destructive/50">
            <CardContent className="pt-6">
              <div className="text-2xl font-display font-bold text-destructive">{stats.errors}</div>
              <p className="text-sm text-muted-foreground">Connection Errors</p>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employer</TableHead>
                <TableHead className="hidden sm:table-cell">Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Last Sync</TableHead>
                <TableHead className="hidden sm:table-cell">Employees</TableHead>
                {isSuperAdmin && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {integrations.map((i) => (
                <TableRow key={i.id} className={i.status === "error" ? "bg-destructive/5" : ""}>
                  <TableCell className="font-medium">{i.employer}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge className={typeColors[i.type]}>{i.type}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[i.status]}>{i.status}</Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{i.lastSync || "—"}</TableCell>
                  <TableCell className="hidden sm:table-cell">{i.employees.toLocaleString()}</TableCell>
                  {isSuperAdmin && (
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => testConnection(i)} title="Test Connection">
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openEditModal(i)} title="Edit">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => toggleIntegrationStatus(i)} title={i.status === "disabled" ? "Enable" : "Disable"}>
                          {i.status === "disabled" ? (
                            <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ToggleRight className="h-4 w-4 text-success" />
                          )}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteIntegration(i)} title="Delete" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
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

      {/* Super Admin Integration Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingIntegration ? "Edit Integration" : "Add New Integration"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="employer">Employer Name *</Label>
              <Input
                id="employer"
                value={formData.employer}
                onChange={(e) => setFormData((p) => ({ ...p, employer: e.target.value }))}
                placeholder="e.g. Ministry of Education"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="type">Integration Type *</Label>
              <select
                id="type"
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={formData.type}
                onChange={(e) => setFormData((p) => ({ ...p, type: e.target.value as IntegrationType }))}
              >
                <option value="API">API Integration</option>
                <option value="CSV Upload">CSV Upload</option>
                <option value="Manual">Manual</option>
              </select>
            </div>

            {formData.type === "API" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="apiEndpoint">API Endpoint URL</Label>
                  <Input
                    id="apiEndpoint"
                    type="url"
                    value={formData.apiEndpoint}
                    onChange={(e) => setFormData((p) => ({ ...p, apiEndpoint: e.target.value }))}
                    placeholder="https://api.employer.gov.zm/payroll"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apiKey">API Key / Token</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    value={formData.apiKey}
                    onChange={(e) => setFormData((p) => ({ ...p, apiKey: e.target.value }))}
                    placeholder="Enter API key"
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.notes}
                onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Additional notes about this integration..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingIntegration ? "Update" : "Add Integration"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CompliancePayroll;
