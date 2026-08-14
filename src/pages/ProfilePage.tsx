import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  User,
  FileCheck,
  CreditCard,
  TrendingUp,
  Clock,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Mail,
  Phone,
  Building,
  Hash,
  Loader2,
  FileSignature,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import DataErasureSection from "@/components/DataErasureSection";
import DataExportSection from "@/components/DataExportSection";
import GranularConsentSection from "@/components/GranularConsentSection";
import BorrowerJourney from "@/components/BorrowerJourney";

interface LoanApplication {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

const ProfilePage = () => {
  const { user, profile, loading: authLoading, profileLoading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) navigate("/login", { replace: true });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) refreshProfile();
  }, [user, refreshProfile]);

  useEffect(() => {
    if (!user) return;

    const fetchApplications = async () => {
      const { data } = await supabase
        .from("loan_applications")
        .select("id, status, created_at, updated_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      setApplications(data || []);
      setPageLoading(false);
    };

    fetchApplications();

    const channel = supabase
      .channel("user-applications")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "loan_applications", filter: `user_id=eq.${user.id}` },
        fetchApplications
      )
      .subscribe();

    const profileChannel = supabase
      .channel("user-profile")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `user_id=eq.${user.id}` },
        refreshProfile
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(profileChannel);
    };
  }, [user, refreshProfile]);

  const kycStatus = profile?.kyc_status || "PENDING";
  const canCompare = kycStatus === "VERIFIED" || kycStatus === "COMPLETED";

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "approved": return "bg-success text-success-foreground";
      case "rejected": return "bg-destructive text-destructive-foreground";
      case "pending": return "bg-warning text-warning-foreground";
      case "reviewing": return "bg-info text-info-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getStatusLabel = (status: string) =>
    status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const getKycIcon = () => {
    switch (kycStatus) {
      case "VERIFIED":
      case "COMPLETED":
        return <CheckCircle2 className="h-5 w-5 text-success" />;
      case "IN_REVIEW":
        return <Clock className="h-5 w-5 text-warning" />;
      case "REJECTED":
        return <XCircle className="h-5 w-5 text-destructive" />;
      default:
        return <AlertCircle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getKycLabel = () => {
    switch (kycStatus) {
      case "VERIFIED": return "Verified";
      case "COMPLETED": return "Completed";
      case "IN_REVIEW": return "Under Review";
      case "REJECTED": return "Action Required";
      default: return "Not Started";
    }
  };

  const profileFields = [
    { key: "full_name" as const, label: "Full Name", icon: User },
    { key: "email" as const, label: "Email Address", icon: Mail },
    { key: "phone" as const, label: "Phone Number", icon: Phone },
    { key: "nrc_number" as const, label: "NRC Number", icon: Hash },
    { key: "employer" as const, label: "Employer / Ministry", icon: Building },
    { key: "employee_number" as const, label: "Employee Number", icon: Hash },
  ];

  if (authLoading || pageLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <Navbar />
      <main className="container mx-auto px-4 py-6 sm:py-8 max-w-7xl space-y-6 pt-24">
        <header>
          <p className="text-sm font-medium text-primary mb-2">Borrower dashboard</p>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-display font-bold text-foreground">
            Welcome back, <span className="text-primary">{profile?.full_name || "there"}</span>
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            See where you are in your Riverbanc journey and what you need to do next.
          </p>
        </header>

        <BorrowerJourney
          kycStatus={kycStatus}
          consentAccepted={Boolean(profile?.consent_accepted)}
          applicationCount={applications.length}
          onKyc={() => navigate("/apply")}
          onCompare={() => navigate("/compare")}
        />

        <section aria-labelledby="account-overview">
          <div className="mb-3">
            <h2 id="account-overview" className="text-lg font-display font-semibold text-foreground">Account overview</h2>
            <p className="text-sm text-muted-foreground">Your verification and application activity at a glance.</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Verification</CardTitle>
                <ShieldCheck className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  {getKycIcon()}
                  <span className="text-lg font-display font-bold text-foreground">{getKycLabel()}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Active applications</CardTitle>
                <FileCheck className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-display font-bold text-foreground">
                  {applications.filter((app) => !["approved", "rejected"].includes(app.status.toLowerCase())).length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Currently in progress</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Applications</CardTitle>
                <CreditCard className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-display font-bold text-foreground">{applications.length}</div>
                <p className="text-xs text-muted-foreground mt-1">All time</p>
              </CardContent>
            </Card>
          </div>
        </section>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-display flex items-center gap-2">
              <FileSignature className="h-5 w-5 text-primary" />
              Payroll deduction consent
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Any required consent will be presented clearly before the relevant application step.
            </p>
          </CardHeader>
          <CardContent>
            {profile?.consent_accepted ? (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-success/10 border border-success/20">
                <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Consent completed</p>
                  <p className="text-xs text-muted-foreground">
                    Signed on {profile.consent_signed_at
                      ? new Date(profile.consent_signed_at).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" })
                      : "—"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Consent not yet signed</p>
                    <p className="text-xs text-muted-foreground">
                      {kycStatus === "PENDING" && "Complete verification before the relevant consent step."}
                      {kycStatus === "IN_REVIEW" && "Your verification is under review. We'll show the next required step when it is ready."}
                      {kycStatus === "REJECTED" && "Resubmit your verification information before proceeding."}
                      {canCompare && "Your verification is complete. Any required consent will be presented before you proceed."}
                    </p>
                  </div>
                </div>
                {(kycStatus === "PENDING" || kycStatus === "REJECTED") && (
                  <Button size="sm" variant="outline" onClick={() => navigate("/apply")}>
                    {kycStatus === "PENDING" ? "Start verification" : "Resubmit"}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-display flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Profile details
            </CardTitle>
            <p className="text-sm text-muted-foreground">Information used to verify your identity and employment.</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {profileFields.map(({ key, label, icon: Icon }) => {
                const value = profile?.[key];
                return (
                  <div key={key} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground mb-1">{label}</p>
                      {value ? (
                        <p className="text-sm font-medium text-foreground truncate">{String(value)}</p>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground border-muted-foreground/30">Not provided</Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-display flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-primary" />
              Recent applications
            </CardTitle>
            <p className="text-sm text-muted-foreground">Track what is happening after you choose a financial institution.</p>
          </CardHeader>
          <CardContent>
            {applications.length > 0 ? (
              <div className="space-y-3">
                {applications.map((app) => (
                  <div key={app.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg bg-muted/30 border border-border/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">Application</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Submitted {new Date(app.created_at).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" })}
                        {app.updated_at && ` • Updated ${new Date(app.updated_at).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" })}`}
                      </p>
                    </div>
                    <Badge className={`${getStatusColor(app.status)} text-xs`}>{getStatusLabel(app.status)}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileCheck className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm font-medium text-foreground">No lender applications yet</p>
                <p className="text-xs mt-1">Once you choose a financial institution, your application activity will appear here.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-display flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Next actions
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-3">
            {canCompare ? (
              <Button onClick={() => navigate("/compare")} className="sm:flex-1">
                <CreditCard className="mr-2 h-4 w-4" />
                View eligible offers
              </Button>
            ) : (
              <Button onClick={() => navigate("/apply")} className="sm:flex-1">
                <ShieldCheck className="mr-2 h-4 w-4" />
                {kycStatus === "REJECTED" ? "Resubmit verification" : "Continue verification"}
              </Button>
            )}
            <Button onClick={() => navigate("/#how-it-works")} variant="outline" className="sm:flex-1">
              Learn how Riverbanc works
            </Button>
          </CardContent>
        </Card>

        <GranularConsentSection />
        <DataExportSection />
        <DataErasureSection />
      </main>
    </div>
  );
};

export default ProfilePage;
