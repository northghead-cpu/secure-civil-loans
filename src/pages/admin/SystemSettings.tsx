import { AdminHero, AdminPageShell, adminCardClass } from "@/components/admin/AdminPageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Bell, Globe, Key, Shield } from "lucide-react";

const SystemSettings = () => {
  return (
    <AdminPageShell className="max-w-5xl">
      <AdminHero
        badge="Super admin"
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
            <Label>Platform Name</Label>
            <Input defaultValue="Riverbank" />
          </div>
          <div className="space-y-2">
            <Label>Support Email</Label>
            <Input defaultValue="support@riverbank.co.zm" />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Maintenance Mode</Label>
              <p className="text-xs text-muted-foreground">Disable public access temporarily</p>
            </div>
            <Switch />
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
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>IP Whitelisting</Label>
              <p className="text-xs text-muted-foreground">Restrict admin access by IP address</p>
            </div>
            <Switch />
          </div>
          <div className="space-y-2">
            <Label>Session Timeout (minutes)</Label>
            <Input type="number" defaultValue="30" className="w-32" />
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
            <Label>TransUnion CRB API Key</Label>
            <Input type="password" defaultValue="************" />
          </div>
          <div className="space-y-2">
            <Label>SMS Gateway API Key</Label>
            <Input type="password" defaultValue="************" />
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
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>SMS Notifications</Label>
              <p className="text-xs text-muted-foreground">Send SMS alerts to applicants</p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Admin Slack Alerts</Label>
              <p className="text-xs text-muted-foreground">Post critical alerts to Slack channel</p>
            </div>
            <Switch />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button>Save Settings</Button>
      </div>
    </AdminPageShell>
  );
};

export default SystemSettings;
