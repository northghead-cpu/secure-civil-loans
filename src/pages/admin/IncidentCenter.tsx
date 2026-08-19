import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertOctagon, CheckCircle2, Clock3, Loader2, Search, ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useRBAC } from "@/hooks/useRBAC";
import { toast } from "sonner";

const SEVERITIES = ["critical", "high", "medium", "low"] as const;
const STATUSES = ["detected", "acknowledged", "investigating", "resolved"] as const;

type Severity = (typeof SEVERITIES)[number];
type Status = (typeof STATUSES)[number];

interface Incident {
  id: string;
  operation: string;
  severity: Severity;
  status: Status;
  summary: string;
  correlation_id: string | null;
  source: string;
  audit_log_id: string | null;
  occurred_at: string;
  acknowledged_at: string | null;
  investigating_at: string | null;
  resolved_at: string | null;
  resolution_code: string | null;
  created_at: string;
  updated_at: string;
}

const severityClass: Record<Severity, string> = {
  critical: "border-destructive/40 bg-destructive/10 text-destructive",
  high: "border-orange-500/40 bg-orange-500/10 text-orange-600",
  medium: "border-amber-500/40 bg-amber-500/10 text-amber-600",
  low: "border-blue-500/40 bg-blue-500/10 text-blue-600",
};

const statusClass: Record<Status, string> = {
  detected: "bg-destructive/10 text-destructive",
  acknowledged: "bg-amber-500/10 text-amber-600",
  investigating: "bg-blue-500/10 text-blue-600",
  resolved: "bg-emerald-500/10 text-emerald-600",
};

const nextStatus: Record<Status, Status | null> = {
  detected: "acknowledged",
  acknowledged: "investigating",
  investigating: "resolved",
  resolved: null,
};

