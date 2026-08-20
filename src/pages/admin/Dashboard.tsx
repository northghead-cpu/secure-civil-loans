import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Activity, ArrowUpRight, Banknote, BriefcaseBusiness, Clock3, FileCheck, ShieldAlert, Siren, TrendingUp, Users } from "lucide-react";

type DashboardData = {
  activeBorrowers: number;
  pendingApplications: number;
  monthlyRevenue: number;
  riskAlerts: number;
  throughput: number;
  priorityItems: Array<{ id: string; title: string; owner: string; status: string; occurredAt: string }>;
  activity: Array<{ id: string; action: string; user: string; time: string }>;
  pipeline: Array<{ stage: string; count: number; share: number; tone: string }>;
  lenders: Array<{ name: string; fill: number; subtitle: string }>;
};

const EMPTY: DashboardData = {
  activeBorrowers: 0,
  pendingApplications: 0,
  monthlyRevenue: 0,
  riskAlerts: 0,
  throughput: 0,
  priorityItems: [],
  activity: [],
  pipeline: [
    { stage: "Submitted", count: 0, share: 0, tone: "bg-sky-500" },
    { stage: "KYC review", count: 0, share: 0, tone: "bg-cyan-400" },
    { stage: "CRB check", count: 0, share: 0, tone: "bg-violet-500" },
    { stage: "Approved", count: 0, share: 0, tone: "bg-emerald-500" },
    { stage: "Rejected", count: 0, share: 0, tone: "bg-rose-500" },
  ],
  lenders: [],
};

