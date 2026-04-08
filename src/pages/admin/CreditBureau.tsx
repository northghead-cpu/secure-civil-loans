import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRBAC } from "@/hooks/useRBAC";
import { toast } from "sonner";
import { ShieldCheck, Search, AlertTriangle, Loader2, TrendingUp, TrendingDown, AlertCircle, CheckCircle2, XCircle, Clock, ArrowLeft } from "lucide-react";
import {
  performCRBCheck,
  CRBReport,
  CRBCheckResult,
  getScoreColor,
  getRiskLevelColor,
  getRecommendationColor,
  formatScore,
} from "@/services/creditBureauService";

interface CheckHistoryItem {
  id: string;
  nrcNumber: string;
  fullName: string;
  status: CRBReport["status"];
  riskLevel: CRBReport["riskLevel"];
  recommendation: CRBReport["recommendation"];
  checkedAt: string;
  checkedBy: string;
  score?: number;
}

const CreditBureau = () => {
  const { hasRole } = useRBAC();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [nrcNumber, setNrcNumber] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentReport, setCurrentReport] = useState<CRBReport | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  
  // Read URL params on mount (for pre-filling from Applications page)
  useEffect(() => {
    const nrcParam = searchParams.get("nrc");
    const nameParam = searchParams.get("name");
    const appIdParam = searchParams.get("appId");
    
    if (nrcParam) setNrcNumber(decodeURIComponent(nrcParam));
    if (nameParam) setFullName(decodeURIComponent(nameParam));
    if (appIdParam) setApplicationId(appIdParam);
  }, [searchParams]);

  // Check history
  const [checkHistory] = useState<CheckHistoryItem[]>([
    { id: "1", nrcNumber: "123456/12/1", fullName: "John Mwale", status: "CLEAR", riskLevel: "LOW", recommendation: "APPROVE", checkedAt: "2026-03-10 14:30", checkedBy: "Admin", score: 720 },
    { id: "2", nrcNumber: "234567/12/2", fullName: "Grace Banda", status: "ADVERSE", riskLevel: "HIGH", recommendation: "REVIEW", checkedAt: "2026-03-09 11:20", checkedBy: "Admin", score: 380 },
    { id: "3", nrcNumber: "345678/12/3", fullName: "Peter Zulu", status: "CLEAR", riskLevel: "MEDIUM", recommendation: "APPROVE_WITH_CONDITIONS", checkedAt: "2026-03-08 09:15", checkedBy: "Admin", score: 550 },
    { id: "4", nrcNumber: "456789/12/4", fullName: "Mary Phiri", status: "NO_RECORD", riskLevel: "LOW", recommendation: "APPROVE", checkedAt: "2026-03-07 16:45", checkedBy: "Admin" },
  ]);

  const runCRBCheck = async () => {
    if (!nrcNumber.trim()) {
      toast.error("Please enter NRC Number");
      return;
    }
    if (!fullName.trim()) {
      toast.error("Please enter Full Name");
      return;
    }

    setLoading(true);
    try {
      const result: CRBCheckResult = await performCRBCheck(
        { nrcNumber: nrcNumber.trim(), fullName: fullName.trim() },
        "Admin"
      );

      if (result.success && result.report) {
        setCurrentReport(result.report);
        setShowReportModal(true);
        toast.success("Credit Bureau Check Complete");
      } else {
        toast.error(result.error || "Check failed");
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: CRBReport["status"]) => {
    switch (status) {
      case "CLEAR":
        return <CheckCircle2 className="h-5 w-5 text-success" />;
      case "ADVERSE":
        return <XCircle className="h-5 w-5 text-destructive" />;
      case "NO_RECORD":
        return <AlertCircle className="h-5 w-5 text-warning" />;
      default:
        return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusLabel = (status: CRBReport["status"]) => {
    switch (status) {
      case "CLEAR":
        return "Clear";
      case "ADVERSE":
        return "Adverse";
      case "NO_RECORD":
        return "No Record";
      default:
        return status;
    }
  };

  const getRecommendationLabel = (rec: CRBReport["recommendation"]) => {
    switch (rec) {
      case "APPROVE":
        return "Approve";
      case "APPROVE_WITH_CONDITIONS":
        return "Conditional";
      case "REVIEW":
        return "Review";
      case "DECLINE":
        return "Decline";
      default:
        return rec;
    }
  };

  // Stats
  const stats = {
    total: checkHistory.length,
    clear: checkHistory.filter((h) => h.status === "CLEAR").length,
    adverse: checkHistory.filter((h) => h.status === "ADVERSE").length,
    pending: checkHistory.filter((h) => h.status === "NO_RECORD").length,
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Credit Bureau Check</h1>
        <p className="text-sm text-muted-foreground">
          Run CRB (Credit Reference Bureau) checks for loan applicants
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-display font-bold text-foreground">{stats.total}</div>
            <p className="text-sm text-muted-foreground">Total Checks</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-display font-bold text-success">{stats.clear}</div>
            <p className="text-sm text-muted-foreground">Clear</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-display font-bold text-destructive">{stats.adverse}</div>
            <p className="text-sm text-muted-foreground">Adverse</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-display font-bold text-warning">{stats.pending}</div>
            <p className="text-sm text-muted-foreground">No Record</p>
          </CardContent>
        </Card>
      </div>

      {/* New Check Form */}
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
              <Input
                id="nrcNumber"
                placeholder="123456/12/1"
                value={nrcNumber}
                onChange={(e) => setNrcNumber(e.target.value)}
                className="uppercase"
              />
              <p className="text-xs text-muted-foreground">Format: 123456/12/1</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                placeholder="Enter applicant's full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={runCRBCheck} disabled={loading} className="w-full sm:w-auto">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Checking...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Run CRB Check
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground">
            <AlertTriangle className="h-3 w-3 inline mr-1" />
            Note: This uses simulated data for demonstration. Connect to TransUnion Zambia API for production.
          </p>
        </CardContent>
      </Card>

      {/* Check History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Checks</CardTitle>
        </CardHeader>
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
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(check.status)}
                      <span className="text-sm">{getStatusLabel(check.status)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {check.score !== undefined ? (
                      <Badge className={getScoreColor(
                        check.score >= 600 ? "EXCELLENT" :
                        check.score >= 500 ? "GOOD" :
                        check.score >= 400 ? "FAIR" : "POOR"
                      )}>
                        {formatScore(check.score)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">N/A</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge className={getRiskLevelColor(check.riskLevel)}>
                      {check.riskLevel.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={getRecommendationColor(check.recommendation)}>
                      {getRecommendationLabel(check.recommendation)}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                    {check.checkedAt}
                  </TableCell>
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
            </DialogTitle>
          </DialogHeader>
          {currentReport && (
            <div className="space-y-6 py-4">
              {/* Status Banner */}
              <div className={`p-4 rounded-lg ${
                currentReport.status === "CLEAR" ? "bg-success/10 border border-success/20" : "bg-destructive/10 border border-destructive/20"
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {currentReport.status === "CLEAR" ? (
                      <CheckCircle2 className="h-8 w-8 text-success" />
                    ) : (
                      <XCircle className="h-8 w-8 text-destructive" />
                    )}
                    <div>
                      <p className="font-semibold text-lg">
                        {currentReport.status === "CLEAR" ? "Clear Record" : "Adverse Record Found"}
                      </p>
                      <p className="text-sm text-muted-foreground">{currentReport.summary}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Applicant Info */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">NRC Number:</span>
                  <span className="text-sm font-medium">{currentReport.nrcNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Full Name:</span>
                  <span className="text-sm font-medium">{currentReport.fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Checked At:</span>
                  <span className="text-sm font-medium">{new Date(currentReport.checkedAt).toLocaleString()}</span>
                </div>
              </div>

              {/* Credit Score */}
              {currentReport.score && (
                <div className="bg-muted/50 rounded-lg p-4">
                  <h4 className="font-semibold mb-3">Credit Score</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-background rounded-lg">
                      <div className={`text-4xl font-display font-bold ${getScoreColor(currentReport.score.rating)}`}>
                        {formatScore(currentReport.score.score)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Score (0-999)</p>
                    </div>
                    <div className="text-center p-3 bg-background rounded-lg">
                      <Badge className={getScoreColor(currentReport.score.rating)}>
                        {currentReport.score.rating.replace("_", " ")}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">Rating</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-3 text-center text-sm">
                    <div>
                      <p className="font-medium">{currentReport.score.totalAccounts}</p>
                      <p className="text-xs text-muted-foreground">Total Accounts</p>
                    </div>
                    <div>
                      <p className="font-medium">{currentReport.score.activeAccounts}</p>
                      <p className="text-xs text-muted-foreground">Active</p>
                    </div>
                    <div>
                      <p className="font-medium">{currentReport.score.delinquencyRate}%</p>
                      <p className="text-xs text-muted-foreground">Delinquency</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Adverse Records */}
              {currentReport.adverseRecords && currentReport.adverseRecords.length > 0 && (
                <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4">
                  <h4 className="font-semibold text-destructive flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-4 w-4" />
                    Adverse Records ({currentReport.adverseRecords.length})
                  </h4>
                  <div className="space-y-3">
                    {currentReport.adverseRecords.map((record, index) => (
                      <div key={index} className="bg-background rounded-lg p-3">
                        <div className="flex justify-between">
                          <span className="font-medium text-sm">{record.type.replace("_", " ")}</span>
                          {record.amount && (
                            <span className="text-sm font-medium">ZMW {record.amount.toLocaleString()}</span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{record.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">Reported: {record.dateReported}</p>
                        {record.creditor && (
                          <p className="text-xs text-muted-foreground">Creditor: {record.creditor}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Risk Assessment */}
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <Badge className={`${getRiskLevelColor(currentReport.riskLevel)} text-sm px-3 py-1`}>
                    {currentReport.riskLevel.replace("_", " ")} RISK
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-2">Risk Level</p>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <Badge className={`${getRecommendationColor(currentReport.recommendation)} text-sm px-3 py-1`}>
                    {getRecommendationLabel(currentReport.recommendation).toUpperCase()}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-2">Recommendation</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CreditBureau;
