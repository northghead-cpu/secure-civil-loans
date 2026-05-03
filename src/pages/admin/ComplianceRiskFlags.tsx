import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRBAC } from "@/hooks/useRBAC";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { ShieldAlert, Eye, CheckCircle2, XCircle, AlertCircle, Loader2, Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

type Severity = "critical" | "high" | "medium" | "low";

interface RiskFlag {
  id: string;
  application_id: string;
  user_id: string;
  flag_type: string;
  fraud_score: number;
  flags: unknown[];
  status: string;
  resolution_notes: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

const severityFromScore = (score: number): Severity => {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 30) return "medium";
  return "low";
};

const severityColors: Record<Severity, string> = {
  critical: "bg-destructive/20 text-destructive border-destructive/30",
  high: "bg-destructive/10 text-destructive border-destructive/20",
  medium: "bg-warning/10 text-warning border-warning/20",
  low: "bg-info/10 text-info border-info/20",
};

const statusColors: Record<string, string> = {
  pending: "bg-destructive/10 text-destructive",
  approved: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive",
  needs_review: "bg-amber-500/10 text-amber-600",
};

const ComplianceRiskFlags = () => {
  const { hasRole, logAction } = useRBAC();
  const { user } = useAuth();
  const isSuperAdmin = hasRole("super_admin");

  const [flags, setFlags] = useState<RiskFlag[]>([]);
  const [loadingFlags, setLoadingFlags] = useState(true);
  const [selectedFlag, setSelectedFlag] = useState<RiskFlag | null>(null);
  const [showResolutionModal, setShowResolutionModal] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [viewFlag, setViewFlag] = useState<RiskFlag | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchFlags = useCallback(async () => {
    const { data, error } = await supabase
      .from("risk_flags")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setFlags(data as RiskFlag[]);
    setLoadingFlags(false);
  }, []);

  useEffect(() => {
    fetchFlags();
    const channel = supabase
      .channel("risk_flags_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "risk_flags" }, () => {
        fetchFlags();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchFlags]);

  const filteredFlags = flags.filter((f) => {
    const severity = severityFromScore(f.fraud_score);
    if (severityFilter !== "all" && severity !== severityFilter) return false;
    if (statusFilter !== "all" && f.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return f.flag_type.toLowerCase().includes(q) || f.application_id.toLowerCase().includes(q);
    }
    return true;
  });

  const stats = {
    critical: flags.filter((f) => severityFromScore(f.fraud_score) === "critical" && f.status === "pending").length,
    open: flags.filter((f) => f.status === "pending").length,
    investigating: flags.filter((f) => f.status === "needs_review").length,
    resolved: flags.filter((f) => f.status === "approved" || f.status === "rejected").length,
  };

  const openResolutionModal = (flag: RiskFlag) => {
    if (!isSuperAdmin) {
      toast.error("Only Super Admins can resolve risk flags");
      return;
    }
    setSelectedFlag(flag);
    setResolutionNotes(flag.resolution_notes || "");
    setShowResolutionModal(true);
  };

  const resolveFlag = async (newStatus: string) => {
    if (!selectedFlag || !user) return;

    if (!resolutionNotes.trim() && (newStatus === "approved" || newStatus === "rejected")) {
      toast.error("Please provide resolution notes");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("risk_flags")
        .update({
          status: newStatus,
          resolution_notes: resolutionNotes,
          resolved_by: user.id,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", selectedFlag.id);

      if (error) throw error;

      await logAction("resolve_risk_flag", selectedFlag.id, "risk_flags", { status: selectedFlag.status }, { status: newStatus, notes: resolutionNotes });

      toast.success(`Risk flag ${newStatus === "approved" ? "approved" : newStatus === "rejected" ? "rejected" : "updated"}`);
      setShowResolutionModal(false);
      fetchFlags();
    } catch {
      toast.error("Failed to resolve risk flag");
    } finally {
      setSaving(false);
    }
  };

  const statusOptions = [
    { value: "approved", label: "Approved", icon: CheckCircle2, cls: "border-success/50 text-success hover:bg-success/10" },
    { value: "rejected", label: "Rejected", icon: XCircle, cls: "border-destructive/50 text-destructive hover:bg-destructive/10" },
    { value: "needs_review", label: "Needs Review", icon: AlertCircle, cls: "border-amber-500/50 text-amber-600 hover:bg-amber-500/10" },
  ];

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Risk Flags</h1>
        <p className="text-sm text-muted-foreground">
          Monitor and resolve potential fraud and compliance risks
          {isSuperAdmin && <span className="ml-2 text-xs text-primary">(Super Admin: Can resolve flags)</span>}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className={stats.critical > 0 ? "border-destructive/50" : ""}>
          <CardContent className="pt-6">
            <div className={`text-2xl font-display font-bold ${stats.critical > 0 ? "text-destructive" : "text-muted-foreground"}`}>{stats.critical}</div>
            <p className="text-xs sm:text-sm text-muted-foreground">Critical</p>
          </CardContent>
        </Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-display font-bold text-warning">{stats.open}</div><p className="text-xs sm:text-sm text-muted-foreground">Open</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-display font-bold text-info">{stats.investigating}</div><p className="text-xs sm:text-sm text-muted-foreground">Investigating</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-display font-bold text-success">{stats.resolved}</div><p className="text-xs sm:text-sm text-muted-foreground">Resolved</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="pt-4 pb-2 px-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by type or application ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="needs_review">Needs Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {loadingFlags ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead className="hidden md:table-cell">Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFlags.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No risk flags match your filters</TableCell></TableRow>
                ) : filteredFlags.map((f) => {
                  const severity = severityFromScore(f.fraud_score);
                  return (
                    <TableRow key={f.id} className={f.status === "pending" ? "bg-destructive/5" : ""}>
                      <TableCell className="font-medium">{f.flag_type}</TableCell>
                      <TableCell><Badge className={severityColors[severity]}>{severity}</Badge></TableCell>
                      <TableCell className="hidden md:table-cell"><Badge className={statusColors[f.status] || "bg-muted text-muted-foreground"}>{f.status.replace("_", " ")}</Badge></TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">{new Date(f.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="ghost" title="View Details" onClick={() => setViewFlag(f)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {isSuperAdmin && f.status === "pending" && (
                            <Button size="sm" variant="ghost" className="text-success" onClick={() => openResolutionModal(f)} title="Resolve Flag">
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* View Details Modal */}
      <Dialog open={!!viewFlag} onOpenChange={() => setViewFlag(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle>Risk Flag Details</DialogTitle></DialogHeader>
          {viewFlag && (
            <div className="space-y-3 py-2">
              <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Type:</span><span className="font-medium">{viewFlag.flag_type}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Fraud Score:</span><span className="font-medium">{viewFlag.fraud_score}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Severity:</span><Badge className={severityColors[severityFromScore(viewFlag.fraud_score)]}>{severityFromScore(viewFlag.fraud_score)}</Badge></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Status:</span><Badge className={statusColors[viewFlag.status] || "bg-muted"}>{viewFlag.status}</Badge></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Created:</span><span>{new Date(viewFlag.created_at).toLocaleString()}</span></div>
                {viewFlag.resolution_notes && <div className="flex justify-between"><span className="text-muted-foreground">Notes:</span><span>{viewFlag.resolution_notes}</span></div>}
                {viewFlag.resolved_at && <div className="flex justify-between"><span className="text-muted-foreground">Resolved:</span><span>{new Date(viewFlag.resolved_at).toLocaleString()}</span></div>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Resolution Modal */}
      <Dialog open={showResolutionModal} onOpenChange={setShowResolutionModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              Resolve Risk Flag
            </DialogTitle>
          </DialogHeader>
          {selectedFlag && (
            <div className="space-y-4 py-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between"><span className="text-sm text-muted-foreground">Type:</span><span className="text-sm font-medium">{selectedFlag.flag_type}</span></div>
                <div className="flex justify-between"><span className="text-sm text-muted-foreground">Fraud Score:</span><span className="text-sm font-medium">{selectedFlag.fraud_score}</span></div>
                <div className="flex justify-between"><span className="text-sm text-muted-foreground">Severity:</span><Badge className={severityColors[severityFromScore(selectedFlag.fraud_score)]}>{severityFromScore(selectedFlag.fraud_score)}</Badge></div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="resolutionNotes">Resolution Notes *</Label>
                <textarea
                  id="resolutionNotes"
                  className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Describe the resolution and findings..."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Resolution Action</Label>
                <div className="grid grid-cols-3 gap-2">
                  {statusOptions.map((option) => (
                    <Button key={option.value} variant="outline" size="sm" onClick={() => resolveFlag(option.value)} disabled={saving} className={option.cls}>
                      <option.icon className="h-4 w-4 mr-1" />
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResolutionModal(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ComplianceRiskFlags;
