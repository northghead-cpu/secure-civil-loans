import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";

const DataErasureSection = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-display flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Data Erasure
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-foreground/90 leading-relaxed">
            Under Section 60 of the Data Protection Act 2021, you have the right to request the
            erasure of your personal data. Note: If you have an active financial obligation or
            outstanding loan balance, deletion will be rejected. Legally settled historical records
            must be archived for 7 years under banking laws.
          </p>
          <Button
            variant="destructive"
            onClick={() => setOpen(true)}
            className="w-full sm:w-auto"
          >
            Request Account Deletion
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Data Erasure Request</DialogTitle>
            <DialogDescription className="pt-2 text-foreground/80">
              To complete your identity verification and request data erasure, please contact our
              Data Protection Officer. Verified requests are processed within 30 days.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DataErasureSection;
