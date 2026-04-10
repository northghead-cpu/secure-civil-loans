import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  CreditCard,
  FileText,
  FileSignature,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
} from "lucide-react";

const steps = [
  { id: 1, title: "NRC Upload", icon: Upload, description: "Upload your National Registration Card" },
  { id: 2, title: "Government ID", icon: CreditCard, description: "Verify your government-issued identity" },
  { id: 3, title: "Payslip Upload", icon: FileText, description: "Upload your latest payslip" },
  { id: 4, title: "E-Sign Consent", icon: FileSignature, description: "Sign your payroll deduction consent" },
];

const KYCPage = () => {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Redirect if KYC already verified or in review
  useEffect(() => {
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    if (profile?.kyc_status === "VERIFIED") {
      toast.info("Your KYC is already verified.");
      navigate("/profile", { replace: true });
      return;
    }
    if (profile?.kyc_status === "IN_REVIEW") {
      toast.info("Your KYC is under review.");
      navigate("/profile", { replace: true });
    }
  }, [user, profile, navigate]);
  const kycStatus = profile?.kyc_status || "PENDING";
  const [formData, setFormData] = useState({
    fullName: "",
    nrcNumber: "",
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

  const progress = (currentStep / steps.length) * 100;
  const next = () => setCurrentStep((s) => Math.min(s + 1, steps.length));
  const prev = () => setCurrentStep((s) => Math.max(s - 1, 1));
  const updateField = (field: string, value: unknown) => setFormData((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      // Upload files
      const files: { field: string; file: File }[] = [];
      if (formData.nrcFile) files.push({ field: "nrc", file: formData.nrcFile });
      if (formData.govIdFile) files.push({ field: "gov-id", file: formData.govIdFile });
      if (formData.payslipFile) files.push({ field: "payslip", file: formData.payslipFile });

      for (const { field, file } of files) {
        const ext = file.name.split(".").pop();
        const path = `${user.id}/${field}-${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("kyc-documents").upload(path, file, { upsert: true });
        if (error) throw error;
      }

      // Save application to database
      const { error: insertError } = await supabase.from("loan_applications").insert({
        user_id: user.id,
        full_name: formData.fullName,
        nrc_number: formData.nrcNumber,
        gov_id_type: formData.govIdType,
        gov_id_number: formData.govIdNumber,
        employer: formData.employer,
        employee_number: formData.employeeNumber,
        consent_accepted: formData.consentAccepted,
        signature_name: formData.signatureName,
      });
      if (insertError) throw insertError;

      // Update profile KYC status to IN_REVIEW
      await supabase
        .from("profiles")
        .update({ kyc_status: "IN_REVIEW" })
        .eq("user_id", user.id);

      await refreshProfile();
      toast.success("Application submitted successfully");
      navigate("/application-submitted");
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to submit application";
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fullName">Full Name (as on NRC)</Label>
                <Input id="fullName" placeholder="Enter your full name" value={formData.fullName} onChange={(e) => updateField("fullName", e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="nrcNumber">NRC Number</Label>
                <Input id="nrcNumber" placeholder="e.g. 123456/78/1" value={formData.nrcNumber} onChange={(e) => updateField("nrcNumber", e.target.value)} className="mt-1.5" />
              </div>
            </div>
            <div>
              <Label>Upload NRC (Front & Back)</Label>
              <label className="mt-1.5 border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-accent/50 transition-colors cursor-pointer block">
                <input type="file" accept=".png,.jpg,.jpeg,.pdf" className="hidden" onChange={(e) => updateField("nrcFile", e.target.files?.[0] || null)} />
                <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                {formData.nrcFile ? (
                  <p className="text-sm text-foreground font-medium">{formData.nrcFile.name}</p>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">Drag & drop or click to upload</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">PNG, JPG or PDF (max 10MB)</p>
                  </>
                )}
              </label>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>ID Type</Label>
                <select className="w-full mt-1.5 h-10 rounded-md border border-input bg-background px-3 text-sm" value={formData.govIdType} onChange={(e) => updateField("govIdType", e.target.value)}>
                  <option value="passport">Passport</option>
                  <option value="driving_license">Driving License</option>
                  <option value="employee_id">Government Employee ID</option>
                </select>
              </div>
              <div>
                <Label htmlFor="govIdNumber">ID Number</Label>
                <Input id="govIdNumber" placeholder="Enter ID number" value={formData.govIdNumber} onChange={(e) => updateField("govIdNumber", e.target.value)} className="mt-1.5" />
              </div>
            </div>
            <div>
              <Label>Upload Government ID</Label>
              <label className="mt-1.5 border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-accent/50 transition-colors cursor-pointer block">
                <input type="file" accept=".png,.jpg,.jpeg,.pdf" className="hidden" onChange={(e) => updateField("govIdFile", e.target.files?.[0] || null)} />
                <CreditCard className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                {formData.govIdFile ? (
                  <p className="text-sm text-foreground font-medium">{formData.govIdFile.name}</p>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">Drag & drop or click to upload</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">PNG, JPG or PDF (max 10MB)</p>
                  </>
                )}
              </label>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="employer">Employer / Ministry</Label>
                <Input id="employer" placeholder="e.g. Ministry of Education" value={formData.employer} onChange={(e) => updateField("employer", e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="employeeNumber">Employee Number</Label>
                <Input id="employeeNumber" placeholder="Your payroll number" value={formData.employeeNumber} onChange={(e) => updateField("employeeNumber", e.target.value)} className="mt-1.5" />
              </div>
            </div>
            <div>
              <Label>Upload Latest Payslip</Label>
              <label className="mt-1.5 border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-accent/50 transition-colors cursor-pointer block">
                <input type="file" accept=".png,.jpg,.jpeg,.pdf" className="hidden" onChange={(e) => updateField("payslipFile", e.target.files?.[0] || null)} />
                <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                {formData.payslipFile ? (
                  <p className="text-sm text-foreground font-medium">{formData.payslipFile.name}</p>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">Upload your most recent payslip</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">PDF or image (max 10MB)</p>
                  </>
                )}
              </label>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 border border-border/50">
              <p className="text-sm text-muted-foreground">
                <ShieldCheck className="w-4 h-4 inline mr-1 text-success" />
                Your payslip data is processed securely and used only for loan affordability calculations.
              </p>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="bg-muted/50 rounded-xl p-6 border border-border/50">
              <h4 className="font-display font-semibold text-foreground mb-4">Payroll Deduction Consent</h4>
              <div className="prose prose-sm text-muted-foreground max-h-48 overflow-y-auto text-sm leading-relaxed mb-4">
                <p>I, the undersigned, hereby authorize my employer to deduct the agreed loan repayment amount from my monthly salary and remit the same directly to the selected lending institution.</p>
                <p>I understand that this deduction will continue until the full loan amount, including any applicable interest and fees, has been repaid in full.</p>
                <p>I acknowledge that I have read and understood the terms and conditions of the loan offer and that this consent is irrevocable for the duration of the loan term unless mutually agreed upon by all parties.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Checkbox id="consent" checked={formData.consentAccepted} onCheckedChange={(checked) => updateField("consentAccepted", checked)} />
              <Label htmlFor="consent" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
                I have read and agree to the payroll deduction consent terms. I confirm that all information provided is true and accurate.
              </Label>
            </div>
            <div>
              <Label htmlFor="signatureName">Digital Signature (Type your full name)</Label>
              <Input id="signatureName" placeholder="Type your full legal name" value={formData.signatureName} onChange={(e) => updateField("signatureName", e.target.value)} className="mt-1.5 font-serif italic text-lg" />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 lg:px-8 max-w-3xl">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h1 className="text-3xl font-display font-bold text-foreground mb-2">KYC Verification</h1>
                <p className="text-muted-foreground">Complete the steps below to verify your identity and apply for refinancing.</p>
              </div>
              <Badge
                variant="outline"
                className={
                  kycStatus === "VERIFIED"
                    ? "border-success text-success"
                    : kycStatus === "COMPLETED"
                    ? "border-success text-success"
                    : kycStatus === "IN_REVIEW"
                    ? "border-warning text-warning"
                    : kycStatus === "REJECTED"
                    ? "border-destructive text-destructive"
                    : "border-muted-foreground text-muted-foreground"
                }
              >
                KYC Status: {kycStatus}
              </Badge>
            </div>
          </motion.div>

          <div className="mb-8">
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium text-foreground">Step {currentStep} of {steps.length}</span>
              <span className="text-sm text-muted-foreground">{steps[currentStep - 1].title}</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
            {steps.map((step) => (
              <button
                key={step.id}
                onClick={() => setCurrentStep(step.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  step.id === currentStep
                    ? "bg-primary text-primary-foreground"
                    : step.id < currentStep
                    ? "bg-success/10 text-success"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {step.id < currentStep ? <CheckCircle2 className="w-4 h-4" /> : <step.icon className="w-4 h-4" />}
                <span className="hidden sm:inline">{step.title}</span>
              </button>
            ))}
          </div>

          <motion.div
            key={currentStep}
            className="bg-card rounded-xl p-6 lg:p-8 border border-border/50 card-elevated"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="mb-6">
              <h3 className="text-xl font-display font-semibold text-foreground">{steps[currentStep - 1].title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{steps[currentStep - 1].description}</p>
            </div>
            {renderStep()}
          </motion.div>

          <div className="flex justify-between mt-6">
            <Button variant="outline" onClick={prev} disabled={currentStep === 1}>
              <ArrowLeft className="w-4 h-4" /> Previous
            </Button>
            {currentStep === steps.length ? (
              <Button disabled={!formData.consentAccepted || !formData.signatureName || submitting} onClick={handleSubmit}>
                {submitting ? "Submitting…" : "Submit Application"} <CheckCircle2 className="w-4 h-4" />
              </Button>
            ) : (
              <Button onClick={next}>
                Next Step <ArrowRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default KYCPage;
