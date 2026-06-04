import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

const AGREEMENT_VERSION = "pda-v1-2026-06";

const buildAgreementText = (opts: {
  fullName: string;
  employer: string;
  amount: string;
  duration: string;
}) =>
  `PAYROLL DEDUCTION & REPAYMENT AUTHORIZATION (${AGREEMENT_VERSION})

I, ${opts.fullName || "[borrower]"}, employed by ${opts.employer || "[employer]"}, hereby irrevocably authorize Riverbanc and the partner lender to:

1. Deduct the agreed monthly repayment from my salary at source via my employer's payroll, for the loan amount of ZMW ${opts.amount || "[amount]"} repayable over ${opts.duration || "[term]"} month(s).
2. Initiate alternative recovery (mobile money / bank debit) for any month a payroll deduction cannot be processed.
3. Share my employment, salary, and repayment data with the lender, employer payroll office, and the Credit Reference Bureau for the duration of the loan.
4. Continue deductions until the loan, interest, and any lawful fees are fully repaid. This authorization remains in force for the full loan term and cannot be cancelled unilaterally while a balance is outstanding.

No charges, deductions, or disbursements will be made until this authorization is signed and on file.`;

export default function ApplyLoanModal({ open, onClose }: Props) {
  const { user, profile } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<"details" | "esign">("details");
  const [form, setForm] = useState({
    amount: "",
    purpose: "",
    duration: "",
    notes: "",
  });
  const [esign, setEsign] = useState({
    accepted: false,
    signatureName: "",
  });

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const reset = () => {
    setForm({ amount: "", purpose: "", duration: "", notes: "" });
    setEsign({ accepted: false, signatureName: "" });
    setStep("details");
  };

  const goToEsign = () => {
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) {
      toast.error("Please enter a valid loan amount.");
      return;
    }
    if (!form.duration || isNaN(Number(form.duration)) || Number(form.duration) <= 0) {
      toast.error("Please enter a valid repayment duration.");
      return;
    }
    setEsign((p) => ({ ...p, signatureName: profile?.full_name || "" }));
    setStep("esign");
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error("You must be logged in to apply.");
      return;
    }
    const expectedName = (profile?.full_name || "").trim().toLowerCase();
    const typedName = esign.signatureName.trim().toLowerCase();
    if (!esign.accepted) {
      toast.error("You must accept the payroll deduction authorization.");
      return;
    }
    if (!typedName) {
      toast.error("Please type your full legal name as your signature.");
      return;
    }
    if (expectedName && typedName !== expectedName) {
      toast.error("Signature must match your verified full name on file.");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create the loan application
      const { data: app, error: appError } = await supabase
        .from("loan_applications")
        .insert({
          user_id: user.id,
          full_name: profile?.full_name || null,
          nrc_number: profile?.nrc_number || null,
          employer: profile?.employer || null,
          employee_number: profile?.employee_number || null,
          gross_salary: profile?.salary || null,
          requested_amount: Number(form.amount),
          selected_repayment_months: Number(form.duration),
          consent_accepted: true,
          signature_name: esign.signatureName.trim(),
          status: "pending",
        })
        .select("id")
        .single();

      if (appError) throw appError;

      // 2. Store the immutable signed authorization
      const agreementText = buildAgreementText({
        fullName: profile?.full_name || "",
        employer: profile?.employer || "",
        amount: form.amount,
        duration: form.duration,
      });

      const { error: authError } = await supabase
        .from("payroll_deduction_authorizations")
        .insert({
          user_id: user.id,
          loan_application_id: app.id,
          agreement_version: AGREEMENT_VERSION,
          agreement_text: agreementText,
          signature_name: esign.signatureName.trim(),
          signer_full_name: profile?.full_name || null,
          signer_nrc: profile?.nrc_number || null,
          signer_employer: profile?.employer || null,
          signer_employee_number: profile?.employee_number || null,
          authorized_amount: Number(form.amount),
          authorized_term_months: Number(form.duration),
          user_agent: navigator.userAgent.slice(0, 500),
          status: "active",
        });

      if (authError) throw authError;

      toast.success("Application submitted", {
        description: "Your signed payroll deduction authorization is on file. We'll be in touch.",
      });

      reset();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to submit application";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const agreementPreview = buildAgreementText({
    fullName: profile?.full_name || "",
    employer: profile?.employer || "",
    amount: form.amount,
    duration: form.duration,
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">
            {step === "details" ? "Apply for a Loan" : "Payroll Deduction E-Sign"}
          </DialogTitle>
          <DialogDescription>
            {step === "details"
              ? "Fill in the details below to submit your loan application."
              : "Review and sign the payroll deduction & repayment authorization. No charges start until this is signed."}
          </DialogDescription>
        </DialogHeader>

        {step === "details" && (
          <div className="space-y-4 pt-2">
            <div>
              <Label htmlFor="loan-amount">Loan Amount (ZMW)</Label>
              <Input
                id="loan-amount"
                type="number"
                placeholder="e.g. 50000"
                value={form.amount}
                onChange={(e) => handleChange("amount", e.target.value)}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="loan-purpose">Purpose of Loan</Label>
              <Input
                id="loan-purpose"
                placeholder="e.g. Home improvement"
                value={form.purpose}
                onChange={(e) => handleChange("purpose", e.target.value)}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="loan-duration">Preferred Duration (months)</Label>
              <Input
                id="loan-duration"
                type="number"
                placeholder="e.g. 36"
                value={form.duration}
                onChange={(e) => handleChange("duration", e.target.value)}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="loan-notes">Additional Notes</Label>
              <Textarea
                id="loan-notes"
                placeholder="Any additional information..."
                value={form.notes}
                onChange={(e) => handleChange("notes", e.target.value)}
                className="mt-1.5"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={onClose} disabled={submitting}>
                Cancel
              </Button>
              <Button onClick={goToEsign} disabled={submitting}>
                Continue to E-Sign
              </Button>
            </div>
          </div>
        )}

        {step === "esign" && (
          <div className="space-y-4 pt-2">
            <div className="rounded-md border border-border bg-muted/40 p-3 max-h-56 overflow-y-auto text-xs leading-relaxed whitespace-pre-wrap font-mono">
              {agreementPreview}
            </div>

            <div className="flex items-start gap-2">
              <Checkbox
                id="pda-accept"
                checked={esign.accepted}
                onCheckedChange={(c) => setEsign((p) => ({ ...p, accepted: c === true }))}
              />
              <Label
                htmlFor="pda-accept"
                className="text-sm text-muted-foreground leading-relaxed cursor-pointer"
              >
                I have read and agree to the payroll deduction & repayment authorization above. I
                understand it is irrevocable until the loan is fully repaid.
              </Label>
            </div>

            <div>
              <Label htmlFor="pda-signature">Digital Signature (type your full legal name)</Label>
              <Input
                id="pda-signature"
                placeholder={profile?.full_name || "Full legal name"}
                value={esign.signatureName}
                onChange={(e) =>
                  setEsign((p) => ({ ...p, signatureName: e.target.value }))
                }
                className="mt-1.5 font-serif italic text-lg"
              />
              {profile?.full_name && (
                <p className="text-xs text-muted-foreground mt-1">
                  Must match your verified name: <strong>{profile.full_name}</strong>
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="w-4 h-4 text-primary" />
              Your signature, timestamp, and browser details will be stored as a tamper-evident record.
            </div>

            <div className="flex justify-between gap-3 pt-2">
              <Button variant="outline" onClick={() => setStep("details")} disabled={submitting}>
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || !esign.accepted || !esign.signatureName.trim()}
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Sign & Submit
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
