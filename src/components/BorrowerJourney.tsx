import { CheckCircle2, Circle, Clock3, FileCheck2, ShieldCheck, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface BorrowerJourneyProps {
  kycStatus: string;
  consentAccepted: boolean;
  applicationCount: number;
  onKyc: () => void;
  onCompare: () => void;
}

type StepState = "complete" | "current" | "upcoming" | "attention";

const BorrowerJourney = ({ kycStatus, consentAccepted, applicationCount, onKyc, onCompare }: BorrowerJourneyProps) => {
  const navigate = useNavigate();
  const normalizedKyc = kycStatus.toUpperCase();
  const kycComplete = normalizedKyc === "VERIFIED" || normalizedKyc === "COMPLETED";
  const kycInReview = normalizedKyc === "IN_REVIEW";
  const kycRejected = normalizedKyc === "REJECTED";

  const steps: { label: string; description: string; state: StepState }[] = [
    { label: "Account created", description: "Your Riverbanc account is ready.", state: "complete" },
    {
      label: "Identity & employment verification",
      description: kycRejected ? "Action required: resubmit your verification information." : kycInReview ? "Your verification information is being reviewed." : kycComplete ? "Your identity and employment information is verified." : "Verify your identity and employment to unlock eligible offers.",
      state: kycRejected ? "attention" : kycInReview ? "current" : kycComplete ? "complete" : "current",
    },
    {
      label: "Compare eligible offers",
      description: kycComplete ? (applicationCount > 0 ? "Review the offers available to you and your applications." : "Verified lender offers will appear here when available.") : "Available after verification is complete.",
      state: kycComplete ? "current" : "upcoming",
    },
    { label: "Choose a financial institution", description: "Select the lender and product you want to pursue.", state: kycComplete && applicationCount > 0 ? "current" : "upcoming" },
    { label: "Lender review & decision", description: applicationCount > 0 ? "Track the selected financial institution's review and decision." : "The selected financial institution reviews your application and makes the lending decision.", state: applicationCount > 0 ? "current" : "upcoming" },
  ];

  const firstActionStep = steps.find((step) => step.state === "current" || step.state === "attention");
  const getIcon = (state: StepState) => state === "complete" ? <CheckCircle2 className="h-5 w-5 text-success" /> : state === "attention" ? <AlertCircle className="h-5 w-5 text-destructive" /> : state === "current" ? <Clock3 className="h-5 w-5 text-primary" /> : <Circle className="h-5 w-5 text-muted-foreground" />;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div><CardTitle className="text-xl font-display flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />Your Riverbanc journey</CardTitle><p className="text-sm text-muted-foreground mt-1">Follow your progress from verification to lender decision.</p></div>
          {firstActionStep && <Badge variant={firstActionStep.state === "attention" ? "destructive" : "secondary"}>{firstActionStep.state === "attention" ? "Action required" : "Next step"}</Badge>}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-0">
          {steps.map((step, index) => (
            <div key={step.label} className="flex gap-3">
              <div className="flex flex-col items-center"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-background border border-border">{getIcon(step.state)}</div>{index < steps.length - 1 && <div className="w-px flex-1 min-h-8 bg-border" />}</div>
              <div className="pb-6 pt-1 flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{step.label}</p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">{step.description}</p>
                {step.state === "attention" && <Button size="sm" className="mt-3" onClick={onKyc}>Resubmit verification</Button>}
                {step.label === "Identity & employment verification" && step.state === "current" && !kycInReview && !kycComplete && <Button size="sm" className="mt-3" onClick={onKyc}>Start verification</Button>}
                {step.label === "Compare eligible offers" && step.state === "current" && <Button size="sm" variant="outline" className="mt-3" onClick={onCompare}><FileCheck2 className="mr-2 h-4 w-4" />View comparison</Button>}
                {step.label === "Lender review & decision" && applicationCount > 0 && <Button size="sm" variant="outline" className="mt-3" onClick={() => navigate("/application-status")}><FileCheck2 className="mr-2 h-4 w-4" />Track application</Button>}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 rounded-lg border border-border/60 bg-background/60 p-3 text-xs text-muted-foreground"><strong className="text-foreground">Important:</strong> Riverbanc facilitates the comparison and application process. Participating financial institutions provide the loan products and make lending decisions.</div>
        {!consentAccepted && kycComplete && <div className="mt-3 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-foreground">Your verification is complete. Any required payroll deduction consent will be presented before you proceed with the relevant application step.</div>}
      </CardContent>
    </Card>
  );
};

export default BorrowerJourney;
