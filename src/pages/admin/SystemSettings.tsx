import { useEffect, useState } from "react";
import { useRBAC } from "@/hooks/useRBAC";
import { AdminHero, AdminPageShell, adminCardClass } from "@/components/admin/AdminPageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Bell, Globe, Shield, Loader2, Save, Key, Link2, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const DEFAULTS = {
  platformName: "",
  supportEmail: "",
  maintenanceMode: false,
  twoFactorAuth: false,
  ipWhitelisting: false,
  sessionTimeout: 0,
  emailNotifications: false,
  smsNotifications: false,
  slackAlerts: false,
};

type Settings = typeof DEFAULTS;

const SystemSettings = () => {
  const { permissions } = useRBAC();
  const canEditSettings = permissions.canChangeSystemSettings;
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.from("system_settings").select("value").eq("key", "platform").maybeSingle();
      if (error) toast.error(`Unable to load system settings: ${error.message}`);
      if (data?.value && typeof data.value === "object" && !Array.isArray(data.value)) setSettings({ ...DEFAULTS, ...(data.value as Partial<Settings>) });
      setLoading(false);
    };
    void load();
  }, []);

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => setSettings((current) => ({ ...current, [key]: value }));

  const handleSave = async () => {
    if (!canEditSettings) return toast.error("You don't have permission to change system settings");
    setSaving(true);
    const { error } = await supabase.from("system_settings").upsert({ key: "platform", value: settings, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) toast.error(`Failed to save settings: ${error.message}`);
    else toast.success("Settings saved successfully");
  };

  if (loading) return <AdminPageShell><div className="flex items-center justify-center p-10 text-muted-foreground"><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading settings…</div></AdminPageShell>;

  return (
    <AdminPageShell className="max-w-5xl">
      <AdminHero badge={canEditSettings ? "Editable" : "Read only"} title="Platform settings" description="Manage persisted platform configuration. Secrets and third-party credentials must be managed through secure server-side secret storage." stats={[{ label: "Configuration areas", value: "3", meta: "General, security, notifications" }, { label: "Configured", value: settings.platformName ? "Yes" : "No", meta: settings.platformName ? "Platform identity is configured" : "No platform identity configured" }]} />

      <Card className={adminCardClass}><CardHeader><CardTitle className="flex items-center gap-2 text-base font-display"><Globe className="h-4 w-4" /> General</CardTitle></CardHeader><CardContent className="space-y-4"><div className="space-y-2"><Label htmlFor="platformName">Platform Name</Label><Input id="platformName" value={settings.platformName} onChange={(e) => update("platformName", e.target.value)} disabled={!canEditSettings} /></div><div className="space-y-2"><Label htmlFor="supportEmail">Support Email</Label><Input id="supportEmail" type="email" value={settings.supportEmail} onChange={(e) => update("supportEmail", e.target.value)} disabled={!canEditSettings} /></div><div className="flex items-center justify-between"><div><Label>Maintenance Mode</Label><p className="text-xs text-muted-foreground">Disable public access temporarily</p></div><Switch checked={settings.maintenanceMode} onCheckedChange={(v) => update("maintenanceMode", v)} disabled={!canEditSettings} /></div></CardContent></Card>

      <Card className={adminCardClass}><CardHeader><CardTitle className="flex items-center gap-2 text-base font-display"><Shield className="h-4 w-4" /> Security</CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex items-center justify-between"><div><Label>Two-Factor Authentication</Label><p className="text-xs text-muted-foreground">Require 2FA for admin accounts</p></div><Switch checked={settings.twoFactorAuth} onCheckedChange={(v) => update("twoFactorAuth", v)} disabled={!canEditSettings} /></div><div className="flex items-center justify-between"><div><Label>IP Whitelisting</Label><p className="text-xs text-muted-foreground">Restrict admin access by IP address</p></div><Switch checked={settings.ipWhitelisting} onCheckedChange={(v) => update("ipWhitelisting", v)} disabled={!canEditSettings} /></div><div className="space-y-2"><Label htmlFor="sessionTimeout">Session Timeout (minutes)</Label><Input id="sessionTimeout" type="number" min="0" value={settings.sessionTimeout || ""} onChange={(e) => update("sessionTimeout", Number(e.target.value) || 0)} className="w-32" disabled={!canEditSettings} /></div></CardContent></Card>

      <Card className={adminCardClass}><CardHeader><CardTitle className="flex items-center gap-2 text-base font-display"><Key className="h-4 w-4" /> Secure Integrations</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">API keys, client secrets, webhook secrets, and other credentials are intentionally not stored in browser state or ordinary application settings. Configure them through the server-side secret mechanism for the relevant integration.</p><div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={!canEditSettings}><Link2 className="h-4 w-4 mr-2" /> Test Connection</Button><Button variant="outline" size="sm" disabled={!canEditSettings}><Clock className="h-4 w-4 mr-2" /> View Sync Logs</Button></div></CardContent></Card>

      <Card className={adminCardClass}><CardHeader><CardTitle className="flex items-center gap-2 text-base font-display"><Bell className="h-4 w-4" /> Notifications</CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex items-center justify-between"><div><Label>Email Notifications</Label><p className="text-xs text-muted-foreground">Send email on application status changes</p></div><Switch checked={settings.emailNotifications} onCheckedChange={(v) => update("emailNotifications", v)} disabled={!canEditSettings} /></div><div className="flex items-center justify-between"><div><Label>SMS Notifications</Label><p className="text-xs text-muted-foreground">Send SMS alerts to applicants</p></div><Switch checked={settings.smsNotifications} onCheckedChange={(v) => update("smsNotifications", v)} disabled={!canEditSettings} /></div><div className="flex items-center justify-between"><div><Label>Admin Slack Alerts</Label><p className="text-xs text-muted-foreground">Post critical alerts to Slack when configured</p></div><Switch checked={settings.slackAlerts} onCheckedChange={(v) => update("slackAlerts", v)} disabled={!canEditSettings} /></div></CardContent></Card>

      <div className="flex justify-end"><Button onClick={handleSave} disabled={saving || !canEditSettings}>{saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</> : <><Save className="h-4 w-4 mr-2" /> Save Settings</>}</Button></div>
    </AdminPageShell>
  );
};

export default SystemSettings;
