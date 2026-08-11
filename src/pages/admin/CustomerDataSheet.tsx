import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminHero, AdminPageShell, adminCardClass } from "@/components/admin/AdminPageShell";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { sanitizeError } from "@/lib/errors";
import { ExternalLink, RefreshCw, ShieldCheck, Table2 } from "lucide-react";

const TABS = [
  "Users",
  "Employment",
  "KYC & Verification",
  "Applications",
  "Offers",
  "Underwriting & Risk",
  "Subscriptions & Revenue",
  "Engagement",
  "Consent",
  "Support",
  "Audit & Security",
  "Dashboard",
];

interface SyncState {
  spreadsheet_id: string | null;
  last_synced_at: string | null;
  row_counts: Record<string, number> | null;
  last_error: string | null;
}

const CustomerDataSheet = () => {
  const { toast } = useToast();
  const [state, setState] = useState<SyncState | null>(null);
  const [sheetId, setSheetId] = useState("");
  const [syncing, setSyncing] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("report_sync_state")
      .select("spreadsheet_id,last_synced_at,row_counts,last_error")
      .eq("id", "google_sheets")
      .maybeSingle();
    if (data) setState(data as unknown as SyncState);
  };

  useEffect(() => {
    void load();
  }, []);

  const runSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sheets-export", {
        body: { action: "sync", ...(sheetId.trim() ? { spreadsheetId: sheetId.trim() } : {}) },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({
        title: data?.created ? "Workbook created and synced" : "Workbook synced",
        description: "All 12 tabs were refreshed from the Riverbanc database.",
      });
      await load();
    } catch (err) {
      toast({
        title: "Sync failed",
        description: sanitizeError(err),
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const url = state?.spreadsheet_id
    ? `https://docs.google.com/spreadsheets/d/${state.spreadsheet_id}/edit`
    : null;

  return (
    <AdminPageShell>
      <AdminHero
        badge="Google Sheets reporting"
        title="Customer data workbook synchronised from Riverbanc"
        description="A server-side export pushes 12 reporting tabs plus a management dashboard into one Google Sheets workbook. NRC values are masked and no credentials, tokens, documents or payslips ever leave the platform."
        stats={[
          { label: "Sheets", value: String(TABS.length), meta: "Including the Dashboard KPI view" },
          {
            label: "Last sync",
            value: state?.last_synced_at
              ? new Date(state.last_synced_at).toLocaleString()
              : "Never",
            meta: state?.spreadsheet_id ? "Workbook linked" : "No workbook yet",
          },
          {
            label: "Rows exported",
            value: String(
              Object.values(state?.row_counts ?? {}).reduce((a, b) => a + b, 0),
            ),
            meta: "Across all tabs",
          },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card className={adminCardClass}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-display">
              <RefreshCw className="h-4 w-4" /> Run a refresh
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Leave the field empty to create a new workbook on the first run, or paste an
              existing spreadsheet ID to keep syncing into it.
            </p>
            <div className="space-y-2">
              <Label htmlFor="sheet-id">Spreadsheet ID (optional)</Label>
              <Input
                id="sheet-id"
                value={sheetId}
                onChange={(e) => setSheetId(e.target.value)}
                placeholder={state?.spreadsheet_id ?? "Created automatically on first sync"}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={runSync} disabled={syncing}>
                <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Syncing…" : "Sync now"}
              </Button>
              {url && (
                <Button variant="outline" asChild>
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" /> Open workbook
                  </a>
                </Button>
              )}
            </div>
            {state?.last_error && (
              <p className="text-sm text-destructive">Last error: {state.last_error}</p>
            )}
          </CardContent>
        </Card>

        <Card className={adminCardClass}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-display">
              <ShieldCheck className="h-4 w-4" /> Data controls
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Admin and super admin only; the role is re-checked server-side on every run.</p>
            <p>NRC is masked as ******/**/#. Raw NRC is never exported.</p>
            <p>
              Excluded: passwords, OTPs, auth and session tokens, API secrets, identity
              documents, payslip files, signatures and audit log payloads.
            </p>
            <p>Runs through a secure server-side integration — no database credentials in the browser.</p>
          </CardContent>
        </Card>
      </div>

      <Card className={adminCardClass}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-display">
            <Table2 className="h-4 w-4" /> Workbook tabs
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {TABS.map((tab, i) => (
            <div
              key={tab}
              className="flex items-center justify-between rounded-xl border border-border/60 bg-background/60 px-3 py-2"
            >
              <span className="text-sm text-foreground">
                {i + 1}. {tab}
              </span>
              <Badge variant="secondary">{state?.row_counts?.[tab] ?? 0} rows</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </AdminPageShell>
  );
};

export default CustomerDataSheet;
