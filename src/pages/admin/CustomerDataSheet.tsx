import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminHero, AdminPageShell, adminCardClass } from "@/components/admin/AdminPageShell";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { readSheetsExportErrorCode, sheetsExportErrorMessage } from "@/lib/sheetsExportErrors";
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
  const [connectionConfigured, setConnectionConfigured] = useState<boolean | null>(null);
  const [statusLoadError, setStatusLoadError] = useState<string | null>(null);
  const [sheetId, setSheetId] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [serviceAccountEmail, setServiceAccountEmail] = useState<string | null>(null);
  const [setupCode, setSetupCode] = useState<string | null>(null);
  const [defaultSheetId, setDefaultSheetId] = useState<string | null>(null);

  const load = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("sheets-export", {
        body: { action: "status" },
      });
      if (error || data?.error) {
        setStatusLoadError(sheetsExportErrorMessage(await readSheetsExportErrorCode(error, data)));
        return;
      }
      setState((data?.state ?? null) as SyncState | null);
      setConnectionConfigured(data?.configured === true);
      setServiceAccountEmail(
        typeof data?.serviceAccountEmail === "string" ? data.serviceAccountEmail : null,
      );
      setSetupCode(typeof data?.setupCode === "string" ? data.setupCode : null);
      setDefaultSheetId(
        typeof data?.defaultSpreadsheetId === "string" ? data.defaultSpreadsheetId : null,
      );
      setStatusLoadError(null);
    } catch {
      setStatusLoadError(sheetsExportErrorMessage(undefined));
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const checkConnection = async () => {
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("sheets-export", {
        body: { action: "check", ...(sheetId.trim() ? { spreadsheetId: sheetId.trim() } : {}) },
      });
      if (error || data?.verified !== true) {
        toast({
          title: "Connection check failed",
          description: sheetsExportErrorMessage(await readSheetsExportErrorCode(error, data)),
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Workbook connection verified",
        description: "Google access is working. Customer data has not been exported by this check.",
      });
    } catch {
      toast({
        title: "Connection check failed",
        description: sheetsExportErrorMessage(undefined),
        variant: "destructive",
      });
    } finally {
      setChecking(false);
    }
  };

  const runSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sheets-export", {
        body: { action: "sync", ...(sheetId.trim() ? { spreadsheetId: sheetId.trim() } : {}) },
      });
      if (error || data?.error) {
        toast({
          title: "Sync failed",
          description: sheetsExportErrorMessage(await readSheetsExportErrorCode(error, data)),
          variant: "destructive",
        });
        return;
      }
      toast({
        title: data?.created ? "Workbook created and synced" : "Workbook synced",
        description: "All 12 tabs were refreshed from the Riverbanc database.",
      });
      await load();
    } catch {
      toast({
        title: "Sync failed",
        description: sheetsExportErrorMessage(undefined),
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
        description="A server-side export refreshes 12 workbook tabs, including a management dashboard, directly through Google Sheets. NRC values are masked and no credentials, tokens, documents or payslips ever leave the platform."
        stats={[
          { label: "Sheets", value: String(TABS.length), meta: "Including the Dashboard KPI view" },
          {
            label: "Last sync",
            value: state?.last_synced_at
              ? new Date(state.last_synced_at).toLocaleString()
              : "Never",
            meta: state?.spreadsheet_id
              ? "Workbook linked"
              : connectionConfigured === false
                ? "Credentials not configured"
                : connectionConfigured === true
                  ? "Credentials present; sync not verified"
                  : "Connection status unavailable",
          },
          {
            label: "Rows exported",
            value: String(Object.values(state?.row_counts ?? {}).reduce((a, b) => a + b, 0)),
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
              Use a private workbook owned by Riverbanc. Paste its Google Sheets link or ID on the
              first run; later refreshes reuse the saved destination.
            </p>
            {statusLoadError && (
              <p role="status" className="text-sm text-destructive">
                Connection status could not be loaded: {statusLoadError}
              </p>
            )}
            {!statusLoadError && connectionConfigured === false && (
              <p role="status" className="text-sm text-destructive">
                {sheetsExportErrorMessage(setupCode || "GOOGLE_CREDENTIALS_MISSING")}
              </p>
            )}
            {!statusLoadError && connectionConfigured === true && !state?.spreadsheet_id && (
              <p role="status" className="text-sm text-muted-foreground">
                Server credentials are present, but a successful workbook sync has not yet been
                recorded.
              </p>
            )}
            {serviceAccountEmail && (
              <p className="text-sm text-muted-foreground">
                Share the private reporting workbook with <strong>{serviceAccountEmail}</strong> as
                Editor. Keep general access restricted.
              </p>
            )}
            {connectionConfigured === false && (
              <a
                className="inline-block text-sm underline"
                href="https://supabase.com/dashboard/project/zdpeaxkormwjrgllwalq/functions/secrets"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open secure reporting configuration
              </a>
            )}
            <div className="space-y-2">
              <Label htmlFor="sheet-id">Workbook link or ID</Label>
              <Input
                id="sheet-id"
                value={sheetId}
                onChange={(e) => setSheetId(e.target.value)}
                placeholder={
                  defaultSheetId ||
                  state?.spreadsheet_id ||
                  "Paste the private Google Sheets workbook link"
                }
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={runSync}
                disabled={syncing || checking || connectionConfigured !== true}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Syncing…" : "Sync now"}
              </Button>
              <Button
                variant="outline"
                onClick={() => void checkConnection()}
                disabled={checking || syncing || connectionConfigured !== true}
              >
                {checking ? "Checking…" : "Check connection"}
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
              Excluded: passwords, OTPs, auth and session tokens, API secrets, identity documents,
              payslip files, signatures and audit log payloads.
            </p>
            <p>
              Runs through a secure server-side integration — no database credentials in the
              browser.
            </p>
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
