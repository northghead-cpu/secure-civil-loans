import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ApplyLoanModal({ open, onClose }: Props) {
  const [form, setForm] = useState({
    amount: "",
    purpose: "",
    duration: "",
    income: "",
    employment: "",
    collateral: "",
    notes: "",
  });

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    console.log("Loan Application:", form);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Loan Application</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Input
            placeholder="Loan Amount"
            value={form.amount}
            onChange={(e) => handleChange("amount", e.target.value)}
          />

          <Input
            placeholder="Purpose of Loan"
            value={form.purpose}
            onChange={(e) => handleChange("purpose", e.target.value)}
          />

          <Input
            placeholder="Duration (months)"
            value={form.duration}
            onChange={(e) => handleChange("duration", e.target.value)}
          />

          <Input
            placeholder="Monthly Income"
            value={form.income}
            onChange={(e) => handleChange("income", e.target.value)}
          />

          <Input
            placeholder="Employment Status"
            value={form.employment}
            onChange={(e) => handleChange("employment", e.target.value)}
          />

          <Input
            placeholder="Collateral (Yes/No)"
            value={form.collateral}
            onChange={(e) => handleChange("collateral", e.target.value)}
          />

          <Textarea
            placeholder="Additional Notes"
            value={form.notes}
            onChange={(e) => handleChange("notes", e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              Submit Application
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}