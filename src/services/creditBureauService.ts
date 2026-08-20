/**
 * Credit Bureau Service
 * Handles CRB (Credit Reference Bureau) checks for Zambia.
 *
 * This service deliberately does not fabricate credit data. Until a configured
 * CRB provider integration is available, a check fails closed instead of
 * returning simulated scores, adverse records, or recommendations.
 */

export interface CRBCheckRequest {
  nrcNumber: string;
  fullName: string;
  dateOfBirth?: string;
}

export interface CRBAdverseRecord {
  type: "DEFAULT" | "BANKRUPTCY" | "FRAUD" | "CIVIL_JUDGMENT" | "REPOSITORY_ERROR";
  description: string;
  dateReported: string;
  dateResolved?: string;
  amount?: number;
  creditor?: string;
}

export interface CRBCreditScore {
  score: number;
  rating: "EXCELLENT" | "GOOD" | "FAIR" | "POOR" | "VERY_POOR" | "NO_HISTORY";
  creditLimit?: number;
  utilizedCredit?: number;
  totalAccounts: number;
  activeAccounts: number;
  closedAccounts: number;
  delinquencyRate: number;
  lastUpdated: string;
}

export interface CRBReport {
  status: "CLEAR" | "ADVERSE" | "NO_RECORD" | "ERROR";
  nrcNumber: string;
  fullName: string;
  checkedAt: string;
  checkedBy: string;
  score?: CRBCreditScore;
  adverseRecords?: CRBAdverseRecord[];
  summary: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";
  recommendation: "APPROVE" | "APPROVE_WITH_CONDITIONS" | "REVIEW" | "DECLINE";
}

export interface CRBCheckResult {
  success: boolean;
  report?: CRBReport;
  error?: string;
  mockData?: false;
}

export const performCRBCheck = async (
  request: CRBCheckRequest,
  _checkedBy = "Admin"
): Promise<CRBCheckResult> => {
  if (!request.nrcNumber?.trim()) return { success: false, error: "NRC Number is required" };
  if (!request.fullName?.trim()) return { success: false, error: "Full Name is required" };

  const normalizedNRC = request.nrcNumber.replace(/[\s-]/g, "").toUpperCase();
  const nrcPattern = /^\d{6}\/\d{2}\/\d{1}$/;
  if (!nrcPattern.test(normalizedNRC)) {
    return { success: false, error: "Invalid NRC format. Expected format: 123456/12/1" };
  }

  return {
    success: false,
    error: "Credit bureau provider is not configured. No simulated credit result will be returned.",
    mockData: false,
  };
};

export const formatScore = (score: number | undefined): string => {
  if (score === undefined) return "N/A";
  return score.toString().padStart(3, "0");
};

export const getScoreColor = (rating: CRBCreditScore["rating"]): string => {
  switch (rating) {
    case "EXCELLENT": return "text-success";
    case "GOOD": return "text-info";
    case "FAIR": return "text-warning";
    case "POOR": return "text-destructive";
    case "VERY_POOR":
    case "NO_HISTORY":
    default: return "text-muted-foreground";
  }
};

export const getRiskLevelColor = (riskLevel: CRBReport["riskLevel"]): string => {
  switch (riskLevel) {
    case "LOW": return "bg-success/10 text-success border-success/20";
    case "MEDIUM": return "bg-warning/10 text-warning border-warning/20";
    case "HIGH": return "bg-destructive/10 text-destructive border-destructive/20";
    case "VERY_HIGH": return "bg-destructive/20 text-destructive border-destructive/30";
    default: return "bg-muted text-muted-foreground";
  }
};

export const getRecommendationColor = (recommendation: CRBReport["recommendation"]): string => {
  switch (recommendation) {
    case "APPROVE": return "bg-success text-success-foreground";
    case "APPROVE_WITH_CONDITIONS": return "bg-info text-info-foreground";
    case "REVIEW": return "bg-warning text-warning-foreground";
    case "DECLINE": return "bg-destructive text-destructive-foreground";
    default: return "bg-muted text-muted-foreground";
  }
};
