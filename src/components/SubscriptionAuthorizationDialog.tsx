import { useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const AGREEMENT = "I authorize Riverbanc Technology Limited to deduct K60 per month from my payroll for my Riverbanc subscription. This subscription is separate from any loan principal, interest, fees or charges imposed by a financial institution.";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fullName: string;
  onAuthorized: () => void;
}

export default function SubscriptionAuthorizationDialog({ open, onOpenChange, fullName, onAuthorized }: Props) {
  const [accepted, setAccepted] = useState(false);
  const [signatureName, setSignatureName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const expectedName = fullName.trim().toLowerCase();
  const signatureMatches = signatureName.trim().toLowerCase() === expectedName && expectedName.length >= 2;

  const reset = () => {
    setAccepted(false);
    setSignatureName("");
    setSubmitting(false);
  };

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) reset();
  };

  const handleAuthorize = async () => {
    if (!accepted || !signatureMatches || submitting) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("authorize_riverbanc_subscription", {
        _signed_name: signatureName.trim(),
      });
      if (error) throw error;
      toast.success("Subscription authorization recorded", {
        description: "Your authorization is recorded. Payroll confirmation is still required before any deduction is treated as confirmed.",
      });
      onAuthorized();
      handleOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to record your subscription authorization.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Authorize your Riverbanc subscription</DialogTitle>
          <DialogDescription>
            Review the exact payroll authorization below. This is an explicit opt-in and is separate from your lender applications.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Monthly subscription authorization
            </div>
            <p className="text-sm leading-6 text-foreground">{AGREEMENT}</p>
            <p className="mt-3 text-xs text-muted-foreground">Amount: ZMW 60.00 · Frequency: Monthly · Collection method: Payroll deduction</p>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox id="subscription-payroll-consent" checked={accepted} onCheckedChange={(value) => setAccepted(value === true)} />
            <Label htmlFor="subscription-payroll-consent" className="text-sm leading-5 font-normal">
              I have read and expressly agree to this K60 monthly payroll deduction authorization. I understand it is not a loan repayment or lender fee.
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subscription-signature-name">Type your verified legal name</Label>
            <Input
              id="subscription-signature-name"
              value={signatureName}
              onChange={(event) => setSignatureName(event.target.value)}
              autoComplete="name"
              placeholder="Enter your full legal name"
              disabled={submitting}
            />
            <p className="text-xs text-muted-foreground">Your signature must match your verified Riverbanc profile name: {fullName}.</p>
            {signatureMatches && <p className="flex items-center gap-1.5 text-xs text-success"><CheckCircle2 className="h-3.5 w-3.5" />Name matches your profile.</p>}
          </div>

          <p className="text-xs text-muted-foreground">
            Authorization does not prove that payroll has deducted the fee. Your status remains pending until the deduction is confirmed.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleAuthorize} disabled={!accepted || !signatureMatches || submitting}>
            {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Recording…</> : "Authorize K60/month"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
