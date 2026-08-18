import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRBAC } from "@/hooks/useRBAC";
import { AdminPageShell, adminCardClass } from "@/components/admin/AdminPageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Database,
  FileSearch,
  History,
  Loader2,
  Search,
  ShieldCheck,
  Users,
  Wifi,
  XCircle,
} from "lucide-react";

type Workspace = "verify" | "members" | "coverage" | "exceptions" | "history" | "sources";

type Profile = {
  id: string;
  user_id: string;
  full_name: string | null;
  nrc_number: string | null;
  phone: string | null;
  email: string | null;
  employer: string | null;
  employee_number: string | null;
  account_status: string;
  created_at: string;
};

const navItems: Array<{ id: Workspace; label: string; description: string; icon: typeof Search }> = [
  { id: "verify", label: "Verify employment", description: "Check a member against Riverbanc records", icon: ShieldCheck },
  { id: "members", label: "Member lookup", description: "Find Riverbanc members by identity", icon: Search },
  { id: "coverage", label: "Payroll coverage", description: "Members grouped by payroll", icon: Users },
  { id: "exceptions", label: "Exceptions", description: "Records needing attention", icon: AlertCircle },
  { id: "history", label: "Verification history", description: "Auditable verification activity", icon: History },
  { id: "sources", label: "Payroll sources", description: "Source health and readiness", icon: Database },
];

const mask = (value: string | null, visible = 4) => (value ? `••••${value.slice(-visible)}` : "—");

