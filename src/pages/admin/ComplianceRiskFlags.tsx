import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRBAC } from "@/hooks/useRBAC";
import { toast } from "sonner";
import { ShieldAlert, Eye, CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";

type RiskStatus = "open" | "investigating" | "approved" | "rejected" | "needs_review";
type Severity = "critical" | "high" | "medium" | "low";

interface RiskFlag {
  id: string;
  user: string;
  type: string;
  severity: Severity;
  date: string;
  status: RiskStatus;
  notes?: string;
  resolvedBy?: string;
  resolvedAt?: string;
}

const mockFlags: RiskFlag[] = [
  { id: "RF001", user: "John Mwale", type: "Duplicate NRC", severity: "high", date: "2026-03-11", status: "open" },
  { id: "RF002", user: "Unknown", type: "Suspicious document", severity: "critical", date: "2026-03-10", status: "open" },
  { id: "RF003", user: "Grace Banda", type: "Income mismatch", severity: "medium", date: "2026-03-09", status: "investigating" },
  { id: "RF004", user: "Peter Zulu", type: "Multiple applications", severity: "low", date: "2026-03-08", status: "approved", notes: "Verified legitimate", resolvedBy: "Admin", resolvedAt: "2026-03-08" },
  { id: "RF005", user: "Mary Phiri", type: "CRB adverse listing", severity: "high", date: "2026-03-07", status: "open" },
  { id: "RF006", user: "James Chanda", type: "Name mismatch", severity: "medium", date: "2026-03-06", status: "rejected", notes: "Fraudulent submission", resolvedBy: "Super Admin", resolvedAt: "2026-03-06" },
];

const severityColors: Record<Severity, string> = {
  critical: "bg-destructive/20 text-destructive border-destructive/30",
  high: "bg-destructive/10 text-destructive border-destructive/20",
  medium: "bg-warning/10 text-warning border-warning/20",
  low: "bg-info/10 text-info border-info/20",
};

const statusColors: Record<RiskStatus, string> = {
  open: "bg-destructive/10 text-destructive",
  investigating: "bg-warning/10 text-warning",
  approved: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive",
  needs_review: "bg-amber-500/10 text-amber-600",
};

const statusOptions: { value: RiskStatus; label: string; icon: typeof CheckCircle2 }[] = [
  { value: "approved", label: "Approved", icon: CheckCircle2 },
  { value: "rejected", label: "Rejected", icon: XCircle },
  { value: "needs_review", label: "Needs Review", icon: AlertCircle },
  { value: "investigating", label: "Investigating", icon: Eye },
  { value: "open", label: "Reopen", icon: ShieldAlert },
];

const ComplianceRiskFlags = () => {
  const { permissions, logAction, hasRole, highestRole } = useRBAC();
  const [flags, setFlags] = useState<RiskFlag[]>(mockFlags);
  const isSuperAdmin = hasRole("super_admin");
  const [selectedFlag, setSelectedFlag] = useState<RiskFlag | null>(null);
  const [showResolutionModal, setShowResolutionModal] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Stats
  const stats = {
    critical: flags.filter((f) => f.severity === "critical" && f.status !== "approved" && f.status !== "rejected").length,
    open: flags.filter((f) => f.status === "open").length,
    investigating: flags.filter((f) => f.status === "investigating").length,
    resolved: flags.filter((f) => f.status === "approved" || f.status === "rejected").length,
  };

  const openResolutionModal = (flag: RiskFlag) => {
    if (!isSuperAdmin) {
      toast.error("Only Super Admins can resolve risk flags");
      return;
    }
    setSelectedFlag(flag);
    setResolutionNotes(flag.notes || "");
    setShowResolutionModal(true);
  };

  const resolveFlag = async (newStatus: RiskStatus) => {
    if (!selectedFlag) return;
    
    if (!resolutionNotes.trim() && (newStatus === "approved" || newStatus === "rejected")) {
      toast.error("Please provide resolution notes");
      return;
    }

    setSaving(true);
    try {
      const resolvedFlag: RiskFlag = {
        ...selectedFlag,
        status: newStatus,
        notes: resolutionNotes,
        resolvedBy: highestRole || "Unknown",
        resolvedAt: new Date().toISOString().split("T")[0],
      };

      await logAction(
        "resolve_risk_flag",
        selectedFlag.id,
        "risk_flags",
        selectedFlag,
        resolvedFlag
      );

      setFlags((prev) =>
        prev.map((f) => (f.id === selectedFlag.id ? resolvedFlag : f))
      );
      
      toast.success(`Risk flag ${newStatus === "approved" ? "approved" : newStatus === "rejected" ? "rejected" : "updated"}`);
      setShowResolutionModal(false);
    } catch (error) {
      toast.error("Failed to resolve risk flag");
    } finally {
      setSaving(false);
    }
  };

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
            <div className={`text-2xl font-display font-bold ${stats.critical > 0 ? "text-destructive" : "text-muted-foreground"}`}>
              {stats.critical}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">Critical</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-display font-bold text-warning">{stats.open}</div>
            <p className="text-xs sm:text-sm text-muted-foreground">Open</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-display font-bold text-info">{stats.investigating}</div>
            <p className="text-xs sm:text-sm text-muted-foreground">Investigating</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-display font-bold text-success">{stats.resolved}</div>
            <p className="text-xs sm:text-sm text-muted-foreground">Resolved</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="hidden sm:table-cell">Flag ID</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead className="hidden md:table-cell">Status</TableHead>
                <TableHead className="hidden lg:table-cell">Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flags.map((f) => (
                <TableRow key={f.id} className={f.status === "open" || f.status === "needs_review" ? "bg-destructive/5" : ""}>
                  <TableCell className="hidden sm:table-cell font-mono text-sm">{f.id}</TableCell>
                  <TableCell className="font-medium">{f.user}</TableCell>
                  <TableCell>{f.type}</TableCell>
                  <TableCell><Badge className={severityColors[f.severity]}>{f.severity}</Badge></TableCell>
                  <TableCell className="hidden md:table-cell"><Badge className={statusColors[f.status]}>{f.status.replace("_", " ")}</Badge></TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">{f.date}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="ghost" title="View Details">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {isSuperAdmin && (f.status !== "approved" && f.status !== "rejected") && (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="text-success" 
                          onClick={() => openResolutionModal(f)}
                          title="Resolve Flag"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Super Admin Risk Resolution Modal */}
      <Dialog open={showResolutionModal} onOpenChange={setShowResolutionModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              Resolve Risk Flag - {selectedFlag?.id}
            </DialogTitle>
          </DialogHeader>
          {selectedFlag && (
            <div className="space-y-4 py-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">User:</span>
                  <span className="text-sm font-medium">{selectedFlag.user}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Type:</span>
                  <span className="text-sm font-medium">{selectedFlag.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Severity:</span>
                  <Badge className={severityColors[selectedFlag.severity]}>{selectedFlag.severity}</Badge>
                </div>
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
                <div className="grid grid-cols-2 gap-2">
                  {statusOptions.map((option) => (
                    <Button
                      key={option.value}
                      variant="outline"
                      size="sm"
                      onClick={() => resolveFlag(option.value)}
                      disabled={saving}
                      className={`
                        ${option.value === "approved" ? "border-success/50 text-success hover:bg-success/10" : ""}
                        ${option.value === "rejected" ? "border-destructive/50 text-destructive hover:bg-destructive/10" : ""}
                        ${option.value === "needs_review" ? "border-amber-500/50 text-amber-600 hover:bg-amber-500/10" : ""}
                      `}
                    >
                      <option.icon className="h-4 w-4 mr-1" />
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResolutionModal(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ComplianceRiskFlags;