const formatCurrency = (value: number) => new Intl.NumberFormat("en-ZM", { style: "currency", currency: "ZMW", maximumFractionDigits: 0 }).format(value);
const formatTime = (value: string) => new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const Dashboard = () => {
  const [data, setData] = useState<DashboardData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);

        const [profiles, applications, risks, payouts, logs, products] = await Promise.all([
          supabase.from("profiles").select("user_id").eq("account_status", "active"),
          supabase.from("loan_applications").select("id,status,full_name,created_at").order("created_at", { ascending: false }),
          supabase.from("risk_flags").select("id,flag_type,status,created_at").not("status", "in", "(resolved,closed)").order("created_at", { ascending: false }),
          supabase.from("payouts").select("amount_zmw,status,created_at,lender").gte("created_at", monthStart.toISOString()).in("status", ["paid", "sent", "disbursed"]),
          supabase.from("audit_logs").select("id,action_performed,action,user_id,created_at").order("created_at", { ascending: false }).limit(4),
          supabase.from("bank_products").select("id,bank_name,active,processing_days").order("bank_name", { ascending: true }),
        ]);

        const failed = [profiles.error, applications.error, risks.error, payouts.error, logs.error, products.error].find(Boolean);
        if (failed) throw failed;

        const apps = applications.data ?? [];
        const openRisks = risks.data ?? [];
        const paidPayouts = payouts.data ?? [];
        const auditLogs = logs.data ?? [];
        const bankProducts = products.data ?? [];

        const actorIds = auditLogs.map((log) => log.user_id).filter(Boolean) as string[];
        const actorResult = actorIds.length
          ? await supabase.from("profiles").select("user_id,full_name,email").in("user_id", actorIds)
          : { data: [], error: null };
        if (actorResult.error) throw actorResult.error;
        const actors = new Map((actorResult.data ?? []).map((p) => [p.user_id, p.full_name || p.email || "System"]));

        const counts = {
          submitted: apps.filter((a) => a.status === "pending").length,
          kyc: apps.filter((a) => a.status === "reviewing").length,
          crb: apps.filter((a) => a.status === "processing").length,
          approved: apps.filter((a) => a.status === "approved").length,
          rejected: apps.filter((a) => a.status === "rejected").length,
        };
        const flowTotal = Math.max(1, Object.values(counts).reduce((a, b) => a + b, 0));

        const priorityItems = [
          ...openRisks.slice(0, 3).map((r) => ({ id: `risk-${r.id}`, title: r.flag_type ? `Risk flag: ${r.flag_type}` : "Open risk flag", owner: "Risk operations", status: r.status || "open", occurredAt: r.created_at })),
          ...apps.filter((a) => ["pending", "reviewing", "processing"].includes(a.status)).slice(0, 3).map((a) => ({ id: `app-${a.id}`, title: `Application ${a.status}`, owner: a.full_name || "Applicant", status: a.status, occurredAt: a.created_at })),
          ...paidPayouts.filter((p) => ["pending", "processing", "failed"].includes(p.status)).slice(0, 3).map((p) => ({ id: `payout-${p.lender}-${p.created_at}`, title: `Payout ${p.status}`, owner: p.lender || "Finance", status: p.status, occurredAt: p.created_at })),
        ].slice(0, 3);

        const lenderMap = new Map<string, { active: number; total: number; days: number[] }>();
        bankProducts.forEach((p) => {
          const current = lenderMap.get(p.bank_name) ?? { active: 0, total: 0, days: [] };
          current.total += 1;
          if (p.active) current.active += 1;
          if (typeof p.processing_days === "number") current.days.push(p.processing_days);
          lenderMap.set(p.bank_name, current);
        });
        const lenders = Array.from(lenderMap.entries()).slice(0, 3).map(([name, value]) => ({
          name,
          fill: value.total ? Math.round((value.active / value.total) * 100) : 0,
          subtitle: value.days.length ? `${(value.days.reduce((a, b) => a + b, 0) / value.days.length).toFixed(1)} day average processing` : `${value.total} product${value.total === 1 ? "" : "s"} configured`,
        }));

        const resolvedApps = apps.filter((a) => ["approved", "rejected", "disbursed"].includes(a.status)).length;
        const next: DashboardData = {
          activeBorrowers: profiles.data?.length ?? 0,
          pendingApplications: apps.filter((a) => ["pending", "reviewing", "processing"].includes(a.status)).length,
          monthlyRevenue: paidPayouts.reduce((sum, p) => sum + Number(p.amount_zmw || 0), 0),
          riskAlerts: openRisks.length,
          throughput: apps.length ? Math.round((resolvedApps / apps.length) * 100) : 0,
          priorityItems,
          activity: auditLogs.map((log) => ({ id: log.id, action: log.action_performed || log.action || "Platform activity", user: log.user_id ? actors.get(log.user_id) || "System" : "System", time: formatTime(log.created_at) })),
          pipeline: [
            { stage: "Submitted", count: counts.submitted, share: Math.round((counts.submitted / flowTotal) * 100), tone: "bg-sky-500" },
            { stage: "KYC review", count: counts.kyc, share: Math.round((counts.kyc / flowTotal) * 100), tone: "bg-cyan-400" },
            { stage: "CRB check", count: counts.crb, share: Math.round((counts.crb / flowTotal) * 100), tone: "bg-violet-500" },
            { stage: "Approved", count: counts.approved, share: Math.round((counts.approved / flowTotal) * 100), tone: "bg-emerald-500" },
            { stage: "Rejected", count: counts.rejected, share: Math.round((counts.rejected / flowTotal) * 100), tone: "bg-rose-500" },
          ],
          lenders,
        };
        if (!cancelled) setData(next);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load dashboard data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  const stats = useMemo(() => [
    { label: "Active borrowers", value: data.activeBorrowers.toLocaleString(), delta: "Live from active accounts", icon: Users, tone: "from-sky-500/20 to-sky-400/5" },
    { label: "Pending applications", value: data.pendingApplications.toLocaleString(), delta: "Currently awaiting workflow action", icon: FileCheck, tone: "from-amber-400/20 to-amber-300/5" },
    { label: "Monthly revenue", value: formatCurrency(data.monthlyRevenue), delta: "Paid, sent, or disbursed this month", icon: Banknote, tone: "from-emerald-400/20 to-emerald-300/5" },
    { label: "Risk alerts", value: data.riskAlerts.toLocaleString(), delta: "Open risk flags", icon: ShieldAlert, tone: "from-rose-400/20 to-rose-300/5" },
  ], [data]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="overflow-hidden rounded-[28px] border border-border/30 bg-gradient-to-br from-slate-950 via-slate-900 to-primary/20 shadow-2xl">
        <div className="w-full p-6 md:p-8 lg:p-10">
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl space-y-4">
                <Badge className="border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/80">Daily operations overview</Badge>
                <div className="space-y-3">
                  <h1 className="max-w-2xl text-4xl font-display font-bold leading-tight text-white md:text-5xl">Admin command center for <span className="text-gradient">live lending activity</span></h1>
                  <p className="max-w-2xl text-base text-white/70 md:text-lg">Track application flow, revenue health, and compliance pressure in one surface built for operators.</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:w-[420px]">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md"><p className="text-xs uppercase tracking-[0.24em] text-white/45">Throughput</p><div className="mt-3 flex items-end justify-between gap-4"><div><p className="text-3xl font-display font-bold text-white">{loading ? "…" : `${data.throughput}%`}</p><p className="text-sm text-white/60">resolved application flow</p></div><TrendingUp className="h-5 w-5 text-emerald-300" /></div></div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md"><p className="text-xs uppercase tracking-[0.24em] text-white/45">Attention</p><div className="mt-3 flex items-end justify-between gap-4"><div><p className="text-3xl font-display font-bold text-white">{loading ? "…" : data.priorityItems.length}</p><p className="text-sm text-white/60">open priority items</p></div><Siren className="h-5 w-5 text-amber-300" /></div></div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {stats.map((stat) => <div key={stat.label} className={`rounded-2xl border border-white/10 bg-gradient-to-br ${stat.tone} p-5 backdrop-blur-sm`}><div className="flex items-start justify-between gap-3"><div className="space-y-2"><p className="text-sm text-white/60">{stat.label}</p><p className="text-3xl font-display font-bold text-white">{loading ? "…" : stat.value}</p></div><div className="rounded-full border border-white/10 bg-white/10 p-2 text-white/80"><stat.icon className="h-4 w-4" /></div></div><p className="mt-4 flex items-center gap-2 text-sm text-white/70"><ArrowUpRight className="h-4 w-4" />{stat.delta}</p></div>)}
            </div>
          </div>
        </div>
      </div>

      {error && <Card className="border-destructive/30 bg-destructive/5"><CardContent className="py-4 text-sm text-destructive">Dashboard data could not be loaded. {error}</CardContent></Card>}

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card className="card-elevated border-border/70 bg-card/95"><CardHeader className="space-y-4"><div className="flex items-center justify-between gap-4"><div><CardTitle className="text-xl font-display">Priority Queue</CardTitle><p className="mt-1 text-sm text-muted-foreground">Open records requiring operational attention.</p></div><Badge variant="secondary" className="rounded-full px-3 py-1">{data.priorityItems.length} open items</Badge></div></CardHeader><CardContent className="space-y-3">{loading ? <p className="py-6 text-sm text-muted-foreground">Loading priority items…</p> : data.priorityItems.length === 0 ? <p className="py-6 text-sm text-muted-foreground">No priority items currently open.</p> : data.priorityItems.map((item) => <div key={item.id} className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-background/70 p-4 md:flex-row md:items-center md:justify-between"><div className="space-y-1"><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary" /><p className="text-sm font-semibold text-foreground">{item.title}</p></div><p className="text-sm text-muted-foreground">{item.owner}</p></div><div className="flex items-center gap-3"><Badge variant="outline">{item.status}</Badge><span className="text-sm text-muted-foreground">{formatTime(item.occurredAt)}</span></div></div>)}</CardContent></Card>
        <Card className="card-elevated border-border/70 bg-card/95"><CardHeader><CardTitle className="text-xl font-display">Live Activity</CardTitle><p className="text-sm text-muted-foreground">Recent platform actions.</p></CardHeader><CardContent className="space-y-4">{loading ? <p className="py-6 text-sm text-muted-foreground">Loading activity…</p> : data.activity.length === 0 ? <p className="py-6 text-sm text-muted-foreground">No activity recorded yet.</p> : data.activity.map((item) => <div key={item.id} className="flex items-start gap-3"><div className="mt-1.5 h-2.5 w-2.5 rounded-full bg-primary" /><div className="flex-1"><p className="text-sm font-medium text-foreground">{item.action}</p><p className="text-sm text-muted-foreground">{item.user}</p></div><div className="flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />{item.time}</div></div>)}</CardContent></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="card-elevated border-border/70 bg-card/95"><CardHeader><CardTitle className="text-xl font-display">Application Pipeline</CardTitle><p className="text-sm text-muted-foreground">Distribution across the current lending workflow.</p></CardHeader><CardContent className="space-y-5">{data.pipeline.map((stage) => <div key={stage.stage} className="space-y-2"><div className="flex items-center justify-between gap-4"><div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${stage.tone}`} /><span className="text-sm font-medium text-foreground">{stage.stage}</span></div><div className="flex items-center gap-3 text-sm"><span className="text-muted-foreground">{stage.share}% of flow</span><span className="font-semibold text-foreground">{stage.count}</span></div></div><Progress value={stage.share} className="h-2.5" /></div>)}</CardContent></Card>
        <Card className="card-elevated border-border/70 bg-card/95"><CardHeader><CardTitle className="text-xl font-display">Lender Health</CardTitle><p className="text-sm text-muted-foreground">Active product availability across partner lenders.</p></CardHeader><CardContent className="space-y-5">{loading ? <p className="py-6 text-sm text-muted-foreground">Loading lender data…</p> : data.lenders.length === 0 ? <p className="py-6 text-sm text-muted-foreground">No lender products configured.</p> : data.lenders.map((lender) => <div key={lender.name} className="space-y-2"><div className="flex items-center justify-between gap-4"><div className="flex items-center gap-2"><BriefcaseBusiness className="h-4 w-4 text-muted-foreground" /><div><p className="text-sm font-semibold text-foreground">{lender.name}</p><p className="text-xs text-muted-foreground">{lender.subtitle}</p></div></div><span className="text-sm font-medium text-foreground">{lender.fill}%</span></div><Progress value={lender.fill} className="h-2.5" /></div>)}<div className="rounded-2xl border border-border/70 bg-muted/40 p-4"><div className="flex items-center gap-3"><Activity className="h-5 w-5 text-primary" /><div><p className="text-sm font-semibold text-foreground">{loading ? "Loading operational status…" : `${data.pendingApplications} applications currently require workflow action`}</p><p className="text-sm text-muted-foreground">This summary is derived from current application records; no placeholder operational events are shown.</p></div></div></div></CardContent></Card>
      </div>
    </div>
  );
};

export default Dashboard;