const CompliancePayroll = () => {
  const { permissions, logAction } = useRBAC();
  const [workspace, setWorkspace] = useState<Workspace>("verify");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [employerFilter, setEmployerFilter] = useState("all");
  const [selectedMember, setSelectedMember] = useState<Profile | null>(null);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationResult, setVerificationResult] = useState<"found" | "not_found" | null>(null);

  const loadProfiles = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id,user_id,full_name,nrc_number,phone,email,employer,employee_number,account_status,created_at")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Unable to load member payroll records");
      setLoading(false);
      return;
    }

    setProfiles((data as Profile[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadProfiles();
    const channel = supabase
      .channel("payroll-member-registry")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, loadProfiles)
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const employers = useMemo(
    () => [...new Set(profiles.map((profile) => profile.employer).filter(Boolean))] as string[],
    [profiles]
  );

  const activeMembers = useMemo(
    () => profiles.filter((profile) => profile.account_status === "active"),
    [profiles]
  );

  const coverage = useMemo(() => {
    const map = new Map<string, { members: number; missingIdentifiers: number }>();
    activeMembers.forEach((profile) => {
      const employer = profile.employer || "Unassigned payroll";
      const current = map.get(employer) ?? { members: 0, missingIdentifiers: 0 };
      current.members += 1;
      if (!profile.employee_number) current.missingIdentifiers += 1;
      map.set(employer, current);
    });
    return [...map.entries()]
      .map(([employer, values]) => ({ employer, ...values }))
      .sort((a, b) => b.members - a.members);
  }, [activeMembers]);

  const exceptions = useMemo(
    () => activeMembers.filter((profile) => !profile.employer || !profile.employee_number),
    [activeMembers]
  );

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return profiles.filter((profile) => {
      const matchesEmployer = employerFilter === "all" || profile.employer === employerFilter;
      if (!matchesEmployer) return false;
      if (!query) return true;
      return [profile.full_name, profile.email, profile.nrc_number, profile.phone, profile.employee_number, profile.employer]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query));
    });
  }, [profiles, search, employerFilter]);

  const runVerification = async () => {
    if (!permissions.canViewPayroll) {
      toast.error("You do not have permission to verify payroll records");
      return;
    }
    if (!selectedMember) {
      toast.error("Select a Riverbanc member first");
      return;
    }

    setVerificationLoading(true);
    setVerificationResult(null);
    try {
      // This first verification layer confirms the member's Riverbanc employment identifiers.
      // External payroll verification is deliberately not simulated until a real source is connected.
      const found = Boolean(selectedMember.employer && selectedMember.employee_number);
      setVerificationResult(found ? "found" : "not_found");
      await logAction(
        "employment_verification_check",
        selectedMember.user_id,
        "profiles",
        null,
        { result: found ? "member_record_ready" : "member_record_incomplete", external_payroll_source: "not_connected" }
      );
    } catch {
      toast.error("Verification check failed");
    } finally {
      setVerificationLoading(false);
    }
  };

  const selectMember = (member: Profile) => {
    setSelectedMember(member);
    setVerificationResult(null);
    setWorkspace("verify");
  };

  if (!permissions.canViewPayroll) {
    return (
      <AdminPageShell>
        <Card className={adminCardClass}>
          <CardContent className="flex min-h-[420px] items-center justify-center">
            <div className="max-w-md text-center">
              <ShieldCheck className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
              <h1 className="font-display text-2xl font-bold">Payroll access restricted</h1>
              <p className="mt-2 text-sm text-muted-foreground">Your current role does not have access to employment verification.</p>
            </div>
          </CardContent>
        </Card>
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell className="min-h-[calc(100vh-7rem)]">
      <div className="flex min-h-[calc(100vh-7rem)] flex-col overflow-hidden rounded-[28px] border border-border/70 bg-card shadow-xl lg:flex-row">
        <aside className="w-full shrink-0 border-b border-border/70 bg-muted/20 p-4 lg:w-[300px] lg:border-b-0 lg:border-r">
          <div className="mb-5 px-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              <ShieldCheck className="h-4 w-4" /> Employment control
            </div>
            <h1 className="mt-2 font-display text-2xl font-bold text-foreground">Payroll verification</h1>
            <p className="mt-1 text-sm text-muted-foreground">Verify Riverbanc members against their declared payroll record.</p>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = workspace === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setWorkspace(item.id)}
                  className={`flex w-full items-start gap-3 rounded-xl p-3 text-left transition ${active ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground hover:bg-background"}`}
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{item.label}</span>
                    <span className={`mt-0.5 block text-xs ${active ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{item.description}</span>
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="mt-6 rounded-2xl border border-border/70 bg-background/70 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Member registry</span>
              <Badge className="bg-success/10 text-success">Live</Badge>
            </div>
            <p className="mt-2 font-display text-2xl font-bold">{activeMembers.length.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">active Riverbanc members</p>
          </div>
        </aside>

        <main className="min-w-0 flex-1 bg-background p-4 md:p-6">
          {workspace === "verify" ? (
            <div className="grid h-full gap-5 xl:grid-cols-[minmax(360px,0.85fr)_minmax(420px,1.15fr)]">
              <Card className={adminCardClass}>
                <CardHeader>
                  <CardTitle className="font-display">Verify employment</CardTitle>
                  <p className="text-sm text-muted-foreground">Find a member first, then run the available verification checks.</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search NRC, employee number, name..." className="pl-9" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {filteredMembers.slice(0, 8).map((member) => (
                      <button key={member.id} type="button" onClick={() => selectMember(member)} className={`w-full rounded-xl border p-3 text-left transition ${selectedMember?.id === member.id ? "border-primary bg-primary/5" : "border-border/70 hover:bg-muted/40"}`}>
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold">{member.full_name || "Unnamed member"}</span>
                          <Badge variant="outline">{member.account_status}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{member.employer || "Payroll not assigned"} · {mask(member.employee_number)}</p>
                      </button>
                    ))}
                    {!loading && filteredMembers.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No Riverbanc member matches this search.</p> : null}
                  </div>
                  <details className="rounded-xl border border-border/70 bg-muted/20 p-3">
                    <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium">Advanced identifiers <ChevronDown className="h-4 w-4 text-muted-foreground" /></summary>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <Input placeholder="Payroll reference" />
                      <Select value={employerFilter} onValueChange={setEmployerFilter}><SelectTrigger><SelectValue placeholder="Employer" /></SelectTrigger><SelectContent><SelectItem value="all">All employers</SelectItem>{employers.map((employer) => <SelectItem key={employer} value={employer}>{employer}</SelectItem>)}</SelectContent></Select>
                    </div>
                  </details>
                </CardContent>
              </Card>

              <Card className={adminCardClass}>
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div><CardTitle className="font-display">Verification result</CardTitle><p className="text-sm text-muted-foreground">The right panel stays focused on the selected member.</p></div>
                  <Badge className="gap-1 bg-warning/10 text-warning"><Wifi className="h-3 w-3" /> External payroll not connected</Badge>
                </CardHeader>
                <CardContent>
                  {!selectedMember ? (
                    <div className="flex min-h-[430px] items-center justify-center text-center"><div><FileSearch className="mx-auto mb-4 h-10 w-10 text-muted-foreground" /><p className="font-semibold">Select a member to begin</p><p className="mt-1 max-w-sm text-sm text-muted-foreground">No external payroll result will be fabricated. This workspace only reports verified data sources.</p></div></div>
                  ) : (
                    <div className="space-y-5">
                      <div className="rounded-2xl border border-border/70 bg-muted/20 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-wide text-muted-foreground">Selected member</p><h2 className="mt-1 font-display text-2xl font-bold">{selectedMember.full_name || "Unnamed member"}</h2></div><Badge className={selectedMember.employer && selectedMember.employee_number ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}>{selectedMember.employer && selectedMember.employee_number ? "Record ready" : "Incomplete record"}</Badge></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><div><p className="text-xs text-muted-foreground">NRC</p><p className="font-medium">{mask(selectedMember.nrc_number)}</p></div><div><p className="text-xs text-muted-foreground">Employee number</p><p className="font-medium">{mask(selectedMember.employee_number)}</p></div><div><p className="text-xs text-muted-foreground">Employer / payroll</p><p className="font-medium">{selectedMember.employer || "Not assigned"}</p></div><div><p className="text-xs text-muted-foreground">Account status</p><p className="font-medium">{selectedMember.account_status}</p></div></div></div>
                      {verificationResult === "found" ? <div className="rounded-2xl border border-success/20 bg-success/5 p-4"><div className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 text-success" /><div><p className="font-semibold text-success">Riverbanc member record ready for payroll verification</p><p className="mt-1 text-sm text-muted-foreground">The member has an employer and employee identifier. An external payroll source must still confirm current employment.</p></div></div></div> : null}
                      {verificationResult === "not_found" ? <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4"><div className="flex gap-3"><XCircle className="mt-0.5 h-5 w-5 text-destructive" /><div><p className="font-semibold text-destructive">Unable to prepare verification</p><p className="mt-1 text-sm text-muted-foreground">The member record is missing an employer or employee identifier.</p></div></div></div> : null}
                      <details className="rounded-xl border border-border/70 p-4"><summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold">Verification details <ChevronDown className="h-4 w-4 text-muted-foreground" /></summary><div className="mt-3 grid gap-3 text-sm sm:grid-cols-2"><div><span className="text-muted-foreground">Source</span><p>Riverbanc member registry</p></div><div><span className="text-muted-foreground">External source</span><p>Not connected</p></div><div><span className="text-muted-foreground">Last member record</span><p>{new Date(selectedMember.created_at).toLocaleDateString()}</p></div><div><span className="text-muted-foreground">Verification reference</span><p>Created after external source connection</p></div></div></details>
                      <Button onClick={runVerification} disabled={verificationLoading} className="w-full sm:w-auto">{verificationLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}Run verification check</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}

          {workspace === "members" ? (
            <WorkspacePanel title="Member lookup" description="Search the Riverbanc member registry and open any record in the verification workspace.">
              <div className="mb-4 flex flex-col gap-3 md:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search member, NRC, employee number, employer..." className="pl-9" /></div><Select value={employerFilter} onValueChange={setEmployerFilter}><SelectTrigger className="md:w-[240px]"><SelectValue placeholder="Employer" /></SelectTrigger><SelectContent><SelectItem value="all">All employers</SelectItem>{employers.map((employer) => <SelectItem key={employer} value={employer}>{employer}</SelectItem>)}</SelectContent></Select></div>
              <MemberTable members={filteredMembers} onSelect={selectMember} />
            </WorkspacePanel>
          ) : null}

          {workspace === "coverage" ? (
            <WorkspacePanel title="Payroll coverage" description="Counts represent active Riverbanc members associated with each payroll, not the size of the external payroll itself.">
              <div className="grid gap-4 sm:grid-cols-3"><Metric label="Active members" value={activeMembers.length} /><Metric label="Payrolls represented" value={coverage.length} /><Metric label="Exceptions" value={exceptions.length} /></div>
              <div className="mt-5 space-y-3">{coverage.map((row) => <div key={row.employer} className="rounded-2xl border border-border/70 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">{row.employer}</p><p className="text-xs text-muted-foreground">{row.missingIdentifiers} member record{row.missingIdentifiers === 1 ? "" : "s"} missing an employee identifier</p></div><p className="font-display text-2xl font-bold">{row.members.toLocaleString()}</p></div></div>)}{coverage.length === 0 ? <EmptyState label="No payroll associations found" /> : null}</div>
            </WorkspacePanel>
          ) : null}

          {workspace === "exceptions" ? (
            <WorkspacePanel title="Exceptions" description="Member records that cannot yet be prepared for reliable external employment verification.">
              <MemberTable members={exceptions} onSelect={selectMember} emptyLabel="No member payroll exceptions found" />
            </WorkspacePanel>
          ) : null}

          {workspace === "history" ? (
            <WorkspacePanel title="Verification history" description="Auditable checks recorded by the verification workspace.">
              <EmptyState icon={History} label="No verification history yet" detail="History will appear here as verification checks are performed. External payroll verification will only be recorded once a real source is connected." />
            </WorkspacePanel>
          ) : null}

          {workspace === "sources" ? (
            <WorkspacePanel title="Payroll sources" description="Connection readiness is shown honestly. No mock API endpoints are presented as live integrations.">
              <div className="grid gap-4 lg:grid-cols-2">{employers.map((employer) => <div key={employer} className="rounded-2xl border border-border/70 p-5"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{employer}</p><p className="mt-1 text-sm text-muted-foreground">{coverage.find((row) => row.employer === employer)?.members ?? 0} active Riverbanc members</p></div><Badge className="bg-warning/10 text-warning">Source pending</Badge></div><Separator className="my-4" /><div className="grid gap-3 text-sm sm:grid-cols-2"><div><span className="text-muted-foreground">Connection</span><p>Not configured</p></div><div><span className="text-muted-foreground">Last sync</span><p>—</p></div><div><span className="text-muted-foreground">Verification</span><p>Awaiting source</p></div><div><span className="text-muted-foreground">Credentials</span><p>Server-side only</p></div></div></div>)}{employers.length === 0 ? <EmptyState icon={Database} label="No payroll sources represented yet" /> : null}</div>
            </WorkspacePanel>
          ) : null}
        </main>
      </div>
    </AdminPageShell>
  );
};

const WorkspacePanel = ({ title, description, children }: { title: string; description: string; children: React.ReactNode }) => (
  <Card className={`${adminCardClass} h-full`}><CardHeader><CardTitle className="font-display text-2xl">{title}</CardTitle><p className="max-w-3xl text-sm text-muted-foreground">{description}</p></CardHeader><CardContent>{children}</CardContent></Card>
);

const Metric = ({ label, value }: { label: string; value: number }) => <Card className={adminCardClass}><CardContent className="pt-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 font-display text-3xl font-bold">{value.toLocaleString()}</p></CardContent></Card>;

const MemberTable = ({ members, onSelect, emptyLabel = "No matching members" }: { members: Profile[]; onSelect: (member: Profile) => void; emptyLabel?: string }) => <div className="overflow-hidden rounded-2xl border border-border/70"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/30"><tr className="border-b border-border/70 text-left"><th className="px-4 py-3 font-semibold">Member</th><th className="px-4 py-3 font-semibold">Employer</th><th className="px-4 py-3 font-semibold">Employee no.</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 text-right">Action</th></tr></thead><tbody>{members.map((member) => <tr key={member.id} className="border-b border-border/60 last:border-0"><td className="px-4 py-3"><p className="font-medium">{member.full_name || "Unnamed member"}</p><p className="text-xs text-muted-foreground">NRC {mask(member.nrc_number)}</p></td><td className="px-4 py-3">{member.employer || "—"}</td><td className="px-4 py-3">{mask(member.employee_number)}</td><td className="px-4 py-3"><Badge variant="outline">{member.account_status}</Badge></td><td className="px-4 py-3 text-right"><Button size="sm" variant="outline" onClick={() => onSelect(member)}>Open</Button></td></tr>)}{members.length === 0 ? <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">{emptyLabel}</td></tr> : null}</tbody></table></div></div>;

const EmptyState = ({ icon: Icon = Clock3, label, detail }: { icon?: typeof Clock3; label: string; detail?: string }) => <div className="flex min-h-[300px] items-center justify-center text-center"><div><Icon className="mx-auto mb-3 h-9 w-9 text-muted-foreground" /><p className="font-semibold">{label}</p>{detail ? <p className="mx-auto mt-1 max-w-lg text-sm text-muted-foreground">{detail}</p> : null}</div></div>;

export default CompliancePayroll;
