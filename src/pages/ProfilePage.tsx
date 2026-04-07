import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { User, FileCheck, CreditCard, TrendingUp, Clock, ShieldCheck, CheckCircle2, XCircle, AlertCircle, Mail, Phone, Building, Hash, Banknote } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LoanApplication {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

const ProfilePage = () => {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchApplications = async () => {
      if (!user) return;

      const { data } = await supabase
        .from("loan_applications")
        .select("id, status, created_at, updated_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      setApplications(data || []);
      setLoading(false);
    };

    fetchApplications();
  }, [user]);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "approved": return "bg-success text-success-foreground";
      case "rejected": return "bg-destructive text-destructive-foreground";
      case "pending": return "bg-warning text-warning-foreground";
      case "reviewing": return "bg-info text-info-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getStatusLabel = (status: string) => {
    return status.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  };

  const kycStatus = profile?.kyc_status || "PENDING";

  const getKycIcon = () => {
    switch (kycStatus) {
      case "COMPLETED": return <CheckCircle2 className="h-5 w-5 text-success" />;
      case "IN_REVIEW": return <Clock className="h-5 w-5 text-warning" />;
      case "REJECTED": return <XCircle className="h-5 w-5 text-destructive" />;
      default: return <AlertCircle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getKycLabel = () => {
    switch (kycStatus) {
      case "COMPLETED": return "Verified";
      case "IN_REVIEW": return "Under Review";
      case "REJECTED": return "Rejected";
      default: return "Not Started";
    }
  };

  // Profile fields with labels and icons for display
  const profileFields = [
    { key: "full_name" as const, label: "Full Name", icon: User },
    { key: "email" as const, label: "Email Address", icon: Mail },
    { key: "phone" as const, label: "Phone Number", icon: Phone },
    { key: "nrc_number" as const, label: "NRC Number", icon: Hash },
    { key: "employer" as const, label: "Employer / Ministry", icon: Building },
    { key: "employee_number" as const, label: "Employee Number", icon: Hash },
  ];

  const completedFields = profileFields.filter(f => profile && profile[f.key]);
  const profileCompletion = (completedFields.length / profileFields.length) * 100;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-6 sm:py-8 max-w-7xl space-y-6">
        
        {/* Header */}
        <div className="text-center sm:text-left">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-display font-bold text-foreground">
            Welcome back, <span className="text-primary">{profile?.full_name || "User"}</span>!
          </h1>
          <p className="text-muted-foreground mt-2">Manage your profile and track your loan applications</p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Profile Completion */}
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Profile</CardTitle>
              <User className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-display font-bold text-foreground">{Math.round(profileCompletion)}%</div>
              <Progress value={profileCompletion} className="mt-2 h-2" />
              <p className="text-xs text-muted-foreground mt-2">
                {profileFields.length - completedFields.length} fields remaining
              </p>
            </CardContent>
          </Card>

          {/* KYC Status */}
          <Card className="bg-gradient-to-br from-warning/5 to-warning/10 border-warning/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">KYC Status</CardTitle>
              <ShieldCheck className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {getKycIcon()}
                <span className="text-lg sm:text-xl font-display font-bold text-foreground">{getKycLabel()}</span>
              </div>
              {kycStatus === "PENDING" && (
                <Button 
                  size="sm" 
                  variant="link" 
                  className="px-0 mt-2 h-auto text-xs text-primary" 
                  onClick={() => navigate("/apply")}
                >
                  Start KYC →
                </Button>
              )}
              {kycStatus === "REJECTED" && (
                <Button 
                  size="sm" 
                  variant="link" 
                  className="px-0 mt-2 h-auto text-xs text-destructive" 
                  onClick={() => navigate("/apply")}
                >
                  Resubmit →
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Active Applications */}
          <Card className="bg-gradient-to-br from-info/5 to-info/10 border-info/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Active</CardTitle>
              <FileCheck className="h-4 w-4 text-info" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-display font-bold text-foreground">
                {applications.filter(app => app.status !== "approved" && app.status !== "rejected").length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">In progress</p>
            </CardContent>
          </Card>

          {/* Total Applications */}
          <Card className="bg-gradient-to-br from-success/5 to-success/10 border-success/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Total</CardTitle>
              <CreditCard className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-display font-bold text-foreground">{applications.length}</div>
              <p className="text-xs text-muted-foreground mt-1">All time</p>
            </CardContent>
          </Card>
        </div>

        {/* Profile Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-display flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Profile Details
            </CardTitle>
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
                        <Badge variant="outline" className="text-xs text-muted-foreground border-muted-foreground/30">
                          Not provided
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Two Column Layout for Applications and Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Recent Applications */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-display flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-primary" />
                Recent Applications
              </CardTitle>
            </CardHeader>
            <CardContent>
              {applications.length > 0 ? (
                <div className="space-y-3">
                  {applications.map((app) => (
                    <div key={app.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">Loan Application</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(app.created_at).toLocaleDateString('en-ZA', { 
                            day: '2-digit', 
                            month: 'short', 
                            year: 'numeric' 
                          })}
                        </p>
                      </div>
                      <Badge className={`${getStatusColor(app.status)} text-xs`}>
                        {getStatusLabel(app.status)}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileCheck className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No applications yet</p>
                  <p className="text-xs mt-1">Start by completing your KYC verification</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-display flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={() => {
                  if (kycStatus === "COMPLETED") {
                    navigate("/compare");
                  } else if (kycStatus === "IN_REVIEW") {
                    toast.info("Your KYC is still under review. Please wait for approval.");
                  } else {
                    navigate("/apply");
                  }
                }}
                className="w-full justify-start h-12 text-left"
                variant="outline"
              >
                <div className="flex items-center gap-3 w-full">
                  <CreditCard className="h-5 w-5 text-primary shrink-0" />
                  <div className="text-left">
                    <p className="font-medium">
                      {kycStatus === "COMPLETED" ? "Apply for a Loan" : "Complete KYC & Apply"}
                    </p>
                    <p className="text-xs text-muted-foreground font-normal">
                      {kycStatus === "COMPLETED" 
                        ? "Browse and compare loan options" 
                        : "Verify your identity first"}
                    </p>
                  </div>
                </div>
              </Button>
              
              <Button
                onClick={() => navigate("/compare")}
                className="w-full justify-start h-12 text-left"
                variant="outline"
              >
                <div className="flex items-center gap-3 w-full">
                  <TrendingUp className="h-5 w-5 text-primary shrink-0" />
                  <div className="text-left">
                    <p className="font-medium">Compare Loan Options</p>
                    <p className="text-xs text-muted-foreground font-normal">View rates from different lenders</p>
                  </div>
                </div>
              </Button>

              <Button
                onClick={() => navigate("/profile")}
                className="w-full justify-start h-12 text-left"
                variant="outline"
              >
                <div className="flex items-center gap-3 w-full">
                  <User className="h-5 w-5 text-primary shrink-0" />
                  <div className="text-left">
                    <p className="font-medium">Edit Profile</p>
                    <p className="text-xs text-muted-foreground font-normal">Update your personal information</p>
                  </div>
                </div>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
