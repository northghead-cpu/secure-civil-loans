import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { User, FileCheck, CreditCard, Settings, TrendingUp, Clock, ShieldCheck, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PulseBeams } from "@/components/ui/pulse-beams";
import { toast } from "sonner";

interface LoanApplication {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

const beams = [
  {
    path: "M269 220.5H16.5C10.9772 220.5 6.5 224.977 6.5 230.5V398.5",
    gradientConfig: {
      initial: {
        x1: "0%",
        x2: "0%",
        y1: "80%",
        y2: "100%",
      },
      animate: {
        x1: ["0%", "0%", "200%"],
        x2: ["0%", "0%", "180%"],
        y1: ["80%", "0%", "0%"],
        y2: ["100%", "20%", "20%"],
      },
      transition: {
        duration: 2,
        repeat: Infinity,
        repeatType: "loop",
        ease: "linear",
        repeatDelay: 2,
        delay: Math.random() * 2,
      },
    },
    connectionPoints: [
      { cx: 6.5, cy: 398.5, r: 6 },
      { cx: 269, cy: 220.5, r: 6 }
    ]
  },
  {
    path: "M568 200H841C846.523 200 851 195.523 851 190V40",
    gradientConfig: {
      initial: {
        x1: "0%",
        x2: "0%",
        y1: "80%",
        y2: "100%",
      },
      animate: {
        x1: ["20%", "100%", "100%"],
        x2: ["0%", "90%", "90%"],
        y1: ["80%", "80%", "-20%"],
        y2: ["100%", "100%", "0%"],
      },
      transition: {
        duration: 2,
        repeat: Infinity,
        repeatType: "loop",
        ease: "linear",
        repeatDelay: 2,
        delay: Math.random() * 2,
      },
    },
    connectionPoints: [
      { cx: 851, cy: 34, r: 6.5 },
      { cx: 568, cy: 200, r: 6 }
    ]
  },
  {
    path: "M425.5 274V333C425.5 338.523 421.023 343 415.5 343H152C146.477 343 142 347.477 142 353V426.5",
    gradientConfig: {
      initial: {
        x1: "0%",
        x2: "0%",
        y1: "80%",
        y2: "100%",
      },
      animate: {
        x1: ["20%", "100%", "100%"],
        x2: ["0%", "90%", "90%"],
        y1: ["80%", "80%", "-20%"],
        y2: ["100%", "100%", "0%"],
      },
      transition: {
        duration: 2,
        repeat: Infinity,
        repeatType: "loop",
        ease: "linear",
        repeatDelay: 2,
        delay: Math.random() * 2,
      },
    },
    connectionPoints: [
      { cx: 142, cy: 427, r: 6.5 },
      { cx: 425.5, cy: 274, r: 6 }
    ]
  },
  {
    path: "M493 274V333.226C493 338.749 497.477 343.226 503 343.226H760C765.523 343.226 770 347.703 770 353.226V427",
    gradientConfig: {
      initial: {
        x1: "40%",
        x2: "50%",
        y1: "160%",
        y2: "180%",
      },
      animate: {
        x1: "0%",
        x2: "10%",
        y1: "-40%",
        y2: "-20%",
      },
      transition: {
        duration: 2,
        repeat: Infinity,
        repeatType: "loop",
        ease: "linear",
        repeatDelay: 2,
        delay: Math.random() * 2,
      },
    },
    connectionPoints: [
      { cx: 770, cy: 427, r: 6.5 },
      { cx: 493, cy: 274, r: 6 }
    ]
  },
  {
    path: "M380 168V17C380 11.4772 384.477 7 390 7H414",
    gradientConfig: {
      initial: {
        x1: "-40%",
        x2: "-10%",
        y1: "0%",
        y2: "20%",
      },
      animate: {
        x1: ["40%", "0%", "0%"],
        x2: ["10%", "0%", "0%"],
        y1: ["0%", "0%", "180%"],
        y2: ["20%", "20%", "200%"],
      },
      transition: {
        duration: 2,
        repeat: Infinity,
        repeatType: "loop",
        ease: "linear",
        repeatDelay: 2,
        delay: Math.random() * 2,
      },
    },
    connectionPoints: [
      { cx: 420.5, cy: 6.5, r: 6 },
      { cx: 380, cy: 168, r: 6 }
    ]
  }
];

const gradientColors = {
  start: "#18CCFC",
  middle: "#6344F5",
  end: "#AE48FF"
};

interface LoanApplication {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

const ProfilePage = () => {
  const { user, profile } = useAuth();
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
        .limit(5);

      setApplications(data || []);
      setLoading(false);
    };

