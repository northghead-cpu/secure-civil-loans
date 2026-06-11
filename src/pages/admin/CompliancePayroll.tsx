import { useState, useEffect } from "react";
import { useRBAC } from "@/hooks/useRBAC";
import { edgeFunctionService } from "@/services/edgeFunctionService";
import { AdminHero, AdminPageShell, adminCardClass } from "@/components/admin/AdminPageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Link2, Plus, AlertCircle, Loader2, Trash2, TestTubes } from "lucide-react";
import { toast } from "sonner";

type IntegrationType = "API" | "CSV Upload" | "Manual";
type IntegrationStatus = "connected" | "error" | "pending" | "disabled";

interface PayrollIntegration {
  id: string;
  provider_name: string;
  api_endpoint: string | null;
  status: "active" | "inactive";
  created_at: string;
  created_by?: string;
}

const statusColors: Record<string, string> = {
  active: "bg-success/10 text-success border-success/20",
  inactive: "bg-warning/10 text-warning border-warning/20",
  error: "bg-destructive/10 text-destructive border-destructive/20",
};

const CompliancePayroll = () => {
  const { permissions, hasRole } = useRBAC();
  const [integrations, setIntegrations] = useState<PayrollIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  const isSuperAdmin = hasRole("super_admin");

  const [formData, setFormData] = useState({
    provider_name: "",
    api_endpoint: "",
  });

  useEffect(() => {
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    if (!isSuperAdmin) {
      setLoading(false);
      return;
    }

    try {
      const result = await edgeFunctionService.listPayrollIntegrations();
      setIntegrations(result);
    } catch (err) {
      console.error("Failed to load integrations:", err);
      toast.error("Failed to load payroll integrations");
    } finally {
      setLoading(false);
    }
  };

  const handleAddIntegration = async () => {
    if (!formData.provider_name || !formData.api_endpoint) {
      toast.error("Please fill in all fields");
      return;
    }

    setSaving(true);
    try {
      await edgeFunctionService.createPayrollIntegration(
        formData.provider_name,
        formData.api_endpoint,
        "inactive"
      );
      toast.success("Integration created successfully");
      setFormData({ provider_name: "", api_endpoint: "" });
      setShowModal(false);
      await loadIntegrations();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create integration";
      console.error("Create error:", err);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async (integration: PayrollIntegration) => {
    setTesting(integration.id);
    try {
      await edgeFunctionService.testPayrollConnection(integration.api_endpoint || "");
      toast.success("Connection test successful");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Connection test failed";
      console.error("Test error:", err);
      toast.error(message);
    } finally {
      setTesting(null);
    }
  };

  const handleDeleteIntegration = async (id: string) => {
    if (!confirm("Are you sure you want to delete this integration?")) return;

    try {
      await edgeFunctionService.deletePayrollIntegration(id);
      toast.success("Integration deleted successfully");
      await loadIntegrations();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete integration";
      console.error("Delete error:", err);
      toast.error(message);
    }
  };

  const handleToggleStatus = async (integration: PayrollIntegration) => {
    const newStatus = integration.status === "active" ? "inactive" : "active";
    try {
      await edgeFunctionService.updatePayrollIntegration(integration.id, { status: newStatus });
      toast.success(`Integration ${newStatus}`);
      await loadIntegrations();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update integration";
      console.error("Update error:", err);
      toast.error(message);
    }
  };

  if (loading) {
    return (
      <AdminPageShell>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </AdminPageShell>
    );
  }

  if (!isSuperAdmin) {
    return (
      <AdminPageShell>
        <Card className={adminCardClass}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-destructive">
              <AlertCircle className="w-5 h-5" />
              <p>You don't have permission to manage payroll integrations.</p>
            </div>
          </CardContent>
        </Card>
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell>
      <AdminHero
        title="Payroll Integration"
        description="Manage secure connections to payroll providers (API credentials stored server-side)"
      />

      <div className="space-y-6 max-w-5xl">
        {/* Security Notice */}
        <Card className="border-info/20 bg-info/5">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <div className="text-info text-lg">🔒</div>
              <div>
                <p className="text-sm font-medium text-foreground">Secure Configuration</p>
                <p className="text-sm text-muted-foreground mt-1">
                  All payroll provider API keys and credentials are stored securely on the server via Edge Functions.
                  Your frontend never sees these sensitive values.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Add Integration Button */}
        <div className="flex justify-end">
          <Dialog open={showModal} onOpenChange={setShowModal}>
            <DialogTrigger asChild>
              <Button className="h-11">
                <Plus className="w-4 h-4 mr-2" /> Add Integration
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Payroll Integration</DialogTitle>
                <DialogDescription>
                  Connect a new payroll provider. API credentials will be stored securely on the server.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="provider">Provider Name</Label>
                  <Input
                    id="provider"
                    placeholder="e.g., Ministry of Education"
                    value={formData.provider_name}
                    onChange={(e) => setFormData({ ...formData, provider_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endpoint">API Endpoint URL</Label>
                  <Input
                    id="endpoint"
                    type="url"
                    placeholder="https://api.provider.com/v1/payroll"
                    value={formData.api_endpoint}
                    onChange={(e) => setFormData({ ...formData, api_endpoint: e.target.value })}
                  />
                </div>
                <Button
                  onClick={handleAddIntegration}
                  disabled={saving}
                  className="w-full"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Create Integration
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Integrations Table */}
        <Card className={adminCardClass}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="w-4 h-4" /> Active Integrations
            </CardTitle>
          </CardHeader>
          <CardContent>
            {integrations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No payroll integrations configured yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Provider</TableHead>
                      <TableHead>Endpoint</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {integrations.map((integration) => (
                      <TableRow key={integration.id}>
                        <TableCell className="font-medium">{integration.provider_name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground truncate max-w-xs">
                          {integration.api_endpoint}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[integration.status]}>
                            {integration.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleTestConnection(integration)}
                            disabled={testing === integration.id}
                          >
                            {testing === integration.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <TestTubes className="w-3 h-3" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleToggleStatus(integration)}
                          >
                            {integration.status === "active" ? "Disable" : "Enable"}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteIntegration(integration.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminPageShell>
  );
};

export default CompliancePayroll;
