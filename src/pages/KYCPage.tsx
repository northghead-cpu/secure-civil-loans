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
  const [formData, setFormData] = useState({
    fullName: "",
    nrcNumber: "",
    phone: "",
    nrcFile: null as File | null,
    govIdType: "passport",
    govIdNumber: "",
    govIdFile: null as File | null,
    payslipFile: null as File | null,
    employer: "",
    employeeNumber: "",
    consentAccepted: false,
    signatureName: "",
  });

  useEffect(() => {
    if (user) refreshProfile();
  }, [user, refreshProfile]);

  useEffect(() => {
    if (authLoading || profileLoading) return;
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    if ((profile?.kyc_status === "VERIFIED" || profile?.kyc_status === "COMPLETED") && profile?.consent_accepted) {
      toast.info("Your Riverbanc verification is already complete.");
      navigate("/profile", { replace: true });
      return;
    }
    if (profile?.kyc_status === "IN_REVIEW") {
      toast.info("Your verification is under review.");
      navigate("/profile", { replace: true });
    }
  }, [user, profile, authLoading, profileLoading, navigate]);

  useEffect(() => {
    if ((profile?.kyc_status === "VERIFIED" || profile?.kyc_status === "COMPLETED") && profile?.consent_accepted === false) {
      setCurrentStep(4);
    }
  }, [profile?.kyc_status, profile?.consent_accepted]);

  const kycStatus = profile?.kyc_status || "PENDING";
  const progress = (currentStep / steps.length) * 100;
  const updateField = (field: string, value: unknown) => setFormData((prev) => ({ ...prev, [field]: value }));

  const handleNrcUpload = async (file: File | null) => {
    updateField("nrcFile", file);
    if (!file) { setNrcResult(null); return; }
    setParsingNrc(true);
    try {
      const result = await parseNRC(file);
      setNrcResult(result);
      if (result.success) {
        if (result.full_name && !formData.fullName) updateField("fullName", result.full_name);
        if (result.document_number && !formData.nrcNumber) updateField("nrcNumber", result.document_number);
        toast.success("NRC parsed — fields auto-filled where possible.");
      } else toast.info("Could not auto-extract NRC data. Please fill it in manually.");
    } catch { toast.info("NRC parsing unavailable. Please fill it in manually."); }
    finally { setParsingNrc(false); }
  };

  const handleGovIdUpload = async (file: File | null) => {
    updateField("govIdFile", file);
    if (!file) { setGovIdResult(null); return; }
    setParsingGovId(true);
    try {
      const govIdType: IDDocumentType = formData.govIdType === "driving_license" ? "driving_license" : formData.govIdType === "employee_id" ? "employee_id" : "passport";
      const result = await parseGovernmentID(file, govIdType);
      setGovIdResult(result);
      if (result.success) {
        if (result.document_number && !formData.govIdNumber) updateField("govIdNumber", result.document_number);
        if (result.full_name && !formData.fullName) updateField("fullName", result.full_name);
        toast.success("Government ID parsed — fields auto-filled where possible.");
      } else toast.info("Could not auto-extract ID data. Please fill it in manually.");
    } catch { toast.info("ID parsing unavailable. Please fill it in manually."); }
    finally { setParsingGovId(false); }
  };

  const handlePayslipUpload = async (file: File | null) => {
    updateField("payslipFile", file);
    if (!file) { setPayrollResult(null); return; }
    setParsingPayslip(true);
    try {
      const result = await parsePayslip(file);
      setPayrollResult(result);
      if (result.success) {
        if (result.employer && !formData.employer) updateField("employer", result.employer);
        if (result.employee_number && !formData.employeeNumber) updateField("employeeNumber", result.employee_number);
        toast.success("Payslip parsed — fields auto-filled where possible.");
      } else toast.info("Could not auto-extract payslip data. Please fill it in manually.");
    } catch { toast.info("Payslip parsing unavailable. Please fill it in manually."); }
    finally { setParsingPayslip(false); }
  };

  const handleSubmit = async () => {
    if (!user) { toast.error("You must be logged in"); return; }
    if (!formData.consentAccepted || !formData.signatureName.trim()) {
      toast.error("Please review and authorize your Riverbanc subscription.");
      return;
    }

    const KycSchema = z.object({
      fullName: z.string().trim().min(2, "Full name is required").max(100),
      nrcNumber: z.string().trim().regex(/^\d{6}\/\d{2}\/\d{1}$/, "NRC must be in format 123456/78/1"),
      phone: z.string().trim().regex(/^\+?[0-9\s-]{9,20}$/, "Enter a valid phone number"),
      employer: z.string().trim().min(2, "Employer is required").max(150),
      employeeNumber: z.string().trim().min(1, "Employee number is required").max(50),
      signatureName: z.string().trim().min(2, "Your full legal name is required for the authorization").max(100),
    });
    const parsed = KycSchema.safeParse({ ...formData });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "Please review the form.");
      return;
    }

    const MAX_FILE_BYTES = 10 * 1024 * 1024;
    const filesToCheck = [
      { field: "NRC", file: formData.nrcFile },
      { field: "Government ID", file: formData.govIdFile },
      { field: "Payslip", file: formData.payslipFile },
    ];
    for (const { field, file } of filesToCheck) {
      if (file && file.size > MAX_FILE_BYTES) { toast.error(`${field} file exceeds the 10MB limit.`); return; }
    }

    setSubmitting(true);
    try {
      const files: { field: string; file: File }[] = [];
      if (formData.nrcFile) files.push({ field: "nrc", file: formData.nrcFile });
      if (formData.govIdFile) files.push({ field: "gov-id", file: formData.govIdFile });
      if (formData.payslipFile) files.push({ field: "payslip", file: formData.payslipFile });

      for (const { field, file } of files) {
        const ext = file.name.split(".").pop();
        const path = `${user.id}/${field}-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("kyc-documents").upload(path, file, { upsert: true });
        if (uploadError) throw new Error(`Failed to upload ${field}`);
      }

      const validated = parsed.data;
      const { error: profileError } = await supabase.from("profiles").upsert({
        user_id: user.id,
        full_name: validated.fullName,
        nrc_number: validated.nrcNumber,
        phone: validated.phone,
        employer: validated.employer,
        employee_number: validated.employeeNumber,
        kyc_status: "IN_REVIEW",
        consent_accepted: formData.consentAccepted,
        consent_signed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      if (profileError) throw new Error("Failed to save KYC profile");

      await refreshProfile();
      toast.success("Verification submitted and Riverbanc subscription authorization recorded.");
      setTimeout(() => navigate("/application-submitted"), 1200);
    } catch (err) {
      const { logger } = await import("@/lib/logger");
      logger.error("KYC submission failed", { name: err instanceof Error ? err.name : typeof err });
      toast.error("We couldn't submit your verification. Please review your details and try again.");
    } finally { setSubmitting(false); }
  };

  const uploadCard = (label: string, file: File | null, icon: React.ReactNode, onChange: (file: File | null) => void, helper: string) => (
    <div>
      <Label>{label}</Label>
      <label className="mt-1.5 border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-accent/50 transition-colors cursor-pointer block">
        <input type="file" accept=".png,.jpg,.jpeg,.pdf" className="hidden" onChange={(e) => onChange(e.target.files?.[0] || null)} />
        {icon}
        {file ? <p className="text-sm text-foreground font-medium">{file.name}</p> : <><p className="text-sm text-muted-foreground">Click to upload</p><p className="text-xs text-muted-foreground/70 mt-1">{helper}</p></>}
      </label>
    </div>
  );

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <div className="space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div><Label htmlFor="fullName">Full name</Label><Input id="fullName" placeholder="As shown on your NRC" value={formData.fullName} onChange={(e) => updateField("fullName", e.target.value)} className="mt-1.5" /><p className="text-xs text-muted-foreground mt-1">We'll use this to match your identity records.</p></div>
            <div><Label htmlFor="nrcNumber">NRC number</Label><Input id="nrcNumber" placeholder="e.g. 123456/78/1" value={formData.nrcNumber} onChange={(e) => updateField("nrcNumber", e.target.value)} className="mt-1.5" /><p className="text-xs text-muted-foreground mt-1">Used for identity verification.</p></div>
          </div>
          <div><Label htmlFor="phone">Phone number</Label><Input id="phone" type="tel" placeholder="e.g. +260 97X XXXXXX" value={formData.phone} onChange={(e) => updateField("phone", e.target.value)} className="mt-1.5" /></div>
          {uploadCard("NRC document", formData.nrcFile, <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />, handleNrcUpload, "PNG, JPG or PDF · max 10MB")}
          {parsingNrc && <p className="text-sm text-muted-foreground">Extracting NRC data…</p>}
          {nrcResult?.success && <div className="bg-success/10 border border-success/30 rounded-lg p-3 text-sm"><p className="font-medium text-success">NRC data extracted</p><p className="text-muted-foreground mt-1">Fields were auto-filled where possible. Please review them before continuing.</p></div>}
          <div className="bg-muted/50 rounded-lg p-4 border border-border/50"><p className="text-sm text-muted-foreground"><Info className="w-4 h-4 inline mr-1" /> Your NRC is collected for identity verification and handled according to Riverbanc's privacy policies.</p></div>
        </div>;
      case 2:
        return <div className="space-y-6">
          <div className="bg-muted/50 rounded-lg p-4 border border-border/50"><p className="text-sm text-muted-foreground">We use a government-issued identity document to verify that your Riverbanc profile belongs to you.</p></div>
          <div className="grid md:grid-cols-2 gap-4">
            <div><Label>ID type</Label><select className="w-full mt-1.5 h-10 rounded-md border border-input bg-background px-3 text-sm" value={formData.govIdType} onChange={(e) => updateField("govIdType", e.target.value)}><option value="passport">Passport</option><option value="driving_license">Driving License</option><option value="employee_id">Government Employee ID</option></select></div>
            <div><Label htmlFor="govIdNumber">ID number</Label><Input id="govIdNumber" placeholder="Enter ID number" value={formData.govIdNumber} onChange={(e) => updateField("govIdNumber", e.target.value)} className="mt-1.5" /></div>
          </div>
          {uploadCard("Government ID", formData.govIdFile, <CreditCard className="w-10 h-10 text-muted-foreground mx-auto mb-3" />, handleGovIdUpload, "PNG, JPG or PDF · max 10MB")}
          {parsingGovId && <p className="text-sm text-muted-foreground">Extracting ID data…</p>}
          {govIdResult?.success && <div className="bg-success/10 border border-success/30 rounded-lg p-3 text-sm"><p className="font-medium text-success">Identity document received</p><p className="text-muted-foreground mt-1">Fields were auto-filled where possible. Please review them before continuing.</p></div>}
          <div className="flex gap-3 items-start bg-card border border-border rounded-lg p-4"><ShieldCheck className="w-5 h-5 text-success shrink-0 mt-0.5" /><p className="text-sm text-muted-foreground">Your document is collected for verification and lender eligibility workflows. Sharing with a financial institution occurs only as part of your chosen application flow.</p></div>
        </div>;
      case 3:
        return <div className="space-y-6">
          <div><h4 className="font-semibold text-foreground">Verify your employment</h4><p className="text-sm text-muted-foreground mt-1">Your employment and income information helps determine which loan options you may be eligible for.</p></div>
          {uploadCard("Latest payslip", formData.payslipFile, <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />, handlePayslipUpload, "PDF, PNG or JPG · max 10MB")}
          {parsingPayslip && <p className="text-sm text-muted-foreground">Extracting payslip data…</p>}
          {payrollResult?.success && <div className="bg-success/10 border border-success/30 rounded-lg p-4 text-sm"><p className="font-medium text-success">Payslip data extracted</p><p className="text-muted-foreground mt-1">Review the extracted information below before continuing.</p>{payrollResult.gross_salary != null && <p className="mt-2 text-muted-foreground">Gross salary: <span className="text-foreground font-medium">K {payrollResult.gross_salary.toLocaleString()}</span></p>}{payrollResult.net_salary != null && <p className="text-muted-foreground">Net salary: <span className="text-foreground font-medium">K {payrollResult.net_salary.toLocaleString()}</span></p>}</div>}
          <div className="grid md:grid-cols-2 gap-4"><div><Label htmlFor="employer">Employer / Ministry</Label><Input id="employer" placeholder="e.g. Ministry of Education" value={formData.employer} onChange={(e) => updateField("employer", e.target.value)} className="mt-1.5" /></div><div><Label htmlFor="employeeNumber">Employee number</Label><Input id="employeeNumber" placeholder="Your payroll number" value={formData.employeeNumber} onChange={(e) => updateField("employeeNumber", e.target.value)} className="mt-1.5" /></div></div>
          <div className="bg-muted/50 rounded-lg p-4 border border-border/50"><p className="text-sm text-muted-foreground"><ShieldCheck className="w-4 h-4 inline mr-1 text-success" /> Your employment and payslip information is used for verification and affordability assessment.</p></div>
        </div>;
      case 4:
        return <div className="space-y-6">
          <div><h4 className="text-xl font-display font-semibold text-foreground">Review your information</h4><p className="text-sm text-muted-foreground mt-1">Before submitting, make sure your details and documents are correct.</p></div>
          <div className="grid gap-3"><div className="flex items-center justify-between rounded-lg border border-border p-4"><span className="text-sm">Personal details</span><Badge variant="outline" className="border-success text-success">Ready</Badge></div><div className="flex items-center justify-between rounded-lg border border-border p-4"><span className="text-sm">Identity verification</span><Badge variant="outline" className="border-success text-success">Ready</Badge></div><div className="flex items-center justify-between rounded-lg border border-border p-4"><span className="text-sm">Employment verification</span><Badge variant="outline" className="border-success text-success">Ready</Badge></div></div>
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-6 space-y-4"><div><h4 className="font-display font-semibold text-foreground">Authorize your Riverbanc subscription</h4><p className="text-sm text-muted-foreground mt-1">Riverbanc provides its comparison and application-support services for <strong className="text-foreground">K60 per month</strong>.</p></div><div className="grid sm:grid-cols-3 gap-3 text-sm"><div><p className="text-muted-foreground">Monthly fee</p><p className="font-semibold text-foreground">K60</p></div><div><p className="text-muted-foreground">Payment method</p><p className="font-semibold text-foreground">Payroll deduction</p></div><div><p className="text-muted-foreground">Payment recipient</p><p className="font-semibold text-foreground">Riverbanc Technology Limited</p></div></div><div className="rounded-lg bg-background/70 border border-border p-4 text-sm text-muted-foreground"><p>This subscription fee pays for access to Riverbanc's platform and services. <strong className="text-foreground">It is separate from any loan principal, interest, fees or charges imposed by a financial institution.</strong></p><p className="mt-2">By authorizing below, you authorize Riverbanc Technology Limited to deduct K60 per month from your payroll for the Riverbanc subscription, subject to the applicable subscription terms.</p></div></div>
          <div className="flex items-start gap-3"><Checkbox id="consent" checked={formData.consentAccepted} onCheckedChange={(checked) => updateField("consentAccepted", checked === true)} /><Label htmlFor="consent" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">I have reviewed the information above and authorize Riverbanc Technology Limited to deduct K60 per month from my payroll for my Riverbanc subscription. I confirm that the information I have provided is accurate.</Label></div>
          <div><Label htmlFor="signatureName">Digital signature</Label><Input id="signatureName" placeholder="Type your full legal name" value={formData.signatureName} onChange={(e) => updateField("signatureName", e.target.value)} className="mt-1.5 font-serif italic text-lg" /><p className="text-xs text-muted-foreground mt-1">Type your full legal name as your electronic signature.</p></div>
          <div className="flex gap-3 items-start bg-muted/50 rounded-lg p-4 border border-border/50"><Info className="w-4 h-4 shrink-0 mt-0.5" /><p className="text-xs text-muted-foreground">This authorization is for the Riverbanc K60 monthly subscription only. It does not authorize a lender to deduct loan repayments from your salary.</p></div>
        </div>;
      default: return null;
    }
  };

  return <div className="min-h-screen bg-background"><Navbar /><main className="pt-24 pb-16"><div className="container mx-auto px-4 lg:px-8 max-w-3xl"><motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8"><div className="flex items-center justify-between flex-wrap gap-2"><div><h1 className="text-3xl font-display font-bold text-foreground mb-2">Verify your Riverbanc profile</h1><p className="text-muted-foreground">We need a few details to verify your identity and employment and determine which loan options you may be eligible for.</p></div><Badge variant="outline" className={kycStatus === "VERIFIED" || kycStatus === "COMPLETED" ? "border-success text-success" : kycStatus === "IN_REVIEW" ? "border-warning text-warning" : kycStatus === "REJECTED" ? "border-destructive text-destructive" : "border-muted-foreground text-muted-foreground"}>Verification: {kycStatus}</Badge></div></motion.div><div className="mb-8"><div className="flex justify-between mb-2"><span className="text-sm font-medium text-foreground">Step {currentStep} of {steps.length}</span><span className="text-sm text-muted-foreground">{steps[currentStep - 1].title}</span></div><Progress value={progress} className="h-2" /></div><div className="flex gap-2 mb-8 overflow-x-auto pb-2">{steps.map((step) => <button key={step.id} onClick={() => setCurrentStep(step.id)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${step.id === currentStep ? "bg-primary text-primary-foreground" : step.id < currentStep ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>{step.id < currentStep ? <CheckCircle2 className="w-4 h-4" /> : <step.icon className="w-4 h-4" />}<span className="hidden sm:inline">{step.title}</span></button>)}</div><motion.div key={currentStep} className="bg-card rounded-xl p-6 lg:p-8 border border-border/50 card-elevated" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}><div className="mb-6"><h3 className="text-xl font-display font-semibold text-foreground">{steps[currentStep - 1].title}</h3><p className="text-sm text-muted-foreground mt-1">{steps[currentStep - 1].description}</p></div>{renderStep()}</motion.div><div className="flex justify-between mt-6"><Button variant="outline" onClick={() => setCurrentStep((s) => Math.max(s - 1, 1))} disabled={currentStep === 1}><ArrowLeft className="w-4 h-4" /> Previous</Button>{currentStep === steps.length ? <Button disabled={!formData.consentAccepted || !formData.signatureName.trim() || submitting} onClick={handleSubmit}>{submitting ? "Submitting…" : "Review & authorize K60/month"}<CheckCircle2 className="w-4 h-4" /></Button> : <Button onClick={() => setCurrentStep((s) => Math.min(s + 1, steps.length))}>Next step <ArrowRight className="w-4 h-4" /></Button>}</div></div></main><Footer /></div>;
};

export default KYCPage;
