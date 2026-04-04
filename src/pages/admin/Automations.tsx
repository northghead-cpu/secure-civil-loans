import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Automations</h1>
          <p className="text-sm text-muted-foreground">Configure automated workflows and rules</p>
        </div>
        <Button><Plus className="w-4 h-4 mr-1" /> New Automation</Button>
      </div>

      <div className="grid gap-4">
        {automations.map((auto) => (
          <Card key={auto.name}>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-accent/10 shrink-0">
                    <Zap className="h-5 w-5 text-accent" />
                  </div>
                  <div className="space-y-1 min-w-0">
                    <h3 className="font-display font-semibold text-foreground">{auto.name}</h3>
                    <p className="text-sm text-muted-foreground">{auto.description}</p>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Badge variant="outline" className="text-xs">Trigger: {auto.trigger}</Badge>
                      <Badge variant="outline" className="text-xs">Action: {auto.action}</Badge>
                      <span className="text-xs text-muted-foreground">{auto.runs} runs</span>
                    </div>
                  </div>
                </div>
                <Switch checked={auto.enabled} className="shrink-0" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Automations;
