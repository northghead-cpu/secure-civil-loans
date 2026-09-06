import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { parsePayslip, type PayrollParseResult } from "@/services/payrollParsingService";
import { parseNRC, parseGovernmentID, type IDParseResult, type IDDocumentType } from "@/services/idDocumentParsingService";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Upload, CreditCard, FileText, FileSignature, CheckCircle2, ArrowRight, ArrowLeft, ShieldCheck, Info } from "lucide-react";

const steps = [
  { id: 1, title: "Personal details", icon: Upload, description: "Tell us about yourself and verify your NRC" },
  { id: 2, title: "Identity", icon: CreditCard, description: "Verify your government-issued identity" },
  { id: 3, title: "Employment", icon: FileText, description: "Verify your employment and income" },
  { id: 4, title: "Review & authorize", icon: FileSignature, description: "Review your information and authorize your Riverbanc subscription" },
];

const KYCPage = () => {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading, profileLoading, refreshProfile } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [parsingPayslip, setParsingPayslip] = useState(false);
  const [payrollResult, setPayrollResult] = useState<PayrollParseResult | null>(null);
  const [parsingNrc, setParsingNrc] = useState(false);
  const [nrcResult, setNrcResult] = useState<IDParseResult | null>(null);
  const [parsingGovId, setParsingGovId] = useState(false);
  const [govIdResult, setGovIdResult] = useState<IDParseResult | null>(null);
  const [formData, setFormData] = useState({ fullName: "", nrcNumber: "", phone: "", nrcFile: null as File | null, govIdType: "passport", govIdNumber: "", govIdFile: null as File | null, payslipFile: null as File | null, employer: "", employeeNumber: "", consentAccepted: false, signatureName: "" });

  useEffect(() => { if (user) void refreshProfile(); }, [user, refreshProfile]);
  useEffect(() => {
    if (authLoading || profileLoading) return;
    if (!user) { navigate("/login", { replace: true }); return; }
    if ((profile?.kyc_status === "VERIFIED" || profile?.kyc_status === "COMPLETED") && profile?.consent_accepted) { toast.info("Your Riverbanc verification is already complete."); navigate("/profile", { replace: true }); return; }
    if (profile?.kyc_status === "IN_REVIEW") { toast.info("Your verification is under review."); navigate("/profile", { replace: true }); }
  }, [user, profile, authLoading, profileLoading, navigate]);
  useEffect(() => { if ((profile?.kyc_status === "VERIFIED" || profile?.kyc_status === "COMPLETED") && profile?.consent_accepted === false) setCurrentStep(4); }, [profile?.kyc_status, profile?.consent_accepted]);

  const progress = (currentStep / steps.length) * 100;
  const updateField = (field: string, value: unknown) => setFormData((prev) => ({ ...prev, [field]: value }));

  const handleNrcUpload = async (file: File | null) => {
    updateField("nrcFile", file);
    if (!file) { setNrcResult(null); return; }
    setParsingNrc(true);
    try { const result = await parseNRC(file); setNrcResult(result); if (result.success) { if (result.full_name && !formData.fullName) updateField("fullName", result.full_name); if (result.document_number && !formData.nrcNumber) updateField("nrcNumber", result.document_number); toast.success("NRC parsed — fields auto-filled where possible."); } else toast.info("Could not auto-extract NRC data. Please fill it in manually."); }
    catch { toast.info("NRC parsing unavailable. Please fill it in manually."); } finally { setParsingNrc(false); }
  };
  const handleGovIdUpload = async (file: File | null) => {
    updateField("govIdFile", file);
    if (!file) { setGovIdResult(null); return; }
    setParsingGovId(true);
    try { const govIdType: IDDocumentType = formData.govIdType === "driving_license" ? "driving_license" : formData.govIdType === "employee_id" ? "employee_id" : "passport"; const result = await parseGovernmentID(file, govIdType); setGovIdResult(result); if (result.success) { if (result.document_number && !formData.govIdNumber) updateField("govIdNumber", result.document_number); if (result.full_name && !formData.fullName) updateField("fullName", result.full_name); toast.success("Government ID parsed — fields auto-filled where possible."); } else toast.info("Could not auto-extract ID data. Please fill it in manually."); }
    catch { toast.info("ID parsing unavailable. Please fill it in manually."); } finally { setParsingGovId(false); }
  };
  const handlePayslipUpload = async (file: File | null) => {
    updateField("payslipFile", file);
    if (!file) { setPayrollResult(null); return; }
    setParsingPayslip(true);
    try { const result = await parsePayslip(file); setPayrollResult(result); if (result.success) { if (result.employer && !formData.employer) updateField("employer", result.employer); if (result.employee_number && !formData.employeeNumber) updateField("employeeNumber", result.employee_number); toast.success("Payslip parsed — fields auto-filled where possible."); } else toast.info("Could not auto-extract payslip data. Please fill it in manually."); }
    catch { toast.info("Payslip parsing unavailable. Please fill it in manually."); } finally { setParsingPayslip(false); }
  };

  const handleSubmit = async () => {
    if (!user) { toast.error("You must be logged in"); return; }
    if (!formData.consentAccepted || !formData.signatureName.trim()) { toast.error("Please review and authorize your Riverbanc subscription."); return; }
    const KycSchema = z.object({ fullName: z.string().trim().min(2, "Full name is required").max(100), nrcNumber: z.string().trim().regex(/^\d{6}\/\d{2}\/\d{1}$/, "NRC must be in format 123456/78/1"), phone: z.string().trim().regex(/^\+?[0-9\s\-]{9,20}$/, "Enter a valid phone number"), employer: z.string().trim().min(2, "Employer is required").max(150), employeeNumber: z.string().trim().min(1, "Employee number is required").max(50), signatureName: z.string().trim().min(2, "Your full legal name is required for the authorization").max(100) });
    const parsed = KycSchema.safeParse(formData);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message || "Please review the form."); return; }
    const MAX_FILE_BYTES = 10 * 1024 * 1024;
    for (const { field, file } of [{ field: "NRC", file: formData.nrcFile }, { field: "Government ID", file: formData.govIdFile }, { field: "Payslip", file: formData.payslipFile }]) { if (file && file.size > MAX_FILE_BYTES) { toast.error(`${field} file exceeds the 10MB limit.`); return; } }
    setSubmitting(true);
    try {
      const files: { field: string; file: File }[] = [];
      if (formData.nrcFile) files.push({ field: "nrc", file: formData.nrcFile });
      if (formData.govIdFile) files.push({ field: "gov-id", file: formData.govIdFile });
      if (formData.payslipFile) files.push({ field: "payslip", file: formData.payslipFile });
      for (const { field, file } of files) { const ext = file.name.split(".").pop(); const path = `${user.id}/${field}-${Date.now()}.${ext}`; const { error: uploadError } = await supabase.storage.from("kyc-documents").upload(path, file, { upsert: true }); if (uploadError) throw new Error(`Failed to upload ${field}`); }
      const validated = parsed.data;
      const { error: profileError } = await supabase.from("profiles").upsert({ user_id: user.id, full_name: validated.fullName, nrc_number: validated.nrcNumber, phone: validated.phone, employer: validated.employer, employee_number: validated.employeeNumber, kyc_status: "IN_REVIEW", consent_accepted: formData.consentAccepted, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (profileError) throw new Error("Failed to save KYC profile");
      await refreshProfile();
      toast.success("Verification submitted and Riverbanc subscription authorization recorded.");
      setTimeout(() => navigate("/application-submitted"), 1200);
    } catch (err) { const { logger } = await import("@/lib/logger"); logger.error("KYC submission failed", { name: err instanceof Error ? err.name : typeof err }); toast.error("We couldn't submit your verification. Please review your details and try again."); }
    finally { setSubmitting(false); }
  };

  const uploadCard = (label: string, file: File | null, icon: React.ReactNode, onChange: (file: File | null) => void, helper: string) => <div><Label>{label}</Label><label className="mt-1.5 border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-accent/50 transition-colors cursor-pointer block"><input type="file" accept=".png,.jpg,.jpeg,.pdf" className="hidden" onChange={(e) => onChange(e.target.files?.[0] || null)} />{icon}{file ? <p className="text-sm text-foreground font-medium">{file.name}</p> : <><p className="text-sm text-muted-foreground">Click to upload</p><p className="text-xs text-muted-foreground/70 mt-1">{helper}</p></>}</label></div>;

  const renderStep = () => {
    switch (currentStep) {
      case 1: return <div className="space-y-6"><div className="grid md:grid-cols-2 gap-4"><div><Label htmlFor="fullName">Full name</Label><Input id="fullName" placeholder="As shown on your NRC" value={formData.fullName} onChange={(e) => updateField("fullName", e.target.value)} className="mt-1.5" /><p className="text-xs text-muted-foreground mt-1">We'll use this to match your identity records.</p></div><div><Label htmlFor="nrcNumber">NRC number</Label><Input id="nrcNumber" placeholder="e.g. 123456/78/1" value={formData.nrcNumber} onChange={(e) => updateField("nrcNumber", e.target.value)} className="mt-1.5" /><p className="text-xs text-muted-foreground mt-1">Used for identity verification.</p></div></div><div><Label htmlFor="phone">Phone number</Label><Input id="phone" type="tel" placeholder="e.g. +260 97X XXXXXX" value={formData.phone} onChange={(e) => updateField("phone", e.target.value)} className="mt-1.5" /></div>{uploadCard("NRC document", formData.nrcFile, <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />, handleNrcUpload, "PNG, JPG or PDF · max 10MB")}{parsingNrc && <p className="text-sm text-muted-foreground">Extracting NRC data…</p>}{nrcResult?.success && <div className="bg-success/10 border border-success/30 rounded-lg p-3 text-sm"><p className="font-medium text-success">NRC data extracted</p><p className="text-muted-foreground mt-1">Fields were auto-filled where possible. Please review them before continuing.</p></div>}<div className="bg-muted/50 rounded-lg p-4 border border-border/50"><p className="text-sm text-muted-foreground"><Info className="w-4 h-4 inline mr-1" /> Your NRC is collected for identity verification and handled according to Riverbanc's privacy policies.</p></div></div>;
      case 2: return <div className="space-y-6"><div className="bg-muted/50 rounded-lg p-4 border border-border/50"><p className="text-sm text-muted-foreground">We use a government-issued identity document to verify that your Riverbanc profile belongs to you.</p></div><div className="grid md:grid-cols-2 gap-4"><div><Label>ID type</Label><select className="w-full mt-1.5 h-10 rounded-md border border-input bg-background px-3 text-sm" value={formData.govIdType} onChange={(e) => updateField("govIdType", e.target.value)}><option value="passport">Passport</option><option value="driving_license">Driving License</option><option value="employee_id">Government Employee ID</option></select></div><div><Label htmlFor="govIdNumber">ID number</Label><Input id="govIdNumber" placeholder="Enter ID number" value={formData.govIdNumber} onChange={(e) => updateField("govIdNumber", e.target.value)} className="mt-1.5" /></div></div>{uploadCard("Government ID", formData.govIdFile, <CreditCard className="w-10 h-10 text-muted-foreground mx-auto mb-3" />, handleGovIdUpload, "PNG, JPG or PDF · max 10MB")}{parsingGovId && <p className="text-sm text-muted-foreground">Extracting ID data…</p>}{govIdResult?.success && <div className="bg-success/10 border border-success/30 rounded-lg p-3 text-sm"><p className="font-medium text-success">Identity document received</p><p className="text-muted-foreground mt-1">Fields were auto-filled where possible. Please review them before continuing.</p></div>}<div className="flex gap-3 items-start bg-card border border-border rounded-lg p-4"><ShieldCheck className="w-5 h-5 text-success shrink-0 mt-0.5" /><p className="text-sm text-muted-foreground">Your document is collected for verification and lender eligibility workflows. Sharing with a financial institution occurs only as part of your chosen application flow.</p></div></div>;
      case 3: return <div className="space-y-6"><div className="grid md:grid-cols-2 gap-4"><div><Label htmlFor="employer">Employer</Label><Input id="employer" placeholder="e.g. Ministry of Finance" value={formData.employer} onChange={(e) => updateField("employer", e.target.value)} className="mt-1.5" /></div><div><Label htmlFor="employeeNumber">Employee number</Label><Input id="employeeNumber" placeholder="Your employee number" value={formData.employeeNumber} onChange={(e) => updateField("employeeNumber", e.target.value)} className="mt-1.5" /></div></div>{uploadCard("Latest payslip", formData.payslipFile, <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />, handlePayslipUpload, "PNG, JPG or PDF · max 10MB")}{parsingPayslip && <p className="text-sm text-muted-foreground">Extracting payslip data…</p>}{payrollResult?.success && <div className="bg-success/10 border border-success/30 rounded-lg p-3 text-sm"><p className="font-medium text-success">Payslip data extracted</p><p className="text-muted-foreground mt-1">Fields were auto-filled where possible. Please review them before continuing.</p></div>}<div className="bg-muted/50 rounded-lg p-4 border border-border/50"><p className="text-sm text-muted-foreground">Your employment and income information is used for affordability and loan matching. Riverbanc does not make the final lending decision.</p></div></div>;
      case 4: return <div className="space-y-6"><div className="rounded-xl border border-border bg-card p-5 space-y-4"><div className="flex items-center gap-3"><ShieldCheck className="w-6 h-6 text-success"/><div><p className="font-semibold text-foreground">Review & authorize</p><p className="text-sm text-muted-foreground">Confirm your information and authorize Riverbanc to process your subscription and verification.</p></div></div><div className="grid md:grid-cols-2 gap-3 text-sm"><div><p className="text-muted-foreground">Name</p><p className="font-medium">{formData.fullName || "—"}</p></div><div><p className="text-muted-foreground">NRC</p><p className="font-medium">{formData.nrcNumber || "—"}</p></div><div><p className="text-muted-foreground">Employer</p><p className="font-medium">{formData.employer || "—"}</p></div><div><p className="text-muted-foreground">Employee number</p><p className="font-medium">{formData.employeeNumber || "—"}</p></div></div></div><div className="flex items-start gap-3"><Checkbox id="consent" checked={formData.consentAccepted} onCheckedChange={(checked) => updateField("consentAccepted", checked === true)} /><Label htmlFor="consent" className="text-sm leading-relaxed cursor-pointer">I confirm that the information provided is accurate and authorize Riverbanc Technology Limited to process my information for verification, subscription administration, loan comparison and application support.</Label></div><div><Label htmlFor="signatureName">Authorization signature</Label><Input id="signatureName" placeholder={formData.fullName || "Full legal name"} value={formData.signatureName} onChange={(e) => updateField("signatureName", e.target.value)} className="mt-1.5" /></div></div>;
      default: return null;
    }
  };

  if (authLoading || profileLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  if (!user) return null;
  return <div className="min-h-screen bg-background"><Navbar/><main className="pt-24 pb-16"><div className="container mx-auto px-4 lg:px-8 max-w-3xl space-y-6"><header><p className="text-sm font-medium text-primary mb-2">Verification</p><h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">Complete your Riverbanc profile</h1><p className="text-muted-foreground mt-2">Securely verify your identity and employment information.</p></header><div className="space-y-2"><Progress value={progress}/><p className="text-xs text-muted-foreground">Step {currentStep} of {steps.length}</p></div><div className="flex gap-2 overflow-x-auto pb-1">{steps.map((step) => { const Icon = step.icon; return <button key={step.id} type="button" onClick={() => step.id <= currentStep && setCurrentStep(step.id)} className={`shrink-0 rounded-lg border px-3 py-2 text-left ${step.id === currentStep ? "border-primary bg-primary/5" : step.id < currentStep ? "border-success/40" : "border-border"}`}><div className="flex items-center gap-2"><Icon className="w-4 h-4"/><span className="text-sm font-medium">{step.title}</span></div></button>; })}</div><motion.div key={currentStep} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border bg-card p-5 md:p-7">{renderStep()}</motion.div><div className="flex justify-between gap-3"><Button variant="outline" disabled={currentStep === 1 || submitting} onClick={() => setCurrentStep((step) => Math.max(1, step - 1))}><ArrowLeft className="w-4 h-4 mr-2"/>Back</Button>{currentStep < steps.length ? <Button disabled={submitting} onClick={() => setCurrentStep((step) => Math.min(steps.length, step + 1))}>Continue<ArrowRight className="w-4 h-4 ml-2"/></Button> : <Button disabled={submitting} onClick={handleSubmit}>{submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin"/>}{submitting ? "Submitting…" : "Submit verification"}<CheckCircle2 className="w-4 h-4 ml-2"/></Button>}</div></div></main><Footer/></div>;
};

export default KYCPage;
