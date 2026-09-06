import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { parsePayslip, type PayrollParseResult } from "@/services/payrollParsingService";
import { parseNRC, parseGovernmentID, type IDParseResult, type IDDocumentType } from "@/services/idDocumentParsingService";
import { getRequiredPayslipPeriods, validatePayslipPeriod } from "@/services/payslipPeriodValidationService";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Upload, CreditCard, FileText, FileSignature, CheckCircle2, ArrowRight, ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

interface PayslipSlot { file: File | null; result: PayrollParseResult | null; validating: boolean; }
const emptySlot = (): PayslipSlot => ({ file: null, result: null, validating: false });
const MAX_FILE_BYTES = 10 * 1024 * 1024;

const StrictKYCPage = () => {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading, profileLoading, refreshProfile } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [applicationDate, setApplicationDate] = useState<Date | null>(null);
  const [nrcFile, setNrcFile] = useState<File | null>(null);
  const [govIdFile, setGovIdFile] = useState<File | null>(null);
  const [nrcResult, setNrcResult] = useState<IDParseResult | null>(null);
  const [govIdResult, setGovIdResult] = useState<IDParseResult | null>(null);
  const [govIdType, setGovIdType] = useState<IDDocumentType>("passport");
  const [payslips, setPayslips] = useState<PayslipSlot[]>([emptySlot(), emptySlot(), emptySlot()]);
  const [introductoryLetter, setIntroductoryLetter] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [parsingIdentity, setParsingIdentity] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [signatureName, setSignatureName] = useState("");
  const [formData, setFormData] = useState({ fullName: "", nrcNumber: "", phone: "", govIdNumber: "", employer: "", employeeNumber: "" });

  useEffect(() => { if (user) refreshProfile(); }, [user, refreshProfile]);
  useEffect(() => { if (authLoading || profileLoading) return; if (!user) { navigate("/login", { replace: true }); return; } if ((profile?.kyc_status === "VERIFIED" || profile?.kyc_status === "COMPLETED") && profile?.consent_accepted) navigate("/profile", { replace: true }); }, [user, profile, authLoading, profileLoading, navigate]);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const loadServerDate = async () => {
      const { data, error } = await supabase.rpc("current_application_date" as never);
      if (cancelled) return;
      if (error || !data) { toast.error("We could not establish the application date. Please try again."); return; }
      const date = new Date(`${String(data)}T12:00:00.000Z`);
      if (!Number.isNaN(date.getTime())) setApplicationDate(date);
    };
    loadServerDate();
    return () => { cancelled = true; };
  }, [user]);

  const requiredPeriods = useMemo(() => applicationDate ? getRequiredPayslipPeriods(applicationDate) : [], [applicationDate]);
  const acceptedPeriodKeys = useMemo(() => payslips.flatMap((slot) => { const period = slot.result?.pay_period; if (!period || !slot.result?.success || !applicationDate) return []; const validation = validatePayslipPeriod(period, applicationDate, slot.result.confidence); return validation.valid && validation.detected ? [validation.detected.key] : []; }), [payslips, applicationDate]);
  const allPeriodsPresent = requiredPeriods.length === 3 && new Set(acceptedPeriodKeys).size === 3 && requiredPeriods.every((p) => acceptedPeriodKeys.includes(p.key));
  const progress = currentStep / 3 * 100;

  const handleIdentity = async (kind: "nrc" | "gov", file: File | null) => {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) { toast.error("Identity document exceeds the 10MB limit."); return; }
    setParsingIdentity(true);
    try {
      const result = kind === "nrc" ? await parseNRC(file) : await parseGovernmentID(file, govIdType);
      if (!result.success) { toast.error("Identity OCR could not validate this document."); return; }
      if (kind === "nrc") { setNrcFile(file); setNrcResult(result); setFormData((current) => ({ ...current, fullName: current.fullName || result.full_name || "", nrcNumber: current.nrcNumber || result.document_number || "" })); }
      else { setGovIdFile(file); setGovIdResult(result); setFormData((current) => ({ ...current, fullName: current.fullName || result.full_name || "", govIdNumber: current.govIdNumber || result.document_number || "" })); }
      toast.success("Identity document received and OCR-checked.");
    } catch { toast.error("Identity OCR failed. The document was not accepted."); }
    finally { setParsingIdentity(false); }
  };

  const handlePayslip = async (index: number, file: File | null) => {
    if (!file) { setPayslips((current) => current.map((slot, i) => i === index ? emptySlot() : slot)); return; }
    if (file.size > MAX_FILE_BYTES) { toast.error("Payslip exceeds the 10MB limit."); return; }
    setPayslips((current) => current.map((slot, i) => i === index ? { file, result: null, validating: true } : slot));
    try {
      const result = await parsePayslip(file);
      const validation = applicationDate ? validatePayslipPeriod(result.pay_period, applicationDate, result.confidence) : null;
      if (!result.success || !validation?.valid) { setPayslips((current) => current.map((slot, i) => i === index ? emptySlot() : slot)); toast.error(`Payslip rejected: ${validation?.reason ?? result.error ?? "OCR validation failed."}`); return; }
      if (acceptedPeriodKeys.includes(validation.detected!.key)) { setPayslips((current) => current.map((slot, i) => i === index ? emptySlot() : slot)); toast.error(`Payslip rejected: ${validation.detected!.key} is already uploaded.`); return; }
      setPayslips((current) => current.map((slot, i) => i === index ? { file, result, validating: false } : slot));
      if (result.employer) setFormData((current) => ({ ...current, employer: current.employer || result.employer || "" }));
      if (result.employee_number) setFormData((current) => ({ ...current, employeeNumber: current.employeeNumber || result.employee_number || "" }));
      toast.success(`Payslip accepted for ${validation.detected!.key}.`);
    } catch { setPayslips((current) => current.map((slot, i) => i === index ? emptySlot() : slot)); toast.error("Payslip OCR failed. The document was not accepted."); }
  };

  const submit = async () => {
    if (!user || !applicationDate) { toast.error("Application date is not available."); return; }
    const schema = z.object({ fullName: z.string().trim().min(2).max(100), nrcNumber: z.string().trim().regex(/^\d{6}\/\d{2}\/\d{1}$/), phone: z.string().trim().regex(/^\+?[0-9\s-]{9,20}$/), govIdNumber: z.string().trim().min(1).max(50), employer: z.string().trim().min(2).max(150), employeeNumber: z.string().trim().min(1).max(50), signatureName: z.string().trim().min(2).max(100) });
    const parsed = schema.safeParse({ ...formData, signatureName });
    if (!parsed.success) { toast.error("Please complete all required identity and employment fields."); return; }
    if (!nrcFile || !govIdFile) { toast.error("NRC and government ID documents are required."); return; }
    if (!allPeriodsPresent) { toast.error("All three latest completed monthly payslips are required."); return; }
    if (!introductoryLetter) { toast.error("Your government-issued employment introductory letter is required."); return; }
    if (!consentAccepted) { toast.error("Please review and authorize your Riverbanc subscription."); return; }
    setSubmitting(true);
    try {
      const files = [{ field: "nrc", file: nrcFile }, { field: "gov-id", file: govIdFile }, ...payslips.map((slot) => ({ field: "payslip", file: slot.file! })), { field: "introductory-letter", file: introductoryLetter }];
      for (const { field, file } of files) {
        const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
        const path = `${user.id}/${field}-${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("kyc-documents").upload(path, file, { upsert: false });
        if (error) throw new Error(`Failed to upload ${field}`);
      }
      const { error: profileError } = await supabase.from("profiles").upsert({ user_id: user.id, full_name: parsed.data.fullName, nrc_number: parsed.data.nrcNumber, phone: parsed.data.phone, employer: parsed.data.employer, employee_number: parsed.data.employeeNumber, kyc_status: "IN_REVIEW", consent_accepted: true, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (profileError) throw new Error("Failed to save KYC profile");
      await refreshProfile();
      toast.success("Verification submitted for review.");
      setTimeout(() => navigate("/application-submitted"), 800);
    } catch (error) { const { logger } = await import("@/lib/logger"); logger.error("Strict KYC submission failed", { name: error instanceof Error ? error.name : typeof error }); toast.error("We couldn't submit your verification. No verification status was changed."); }
    finally { setSubmitting(false); }
  };

  if (authLoading || profileLoading || !user || !applicationDate) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  return <div className="min-h-screen bg-background"><Navbar /><main className="pt-24 pb-16"><div className="container mx-auto px-4 lg:px-8 max-w-4xl"><div className="mb-8"><Progress value={progress} className="h-2" /><p className="mt-3 text-sm text-muted-foreground">Step {currentStep} of 3</p></div>
    {currentStep === 1 && <section className="space-y-6"><div><h1 className="text-3xl font-display font-bold">Identity</h1><p className="text-muted-foreground mt-2">Verify your NRC and government-issued identity document.</p></div><div className="grid md:grid-cols-2 gap-4"><div><Label>Full name</Label><Input className="mt-1.5" value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} /></div><div><Label>NRC number</Label><Input className="mt-1.5" placeholder="123456/78/1" value={formData.nrcNumber} onChange={(e) => setFormData({ ...formData, nrcNumber: e.target.value })} /></div></div><div><Label>Phone number</Label><Input className="mt-1.5" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} /></div><div className="grid md:grid-cols-2 gap-4"><div className="rounded-xl border border-border/60 p-4"><Label>NRC document</Label><label className="mt-2 border-2 border-dashed border-border rounded-xl p-5 text-center cursor-pointer block"><input type="file" accept=".png,.jpg,.jpeg,.pdf" className="hidden" onChange={(e) => handleIdentity("nrc", e.target.files?.[0] || null)} /><Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />{nrcFile ? <p className="text-sm font-medium">{nrcFile.name}</p> : <p className="text-sm text-muted-foreground">Upload NRC</p>}</label></div><div className="rounded-xl border border-border/60 p-4"><Label>Government ID</Label><select className="w-full mt-1.5 h-10 rounded-md border border-input bg-background px-3 text-sm" value={govIdType} onChange={(e) => setGovIdType(e.target.value as IDDocumentType)}><option value="passport">Passport</option><option value="driving_license">Driving License</option><option value="employee_id">Government Employee ID</option></select><Input className="mt-2" placeholder="ID number" value={formData.govIdNumber} onChange={(e) => setFormData({ ...formData, govIdNumber: e.target.value })} /><label className="mt-2 border-2 border-dashed border-border rounded-xl p-5 text-center cursor-pointer block"><input type="file" accept=".png,.jpg,.jpeg,.pdf" className="hidden" onChange={(e) => handleIdentity("gov", e.target.files?.[0] || null)} /><CreditCard className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />{govIdFile ? <p className="text-sm font-medium">{govIdFile.name}</p> : <p className="text-sm text-muted-foreground">Upload government ID</p>}</label></div></div>{parsingIdentity && <p className="text-sm text-muted-foreground">Checking identity document with OCR…</p>}<Button disabled={!nrcFile || !govIdFile || parsingIdentity} onClick={() => setCurrentStep(2)}>Continue <ArrowRight className="w-4 h-4" /></Button></section>}
    {currentStep === 2 && <section className="space-y-6"><div><h1 className="text-3xl font-display font-bold">Employment evidence</h1><p className="text-muted-foreground mt-2">The three latest completed calendar-month payslips are mandatory. OCR determines the period; filenames are never trusted.</p></div><div className="rounded-xl border border-border/60 bg-muted/20 p-4"><p className="text-sm font-medium">Required periods</p><div className="mt-2 flex flex-wrap gap-2">{requiredPeriods.map((period) => <span key={period.key} className={`rounded-full border px-3 py-1 text-sm ${acceptedPeriodKeys.includes(period.key) ? "border-success/40 bg-success/10" : "border-border bg-background"}`}>{period.key} {acceptedPeriodKeys.includes(period.key) && <CheckCircle2 className="inline w-4 h-4 ml-1" />}</span>)}</div></div><div className="grid md:grid-cols-3 gap-4">{payslips.map((slot, index) => <div key={index} className="rounded-xl border border-border/60 p-4"><Label>Payslip {index + 1}</Label><label className="mt-2 border-2 border-dashed border-border rounded-xl p-5 text-center cursor-pointer block"><input type="file" accept=".png,.jpg,.jpeg,.pdf" className="hidden" onChange={(e) => handlePayslip(index, e.target.files?.[0] || null)} /><FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />{slot.validating ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : slot.result?.pay_period ? <><p className="text-sm font-medium">{slot.result.pay_period}</p><p className="text-xs text-success mt-1">Accepted by OCR</p></> : <p className="text-sm text-muted-foreground">Upload payslip</p>}</label></div>)}</div><div className="grid md:grid-cols-2 gap-4"><div><Label>Employer</Label><Input className="mt-1.5" value={formData.employer} onChange={(e) => setFormData({ ...formData, employer: e.target.value })} /></div><div><Label>Employee number</Label><Input className="mt-1.5" value={formData.employeeNumber} onChange={(e) => setFormData({ ...formData, employeeNumber: e.target.value })} /></div></div><div className="rounded-xl border border-border/60 bg-card p-4"><p className="text-sm font-medium flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Government employment introductory letter</p><p className="text-xs text-muted-foreground mt-1">Upload the government-issued letter provided by your employer. Riverbanc does not create or author this document.</p><label className="mt-3 border-2 border-dashed border-border rounded-xl p-5 text-center cursor-pointer block"><input type="file" accept=".png,.jpg,.jpeg,.pdf" className="hidden" onChange={(e) => setIntroductoryLetter(e.target.files?.[0] || null)} /><FileSignature className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />{introductoryLetter ? <p className="text-sm font-medium">{introductoryLetter.name}</p> : <p className="text-sm text-muted-foreground">Upload government-issued letter</p>}</label></div><div className="flex gap-3"><Button variant="outline" onClick={() => setCurrentStep(1)}><ArrowLeft className="w-4 h-4" /> Back</Button><Button disabled={!allPeriodsPresent || !introductoryLetter} onClick={() => setCurrentStep(3)}>Continue <ArrowRight className="w-4 h-4" /></Button></div></section>}
    {currentStep === 3 && <section className="space-y-6"><div><h1 className="text-3xl font-display font-bold">Review & authorize</h1><p className="text-muted-foreground mt-2">Review your information and authorize your Riverbanc subscription.</p></div><div className="rounded-xl border border-border/60 bg-card p-5 space-y-2"><p className="text-sm"><strong>Name:</strong> {formData.fullName}</p><p className="text-sm"><strong>Employer:</strong> {formData.employer}</p><p className="text-sm"><strong>Payslips:</strong> {new Set(acceptedPeriodKeys).size}/3 accepted</p><p className="text-sm"><strong>Introductory letter:</strong> {introductoryLetter ? "Received" : "Missing"}</p></div><label className="flex items-start gap-3"><Checkbox checked={consentAccepted} onCheckedChange={(checked) => setConsentAccepted(checked === true)} /><span className="text-sm text-muted-foreground">I authorize my Riverbanc subscription and consent to the stated processing and lender-sharing terms.</span></label><div><Label>Full legal name</Label><Input className="mt-1.5" value={signatureName} onChange={(e) => setSignatureName(e.target.value)} /></div><div className="flex gap-3"><Button variant="outline" onClick={() => setCurrentStep(2)}><ArrowLeft className="w-4 h-4" /> Back</Button><Button disabled={submitting || !consentAccepted || !signatureName.trim()} onClick={submit}>{submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Submit verification</Button></div></section>}
  </div></main><Footer /></div>;
};
export default StrictKYCPage;
