import { useState } from "react";
import { useRBAC } from "@/hooks/useRBAC";
import { AdminHero, AdminPageShell, adminCardClass } from "@/components/admin/AdminPageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Bell, Globe, Key, Shield, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

const SystemSettings = () => {
  const { permissions, logAction } = useRBAC();
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [platformName, setPlatformName] = useState("Riverbank");
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
