import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";

const DataErasureSection = () => {
  const [open, setOpen] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const handleDialogChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) setAcknowledged(false);
  };

  const handleProceed = () => {
    if (!acknowledged) return;
    // This opens the user's email client; the request is not submitted automatically.
    window.location.href = "mailto:support@riverbanc.co.zm?subject=Privacy%20request";
    handleDialogChange(false);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-display flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Data erasure
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => setOpen(true)} className="w-full sm:w-auto">
            Request data erasure
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={handleDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Data erasure request</DialogTitle>
            <DialogDescription className="pt-2 text-foreground/80 leading-relaxed">
              Section 60 of Zambia's Data Protection Act No. 3 of 2021 provides a right to request erasure in specified circumstances. Riverbanc assesses each request against the purpose for holding each category of information and any applicable legal obligation or need to establish, exercise or defend a legal claim. An active loan or financial obligation does not automatically require all information to be retained. Where a record must lawfully be kept, access and use remain limited to the permitted purpose.
            </DialogDescription>
            <p className="text-sm text-foreground/80">
              To start your request, email support@riverbanc.co.zm with the subject “Privacy request”. Riverbanc may ask for information needed to verify your identity and will assess the request under the applicable statutory timeframe. This step opens your email app; it does not send a request automatically.
            </p>
          </DialogHeader>
          <div className="flex items-start gap-3 py-2">
            <Checkbox
              id="data-erasure-acknowledgement"
              checked={acknowledged}
              onCheckedChange={(checked) => setAcknowledged(checked === true)}
            />
            <label htmlFor="data-erasure-acknowledgement" className="text-sm leading-relaxed cursor-pointer">
              I acknowledge and understand.
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleDialogChange(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleProceed} disabled={!acknowledged}>
              Proceed with request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DataErasureSection;
