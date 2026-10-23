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
import { Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { untypedDb } from "@/integrations/supabase/untyped";
import { readAllRows } from "@/lib/readAllRows";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

/**
 * DPA 2021 §38 — Right to data portability.
 * Lets the authenticated user export a machine-readable JSON copy of records
 * held about them. RLS scopes every query to the authenticated user.
 */
const DataExportSection = () => {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setAcknowledged(false);
  };

  const handleExport = async () => {
    if (!user) {
      toast.error("Please sign in to download your data.");
      return;
    }
    setBusy(true);
    try {
      const tables = [
        "profiles",
        "kyc",
        "kyc_documents",
        "loan_applications",
        "application_handoffs",
        "payroll_deduction_authorizations",
        "subscription_authorizations",
        "payment_receipts",
        "support_cases",
        "notifications",
      ] as const;
      const entries = await Promise.all(
        tables.map(
          async (table) =>
            [
              table,
              await readAllRows<Record<string, unknown>>((from, to) =>
                untypedDb
                  .from(table)
                  .select("*")
                  .eq("user_id", user.id)
                  .order("id")
                  .range(from, to),
              ),
            ] as const,
        ),
      );
      const cases =
        entries.find(([table]) => table === "support_cases")?.[1] ?? [];
      const messages = [];
      for (const item of cases) {
        messages.push(
          ...(await readAllRows<Record<string, unknown>>((from, to) =>
            untypedDb
              .from("support_messages")
              .select("*")
              .eq("case_id", item.id)
              .order("id")
              .range(from, to),
          )),
        );
      }
      const payouts = await readAllRows<Record<string, unknown>>((from, to) =>
        untypedDb
          .from("payouts")
          .select("*, loan_applications!inner(user_id)")
          .eq("loan_applications.user_id", user.id)
          .order("id")
          .range(from, to),
      );
      const bundle = {
        exported_at: new Date().toISOString(),
        subject: { user_id: user.id, email: user.email },
        records: {
          ...Object.fromEntries(entries),
          support_messages: messages,
          payouts,
        },
        note: "Includes recorded personal data and document references. Identity-document and receipt file bytes are not embedded.",
      };

      const blob = new Blob([JSON.stringify(bundle, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `riverbanc-data-export-${user.id.slice(0, 8)}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      await supabase.rpc("log_audit", {
        _user_id: user.id,
        _role: "user",
        _action: "data_export_downloaded",
        _record_id: user.id,
        _table_name: "profiles",
        _old_value: null,
        _new_value: null,
      });

      toast.success("Your data export has been downloaded.");
    } catch (err) {
      toast.error("We couldn't build the export. Please try again shortly.");
      console.error("data export failed", err);
    } finally {
      setBusy(false);
    }
  };

  const handleProceed = async () => {
    if (!acknowledged || busy) return;
    handleDialogChange(false);
    await handleExport();
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-display flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Download Your Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => setDialogOpen(true)}
            disabled={busy}
            className="w-full sm:w-auto"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Preparing export…
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download my data (JSON)
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Download your personal data</DialogTitle>
            <DialogDescription className="pt-2 text-foreground/80 leading-relaxed">
              Under Section 38 of the Data Protection Act 2021, you can download
              a machine-readable JSON copy of the personal records Riverbanc
              holds about you. The export may include your profile, KYC
              submissions, loan applications, payouts, and payroll deduction
              authorizations. The file will be saved directly to this device.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-3 py-2">
            <Checkbox
              id="data-export-acknowledgement"
              checked={acknowledged}
              onCheckedChange={(checked) => setAcknowledged(checked === true)}
            />
            <label
              htmlFor="data-export-acknowledgement"
              className="text-sm leading-relaxed cursor-pointer"
            >
              I acknowledge and understand.
            </label>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleDialogChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button onClick={handleProceed} disabled={!acknowledged || busy}>
              {busy ? "Preparing…" : "Proceed with download"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DataExportSection;
