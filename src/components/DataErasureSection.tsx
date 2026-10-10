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
            Data erasure
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-foreground/90 leading-relaxed">
            Section 60 of Zambia's Data Protection Act No. 3 of 2021 provides a right to request erasure in specified circumstances. Riverbanc assesses each request against the purpose for holding each category of information and any applicable legal obligation or need to establish, exercise or defend a legal claim. An active loan or financial obligation does not automatically require all of your information to be retained. Where a record must lawfully be kept, access and use remain limited to the permitted purpose.
          </p>
          <Button variant="destructive" onClick={() => setOpen(true)} className="w-full sm:w-auto">
            Request data erasure
          </Button>
        </CardContent>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Data erasure request</DialogTitle>
            <DialogDescription className="pt-2 text-foreground/80">
              Email <a className="underline text-primary" href="mailto:support@riverbanc.co.zm?subject=Privacy%20request">support@riverbanc.co.zm</a> with the subject "Privacy request". We may ask for information to verify your identity. We will assess the request and respond within the applicable statutory timeframe, generally 14 days under the Data Protection (General) Regulations. If any information cannot lawfully be erased, we will explain the applicable reason where appropriate.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter><Button onClick={() => setOpen(false)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DataErasureSection;
