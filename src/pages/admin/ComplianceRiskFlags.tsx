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
import { riskService, type RiskFlag } from "@/services/riskService";

type Severity = "critical" | "high" | "medium" | "low";

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

  const STORAGE_KEY = "riskFlags_filters";
  const [searchParams, setSearchParams] = useSearchParams();

  const getInitial = (key: string, fallback: string) => {
    const urlVal = searchParams.get(key);
    if (urlVal) return urlVal;
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return stored[key] || fallback;
    } catch { return fallback; }
  };

  const [flags, setFlags] = useState<RiskFlag[]>([]);
  const [loadingFlags, setLoadingFlags] = useState(true);
  const [selectedFlag, setSelectedFlag] = useState<RiskFlag | null>(null);
  const [showResolutionModal, setShowResolutionModal] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [viewFlag, setViewFlag] = useState<RiskFlag | null>(null);
  const [searchQuery, setSearchQuery] = useState(() => getInitial("q", ""));
  const [severityFilter, setSeverityFilter] = useState(() => getInitial("severity", "all"));
  const [statusFilter, setStatusFilter] = useState(() => getInitial("status", "all"));

  useEffect(() => {
    const params: Record<string, string> = {};
    if (searchQuery) params.q = searchQuery;
    if (severityFilter !== "all") params.severity = severityFilter;
    if (statusFilter !== "all") params.status = statusFilter;
    setSearchParams(params, { replace: true });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ q: searchQuery, severity: severityFilter, status: statusFilter }));
  }, [searchQuery, severityFilter, statusFilter, setSearchParams]);

  const fetchFlags = useCallback(async () => {
    try {
      setFlags(await riskService.list());
    } catch {
      toast.error("Failed to load risk flags");
    } finally {
      setLoadingFlags(false);
    }
  }, []);

  useEffect(() => {
    void fetchFlags();
    const channel = supabase
      .channel("risk_flags_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "risk_flags" }, () => {
        void fetchFlags();
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
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
      await riskService.resolve(selectedFlag.id, newStatus as "approved" | "rejected" | "needs_review", resolutionNotes, user.id);
      await logAction("resolve_risk_flag", selectedFlag.id, "risk_flags", { status: selectedFlag.status }, { status: newStatus, notes: resolutionNotes });

      toast.success(`Risk flag ${newStatus === "approved" ? "approved" : newStatus === "rejected" ? "rejected" : "updated"}`);
      setShowResolutionModal(false);
      void fetchFlags();
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
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Critical</p><p className="text-2xl font-display font-bold text-destructive">{stats.critical}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Open</p><p className="text-2xl font-display font-bold">{stats.open}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Investigating</p><p className="text-2xl font-display font-bold">{stats.investigating}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Resolved</p><p className="text-2xl font-display font-bold text-success">{stats.resolved}</p></CardContent></Card>
      </div>

      <Card><CardContent className="pt-6"><div className="flex flex-col lg:flex-row gap-3"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search flag type or application ID" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div><Select value={severityFilter} onValueChange={setSeverityFilter}><SelectTrigger className="w-full lg:w-44"><SelectValue placeholder="Severity" /></SelectTrigger><SelectContent><SelectItem value="all">All severity</SelectItem><SelectItem value="critical">Critical</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="low">Low</SelectItem></SelectContent></Select><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full lg:w-44"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All status</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="needs_review">Needs review</SelectItem><SelectItem value="approved">Approved</SelectItem><SelectItem value="rejected">Rejected</SelectItem></SelectContent></Select></div></CardContent></Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {loadingFlags ? <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div> : <Table><TableHeader><TableRow><TableHead>Application</TableHead><TableHead>Flag</TableHead><TableHead>Severity</TableHead><TableHead>Score</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader><TableBody>{filteredFlags.map((flag) => { const severity = severityFromScore(flag.fraud_score); return <TableRow key={flag.id}><TableCell className="font-mono text-xs">{flag.application_id}</TableCell><TableCell className="font-medium">{flag.flag_type}</TableCell><TableCell><Badge className={severityColors[severity]}>{severity}</Badge></TableCell><TableCell>{flag.fraud_score}</TableCell><TableCell><Badge className={statusColors[flag.status] || ""}>{flag.status}</Badge></TableCell><TableCell className="text-right"><div className="flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={() => setViewFlag(flag)}><Eye className="w-4 h-4 mr-1" /> View</Button>{isSuperAdmin && flag.status !== "approved" && flag.status !== "rejected" && <Button size="sm" onClick={() => openResolutionModal(flag)}>Resolve</Button>}</div></TableCell></TableRow>; })}</TableBody></Table>}
          {!loadingFlags && filteredFlags.length === 0 && <p className="py-12 text-center text-sm text-muted-foreground">No risk flags match the current filters.</p>}
        </CardContent>
      </Card>

      <Dialog open={Boolean(viewFlag)} onOpenChange={(open) => !open && setViewFlag(null)}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Risk flag details</DialogTitle></DialogHeader>{viewFlag && <div className="space-y-4 text-sm"><div className="grid grid-cols-2 gap-4"><div><p className="text-muted-foreground">Application</p><p className="font-mono text-xs mt-1">{viewFlag.application_id}</p></div><div><p className="text-muted-foreground">User</p><p className="font-mono text-xs mt-1">{viewFlag.user_id}</p></div><div><p className="text-muted-foreground">Flag</p><p className="mt-1 font-medium">{viewFlag.flag_type}</p></div><div><p className="text-muted-foreground">Fraud score</p><p className="mt-1 font-medium">{viewFlag.fraud_score}</p></div></div><div><p className="text-muted-foreground">Flags</p><pre className="mt-1 max-h-48 overflow-auto rounded-lg bg-muted/40 p-3 text-xs">{JSON.stringify(viewFlag.flags, null, 2)}</pre></div>{viewFlag.resolution_notes && <div><p className="text-muted-foreground">Resolution notes</p><p className="mt-1">{viewFlag.resolution_notes}</p></div>}</div>}</DialogContent></Dialog>

      <Dialog open={showResolutionModal} onOpenChange={setShowResolutionModal}><DialogContent><DialogHeader><DialogTitle>Resolve Risk Flag</DialogTitle></DialogHeader><div className="space-y-4"><div><Label htmlFor="resolutionNotes">Resolution notes</Label><textarea id="resolutionNotes" className="mt-1.5 w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm" value={resolutionNotes} onChange={(e) => setResolutionNotes(e.target.value)} placeholder="Document the evidence and rationale..." /></div><DialogFooter>{statusOptions.map(({ value, label, icon: Icon, cls }) => <Button key={value} variant="outline" className={cls} disabled={saving} onClick={() => void resolveFlag(value)}><Icon className="w-4 h-4 mr-1" /> {label}</Button>)}</DialogFooter></div></DialogContent></Dialog>
    </div>
  );
};

export default ComplianceRiskFlags;
