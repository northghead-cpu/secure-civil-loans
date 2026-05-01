import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ShieldCheck, Search, AlertTriangle, Loader2, CheckCircle2, XCircle, AlertCircle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Summary-only type returned by the edge function
interface CRBSummary {
  credit_score: number;
  score_rating: string;
  open_accounts: number;
  probability_of_default: number;
  risk_level: string;
  recommendation: string;
  status: string;
  summary: string;
  adverse_count: number;
  total_outstanding_zmw: number;
  checked_at: string;
}

interface CheckHistoryItem {
  id: string;
  nrcNumber: string;
  fullName: string;
  status: string;
  riskLevel: string;
  recommendation: string;
  checkedAt: string;
  score?: number;
}

const formatZMW = (amount: number): string => `K ${amount.toLocaleString("en-ZM", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const getScoreColorClass = (rating: string): string => {
  switch (rating) {
    case "EXCELLENT": return "text-success";
    case "GOOD": return "text-info";
    case "FAIR": return "text-warning";
    case "POOR": case "VERY_POOR": return "text-destructive";
    default: return "text-muted-foreground";
  }
};

const getRiskBadgeClass = (level: string): string => {
  switch (level) {
    case "LOW": return "bg-success/10 text-success border-success/20";
    case "MEDIUM": return "bg-warning/10 text-warning border-warning/20";
    case "HIGH": return "bg-destructive/10 text-destructive border-destructive/20";
    case "VERY_HIGH": return "bg-destructive/20 text-destructive border-destructive/30";
    default: return "bg-muted text-muted-foreground";
  }
};

const getRecBadgeClass = (rec: string): string => {
  switch (rec) {
    case "APPROVE": return "bg-success text-success-foreground";
    case "APPROVE_WITH_CONDITIONS": return "bg-warning text-warning-foreground";
    case "REVIEW": return "bg-warning text-warning-foreground";
    case "DECLINE": return "bg-destructive text-destructive-foreground";
    default: return "bg-muted text-muted-foreground";
  }
};

const recLabel = (rec: string) => {
  switch (rec) {
    case "APPROVE": return "Approve";
    case "APPROVE_WITH_CONDITIONS": return "Conditional";
    case "REVIEW": return "Review";
    case "DECLINE": return "Decline";
    default: return rec;
  }
};

const statusIcon = (status: string) => {
  switch (status) {
    case "CLEAR": return <CheckCircle2 className="h-5 w-5 text-success" />;
    case "ADVERSE": return <XCircle className="h-5 w-5 text-destructive" />;
    case "NO_RECORD": return <AlertCircle className="h-5 w-5 text-warning" />;
    default: return <Clock className="h-5 w-5 text-muted-foreground" />;
  }
};

const CreditBureau = () => {
  const [searchParams] = useSearchParams();
  const [nrcNumber, setNrcNumber] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentReport, setCurrentReport] = useState<CRBSummary | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [checkHistory, setCheckHistory] = useState<CheckHistoryItem[]>([
    { id: "1", nrcNumber: "123456/12/1", fullName: "John Mwale", status: "CLEAR", riskLevel: "LOW", recommendation: "APPROVE", checkedAt: "2026-03-10 14:30", score: 720 },
    { id: "2", nrcNumber: "234567/12/2", fullName: "Grace Banda", status: "ADVERSE", riskLevel: "HIGH", recommendation: "REVIEW", checkedAt: "2026-03-09 11:20", score: 380 },
    { id: "3", nrcNumber: "345678/12/3", fullName: "Peter Zulu", status: "CLEAR", riskLevel: "MEDIUM", recommendation: "APPROVE_WITH_CONDITIONS", checkedAt: "2026-03-08 09:15", score: 550 },
  ]);

  useEffect(() => {
    const nrcParam = searchParams.get("nrc");
    const nameParam = searchParams.get("name");
    if (nrcParam) setNrcNumber(decodeURIComponent(nrcParam));
    if (nameParam) setFullName(decodeURIComponent(nameParam));
  }, [searchParams]);

  const runCRBCheck = async () => {
    if (!nrcNumber.trim()) { toast.error("Please enter NRC Number"); return; }
    if (!fullName.trim()) { toast.error("Please enter Full Name"); return; }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("crb-proxy", {
        body: { nrc_number: nrcNumber.trim(), full_name: fullName.trim() },
      });

      if (error) {
        toast.error(error.message || "CRB check failed");
        return;
      }

      if (data?.success && data.data) {
        const summary: CRBSummary = data.data;
        setCurrentReport(summary);
        setShowReportModal(true);
        toast.success("Credit Bureau Check Complete");

        // Add to local history (summary only)
        setCheckHistory((prev) => [
          {
            id: crypto.randomUUID(),
            nrcNumber: nrcNumber.trim(),
            fullName: fullName.trim(),
            status: summary.status,
            riskLevel: summary.risk_level,
            recommendation: summary.recommendation,
            checkedAt: new Date(summary.checked_at).toLocaleString(),
            score: summary.credit_score,
          },
          ...prev,
        ]);
      } else {
        toast.error(data?.error || "Check failed");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    total: checkHistory.length,
    clear: checkHistory.filter((h) => h.status === "CLEAR").length,
    adverse: checkHistory.filter((h) => h.status === "ADVERSE").length,
    pending: checkHistory.filter((h) => h.status === "NO_RECORD").length,
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Credit Bureau Check</h1>
          <p className="text-sm text-muted-foreground">Run CRB checks for loan applicants via TransUnion Zambia</p>
        </div>
        <Badge variant="outline" className="border-primary/40 text-primary gap-1.5 px-3 py-1">
          <ShieldCheck className="h-3.5 w-3.5" />
          Data Source: TransUnion Zambia
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><div className="text-2xl font-display font-bold text-foreground">{stats.total}</div><p className="text-sm text-muted-foreground">Total Checks</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-display font-bold text-success">{stats.clear}</div><p className="text-sm text-muted-foreground">Clear</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-display font-bold text-destructive">{stats.adverse}</div><p className="text-sm text-muted-foreground">Adverse</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-display font-bold text-warning">{stats.pending}</div><p className="text-sm text-muted-foreground">No Record</p></CardContent></Card>
      </div>

      {/* Check Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Run New CRB Check
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nrcNumber">NRC Number *</Label>
              <Input id="nrcNumber" placeholder="123456/12/1" value={nrcNumber} onChange={(e) => setNrcNumber(e.target.value)} className="uppercase" disabled={loading} />
              <p className="text-xs text-muted-foreground">Format: 123456/12/1</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name *</Label>
              <Input id="fullName" placeholder="Enter applicant's full name" value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={loading} />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 border border-border">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm font-medium text-foreground">Fetching live Bureau data...</span>
            </div>
          ) : (
            <Button onClick={runCRBCheck} className="w-full sm:w-auto">
              <Search className="h-4 w-4 mr-2" />
              Run CRB Check
            </Button>
          )}
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Recent Checks</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>NRC Number</TableHead>
                <TableHead>Full Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Score</TableHead>
                <TableHead className="hidden md:table-cell">Risk Level</TableHead>
                <TableHead>Recommendation</TableHead>
                <TableHead className="hidden lg:table-cell">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {checkHistory.map((check) => (
                <TableRow key={check.id}>
                  <TableCell className="font-mono text-sm">{check.nrcNumber}</TableCell>
                  <TableCell className="font-medium">{check.fullName}</TableCell>
                  <TableCell><div className="flex items-center gap-2">{statusIcon(check.status)}<span className="text-sm">{check.status === "CLEAR" ? "Clear" : check.status === "ADVERSE" ? "Adverse" : "No Record"}</span></div></TableCell>
                  <TableCell className="hidden sm:table-cell">{check.score !== undefined ? <Badge className={getScoreColorClass(check.score >= 600 ? "EXCELLENT" : check.score >= 500 ? "GOOD" : check.score >= 400 ? "FAIR" : "POOR")}>{String(check.score).padStart(3, "0")}</Badge> : <span className="text-muted-foreground">N/A</span>}</TableCell>
                  <TableCell className="hidden md:table-cell"><Badge className={getRiskBadgeClass(check.riskLevel)}>{check.riskLevel.replace("_", " ")}</Badge></TableCell>
                  <TableCell><Badge className={getRecBadgeClass(check.recommendation)}>{recLabel(check.recommendation)}</Badge></TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">{check.checkedAt}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Report Modal */}
      <Dialog open={showReportModal} onOpenChange={setShowReportModal}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Credit Bureau Report
              <Badge variant="outline" className="ml-auto border-primary/40 text-primary text-xs">TransUnion Zambia</Badge>
            </DialogTitle>
          </DialogHeader>
          {currentReport && (
            <div className="space-y-6 py-4">
              {/* Status Banner */}
              <div className={`p-4 rounded-lg ${currentReport.status === "CLEAR" ? "bg-success/10 border border-success/20" : "bg-destructive/10 border border-destructive/20"}`}>
                <div className="flex items-center gap-3">
                  {currentReport.status === "CLEAR" ? <CheckCircle2 className="h-8 w-8 text-success" /> : <XCircle className="h-8 w-8 text-destructive" />}
                  <div>
                    <p className="font-semibold text-lg">{currentReport.status === "CLEAR" ? "Clear Record" : "Adverse Record Found"}</p>
                    <p className="text-sm text-muted-foreground">{currentReport.summary}</p>
                  </div>
                </div>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className={`text-3xl font-display font-bold ${getScoreColorClass(currentReport.score_rating)}`}>
                    {String(currentReport.credit_score).padStart(3, "0")}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Credit Score</p>
                  <Badge className={`mt-1 ${getScoreColorClass(currentReport.score_rating)}`}>
                    {currentReport.score_rating.replace("_", " ")}
                  </Badge>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-3xl font-display font-bold text-foreground">
                    {currentReport.open_accounts}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Open Accounts</p>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className={`text-3xl font-display font-bold ${currentReport.probability_of_default > 50 ? "text-destructive" : currentReport.probability_of_default > 25 ? "text-warning" : "text-success"}`}>
                    {currentReport.probability_of_default}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Prob. of Default</p>
                </div>
              </div>

              {/* Outstanding */}
              {currentReport.total_outstanding_zmw > 0 && (
                <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <span className="font-semibold text-destructive">Adverse Records: {currentReport.adverse_count}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Total outstanding: {formatZMW(currentReport.total_outstanding_zmw)}</p>
                </div>
              )}

              {/* Risk & Recommendation */}
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <Badge className={`${getRiskBadgeClass(currentReport.risk_level)} text-sm px-3 py-1`}>
                    {currentReport.risk_level.replace("_", " ")} RISK
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-2">Risk Level</p>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <Badge className={`${getRecBadgeClass(currentReport.recommendation)} text-sm px-3 py-1`}>
                    {recLabel(currentReport.recommendation).toUpperCase()}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-2">Recommendation</p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Checked: {new Date(currentReport.checked_at).toLocaleString()} · Data Source: TransUnion Zambia
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CreditBureau;
