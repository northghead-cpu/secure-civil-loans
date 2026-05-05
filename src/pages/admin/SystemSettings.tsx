import { useState } from "react";
import { useRBAC } from "@/hooks/useRBAC";
import { AdminHero, AdminPageShell, adminCardClass } from "@/components/admin/AdminPageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Bell, Globe, Key, Shield, Loader2, Save, Wallet, Building2, Link2, Clock } from "lucide-react";
import { toast } from "sonner";

const SystemSettings = () => {
  const { permissions, logAction } = useRBAC();
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [platformName, setPlatformName] = useState("Riverbanc");
  const [supportEmail, setSupportEmail] = useState("support@riverbank.co.zm");
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [twoFactorAuth, setTwoFactorAuth] = useState(true);
  const [ipWhitelisting, setIpWhitelisting] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState(30);
  const [crbApiKey, setCrbApiKey] = useState("************");
  const [smsApiKey, setSmsApiKey] = useState("************");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(true);
  const [slackAlerts, setSlackAlerts] = useState(false);

  const canEditSettings = permissions.canChangeSystemSettings;

  const handleSave = async () => {
    if (!canEditSettings) {
      toast.error("You don't have permission to change system settings");
      return;
    }
    setSaving(true);
    try {
      // Log the action
      await logAction("update_system_settings", undefined, "system_settings", null, {
        platformName,
        supportEmail,
        maintenanceMode,
        twoFactorAuth,
        ipWhitelisting,
        sessionTimeout,
        emailNotifications,
        smsNotifications,
        slackAlerts,
      });
      toast.success("Settings saved successfully");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminPageShell className="max-w-5xl">
      <AdminHero
        badge={canEditSettings ? "Super admin" : "Read only"}
        title="Platform-wide controls for security, notifications, and core integrations"
        description="Adjust the operating envelope for the admin workspace without burying high-impact settings inside generic forms."
        stats={[
          { label: "Configuration areas", value: "4", meta: "General, security, keys, and notifications" },
          { label: "Security defaults", value: "2FA on", meta: "Admin access hardened by default" },
        ]}
      />

      <Card className={adminCardClass}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-display">
            <Globe className="h-4 w-4" /> General
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
          <div className="flex items-center justify-between">
            <div>
              <Label>Maintenance Mode</Label>
              <p className="text-xs text-muted-foreground">Disable public access temporarily</p>
            </div>
            <Switch 
              checked={maintenanceMode} 
              onCheckedChange={setMaintenanceMode}
              disabled={!canEditSettings}
            />
          </div>
        </CardContent>
      </Card>

      <Card className={adminCardClass}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-display">
            <Shield className="h-4 w-4" /> Security
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Two-Factor Authentication</Label>
              <p className="text-xs text-muted-foreground">Require 2FA for all admin accounts</p>
            </div>
            <Switch 
              checked={twoFactorAuth} 
              onCheckedChange={setTwoFactorAuth}
              disabled={!canEditSettings}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>IP Whitelisting</Label>
              <p className="text-xs text-muted-foreground">Restrict admin access by IP address</p>
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

      <Card className={adminCardClass}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-display">
            <Key className="h-4 w-4" /> API Keys
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="crbApiKey">TransUnion CRB API Key</Label>
            <Input 
              id="crbApiKey" 
              type="password" 
              value={crbApiKey} 
              onChange={(e) => setCrbApiKey(e.target.value)}
              disabled={!canEditSettings}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="smsApiKey">SMS Gateway API Key</Label>
            <Input 
              id="smsApiKey" 
              type="password" 
              value={smsApiKey} 
              onChange={(e) => setSmsApiKey(e.target.value)}
              disabled={!canEditSettings}
            />
          </div>
        </CardContent>
      </Card>

      <Card className={adminCardClass}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-display">
            <Bell className="h-4 w-4" /> Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Email Notifications</Label>
              <p className="text-xs text-muted-foreground">Send email on application status changes</p>
            </div>
            <Switch 
              checked={emailNotifications} 
              onCheckedChange={setEmailNotifications}
              disabled={!canEditSettings}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>SMS Notifications</Label>
              <p className="text-xs text-muted-foreground">Send SMS alerts to applicants</p>
            </div>
            <Switch 
              checked={smsNotifications} 
              onCheckedChange={setSmsNotifications}
              disabled={!canEditSettings}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Admin Slack Alerts</Label>
              <p className="text-xs text-muted-foreground">Post critical alerts to Slack channel</p>
            </div>
            <Switch 
              checked={slackAlerts} 
              onCheckedChange={setSlackAlerts}
              disabled={!canEditSettings}
            />
          </div>
        </CardContent>
      </Card>

      {/* Payroll Integration Section - Super Admin Only */}
      <Card className={adminCardClass}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-display">
            <Wallet className="h-4 w-4" /> Payroll Integration
          </CardTitle>
          <p className="text-xs text-muted-foreground">Configure third-party payroll provider connections for salary deduction processing</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="payrollProvider">Payroll Provider</Label>
            <select 
              id="payrollProvider" 
              className="w-full mt-1.5 h-10 rounded-md border border-input bg-background px-3 text-sm"
              disabled={!canEditSettings}
            >
              <option value="">Select a provider</option>
              <option value="zanaco">ZANACO Payroll</option>
              <option value="fnb">FNB Business Payroll</option>
              <option value="standard_chartered">Standard Chartered</option>
              <option value="civic">Civic Payroll Services</option>
              <option value="custom">Custom/Internal API</option>
            </select>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="payrollApiUrl">API Endpoint URL</Label>
              <Input 
                id="payrollApiUrl" 
                type="url"
                placeholder="https://api.payroll-provider.com/v1"
                disabled={!canEditSettings}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payrollApiKey">API Key / Token</Label>
              <Input 
                id="payrollApiKey" 
                type="password"
                placeholder="Enter API key"
                disabled={!canEditSettings}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="payrollClientId">Client ID / Merchant ID</Label>
            <Input 
              id="payrollClientId" 
              placeholder="Your payroll client identifier"
              disabled={!canEditSettings}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payrollSecret">Client Secret</Label>
            <Input 
              id="payrollSecret" 
              type="password"
              placeholder="Your payroll client secret"
              disabled={!canEditSettings}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable Live Mode</Label>
              <p className="text-xs text-muted-foreground">Use production payroll API instead of sandbox</p>
            </div>
            <Switch disabled={!canEditSettings} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-verify Employment</Label>
              <p className="text-xs text-muted-foreground">Automatically verify employee status via payroll API</p>
            </div>
            <Switch disabled={!canEditSettings} />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="syncInterval">Sync Interval (minutes)</Label>
              <Input 
                id="syncInterval" 
                type="number"
                defaultValue="60"
                min="15"
                max="1440"
                className="w-32"
                disabled={!canEditSettings}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxDeduction">Max Deduction %</Label>
              <Input 
                id="maxDeduction" 
                type="number"
                defaultValue="30"
                min="1"
                max="100"
                className="w-32"
                disabled={!canEditSettings}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="webhookSecret">Webhook Secret</Label>
            <Input 
              id="webhookSecret" 
              type="password"
              placeholder="Secret for verifying incoming webhooks"
              disabled={!canEditSettings}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable Deduction Notifications</Label>
              <p className="text-xs text-muted-foreground">Notify employers of salary deductions</p>
            </div>
            <Switch disabled={!canEditSettings} />
          </div>
          <div className="flex items-center gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" disabled={!canEditSettings}>
              <Link2 className="h-4 w-4 mr-2" /> Test Connection
            </Button>
            <Button variant="outline" size="sm" disabled={!canEditSettings}>
              <Clock className="h-4 w-4 mr-2" /> View Sync Logs
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        {!canEditSettings && (
          <p className="text-sm text-muted-foreground">
            You need Super Admin or Admin permissions to edit these settings.
          </p>
        )}
        <Button 
          onClick={handleSave} 
          disabled={saving || !canEditSettings}
          className="ml-auto"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" /> Save Settings
            </>
          )}
        </Button>
      </div>
    </AdminPageShell>
  );
};

export default SystemSettings;
