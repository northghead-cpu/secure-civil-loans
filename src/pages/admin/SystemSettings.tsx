import { useState, useEffect } from "react";
import { useRBAC } from "@/hooks/useRBAC";
import { edgeFunctionService } from "@/services/edgeFunctionService";
import { AdminHero, AdminPageShell, adminCardClass } from "@/components/admin/AdminPageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Bell, Globe, Key, Shield, Loader2, Save, Wallet, Building2, Link2, Clock } from "lucide-react";
import { toast } from "sonner";

const SystemSettings = () => {
  const { permissions } = useRBAC();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [platformName, setPlatformName] = useState("Riverbanc");
  const [supportEmail, setSupportEmail] = useState("support@riverbank.co.zm");
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [ipWhitelisting, setIpWhitelisting] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState(30);

  const canEditSettings = permissions.canChangeSystemSettings;

  // Load settings from Edge Function on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    if (!canEditSettings) {
      setLoading(false);
      return;
    }
    
    try {
      const settings = await edgeFunctionService.getAdminSettings();
      if (settings.platform_name) setPlatformName(settings.platform_name as string);
      if (settings.support_email) setSupportEmail(settings.support_email as string);
      if (settings.session_timeout_minutes) setSessionTimeout(settings.session_timeout_minutes as number);
      if (settings.ip_whitelist_enabled !== undefined) setIpWhitelisting(settings.ip_whitelist_enabled as boolean);
      if (settings.maintenance_mode !== undefined) setMaintenanceMode(settings.maintenance_mode as boolean);
    } catch (err) {
      console.error("Failed to load settings:", err);
      toast.error("Failed to load admin settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!canEditSettings) {
      toast.error("You don't have permission to change settings");
      return;
    }

    setSaving(true);
    try {
      // Save settings via Edge Function (server-side, encrypted)
      await Promise.all([
        edgeFunctionService.setAdminSetting("platform_name", platformName),
        edgeFunctionService.setAdminSetting("support_email", supportEmail),
        edgeFunctionService.setAdminSetting("session_timeout_minutes", sessionTimeout),
        edgeFunctionService.setAdminSetting("ip_whitelist_enabled", ipWhitelisting),
        edgeFunctionService.setAdminSetting("maintenance_mode", maintenanceMode),
      ]);
      
      toast.success("Settings saved successfully");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save settings";
      console.error("Save error:", err);
      toast.error(message);
    } finally {
      setSaving(false);
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

  return (
    <AdminPageShell>
      <AdminHero title="System Settings" description="Configure platform-wide settings and integrations" />

      <div className="space-y-6 max-w-5xl">
        {/* Platform Settings */}
        <Card className={adminCardClass}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-display">
              <Globe className="h-4 w-4" /> Platform Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="platformName">Platform Name</Label>
              <Input
                id="platformName"
                value={platformName}
                onChange={(e) => setPlatformName(e.target.value)}
                disabled={!canEditSettings}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supportEmail">Support Email</Label>
              <Input
                id="supportEmail"
                type="email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                disabled={!canEditSettings}
              />
            </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card className={adminCardClass}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-display">
              <Shield className="h-4 w-4" /> Security Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Maintenance Mode</Label>
                <p className="text-xs text-muted-foreground">Temporarily disable access for all non-admin users</p>
              </div>
              <Switch
                checked={maintenanceMode}
                onCheckedChange={setMaintenanceMode}
                disabled={!canEditSettings}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>IP Whitelisting</Label>
                <p className="text-xs text-muted-foreground">Restrict admin access to specific IP addresses</p>
              </div>
              <Switch
                checked={ipWhitelisting}
                onCheckedChange={setIpWhitelisting}
                disabled={!canEditSettings}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sessionTimeout">Session Timeout (minutes)</Label>
              <Input
                id="sessionTimeout"
                type="number"
                value={sessionTimeout}
                onChange={(e) => setSessionTimeout(parseInt(e.target.value) || 30)}
                className="w-32"
                disabled={!canEditSettings}
              />
            </div>
          </CardContent>
        </Card>

        {/* Secure API Keys - Stored Server-Side */}
        <Card className={adminCardClass}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-display">
              <Key className="h-4 w-4" /> Secure API Keys (Server-Managed)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-info/10 border border-info/20 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">
                🔒 <strong>All sensitive API keys are stored securely on the server.</strong>
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                To update TransUnion CRB, Payroll Provider, or other sensitive credentials, contact your DevOps team to update environment variables.
              </p>
            </div>
            <div className="space-y-3">
              <div className="p-3 bg-muted/30 rounded border border-border/50">
                <p className="text-sm font-medium text-foreground">TransUnion CRB API</p>
                <p className="text-xs text-muted-foreground">Configured via CRB_API_KEY environment variable</p>
              </div>
              <div className="p-3 bg-muted/30 rounded border border-border/50">
                <p className="text-sm font-medium text-foreground">Payroll Provider API</p>
                <p className="text-xs text-muted-foreground">Configured via PAYROLL_API_KEY environment variable</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            onClick={handleSave}
            disabled={!canEditSettings || saving}
            className="h-11"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save Settings
          </Button>
          <Button
            onClick={loadSettings}
            variant="outline"
            disabled={!canEditSettings}
            className="h-11"
          >
            Reset
          </Button>
        </div>
      </div>
    </AdminPageShell>
  );
};

export default SystemSettings;
