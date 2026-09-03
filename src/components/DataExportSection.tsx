import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import PaymentReceiptHistory from "@/components/PaymentReceiptHistory";

/**
 * DPA 2021 §38 — Right to data portability.
 * Lets the authenticated user export a machine-readable JSON copy of every
 * record we hold about them. RLS scopes every query to auth.uid().
 */
const DataExportSection = () => {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);

  const handleExport = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const [profile, kyc, loans, payouts, payrollAuths] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("kyc").select("*").eq("user_id", user.id),
        supabase.from("loan_applications").select("*").eq("user_id", user.id),
        supabase.from("payouts").select("*, loan_applications!inner(user_id)").eq("loan_applications.user_id", user.id),
        supabase.from("payroll_deduction_authorizations").select("*").eq("user_id", user.id),
      ]);

      const bundle = {
        exported_at: new Date().toISOString(),
        subject: { user_id: user.id, email: user.email },
        legal_basis: "Data Protection Act 2021, Section 38 — Right to data portability",
        records: {
          profile: profile.data ?? null,
          kyc: kyc.data ?? [],
          loan_applications: loans.data ?? [],
          payouts: payouts.data ?? [],
          payroll_deduction_authorizations: payrollAuths.data ?? [],
        },
      };

      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
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

  return (
    <div className="space-y-6">
      <PaymentReceiptHistory />
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-display flex items-center gap-2"><Download className="h-5 w-5 text-primary" />Download Your Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-foreground/90 leading-relaxed">Under Section 38 of the Data Protection Act 2021, you can obtain a machine-readable copy of every record we hold about you — profile, KYC submissions, loan applications, payouts, and consent history. The file downloads directly to your device as JSON.</p>
          <Button onClick={handleExport} disabled={busy} className="w-full sm:w-auto">
            {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Preparing export…</> : <><Download className="h-4 w-4 mr-2" />Download my data (JSON)</>}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default DataExportSection;
