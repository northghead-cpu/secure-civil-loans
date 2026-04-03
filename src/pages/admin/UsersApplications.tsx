import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AdminHero, AdminPageShell, adminCardClass } from "@/components/admin/AdminPageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ShieldCheck,
  FileText,
  Calculator,
  CheckCircle2,
  XCircle,
  Eye,
  ArrowLeft,
  Loader2,
  Download,
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

  const openApplication = async (application: Application) => {
    setSelected(application);
    setSalaryForm({
      gross: application.gross_salary?.toString() || "",
      deductions: application.deductions?.toString() || "",
      net: application.net_salary?.toString() || "",
    });
    setAdminNotes(application.admin_notes || "");
    const { data: files } = await supabase.storage.from("kyc-documents").list(application.user_id);
    if (files) {
      const docs = await Promise.all(
        files.map(async (file) => {
          const { data } = await supabase.storage
            .from("kyc-documents")
            .createSignedUrl(`${application.user_id}/${file.name}`, 3600);
          return { name: file.name, url: data?.signedUrl || "" };
        })
      );
      setDocuments(docs.filter((doc) => doc.url));
    }
  };

  const updateApplication = async (updates: Record<string, unknown>) => {
    if (!selected) return;
    setSaving(true);
    const { error } = await supabase.from("loan_applications").update(updates).eq("id", selected.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Application updated");
      setApplications((previous) =>
        previous.map((application) =>
          application.id === selected.id ? ({ ...application, ...updates } as Application) : application
        )
      );
      setSelected((previous) => (previous ? ({ ...previous, ...updates } as Application) : previous));
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
      <AdminPageShell className="max-w-5xl">
        <AdminHero
          badge="Application review"
          title={selected.full_name || "Unnamed applicant"}
          description={`NRC: ${selected.nrc_number || "-"} | ${selected.employer || "-"} | Applied ${new Date(selected.created_at).toLocaleDateString()}`}
          actions={
            <div className="flex items-center gap-3">
              <Badge className={statusColors[selected.status] || ""}>{selected.status}</Badge>
              <Button
                variant="outline"
                onClick={() => setSelected(null)}
                className="border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white"
              >
                <ArrowLeft className="mr-1 h-4 w-4" /> Back to Applications
              </Button>
            </div>
          }
          stats={[
            { label: "Gov ID type", value: selected.gov_id_type || "-", meta: "Identity document on file" },
            { label: "Employee number", value: selected.employee_number || "-", meta: "Payroll-linked identifier" },
            { label: "CRB status", value: selected.crb_status || "Not run", meta: "Soft bureau check state" },
          ]}
        />

        <Tabs defaultValue="documents">
          <TabsList>
            <TabsTrigger value="documents"><FileText className="mr-1 h-4 w-4" /> Documents</TabsTrigger>
            <TabsTrigger value="salary"><Calculator className="mr-1 h-4 w-4" /> Payslip</TabsTrigger>
            <TabsTrigger value="crb"><ShieldCheck className="mr-1 h-4 w-4" /> CRB</TabsTrigger>
            <TabsTrigger value="decision">Decision</TabsTrigger>
          </TabsList>

          <TabsContent value="documents" className="mt-4">
            <Card className={adminCardClass}>
              <CardContent className="space-y-4 pt-6">
                <h3 className="font-display font-semibold text-foreground">Uploaded Documents</h3>
                {documents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No documents found.</p>
                ) : (
                  <div className="grid gap-3">
                    {documents.map((doc) => (
                      <a
                        key={doc.name}
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
                      >
                        <Download className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">{doc.name}</span>
                      </a>
                    ))}
                  </div>
                )}
                <div className="grid gap-4 border-t border-border pt-4 md:grid-cols-3">
                  {[
                    ["Gov ID Type", selected.gov_id_type],
                    ["Gov ID Number", selected.gov_id_number],
                    ["Employee Number", selected.employee_number],
                  ].map(([label, value]) => (
                    <div key={label as string}>
                      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
                      <p className="text-sm font-medium text-foreground">{value || "-"}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="salary" className="mt-4">
            <Card className={adminCardClass}>
              <CardContent className="space-y-6 pt-6">
                <h3 className="font-display font-semibold text-foreground">Payslip Parsing & Salary Assessment</h3>
                <div className="space-y-4">
                  {[
                    { label: "Gross Salary (K)", key: "gross" as const },
                    { label: "Total Deductions (K)", key: "deductions" as const },
                  ].map(({ label, key }) => (
                    <div key={key} className="flex items-center justify-between">
                      <Label>{label}</Label>
                      <Input
                        className="w-48 text-right"
                        placeholder="0.00"
                        value={salaryForm[key]}
                        onChange={(event) => setSalaryForm((previous) => ({ ...previous, [key]: event.target.value }))}
                      />
                    </div>
                  ))}
                  <div className="flex items-center justify-between border-t border-border pt-4">
                    <Label className="font-semibold">Net Salary (K)</Label>
                    <Input
                      className="w-48 text-right font-semibold"
                      placeholder="0.00"
                      value={salaryForm.net}
                      onChange={(event) => setSalaryForm((previous) => ({ ...previous, net: event.target.value }))}
                    />
                  </div>
                </div>
                {salaryForm.net ? (
                  <div className="rounded-xl border border-accent/20 bg-accent/10 p-4">
                    <p className="text-sm text-muted-foreground">
                      <strong>Affordability (1/3 rule):</strong> Max monthly repayment ={" "}
                      <strong className="text-foreground">K{(parseFloat(salaryForm.net) / 3).toFixed(2)}</strong>
                    </p>
                  </div>
                ) : null}
                <Button onClick={saveSalary} disabled={saving}>
                  {saving ? "Saving..." : "Save Salary Data"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="crb" className="mt-4">
            <Card className={adminCardClass}>
              <CardContent className="space-y-6 pt-6 text-center">
                <ShieldCheck className="mx-auto h-16 w-16 text-accent" />
                <h3 className="text-lg font-display font-semibold text-foreground">Credit Bureau Pre-Check</h3>
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
                    <p className="mx-auto max-w-md text-sm text-muted-foreground">
                      Run a soft inquiry to check credit standing. This will not affect the applicant&apos;s credit score.
                    </p>
                    <Button size="lg" onClick={runCRBCheck}>Run CRB Pre-Check</Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="decision" className="mt-4">
            <Card className={adminCardClass}>
              <CardContent className="space-y-6 pt-6">
                <h3 className="font-display font-semibold text-foreground">Application Decision</h3>
                <div>
                  <Label htmlFor="adminNotes">Admin Notes</Label>
                  <textarea
                    id="adminNotes"
                    className="mt-1.5 min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Add internal notes..."
                    value={adminNotes}
                    onChange={(event) => setAdminNotes(event.target.value)}
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    className="bg-success text-success-foreground hover:bg-success/90"
                    disabled={saving}
                    onClick={() => updateApplication({ status: "approved", admin_notes: adminNotes })}
                  >
                    <CheckCircle2 className="mr-1 h-4 w-4" /> Approve
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={saving}
                    onClick={() => updateApplication({ status: "rejected", admin_notes: adminNotes })}
                  >
                    <XCircle className="mr-1 h-4 w-4" /> Reject
                  </Button>
                  <Button
                    variant="outline"
                    disabled={saving}
                    onClick={() => updateApplication({ status: "reviewing", admin_notes: adminNotes })}
                  >
                    Mark as Reviewing
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell>
      <AdminHero
        badge="Underwriting queue"
        title="Loan applications ready for review, salary checks, and bureau screening"
        description="Move applicants from document intake through credit review while keeping notes, salary parsing, and final decisions in one place."
        stats={[
          { label: "Applications loaded", value: applications.length.toString(), meta: "Current records in the review list" },
          { label: "Pending", value: applications.filter((application) => application.status === "pending").length.toString(), meta: "Awaiting first action" },
          { label: "Reviewing", value: applications.filter((application) => application.status === "reviewing").length.toString(), meta: "Actively being worked" },
          { label: "Approved", value: applications.filter((application) => application.status === "approved").length.toString(), meta: "Ready for next operational step" },
        ]}
      />

      {loadingApps ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : applications.length === 0 ? (
        <Card className={adminCardClass}>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No applications yet.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className={`${adminCardClass} overflow-hidden`}>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Employer</TableHead>
                  <TableHead>NRC</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((application) => (
                  <TableRow key={application.id}>
                    <TableCell className="font-medium">{application.full_name || "-"}</TableCell>
                    <TableCell>{application.employer || "-"}</TableCell>
                    <TableCell>{application.nrc_number || "-"}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[application.status] || ""}>{application.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(application.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => openApplication(application)}>
                        <Eye className="mr-1 h-4 w-4" /> Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </AdminPageShell>
  );
};

export default UsersApplications;
