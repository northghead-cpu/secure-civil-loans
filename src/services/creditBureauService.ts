/**
 * Credit Bureau Service
 * Handles CRB (Credit Reference Bureau) checks for Zambia
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
  score: number; // 0-999 for TransUnion Zambia typically
  rating: "EXCELLENT" | "GOOD" | "FAIR" | "POOR" | "VERY_POOR" | "NO_HISTORY";
  creditLimit?: number;
  utilizedCredit?: number;
  totalAccounts: number;
  activeAccounts: number;
  closedAccounts: number;
  delinquencyRate: number; // percentage
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
  mockData?: boolean; // Indicates if using simulated data
}

// Simulated CRB data for demo/testing purposes
const generateMockCRBReport = (nrcNumber: string, fullName: string): CRBReport => {
  const hasAdverseRecords = Math.random() > 0.7; // 30% chance of adverse records
  
  const score = Math.floor(Math.random() * 600) + 200; // Score between 200-800
  let rating: CRBCreditScore["rating"];
  if (score >= 700) rating = "EXCELLENT";
  else if (score >= 600) rating = "GOOD";
  else if (score >= 500) rating = "FAIR";
  else if (score >= 400) rating = "POOR";
  else if (score >= 200) rating = "VERY_POOR";
  else rating = "NO_HISTORY";

  const adverseRecords: CRBAdverseRecord[] = hasAdverseRecords ? [
    {
      type: "DEFAULT",
      description: "Payment default on personal loan",
      dateReported: "2025-06-15",
      creditor: "Zanaco Bank",
      amount: 12500,
    }
  ] : [];

  const hasAdverse = adverseRecords.length > 0;
  let riskLevel: CRBReport["riskLevel"];
  let recommendation: CRBReport["recommendation"];
  
  if (!hasAdverse && score >= 600) {
    riskLevel = "LOW";
    recommendation = "APPROVE";
  } else if (!hasAdverse && score >= 450) {
    riskLevel = "MEDIUM";
    recommendation = "APPROVE_WITH_CONDITIONS";
  } else if (score >= 300) {
    riskLevel = "HIGH";
    recommendation = "REVIEW";
  } else {
    riskLevel = "VERY_HIGH";
    recommendation = "DECLINE";
  }

  return {
    status: hasAdverse ? "ADVERSE" : "CLEAR",
    nrcNumber,
    fullName,
    checkedAt: new Date().toISOString(),
    checkedBy: "System",
    score: {
      score,
      rating,
      creditLimit: Math.floor(Math.random() * 100000) + 20000,
      utilizedCredit: Math.floor(Math.random() * 50000),
      totalAccounts: Math.floor(Math.random() * 10) + 1,
      activeAccounts: Math.floor(Math.random() * 5) + 1,
      closedAccounts: Math.floor(Math.random() * 5),
      delinquencyRate: hasAdverse ? 25 : Math.floor(Math.random() * 10),
      lastUpdated: new Date().toISOString(),
    },
    adverseRecords,
    summary: hasAdverse 
      ? `Adverse record found: ${adverseRecords.length} item(s) on file. Total outstanding: ZMW ${adverseRecords.reduce((sum, r) => sum + (r.amount || 0), 0).toLocaleString()}`
      : "No adverse records found. Credit history is clear.",
    riskLevel,
    recommendation,
  };
};

/**
 * Perform a Credit Bureau check
 * In production, this would connect to TransUnion Zambia or another CRB provider
 */
export const performCRBCheck = async (
  request: CRBCheckRequest,
  checkedBy: string = "Admin"
): Promise<CRBCheckResult> => {
  try {
    // Validate inputs
    if (!request.nrcNumber || !request.nrcNumber.trim()) {
      return {
        success: false,
        error: "NRC Number is required",
      };
    }

    if (!request.fullName || !request.fullName.trim()) {
      return {
        success: false,
        error: "Full Name is required",
      };
    }

    // Normalize NRC format (remove spaces and dashes)
    const normalizedNRC = request.nrcNumber.replace(/[\s-]/g, "").toUpperCase();

    // Validate NRC format for Zambia (e.g., 123456/12/1)
    const nrcPattern = /^\d{6}\/\d{2}\/\d{1}$/;
    if (!nrcPattern.test(normalizedNRC)) {
      return {
        success: false,
        error: "Invalid NRC format. Expected format: 123456/12/1",
      };
    }

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Generate mock report (in production, this would call the actual CRB API)
    const report = generateMockCRBReport(normalizedNRC, request.fullName);
    report.checkedBy = checkedBy;

    console.log("[CRB Check] Report generated:", {
      nrc: normalizedNRC,
      status: report.status,
      score: report.score?.score,
      riskLevel: report.riskLevel,
    });

    return {
      success: true,
      report,
      mockData: true, // Set to false when using real API
    };
  } catch (error) {
    console.error("[CRB Check] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
};

/**
 * Format credit score for display
 */
export const formatScore = (score: number | undefined): string => {
  if (score === undefined) return "N/A";
  return score.toString().padStart(3, "0");
};

/**
 * Get score color based on rating
 */
export const getScoreColor = (rating: CRBCreditScore["rating"]): string => {
  switch (rating) {
    case "EXCELLENT":
      return "text-success";
    case "GOOD":
      return "text-info";
    case "FAIR":
      return "text-warning";
    case "POOR":
      return "text-destructive";
    case "VERY_POOR":
    case "NO_HISTORY":
      return "text-muted-foreground";
    default:
      return "text-muted-foreground";
  }
};

/**
 * Get risk level badge color
 */
export const getRiskLevelColor = (riskLevel: CRBReport["riskLevel"]): string => {
  switch (riskLevel) {
    case "LOW":
      return "bg-success/10 text-success border-success/20";
    case "MEDIUM":
      return "bg-warning/10 text-warning border-warning/20";
    case "HIGH":
      return "bg-destructive/10 text-destructive border-destructive/20";
    case "VERY_HIGH":
      return "bg-destructive/20 text-destructive border-destructive/30";
    default:
      return "bg-muted text-muted-foreground";
  }
};

/**
 * Get recommendation badge color
 */
export const getRecommendationColor = (recommendation: CRBReport["recommendation"]): string => {
  switch (recommendation) {
    case "APPROVE":
      return "bg-success text-success-foreground";
    case "APPROVE_WITH_CONDITIONS":
      return "bg-info text-info-foreground";
    case "REVIEW":
      return "bg-warning text-warning-foreground";
    case "DECLINE":
      return "bg-destructive text-destructive-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
};