    fetchApplications();
  }, [user]);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "approved": return "bg-success";
      case "rejected": return "bg-destructive";
      case "pending": return "bg-warning";
      case "kyc_review": return "bg-info";
      case "crb_check": return "bg-accent";
      default: return "bg-muted";
    }
  };

  const getStatusLabel = (status: string) => {
    return status.replace("_", " ").toUpperCase();
  };

  // Profile fields with labels for display
  const profileFieldDefs = [
    { key: "full_name" as const, label: "Full Name" },
    { key: "email" as const, label: "Email Address" },
    { key: "phone" as const, label: "Phone Number" },
    { key: "nrc_number" as const, label: "NRC / ID Number" },
    { key: "employer" as const, label: "Employer / Ministry" },
    { key: "employee_number" as const, label: "Employee Number" },
    { key: "salary" as const, label: "Salary" },
  ];
  const completedFields = profileFieldDefs.filter(f => profile && profile[f.key]);
  const profileCompletion = (completedFields.length / profileFieldDefs.length) * 100;
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

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  return (
    <PulseBeams
      beams={beams}
      gradientColors={gradientColors}
      className="bg-slate-950"
      width={1920}
      height={1080}
    >
      <div className="w-full h-full overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-white leading-tight mb-6">
              Welcome back, <span className="text-gradient">{profile?.full_name || "User"}</span>!
            </h1>
            <p className="text-lg md:text-xl text-white/70 max-w-2xl mx-auto mb-8">
              Manage your profile and loan applications
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Profile Completion */}
            <Card className="hover:bg-blue-50 hover:border-blue-200 transition-colors duration-300">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Profile Completion</CardTitle>
                <User className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-display font-bold text-foreground">{Math.round(profileCompletion)}%</div>
                <Progress value={profileCompletion} className="mt-2" />
                <p className="text-xs text-muted-foreground mt-2">
                  {profileFields.length - completedFields.length} fields remaining
                </p>
              </CardContent>
            </Card>

            {/* Active Applications */}
            <Card className="hover:bg-green-50 hover:border-green-200 transition-colors duration-300">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Active Applications</CardTitle>
                <FileCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-display font-bold text-foreground">
                  {applications.filter(app => app.status !== "approved" && app.status !== "rejected").length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">In progress</p>
              </CardContent>
            </Card>

            {/* Total Applications */}
            <Card className="hover:bg-purple-50 hover:border-purple-200 transition-colors duration-300">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Applications</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-display font-bold text-foreground">{applications.length}</div>
                <p className="text-xs text-muted-foreground mt-1">All time</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Applications */}
            <Card className="hover:bg-orange-50 hover:border-orange-200 transition-colors duration-300">
              <CardHeader>
                <CardTitle className="text-base font-display">Recent Applications</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {applications.length > 0 ? (
                  applications.map((app) => (
                    <div key={app.id} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">Loan Application</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(app.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge className={`${getStatusColor(app.status)} text-white`}>
                        {getStatusLabel(app.status)}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No applications yet</p>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="hover:bg-red-50 hover:border-red-200 transition-colors duration-300">
              <CardHeader>
                <CardTitle className="text-base font-display">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  onClick={() => {
                    if (kycStatus === "COMPLETED") {
                      navigate("/apply");
                    } else if (kycStatus === "IN_REVIEW") {
                      toast.info("Your KYC is still under review.");
                    } else {
                      navigate("/apply");
                    }
                  }}
                  className="w-full justify-start"
                  variant="outline"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  {kycStatus === "COMPLETED" ? "Apply for a Loan" : "Complete KYC & Apply"}
                </Button>
                <Button
                  onClick={() => navigate("/compare")}
                  className="w-full justify-start"
                  variant="outline"
                >
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Compare Loan Options
                </Button>
                <Button
                  onClick={() => {/* TODO: Add profile edit page */}}
                  className="w-full justify-start"
                  variant="outline"
                  disabled
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Update Profile
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PulseBeams>
  );
};

export default ProfilePage;