const IncidentCenter = () => {
  const { logAction } = useRBAC();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selected, setSelected] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState("all");
  const [status, setStatus] = useState("open");

  const fetchIncidents = useCallback(async () => {
    const { data, error } = await supabase
      .from("incidents")
      .select("id, operation, severity, status, summary, correlation_id, source, audit_log_id, occurred_at, acknowledged_at, investigating_at, resolved_at, resolution_code, created_at, updated_at")
      .order("occurred_at", { ascending: false });

    if (error) {
      toast.error("Unable to load incidents");
      setLoading(false);
      return;
    }

    setIncidents((data ?? []) as Incident[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchIncidents();
    const channel = supabase
      .channel("admin_incidents")
      .on("postgres_changes", { event: "*", schema: "public", table: "incidents" }, fetchIncidents)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchIncidents]);

  const filtered = useMemo(() => incidents.filter((incident) => {
    if (severity !== "all" && incident.severity !== severity) return false;
    if (status === "open" && incident.status === "resolved") return false;
    if (status !== "all" && status !== "open" && incident.status !== status) return false;
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return incident.operation.toLowerCase().includes(q)
      || incident.summary.toLowerCase().includes(q)
      || incident.correlation_id?.toLowerCase().includes(q);
  }), [incidents, query, severity, status]);

  const counts = {
    critical: incidents.filter((i) => i.severity === "critical" && i.status !== "resolved").length,
    open: incidents.filter((i) => i.status !== "resolved").length,
    investigating: incidents.filter((i) => i.status === "investigating").length,
    resolved: incidents.filter((i) => i.status === "resolved").length,
  };

  const advance = async (incident: Incident) => {
    const target = nextStatus[incident.status];
    if (!target) return;

    setSaving(true);
    const now = new Date().toISOString();
    const update: Record<string, string> = { status: target, updated_at: now };
    if (target === "acknowledged") update.acknowledged_at = now;
    if (target === "investigating") update.investigating_at = now;
    if (target === "resolved") {
      update.resolved_at = now;
      update.resolution_code = "admin_resolved";
    }

    try {
      const { error } = await supabase.from("incidents").update(update).eq("id", incident.id);
      if (error) throw error;
      await logAction("update_incident_status", incident.id, "incidents", { status: incident.status }, { status: target });
      toast.success(`Incident marked ${target}`);
      await fetchIncidents();
      setSelected((current) => current?.id === incident.id ? { ...current, ...update, status: target } as Incident : current);
    } catch {
      toast.error("Unable to update incident");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-[calc(100vh-2rem)] min-h-[620px] flex flex-col gap-5">
      <div className="shrink-0">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Incident Center</h1>
            <p className="text-sm text-muted-foreground">Operational incidents only. Full audit details remain in Audit Logs.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Critical</p><p className="text-2xl font-bold text-destructive">{counts.critical}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Open</p><p className="text-2xl font-bold">{counts.open}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Investigating</p><p className="text-2xl font-bold text-blue-600">{counts.investigating}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Resolved</p><p className="text-2xl font-bold text-emerald-600">{counts.resolved}</p></CardContent></Card>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-4">
        <Card className="min-h-0 flex flex-col">
          <CardContent className="p-4 space-y-4 overflow-y-auto">
            <div>
              <p className="text-sm font-semibold">Filters</p>
              <p className="text-xs text-muted-foreground">Narrow operational events without exposing audit payloads.</p>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Operation, summary, correlation ID" className="pl-9" />
            </div>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger><SelectValue placeholder="Severity" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All severities</SelectItem>{SEVERITIES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open incidents</SelectItem>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card className="min-h-0 flex flex-col overflow-hidden">
          <CardContent className="p-0 min-h-0 flex flex-col">
            <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-3 border-b text-xs font-semibold text-muted-foreground">
              <span>Operation</span><span>Severity</span><span>Status</span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto divide-y">
              {loading ? (
                <div className="h-full flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : filtered.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-2 text-muted-foreground"><CheckCircle2 className="h-8 w-8" /><p>No incidents match the current filters.</p></div>
              ) : filtered.map((incident) => (
                <button key={incident.id} onClick={() => setSelected(incident)} className={`w-full text-left px-4 py-3 hover:bg-muted/40 ${selected?.id === incident.id ? "bg-muted/50" : ""}`}>
                  <div className="grid grid-cols-[1fr_auto_auto] gap-3 items-start">
                    <div className="min-w-0"><p className="font-medium truncate">{incident.operation}</p><p className="text-xs text-muted-foreground truncate">{incident.summary}</p></div>
                    <Badge variant="outline" className={severityClass[incident.severity]}>{incident.severity}</Badge>
                    <Badge variant="secondary" className={statusClass[incident.status]}>{incident.status}</Badge>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">{new Date(incident.occurred_at).toLocaleString()}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {selected && (
        <Card className="shrink-0">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="space-y-2 min-w-0">
                <div className="flex flex-wrap gap-2 items-center"><Badge variant="outline" className={severityClass[selected.severity]}>{selected.severity}</Badge><Badge variant="secondary" className={statusClass[selected.status]}>{selected.status}</Badge><span className="font-semibold">{selected.operation}</span></div>
                <p className="text-sm">{selected.summary}</p>
                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground"><span><Clock3 className="inline h-3 w-3 mr-1" />{new Date(selected.occurred_at).toLocaleString()}</span>{selected.correlation_id && <span>Correlation: {selected.correlation_id}</span>}<span>Source: {selected.source}</span></div>
              </div>
              {nextStatus[selected.status] && <Button onClick={() => advance(selected)} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}{nextStatus[selected.status] === "resolved" ? "Resolve" : `Mark ${nextStatus[selected.status]}`}</Button>}
            </div>
            <Separator className="my-3" />
            <p className="text-xs text-muted-foreground">Detailed system evidence remains in Audit Logs{selected.audit_log_id ? ". This incident is linked to its audit record." : "."}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default IncidentCenter;
