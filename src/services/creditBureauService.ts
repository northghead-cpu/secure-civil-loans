/**
 * Credit Bureau Service
 * Client-side adapter for the production CRB Edge Function.
 * The browser never talks to the CRB provider directly and never generates
 * synthetic credit information.
 */
import { supabase } from "@/integrations/supabase/client";

export interface CRBCheckRequest { nrcNumber: string; fullName: string; dateOfBirth?: string; }
export interface CRBAdverseRecord {
  type: "DEFAULT" | "BANKRUPTCY" | "FRAUD" | "CIVIL_JUDGMENT" | "REPOSITORY_ERROR";
  description: string; dateReported: string; dateResolved?: string; amount?: number; creditor?: string;
}
export interface CRBCreditScore {
  score: number;
  rating: "EXCELLENT" | "GOOD" | "FAIR" | "POOR" | "VERY_POOR" | "NO_HISTORY";
  creditLimit?: number; utilizedCredit?: number; totalAccounts: number; activeAccounts: number;
  closedAccounts: number; delinquencyRate: number; lastUpdated: string;
}
export interface CRBReport {
  status: "CLEAR" | "ADVERSE" | "NO_RECORD" | "ERROR";
  nrcNumber: string; fullName: string; checkedAt: string; checkedBy: string;
  score?: CRBCreditScore; adverseRecords?: CRBAdverseRecord[]; summary: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";
  recommendation: "APPROVE" | "APPROVE_WITH_CONDITIONS" | "REVIEW" | "DECLINE";
}
export interface CRBCheckResult { success: boolean; report?: CRBReport; error?: string; mockData?: boolean; }

export const performCRBCheck = async (request: CRBCheckRequest, checkedBy = "Admin"): Promise<CRBCheckResult> => {
  try {
    if (!request.nrcNumber?.trim()) return { success: false, error: "NRC Number is required", mockData: false };
    if (!request.fullName?.trim()) return { success: false, error: "Full Name is required", mockData: false };

    const normalizedNRC = request.nrcNumber.replace(/[\s-]/g, "").toUpperCase();
    if (!/^\d{6}\/\d{2}\/\d{1}$/.test(normalizedNRC)) {
      return { success: false, error: "Invalid NRC format. Expected format: 123456/12/1", mockData: false };
    }

    const { data, error } = await supabase.functions.invoke("crb-proxy", {
      body: { nrc_number: normalizedNRC, full_name: request.fullName.trim() },
      headers: { "X-Request-Id": crypto.randomUUID() },
    });
    if (error) {
      console.error("[CRB Check] Edge Function error:", error);
      return { success: false, error: "CRB service unavailable", mockData: false };
    }

    const response = data as { success?: boolean; data?: {
      credit_score: number; score_rating: CRBCreditScore["rating"]; open_accounts: number;
      probability_of_default: number; risk_level: CRBReport["riskLevel"];
      recommendation: CRBReport["recommendation"]; status: string; summary: string;
      adverse_count: number; total_outstanding_zmw: number; checked_at: string;
    }; error?: string };
    if (!response.success || !response.data) return { success: false, error: response.error ?? "CRB service unavailable", mockData: false };

    const result = response.data;
    const report: CRBReport = {
      status: result.status === "ADVERSE" ? "ADVERSE" : result.status === "CLEAR" ? "CLEAR" : "ERROR",
      nrcNumber: normalizedNRC,
      fullName: request.fullName.trim(),
      checkedAt: result.checked_at,
      checkedBy,
      score: {
        score: result.credit_score,
        rating: result.score_rating,
        totalAccounts: result.open_accounts,
        activeAccounts: result.open_accounts,
        closedAccounts: 0,
        delinquencyRate: result.probability_of_default,
        lastUpdated: result.checked_at,
      },
      adverseRecords: [],
      summary: result.summary,
      riskLevel: result.risk_level,
      recommendation: result.recommendation,
    };
    return { success: true, report, mockData: false };
  } catch (error) {
    console.error("[CRB Check] Error:", error);
    return { success: false, error: "CRB service unavailable", mockData: false };
  }
};

export const formatScore = (score: number | undefined): string => score === undefined ? "N/A" : score.toString().padStart(3, "0");
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
