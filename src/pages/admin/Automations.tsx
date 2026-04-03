import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { AdminHero, AdminPageShell, adminCardClass, adminInsetCardClass } from "@/components/admin/AdminPageShell";
import { Zap, Plus } from "lucide-react";

const automations = [
  {
    name: "Auto CRB Check",
    description: "Automatically run CRB pre-check when KYC documents are verified",
    trigger: "KYC Verified",
    action: "Run CRB API",
    enabled: true,
    runs: 234,
  },
  {
    name: "Risk Flag Detection",
    description: "Flag applications with duplicate NRC numbers or mismatched data",
    trigger: "Application Submitted",
    action: "Fraud Check",
    enabled: true,
    runs: 1847,
  },
  {
    name: "Auto Approve Low Risk",
    description: "Automatically approve loans under K5,000 with clear CRB and verified KYC",
    trigger: "CRB Clear + KYC Done",
    action: "Auto Approve",
    enabled: false,
    runs: 0,
  },
  {
    name: "Payout Reminder",
    description: "Send email reminder to finance team 3 days before payout date",
    trigger: "3 days before payout",
    action: "Send Email",
    enabled: true,
    runs: 12,
  },
  {
    name: "Salary Verification",
    description: "Cross-check parsed salary data with payroll integration",
    trigger: "Salary Data Saved",
    action: "Payroll API Check",
    enabled: true,
    runs: 189,
  },
];

const Automations = () => {
  const enabledCount = automations.filter((auto) => auto.enabled).length;
  const totalRuns = automations.reduce((sum, auto) => sum + auto.runs, 0);

  return (
    <AdminPageShell>
      <AdminHero
        badge="Workflow controls"
        title="Automation rules for underwriting and payout operations"
        description="Turn repetitive review steps into controlled workflows while keeping the team aware of where automation is currently active."
        actions={
          <Button className="bg-white text-slate-950 hover:bg-white/90">
            <Plus className="mr-1 h-4 w-4" /> New Automation
          </Button>
        }
        stats={[
          { label: "Total workflows", value: automations.length.toString(), meta: "Across review, fraud, and payout steps" },
          { label: "Enabled now", value: enabledCount.toString(), meta: "Rules currently affecting live traffic" },
          { label: "Recorded runs", value: totalRuns.toLocaleString(), meta: "Cumulative executions from sample data" },
        ]}
      />

      <div className="grid gap-4">
        {automations.map((auto) => (
          <Card key={auto.name} className={adminCardClass}>
            <CardContent className="pt-6">
              <div className={`flex items-start justify-between gap-4 p-1 sm:p-2 ${adminInsetCardClass}`}>
                <div className="flex items-start gap-3">
                  <div className="m-3 rounded-xl bg-accent/10 p-2">
                    <Zap className="h-5 w-5 text-accent" />
                  </div>
                  <div className="space-y-1 p-3 pl-0">
                    <h3 className="font-display font-semibold text-foreground">{auto.name}</h3>
                    <p className="text-sm text-muted-foreground">{auto.description}</p>
                    <div className="flex items-center gap-2 pt-1">
                      <Badge variant="outline" className="text-xs">Trigger: {auto.trigger}</Badge>
                      <Badge variant="outline" className="text-xs">Action: {auto.action}</Badge>
                      <span className="text-xs text-muted-foreground">{auto.runs} runs</span>
                    </div>
                  </div>
                </div>
                <div className="p-3">
                  <Switch checked={auto.enabled} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AdminPageShell>
  );
};

export default Automations;
