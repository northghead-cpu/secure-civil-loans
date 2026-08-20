import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Zap, Plus, Edit, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRBAC } from "@/hooks/useRBAC";

type AutomationRule = {
  id: string;
  name: string;
  description: string;
  trigger: string;
  action: string;
  enabled: boolean;
  run_count: number;
};

const EMPTY_FORM = { name: "", description: "", trigger: "", action: "" };

const Automations = () => {
  const { hasRole } = useRBAC();
  const isSuperAdmin = hasRole("super_admin");
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AutomationRule | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const loadRules = async () => {
    setLoading(true);
    setError(null);
    const { data, error: queryError } = await supabase
      .from("automation_rules")
      .select("id,name,description,trigger,action,enabled,run_count")
      .order("created_at", { ascending: false });
    if (queryError) setError(queryError.message);
    else setRules((data ?? []) as AutomationRule[]);
    setLoading(false);
  };

  useEffect(() => { void loadRules(); }, []);

  const openCreate = () => {
    if (!isSuperAdmin) return toast.error("Only Super Admins can create automations");
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (rule: AutomationRule) => {
    if (!isSuperAdmin) return toast.error("Only Super Admins can edit automations");
    setEditing(rule);
    setForm({ name: rule.name, description: rule.description, trigger: rule.trigger, action: rule.action });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!isSuperAdmin) return toast.error("Only Super Admins can manage automations");
    if (!form.name.trim() || !form.trigger.trim() || !form.action.trim()) return toast.error("Name, trigger and action are required");
    setSaving(true);
    const payload = { name: form.name.trim(), description: form.description.trim(), trigger: form.trigger.trim(), action: form.action.trim(), updated_at: new Date().toISOString() };
    const result = editing
      ? await supabase.from("automation_rules").update(payload).eq("id", editing.id)
      : await supabase.from("automation_rules").insert({ ...payload, enabled: false, run_count: 0 });
    setSaving(false);
    if (result.error) return toast.error(`Unable to save automation: ${result.error.message}`);
    toast.success(editing ? "Automation updated" : "Automation created in disabled state");
    setDialogOpen(false);
    await loadRules();
  };

  const toggle = async (rule: AutomationRule) => {
    if (!isSuperAdmin) return toast.error("Only Super Admins can enable automations");
    const { error: updateError } = await supabase.from("automation_rules").update({ enabled: !rule.enabled, updated_at: new Date().toISOString() }).eq("id", rule.id);
    if (updateError) toast.error(`Unable to update automation: ${updateError.message}`);
    else await loadRules();
  };

  const remove = async (rule: AutomationRule) => {
    if (!isSuperAdmin) return toast.error("Only Super Admins can delete automations");
    if (!window.confirm(`Delete the ${rule.name} automation?`)) return;
    const { error: deleteError } = await supabase.from("automation_rules").delete().eq("id", rule.id);
    if (deleteError) toast.error(`Unable to delete automation: ${deleteError.message}`);
    else { toast.success("Automation deleted"); await loadRules(); }
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Automations</h1>
          <p className="text-sm text-muted-foreground">Configure persisted automated workflow rules. Rules are disabled until explicitly enabled.</p>
        </div>
        {isSuperAdmin && <Button onClick={openCreate}><Plus className="w-4 h-4 mr-1" /> New Automation</Button>}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading automations…</div>
          ) : error ? (
            <div className="p-10 text-sm text-destructive">Unable to load automations: {error}</div>
          ) : rules.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">No automation rules have been configured.</div>
          ) : (
            <div className="grid gap-4 p-4">
              {rules.map((rule) => (
                <Card key={rule.id}>
                  <CardContent className="pt-6">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="p-2 rounded-lg bg-accent/10 shrink-0"><Zap className="h-5 w-5 text-accent" /></div>
                        <div className="space-y-1 min-w-0">
                          <h3 className="font-display font-semibold text-foreground">{rule.name}</h3>
                          <p className="text-sm text-muted-foreground">{rule.description || "No description provided."}</p>
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <Badge variant="outline" className="text-xs">Trigger: {rule.trigger}</Badge>
                            <Badge variant="outline" className="text-xs">Action: {rule.action}</Badge>
                            <span className="text-xs text-muted-foreground">{rule.run_count.toLocaleString()} recorded runs</span>
                          </div>
                        </div>
                      </div>
                      {isSuperAdmin && <div className="flex items-center gap-1 shrink-0"><Switch checked={rule.enabled} onCheckedChange={() => void toggle(rule)} /><Button size="sm" variant="ghost" onClick={() => openEdit(rule)}><Edit className="h-4 w-4" /></Button><Button size="sm" variant="ghost" onClick={() => void remove(rule)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button></div>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader><DialogTitle>{editing ? "Edit Automation" : "New Automation"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Description</Label><Input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Trigger *</Label><Input value={form.trigger} onChange={(e) => setForm((p) => ({ ...p, trigger: e.target.value }))} placeholder="e.g. KYC verified" /></div>
            <div className="space-y-2"><Label>Action *</Label><Input value={form.action} onChange={(e) => setForm((p) => ({ ...p, action: e.target.value }))} placeholder="e.g. Queue review" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save Automation"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Automations;
