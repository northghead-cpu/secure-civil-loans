import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldAlert, CheckCircle, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useRBAC } from "@/hooks/useRBAC";
import { riskService, type RiskFlag, type RiskResolution } from "@/services/riskService";
import { isFeatureEnabled } from "@/config/features";

const statusConfig: Record<string, { color: string; icon: typeof ShieldAlert }> = {
  pending: { color: "bg-warning/10 text-warning", icon: AlertTriangle },
  approved: { color: "bg-success/10 text-success", icon: CheckCircle },
  rejected: { color: "bg-destructive/10 text-destructive", icon: XCircle },
  needs_review: { color: "bg-primary/10 text-primary", icon: ShieldAlert },
};

const RiskCenter = () => {
  const { user } = useAuth();
  const { hasRole, logAction } = useRBAC();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("all");
  const [resolveDialog, setResolveDialog] = useState<RiskFlag | null>(null);
  const [resolution, setResolution] = useState<RiskResolution>("approved");
  const [notes, setNotes] = useState("");

  const isSuperAdmin = hasRole("super_admin");

  if (!isFeatureEnabled("enableAdminControls")) {
    return <div className="p-6 text-muted-foreground">This feature is currently disabled.</div>;
  }

  if (!isSuperAdmin) {
    return <div className="p-6 text-destructive font-medium">Access denied — Super Admin only.</div>;
  }

  const { data: flags = [], isLoading } = useQuery({
    queryKey: ["risk-flags", filter],
    queryFn: () => riskService.list(filter),
  });

  const resolveMutation = useMutation({
    mutationFn: () => riskService.resolve(resolveDialog!.id, resolution, notes, user!.id),
    onSuccess: (flag) => {
      logAction("risk_flag_resolved", flag.id, "risk_flags", { status: resolveDialog!.status }, { status: flag.status, notes });
      queryClient.invalidateQueries({ queryKey: ["risk-flags"] });
      toast.success("Risk flag resolved");
      setResolveDialog(null);
      setNotes("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-foreground">Risk Center</h1>
          <p className="text-sm text-muted-foreground">Review and resolve flagged applications</p>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Filter" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="needs_review">Needs Review</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : flags.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground">No risk flags found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Flag Type</TableHead>
                  <TableHead>Fraud Score</TableHead>
                  <TableHead className="hidden sm:table-cell">Application</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flags.map((f) => {
                  const cfg = statusConfig[f.status] || statusConfig.pending;
                  return (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.flag_type}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={f.fraud_score > 70 ? "text-destructive border-destructive" : f.fraud_score > 40 ? "text-warning border-warning" : ""}>
                          {f.fraud_score}%
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell font-mono text-xs">{f.application_id.slice(0, 8)}…</TableCell>
                      <TableCell><Badge className={cfg.color}>{f.status.replace("_", " ")}</Badge></TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{new Date(f.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        {f.status === "pending" || f.status === "needs_review" ? (
                          <Button size="sm" variant="outline" onClick={() => { setResolveDialog(f); setResolution("approved"); setNotes(""); }}>
                            Resolve
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Resolved</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!resolveDialog} onOpenChange={(open) => { if (!open) setResolveDialog(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Resolve Risk Flag</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Resolution</Label>
              <Select value={resolution} onValueChange={(v) => setResolution(v as RiskResolution)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="needs_review">Needs Review</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Resolution notes..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialog(null)}>Cancel</Button>
            <Button onClick={() => resolveMutation.mutate()} disabled={resolveMutation.isPending}>
              {resolveMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RiskCenter;
