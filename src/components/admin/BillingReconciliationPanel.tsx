import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BillingRun {
  id: string;
  billing_date: string;
  period_start: string;
  period_end: string;
  status: string;
  eligible_count: number;
  confirmed_count: number;
  transaction_count: number;
  receipt_count: number;
  delivery_failure_count: number;
  completed_at: string | null;
}

const BillingReconciliationPanel = () => {
  const [runs, setRuns] = useState<BillingRun[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("billing_runs")
      .select("id,billing_date,period_start,period_end,status,eligible_count,confirmed_count,transaction_count,receipt_count,delivery_failure_count,completed_at")
      .order("billing_date", { ascending: false })
      .limit(12);
    if (error) toast.error("Unable to load billing reconciliation.");
    setRuns((data ?? []) as BillingRun[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="text-lg font-display">Subscription billing reconciliation</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">K60 payroll-confirmed receipts only. Re-running a billing date is idempotent.</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-2">Refresh</span>
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : runs.length === 0 ? <p className="text-sm text-muted-foreground">No billing runs have been recorded yet.</p> : (
          <div className="space-y-3">
            {runs.map((run) => {
              const balanced = run.transaction_count === run.receipt_count;
              return (
                <div key={run.id} className="rounded-lg border border-border/60 bg-muted/20 p-4">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap"><p className="font-medium text-sm">{run.billing_date}</p><Badge variant="outline">{run.status}</Badge>{balanced ? <CheckCircle2 className="h-4 w-4 text-success" aria-label="Balanced" /> : <AlertCircle className="h-4 w-4 text-destructive" aria-label="Needs review" />}</div>
                      <p className="text-xs text-muted-foreground mt-1">Period {run.period_start} to {run.period_end}</p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                      <div><p className="text-muted-foreground">Eligible</p><p className="font-semibold">{run.eligible_count}</p></div>
                      <div><p className="text-muted-foreground">Confirmed</p><p className="font-semibold">{run.confirmed_count}</p></div>
                      <div><p className="text-muted-foreground">Transactions</p><p className="font-semibold">{run.transaction_count}</p></div>
                      <div><p className="text-muted-foreground">Receipts</p><p className="font-semibold">{run.receipt_count}</p></div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">Email delivery failures: {run.delivery_failure_count}. {run.completed_at ? `Completed ${new Date(run.completed_at).toLocaleString("en-ZM")}.` : "Not completed."}</p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BillingReconciliationPanel;
