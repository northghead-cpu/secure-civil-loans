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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ApplyLoanModal({ open, onClose }: Props) {
  const { user, profile } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    amount: "",
    purpose: "",
    duration: "",
    notes: "",
  });

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error("You must be logged in to apply.");
      return;
    }

    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) {
      toast.error("Please enter a valid loan amount.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("loan_applications").insert({
        user_id: user.id,
        full_name: profile?.full_name || null,
        nrc_number: profile?.nrc_number || null,
        employer: profile?.employer || null,
        employee_number: profile?.employee_number || null,
        gross_salary: profile?.salary || null,
        consent_accepted: true,
        signature_name: profile?.full_name || null,
        status: "pending",
      });

      if (error) throw error;

      toast.success("Your application is under review", {
        description: "We'll notify you once your loan application has been processed.",
      });

      setForm({ amount: "", purpose: "", duration: "", notes: "" });
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to submit application";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Apply for a Loan</DialogTitle>
          <DialogDescription>Fill in the details below to submit your loan application.</DialogDescription>
        </DialogHeader>

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
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Submit Application
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
