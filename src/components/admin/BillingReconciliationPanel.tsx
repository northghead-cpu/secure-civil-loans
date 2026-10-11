import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface PayrollAuthorization {
  id: string;
  user_id: string;
  status: string;
  payroll_status: string;
  authorized_at: string;
  payroll_reference: string | null;
  amount: number;
  currency: string;
  full_name: string | null;
  employee_number: string | null;
}

type ReconcileStatus = "submitted" | "confirmed" | "failed";

const BillingReconciliationPanel = () => {
  const [runs, setRuns] = useState<BillingRun[]>([]);
  const [authorizations, setAuthorizations] = useState<PayrollAuthorization[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PayrollAuthorization | null>(null);
  const [payrollReference, setPayrollReference] = useState("");
  const [evidenceConfirmed, setEvidenceConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [runsResult, authResult] = await Promise.all([
        supabase.from("billing_runs")
          .select("id,billing_date,period_start,period_end,status,eligible_count,confirmed_count,transaction_count,receipt_count,delivery_failure_count,completed_at")
          .order("billing_date", { ascending: false }).limit(12),
        supabase.from("subscription_authorizations")
          .select("id,user_id,status,payroll_status,authorized_at,payroll_reference,amount,currency")
          .eq("status", "active").neq("payroll_status", "confirmed")
          .order("authorized_at", { ascending: false }).limit(100),
      ]);
      if (runsResult.error) throw runsResult.error;
      if (authResult.error) throw authResult.error;
      const authRows = authResult.data ?? [];
      const userIds = [...new Set(authRows.map((row) => row.user_id))];
      const profileResult = userIds.length
        ? await supabase.from("profiles").select("user_id,full_name,employee_number").in("user_id", userIds)
        : { data: [], error: null };
      if (profileResult.error) throw profileResult.error;
      const profiles = new Map((profileResult.data ?? []).map((row) => [row.user_id, row]));
      setRuns((runsResult.data ?? []) as BillingRun[]);
      setAuthorizations(authRows.map((row) => ({
        ...row,
        full_name: profiles.get(row.user_id)?.full_name ?? null,
        employee_number: profiles.get(row.user_id)?.employee_number ?? null,
      })) as PayrollAuthorization[]);
    } catch {
      toast.error("Unable to load billing reconciliation.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const openReconciliation = (authorization: PayrollAuthorization) => {
    setSelected(authorization);
    setPayrollReference(authorization.payroll_reference ?? "");
    setEvidenceConfirmed(false);
  };

  const reconcile = async (status: ReconcileStatus) => {
    if (!selected || saving) return;
    const reference = payrollReference.trim();
    if (status !== "failed" && !reference) {
      toast.error("A payroll reference is required.");
      return;
    }
    if (status === "confirmed" && !evidenceConfirmed) {
      toast.error("Confirm that you verified the deduction against payroll evidence.");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.rpc("reconcile_riverbanc_subscription_payroll", {
        _authorization_id: selected.id,
        _status: status,
        _payroll_reference: reference || null,
        _evidence_confirmed: status === "confirmed" && evidenceConfirmed,
      });
      if (error) throw error;
      toast.success(status === "confirmed" ? "Payroll deduction confirmed" : status === "submitted" ? "Payroll submission recorded" : "Payroll status marked failed");
      setSelected(null);
      setPayrollReference("");
      setEvidenceConfirmed(false);
      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to reconcile this subscription.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-display">Subscription billing reconciliation</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Only payroll-confirmed subscriptions enter billing. Confirmation requires a payroll reference and MFA-protected reconciliation.</p>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-display">Payroll authorization queue</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Review active K60 authorizations and record submission or confirmation only against the payroll record.</p>
        </CardHeader>
        <CardContent>
          {loading ? <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : authorizations.length === 0 ? <p className="text-sm text-muted-foreground">No active subscriptions are awaiting payroll reconciliation.</p> : (
            <div className="space-y-3">
              {authorizations.map((authorization) => (
                <div key={authorization.id} className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><p className="font-medium text-sm">{authorization.full_name || "Subscriber"}</p><Badge variant="outline">{authorization.payroll_status}</Badge></div>
                    <p className="mt-1 text-xs text-muted-foreground">Employee number: {authorization.employee_number || "Not available"} · Authorized {new Date(authorization.authorized_at).toLocaleDateString("en-ZM")}</p>
                    {authorization.payroll_reference && <p className="mt-1 text-xs text-muted-foreground">Payroll reference: {authorization.payroll_reference}</p>}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openReconciliation(authorization)}>Reconcile payroll</Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open && !saving) setSelected(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Reconcile payroll deduction</DialogTitle>
            <DialogDescription>
              {selected?.full_name || "Subscriber"} · ZMW {Number(selected?.amount ?? 60).toFixed(2)} monthly. Do not confirm a deduction without matching payroll evidence.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subscription-payroll-reference">Payroll reference</Label>
              <Input id="subscription-payroll-reference" value={payrollReference} onChange={(event) => setPayrollReference(event.target.value)} placeholder="Reference from payroll deduction report" disabled={saving} />
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-border/60 p-3">
              <Checkbox id="subscription-payroll-evidence" checked={evidenceConfirmed} onCheckedChange={(value) => setEvidenceConfirmed(value === true)} disabled={saving} />
              <Label htmlFor="subscription-payroll-evidence" className="text-sm font-normal leading-5">
                I verified the deduction against the official payroll record and confirm the reference above belongs to this subscriber.
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">The action is audit-logged, requires an MFA-authenticated admin/compliance session, and cannot change a previously confirmed deduction.</p>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:gap-2">
            <Button variant="outline" onClick={() => void reconcile("failed")} disabled={saving}>Mark failed</Button>
            <Button variant="outline" onClick={() => void reconcile("submitted")} disabled={saving || !payrollReference.trim()}>Record submission</Button>
            <Button onClick={() => void reconcile("confirmed")} disabled={saving || !payrollReference.trim() || !evidenceConfirmed}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : "Confirm deduction"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BillingReconciliationPanel;
