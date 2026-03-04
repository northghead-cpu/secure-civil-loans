import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  approved: "bg-green-500/10 text-green-600 border-green-500/20",
  rejected: "bg-red-500/10 text-red-600 border-red-500/20",
  reviewing: "bg-blue-500/10 text-blue-600 border-blue-500/20",
};

const AdminPortal = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [selected, setSelected] = useState<Application | null>(null);
  const [loadingApps, setLoadingApps] = useState(true);
  const [documents, setDocuments] = useState<{ name: string; url: string }[]>([]);
  const [salaryForm, setSalaryForm] = useState({ gross: "", deductions: "", net: "" });
  const [adminNotes, setAdminNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Check admin role
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/login");
      return;
    }
    const checkRole = async () => {
      const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!data) {
        toast.error("Access denied — admin only");
        navigate("/");
        return;
      }
      setIsAdmin(true);
    };
    checkRole();
  }, [user, authLoading, navigate]);

  // Fetch applications
  useEffect(() => {
    if (!isAdmin) return;
    const fetch = async () => {
      const { data, error } = await supabase
        .from("loan_applications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        toast.error("Failed to load applications");
      } else {
        setApplications(data as Application[]);
      }
      setLoadingApps(false);
    };
    fetch();
  }, [isAdmin]);

  const openApplication = async (app: Application) => {
    setSelected(app);
    setSalaryForm({
      gross: app.gross_salary?.toString() || "",
      deductions: app.deductions?.toString() || "",
      net: app.net_salary?.toString() || "",
    });
    setAdminNotes(app.admin_notes || "");

    // Fetch documents for this user
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

  const updateApplication = async (updates: Record<string, any>) => {
    if (!selected) return;
    setSaving(true);
    const { error } = await supabase
      .from("loan_applications")
      .update(updates)
      .eq("id", selected.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Application updated");
      setApplications((prev) =>
        prev.map((a) => (a.id === selected.id ? { ...a, ...updates } : a))
      );
      setSelected((prev) => (prev ? { ...prev, ...updates } : prev));
    }
    setSaving(false);
  };

  const saveSalary = () => {
    const gross = parseFloat(salaryForm.gross) || null;
    const ded = parseFloat(salaryForm.deductions) || null;
    const net = parseFloat(salaryForm.net) || null;
    updateApplication({ gross_salary: gross, deductions: ded, net_salary: net });
  };

  const runCRBCheck = () => {
    // Simulated CRB check
    updateApplication({ crb_status: "clear", crb_checked_at: new Date().toISOString() });
  };

  if (authLoading || isAdmin === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 lg:px-8 max-w-6xl">
          {selected ? (
            <div className="space-y-6">
              <Button variant="ghost" onClick={() => setSelected(null)}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Back to Applications
              </Button>

              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-display font-bold text-foreground">
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
                <TabsList>
                  <TabsTrigger value="documents">
                    <FileText className="w-4 h-4 mr-1" /> Documents
                  </TabsTrigger>
                  <TabsTrigger value="salary">
                    <Calculator className="w-4 h-4 mr-1" /> Payslip Parsing
                  </TabsTrigger>
                  <TabsTrigger value="crb">
                    <ShieldCheck className="w-4 h-4 mr-1" /> CRB Check
                  </TabsTrigger>
                  <TabsTrigger value="decision">Decision</TabsTrigger>
                </TabsList>

                <TabsContent value="documents" className="mt-4">
                  <div className="bg-card rounded-xl p-6 border border-border/50 space-y-4">
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
                            className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors"
                          >
                            <Download className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm font-medium text-foreground">{doc.name}</span>
                          </a>
                        ))}
                      </div>
                    )}
                    <div className="grid md:grid-cols-2 gap-4 pt-4 border-t border-border/50">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Gov ID Type</p>
                        <p className="text-sm font-medium text-foreground">{selected.gov_id_type || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Gov ID Number</p>
                        <p className="text-sm font-medium text-foreground">{selected.gov_id_number || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Employee Number</p>
                        <p className="text-sm font-medium text-foreground">{selected.employee_number || "—"}</p>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="salary" className="mt-4">
                  <div className="bg-card rounded-xl p-6 border border-border/50 space-y-6">
                    <h3 className="font-display font-semibold text-foreground">Payslip Parsing & Salary Assessment</h3>
                    <p className="text-sm text-muted-foreground">
                      Review the uploaded payslip and enter the parsed salary data below.
                    </p>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <Label>Gross Salary (K)</Label>
                        <Input
                          className="w-48 text-right"
                          placeholder="0.00"
                          value={salaryForm.gross}
                          onChange={(e) => setSalaryForm((p) => ({ ...p, gross: e.target.value }))}
                        />
                      </div>
                      <div className="flex justify-between items-center">
                        <Label>Total Deductions (K)</Label>
                        <Input
                          className="w-48 text-right"
                          placeholder="0.00"
                          value={salaryForm.deductions}
                          onChange={(e) => setSalaryForm((p) => ({ ...p, deductions: e.target.value }))}
                        />
                      </div>
                      <div className="border-t border-border pt-4 flex justify-between items-center">
                        <Label className="font-semibold">Net Salary (K)</Label>
                        <Input
                          className="w-48 text-right font-semibold"
                          placeholder="0.00"
                          value={salaryForm.net}
                          onChange={(e) => setSalaryForm((p) => ({ ...p, net: e.target.value }))}
                        />
                      </div>
                    </div>
                    {salaryForm.net && (
                      <div className="bg-accent/10 rounded-xl p-4 border border-accent/20">
                        <p className="text-sm text-muted-foreground">
                          <strong>Affordability (1/3 rule):</strong> Max monthly repayment ={" "}
                          <strong className="text-foreground">
                            K{(parseFloat(salaryForm.net) / 3).toFixed(2)}
                          </strong>
                        </p>
                      </div>
                    )}
                    <Button onClick={saveSalary} disabled={saving}>
                      {saving ? "Saving…" : "Save Salary Data"}
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="crb" className="mt-4">
                  <div className="bg-card rounded-xl p-6 border border-border/50 space-y-6 text-center">
                    <ShieldCheck className="w-16 h-16 text-accent mx-auto" />
                    <h3 className="font-display font-semibold text-foreground text-lg">
                      Credit Bureau Pre-Check
                    </h3>
                    {selected.crb_status ? (
                      <div className="space-y-2">
                        <Badge
                          className={
                            selected.crb_status === "clear"
                              ? "bg-green-500/10 text-green-600"
                              : "bg-red-500/10 text-red-600"
                          }
                        >
                          {selected.crb_status.toUpperCase()}
                        </Badge>
                        <p className="text-xs text-muted-foreground">
                          Checked at {new Date(selected.crb_checked_at!).toLocaleString()}
                        </p>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-muted-foreground max-w-md mx-auto">
                          Run a soft inquiry with TransUnion Zambia to check credit standing. This will NOT
                          affect the applicant's credit score.
                        </p>
                        <Button size="lg" onClick={runCRBCheck}>
                          Run CRB Pre-Check
                        </Button>
                      </>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="decision" className="mt-4">
                  <div className="bg-card rounded-xl p-6 border border-border/50 space-y-6">
                    <h3 className="font-display font-semibold text-foreground">Application Decision</h3>
                    <div>
                      <Label htmlFor="adminNotes">Admin Notes</Label>
                      <textarea
                        id="adminNotes"
                        className="mt-1.5 w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                        placeholder="Add internal notes about this application..."
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-3">
                      <Button
                        className="bg-green-600 hover:bg-green-700 text-white"
                        disabled={saving}
                        onClick={() =>
                          updateApplication({ status: "approved", admin_notes: adminNotes })
                        }
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                      </Button>
                      <Button
                        variant="destructive"
                        disabled={saving}
                        onClick={() =>
                          updateApplication({ status: "rejected", admin_notes: adminNotes })
                        }
                      >
                        <XCircle className="w-4 h-4 mr-1" /> Reject
                      </Button>
                      <Button
                        variant="outline"
                        disabled={saving}
                        onClick={() =>
                          updateApplication({ status: "reviewing", admin_notes: adminNotes })
                        }
                      >
                        Mark as Reviewing
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-display font-bold text-foreground mb-2">Admin Portal</h1>
                <p className="text-muted-foreground">Review and manage loan applications.</p>
              </div>

              {loadingApps ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : applications.length === 0 ? (
                <div className="bg-card rounded-xl p-12 border border-border/50 text-center">
                  <p className="text-muted-foreground">No applications yet.</p>
                </div>
              ) : (
                <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
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
                      {applications.map((app) => (
                        <TableRow key={app.id}>
                          <TableCell className="font-medium">{app.full_name || "—"}</TableCell>
                          <TableCell>{app.employer || "—"}</TableCell>
                          <TableCell>{app.nrc_number || "—"}</TableCell>
                          <TableCell>
                            <Badge className={statusColors[app.status] || ""}>{app.status}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {new Date(app.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="ghost" onClick={() => openApplication(app)}>
                              <Eye className="w-4 h-4 mr-1" /> Review
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AdminPortal;
