import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const AUTHORIZATION_VERSION = "handoff-v1-2026-08";
const INFORMATION_CATEGORIES = [
  "Identity information",
  "Employment information",
  "Income information",
  "Verification results",
  "Relevant supporting documents",
];

export interface HandoffOffer {
  id: string;
  lender: string;
  rate: number;
  term: number;
  monthlyPayment: number;
  totalCost: number;
  maxAmount: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  offer: HandoffOffer | null;
  requestedAmount: number;
}

export default function LenderHandoffModal({ open, onClose, offer, requestedAmount }: Props) {
  const { user, profile } = useAuth();
  const [accepted, setAccepted] = useState(false);
  const [signatureName, setSignatureName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const authorizationText = useMemo(() => {
    if (!offer) return "";
    return `INFORMATION-SHARING AUTHORIZATION (${AUTHORIZATION_VERSION})\n\nI authorize Riverbanc Technology Limited to prepare and share the verified information listed below with ${offer.lender} for the purpose of supporting my selected loan application.\n\nThis authorization is separate from Riverbanc's K60/month subscription payroll deduction and does not authorize Riverbanc or the financial institution to deduct loan repayments from my salary. The financial institution will make its own lending decision and may require additional information or agreements before any loan is approved or disbursed.\n\nSelected loan amount: ZMW ${requestedAmount.toLocaleString()}\nSelected term: ${offer.term} months\nSelected annual interest rate: ${offer.rate}%\n\nInformation categories authorized for sharing:\n${INFORMATION_CATEGORIES.map((item) => `- ${item}`).join("\n")}`;
  }, [offer, requestedAmount]);

  const reset = () => {
    setAccepted(false);
    setSignatureName("");
    setSubmitting(false);
  };

  const handleClose = () => {
    if (!submitting) {
      reset();
      onClose();
    }
  };

  const handleAuthorize = async () => {
    if (!user || !offer) return;
    const expectedName = (profile?.full_name || "").trim().toLowerCase();
    const typedName = signatureName.trim().toLowerCase();

    if (!accepted) {
      toast.error("Please authorize the information-sharing terms before continuing.");
      return;
    }
    if (!signatureName.trim()) {
      toast.error("Please enter your full legal name as your authorization signature.");
      return;
    }
    if (expectedName && typedName !== expectedName) {
      toast.error("Your signature must match your verified full name on file.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("application_handoffs" as never).insert({
        user_id: user.id,
        lender_product_id: offer.id,
        lender_name: offer.lender,
        requested_amount: requestedAmount,
        term_months: offer.term,
        interest_rate: offer.rate,
        estimated_monthly_repayment: offer.monthlyPayment,
        total_repayment: offer.totalCost,
        information_categories: INFORMATION_CATEGORIES,
        authorization_text: authorizationText,
        authorization_version: AUTHORIZATION_VERSION,
        authorized_at: new Date().toISOString(),
        authorization_signature: signatureName.trim(),
        status: "authorized",
      } as never);

      if (error) throw error;

      toast.success("Information sharing authorized", {
        description: "Riverbanc will prepare your application for the selected financial institution.",
      });
      reset();
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to authorize the application handoff.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!offer) return null;

  return (
    <Dialog open={open} onOpenChange={(value) => !value && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Review your selection</DialogTitle>
          <DialogDescription>
            You are selecting a financial institution, not accepting a loan. The financial institution makes the final lending decision.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          <div className="rounded-xl border border-border/60 bg-card p-4">
            <p className="text-sm text-muted-foreground">Selected institution</p>
            <p className="mt-1 font-display font-semibold text-foreground">{offer.lender}</p>
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-muted-foreground">Amount</p><p className="font-medium">K{requestedAmount.toLocaleString()}</p></div>
              <div><p className="text-muted-foreground">Term</p><p className="font-medium">{offer.term} months</p></div>
              <div><p className="text-muted-foreground">Annual rate</p><p className="font-medium">{offer.rate}%</p></div>
              <div><p className="text-muted-foreground">Est. monthly</p><p className="font-medium">K{offer.monthlyPayment.toLocaleString()}</p></div>
              <div className="col-span-2"><p className="text-muted-foreground">Estimated total repayment</p><p className="font-medium">K{offer.totalCost.toLocaleString()}</p></div>
            </div>
          </div>

          <div>
            <h3 className="font-display font-semibold text-foreground">Information to be shared</h3>
            <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
              {INFORMATION_CATEGORIES.map((item) => (
                <li key={item} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" />{item}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs leading-relaxed whitespace-pre-wrap max-h-44 overflow-y-auto">
            {authorizationText}
          </div>

          <div className="flex items-start gap-2">
            <Checkbox id="handoff-accept" checked={accepted} onCheckedChange={(checked) => setAccepted(checked === true)} />
            <Label htmlFor="handoff-accept" className="cursor-pointer text-sm leading-relaxed text-muted-foreground">
              I authorize Riverbanc to share the verified information listed above with the selected financial institution for my loan application.
            </Label>
          </div>

          <div>
            <Label htmlFor="handoff-signature">Authorization signature</Label>
            <Input
              id="handoff-signature"
              placeholder={profile?.full_name || "Full legal name"}
              value={signatureName}
              onChange={(event) => setSignatureName(event.target.value)}
              className="mt-1.5"
            />
            {profile?.full_name && <p className="mt-1 text-xs text-muted-foreground">Must match your verified name: <strong>{profile.full_name}</strong></p>}
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            This authorization is recorded separately from your Riverbanc K60/month subscription consent.
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <Button variant="outline" onClick={handleClose} disabled={submitting}>Cancel</Button>
            <Button onClick={handleAuthorize} disabled={submitting || !accepted || !signatureName.trim()}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Authorize & continue <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
