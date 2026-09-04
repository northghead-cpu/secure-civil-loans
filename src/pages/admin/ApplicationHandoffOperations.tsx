import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Clock3, Loader2, RefreshCw, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRBAC } from "@/hooks/useRBAC";
import { toast } from "sonner";
import {
  canManageHandoffOperations,
  isLenderControlledStatus,
  listApplicationHandoffs,
  RIVERBANC_OPERATIONAL_STATUSES,
  updateApplicationHandoffStatus,
  type ApplicationHandoffRecord,
} from "@/services/applicationHandoffService";

const statusLabels: Record<string, string> = {
  pending_authorization: "Pending authorization",
  authorized: "Authorized",
  preparing: "Preparing",
  sent_to_lender: "Sent to lender",
  lender_review: "Lender review",
  additional_information_requested: "Additional information requested",
  approved: "Approved",
  declined: "Declined",
  disbursed: "Disbursed",
};

const statusClasses: Record<string, string> = {
  approved: "bg-success/10 text-success border-success/20",
  declined: "bg-destructive/10 text-destructive border-destructive/20",
  disbursed: "bg-primary/10 text-primary border-primary/20",
  lender_review: "bg-info/10 text-info border-info/20",
  additional_information_requested: "bg-warning/10 text-warning border-warning/20",
};

const ApplicationHandoffOperations = () => {
  const { highestRole } = useRBAC();
  const [handoffs, setHandoffs] = useState<ApplicationHandoffRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const canManage = canManageHandoffOperations(highestRole);

  const loadHandoffs = async () => {
    setLoading(true);
    try {
      setHandoffs(await listApplicationHandoffs());
    } catch {
      toast.error("Failed to load application handoffs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadHandoffs(); }, []);

  const activeCount = useMemo(() => handoffs.filter((handoff) => !["declined", "disbursed"].includes(handoff.status)).length, [handoffs]);

  const updateStatus = async (handoff: ApplicationHandoffRecord, status: string) => {
    if (!canManage) {
      toast.error("You do not have permission to manage application handoffs.");
      return;
    }
    setSavingId(handoff.id);
    try {
      const updated = await updateApplicationHandoffStatus(handoff.id, status);
      setHandoffs((current) => current.map((item) => item.id === updated.id ? updated : item));
      toast.success(`Handoff marked ${statusLabels[status] ?? status}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update handoff status");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary mb-1">Operations</p>
          <h1 className="text-2xl font-display font-bold text-foreground">Application Handoff Operations</h1>
          <p className="text-sm text-muted-foreground mt-1">Coordinate authorized application handoffs and track lender-reported milestones.</p>
        </div>
        <Button variant="outline" onClick={() => void loadHandoffs()} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Total handoffs</p><p className="text-2xl font-display font-bold mt-1">{handoffs.length}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Active handoffs</p><p className="text-2xl font-display font-bold mt-1">{activeCount}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Your role</p><p className="text-2xl font-display font-bold mt-1 capitalize">{highestRole?.replaceAll("_", " ") ?? "—"}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="font-display">Handoff queue</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-muted-foreground" /></div> : handoffs.length === 0 ? <div className="py-12 text-center"><CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-muted-foreground" /><p className="text-muted-foreground">No application handoffs yet.</p></div> : <div className="space-y-3">{handoffs.map((handoff) => {
            const lenderControlled = isLenderControlledStatus(handoff.status);
            return <div key={handoff.id} className="rounded-xl border border-border/60 p-4 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div className="min-w-0"><p className="font-display font-semibold truncate">{handoff.lender_name}{handoff.product_name ? ` · ${handoff.product_name}` : ""}</p><p className="text-xs text-muted-foreground mt-1">Applicant reference: {handoff.user_id}</p></div>
                <Badge className={statusClasses[handoff.status] ?? ""}>{statusLabels[handoff.status] ?? handoff.status}</Badge>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div><p className="text-muted-foreground">Requested</p><p className="font-medium">{handoff.requested_amount == null ? "—" : `K${Number(handoff.requested_amount).toLocaleString()}`}</p></div>
                <div><p className="text-muted-foreground">Term</p><p className="font-medium">{handoff.term_months == null ? "—" : `${handoff.term_months} months`}</p></div>
                <div><p className="text-muted-foreground">Rate</p><p className="font-medium">{handoff.interest_rate == null ? "—" : `${handoff.interest_rate}%`}</p></div>
                <div><p className="text-muted-foreground">Updated</p><p className="font-medium">{new Date(handoff.updated_at).toLocaleString()}</p></div>
              </div>
              {lenderControlled ? <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground"><Clock3 className="w-4 h-4 shrink-0 mt-0.5" /><span>This milestone is controlled by the financial institution. Riverbanc records and displays the lender-reported state; it does not approve, decline or disburse loans.</span></div> : canManage ? <div className="flex flex-col sm:flex-row sm:items-center gap-3"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Send className="w-4 h-4" /> Riverbanc operational status</div><Select value={handoff.status} onValueChange={(value) => void updateStatus(handoff, value)} disabled={savingId === handoff.id}><SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger><SelectContent>{RIVERBANC_OPERATIONAL_STATUSES.map((status) => <SelectItem key={status} value={status}>{statusLabels[status]}</SelectItem>)}</SelectContent></Select><ArrowRight className="hidden sm:block w-4 h-4 text-muted-foreground" /></div> : null}
            </div>;
          })}</div>}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">Riverbanc coordinates the handoff. The selected financial institution owns underwriting, approval, decline and disbursement decisions.</p>
    </div>
  );
};

export default ApplicationHandoffOperations;
