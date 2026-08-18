import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Zap } from "lucide-react";
import { useRBAC } from "@/hooks/useRBAC";
import { toast } from "sonner";

const automations = [
  { name: "Auto CRB Check", description: "Automatically run CRB pre-check when KYC documents are verified", trigger: "KYC Verified", action: "Run CRB API", enabled: true },
  { name: "Risk Flag Detection", description: "Flag applications with duplicate NRC numbers or mismatched data", trigger: "Application Submitted", action: "Fraud Check", enabled: true },
  { name: "Auto Approve Low Risk", description: "Automatically approve loans under K5,000 with clear CRB and verified KYC", trigger: "CRB Clear + KYC Done", action: "Auto Approve", enabled: false },
  { name: "Payout Reminder", description: "Send email reminder to finance team 3 days before payout date", trigger: "3 days before payout", action: "Send Email", enabled: true },
  { name: "Salary Verification", description: "Cross-check parsed salary data with payroll integration", trigger: "Salary Data Saved", action: "Payroll API Check", enabled: true },
];

const Automations = () => {
  const { permissions, logAction } = useRBAC();
  const attemptUnsupportedChange = (name: string) => { void logAction("automation_configuration_attempt", undefined, "automations", null, { automation: name, result: "not_available" }); toast.info("Automation configuration is not connected to a runtime workflow store yet."); };
  if (!permissions.canManageAutomations) return <div className="flex items-center justify-center py-20 text-muted-foreground">You don't have permission to manage automations.</div>;
  return (<div className="space-y-6 max-w-7xl"><div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><div><h1 className="text-2xl font-display font-bold text-foreground">Automations</h1><p className="text-sm text-muted-foreground">Review configured workflow definitions. Runtime configuration is intentionally read-only until a persistent automation store is approved.</p></div><Button variant="outline" disabled>New Automation</Button></div><div className="grid gap-4">{automations.map((auto) => <Card key={auto.name}><CardContent className="pt-6"><div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4"><div className="flex items-start gap-3 min-w-0"><div className="p-2 rounded-lg bg-accent/10 shrink-0"><Zap className="h-5 w-5 text-accent" /></div><div className="space-y-1 min-w-0"><h3 className="font-display font-semibold text-foreground">{auto.name}</h3><p className="text-sm text-muted-foreground">{auto.description}</p><div className="flex flex-wrap items-center gap-2 pt-1"><Badge variant="outline" className="text-xs">Trigger: {auto.trigger}</Badge><Badge variant="outline" className="text-xs">Action: {auto.action}</Badge><Badge variant="secondary" className="text-xs">Definition only</Badge></div></div></div><Switch checked={auto.enabled} disabled onCheckedChange={() => attemptUnsupportedChange(auto.name)} className="shrink-0" /></div></CardContent></Card>)}</div></div>);
};
export default Automations;
