import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ShieldCheck, FileText, Calculator, CheckCircle2, XCircle, Eye,
  ArrowLeft, Loader2, Download,
} from "lucide-react";

interface Application {
  id: string;
  user_id: string;
  full_name: string | null;
  nrc_number: string | null;
  gov_id_type: string | null;
  gov_id_number: string | null;
  employer: string | null;
  employee_number: string | null;
  status: string;
  gross_salary: number | null;
  deductions: number | null;
  net_salary: number | null;
  crb_status: string | null;
  crb_checked_at: string | null;
  admin_notes: string | null;
  created_at: string;
}

const statusColors: Record<string, string> = {
  pending: "bg-warning/10 text-warning border-warning/20",
  approved: "bg-success/10 text-success border-success/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
  reviewing: "bg-info/10 text-info border-info/20",
};

const UsersApplications = () => {
  const [applications, setApplications] = useState<Application[]>([]);
  const [selected, setSelected] = useState<Application | null>(null);
  const [loadingApps, setLoadingApps] = useState(true);
  const [documents, setDocuments] = useState<{ name: string; url: string }[]>([]);
  const [salaryForm, setSalaryForm] = useState({ gross: "", deductions: "", net: "" });
  const [adminNotes, setAdminNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchApps = async () => {
      const { data, error } = await supabase
        .from("loan_applications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) toast.error("Failed to load applications");
      else setApplications(data as Application[]);
      setLoadingApps(false);
    };
    fetchApps();
  }, []);

  const openApplication = async (app: Application) => {
    setSelected(app);
    setSalaryForm({
      gross: app.gross_salary?.toString() || "",
      deductions: app.deductions?.toString() || "",
      net: app.net_salary?.toString() || "",
    });
    setAdminNotes(app.admin_notes || "");
    const { data: files } = await supabase.storage.from("kyc-documents").list(app.user_id);
    if (files) {
      const docs = await Promise.all(
        files.map(async (f) => {
          const { data } = await supabase.storage
            .from("kyc-documents")
            .createSignedUrl(`${app.user_id}/${f.name}`, 3600);
          return { name: f.name, url: data?.signedUrl || "" };
        })
      );
      setDocuments(docs.filter((d) => d.url));
    }
  };

  const updateApplication = async (updates: Record<string, string | number | null | boolean>) => {
    if (!selected) return;
    setSaving(true);
    const { error } = await supabase.from("loan_applications").update(updates).eq("id", selected.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Application updated");
      setApplications((prev) => prev.map((a) => (a.id === selected.id ? { ...a, ...updates } : a)));
      setSelected((prev) => (prev ? { ...prev, ...updates } : prev));
    }
    setSaving(false);
  };

  const saveSalary = () => {
    updateApplication({
      gross_salary: parseFloat(salaryForm.gross) || null,
      deductions: parseFloat(salaryForm.deductions) || null,
      net_salary: parseFloat(salaryForm.net) || null,
    });
  };

  const runCRBCheck = () => {
    updateApplication({ crb_status: "clear", crb_checked_at: new Date().toISOString() });
  };

  if (selected) {
    return (
      <div className="space-y-6 max-w-5xl">
        <Button variant="ghost" onClick={() => setSelected(null)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Applications
        </Button>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-display font-bold text-foreground">
              {selected.full_name || "Unnamed Applicant"}
            </h1>
            <p className="text-sm text-muted-foreground">
              NRC: {selected.nrc_number || "—"} · {selected.employer || "—"} · Applied{" "}
              {new Date(selected.created_at).toLocaleDateString()}
            </p>
          </div>
          <Badge className={statusColors[selected.status] || ""}>{selected.status}</Badge>
        </div>

        <Tabs defaultValue="documents">
          <TabsList className="w-full flex flex-wrap h-auto gap-1">
            <TabsTrigger value="documents" className="flex-1 min-w-[100px]"><FileText className="w-4 h-4 mr-1" /> Docs</TabsTrigger>
            <TabsTrigger value="salary" className="flex-1 min-w-[100px]"><Calculator className="w-4 h-4 mr-1" /> Payslip</TabsTrigger>
            <TabsTrigger value="crb" className="flex-1 min-w-[80px]"><ShieldCheck className="w-4 h-4 mr-1" /> CRB</TabsTrigger>
            <TabsTrigger value="decision" className="flex-1 min-w-[80px]">Decision</TabsTrigger>
          </TabsList>

          <TabsContent value="documents" className="mt-4">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h3 className="font-display font-semibold text-foreground">Uploaded Documents</h3>
                {documents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No documents found.</p>
                ) : (
                  <div className="grid gap-3">
                    {documents.map((doc) => (
                      <a key={doc.name} href={doc.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                        <Download className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">{doc.name}</span>
                      </a>
                    ))}
                  </div>
                )}
                <div className="grid md:grid-cols-3 gap-4 pt-4 border-t border-border">
                  {[
                    ["Gov ID Type", selected.gov_id_type],
                    ["Gov ID Number", selected.gov_id_number],
                    ["Employee Number", selected.employee_number],
                  ].map(([label, value]) => (
                    <div key={label as string}>
                      <p className="text-xs text-muted-foreground mb-1">{label}</p>
                      <p className="text-sm font-medium text-foreground">{value || "—"}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="salary" className="mt-4">
            <Card>
              <CardContent className="pt-6 space-y-6">
                <h3 className="font-display font-semibold text-foreground">Payslip Parsing & Salary Assessment</h3>
                <div className="space-y-4">
                  {[
                    { label: "Gross Salary (K)", key: "gross" as const },
                    { label: "Total Deductions (K)", key: "deductions" as const },
                  ].map(({ label, key }) => (
                    <div key={key} className="flex justify-between items-center">
                      <Label>{label}</Label>
                      <Input className="w-48 text-right" placeholder="0.00" value={salaryForm[key]}
                        onChange={(e) => setSalaryForm((p) => ({ ...p, [key]: e.target.value }))} />
                    </div>
                  ))}
                  <div className="border-t border-border pt-4 flex justify-between items-center">
                    <Label className="font-semibold">Net Salary (K)</Label>
                    <Input className="w-48 text-right font-semibold" placeholder="0.00" value={salaryForm.net}
                      onChange={(e) => setSalaryForm((p) => ({ ...p, net: e.target.value }))} />
                  </div>
                </div>
                {salaryForm.net && (
                  <div className="bg-accent/10 rounded-xl p-4 border border-accent/20">
                    <p className="text-sm text-muted-foreground">
                      <strong>Affordability (1/3 rule):</strong> Max monthly repayment ={" "}
                      <strong className="text-foreground">K{(parseFloat(salaryForm.net) / 3).toFixed(2)}</strong>
                    </p>
                  </div>
                )}
                <Button onClick={saveSalary} disabled={saving}>{saving ? "Saving…" : "Save Salary Data"}</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="crb" className="mt-4">
            <Card>
              <CardContent className="pt-6 space-y-6 text-center">
                <ShieldCheck className="w-16 h-16 text-accent mx-auto" />
                <h3 className="font-display font-semibold text-foreground text-lg">Credit Bureau Pre-Check</h3>
                {selected.crb_status ? (
                  <div className="space-y-2">
                    <Badge className={selected.crb_status === "clear" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}>
                      {selected.crb_status.toUpperCase()}
                    </Badge>
                    <p className="text-xs text-muted-foreground">
                      Checked at {new Date(selected.crb_checked_at!).toLocaleString()}
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                      Run a soft inquiry to check credit standing. This will NOT affect the applicant's credit score.
                    </p>
                    <Button size="lg" onClick={runCRBCheck}>Run CRB Pre-Check</Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="decision" className="mt-4">
            <Card>
              <CardContent className="pt-6 space-y-6">
                <h3 className="font-display font-semibold text-foreground">Application Decision</h3>
                <div>
                  <Label htmlFor="adminNotes">Admin Notes</Label>
                  <textarea id="adminNotes"
                    className="mt-1.5 w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Add internal notes..." value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)} />
                </div>
                <div className="flex gap-3">
                  <Button className="bg-success hover:bg-success/90 text-success-foreground" disabled={saving}
                    onClick={() => updateApplication({ status: "approved", admin_notes: adminNotes })}>
                    <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                  </Button>
                  <Button variant="destructive" disabled={saving}
                    onClick={() => updateApplication({ status: "rejected", admin_notes: adminNotes })}>
                    <XCircle className="w-4 h-4 mr-1" /> Reject
                  </Button>
                  <Button variant="outline" disabled={saving}
                    onClick={() => updateApplication({ status: "reviewing", admin_notes: adminNotes })}>
                    Mark as Reviewing
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Loan Applications</h1>
        <p className="text-sm text-muted-foreground">Review, process, and manage loan applications</p>
      </div>

      {loadingApps ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : applications.length === 0 ? (
        <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">No applications yet.</p></CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Applicant</TableHead>
                  <TableHead className="hidden sm:table-cell">Employer</TableHead>
                  <TableHead className="hidden md:table-cell">NRC</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Date</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell className="font-medium">{app.full_name || "—"}</TableCell>
                    <TableCell className="hidden sm:table-cell">{app.employer || "—"}</TableCell>
                    <TableCell className="hidden md:table-cell">{app.nrc_number || "—"}</TableCell>
                    <TableCell><Badge className={statusColors[app.status] || ""}>{app.status}</Badge></TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">{new Date(app.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => openApplication(app)}>
                        <Eye className="w-4 h-4 mr-1" /> Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default UsersApplications;
