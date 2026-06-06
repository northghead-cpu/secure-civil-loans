import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import FeaturesSection from "@/components/landing/FeaturesSection";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import TrustSection from "@/components/landing/TrustSection";
import CTASection from "@/components/landing/CTASection";
import Footer from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { useRBAC, AppRole } from "@/hooks/useRBAC";
import { Loader2 } from "lucide-react";

const ADMIN_ROLES: AppRole[] = ["super_admin", "admin", "super_user", "compliance_team", "data_entry_team"];

const Index = () => {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading, profileLoading, isPasswordRecovery } = useAuth();
  const { highestRole, loading: rbacLoading } = useRBAC();

  useEffect(() => {
    // Recovery sessions must go to the dedicated reset page, never to an
    // authenticated dashboard.
    if (isPasswordRecovery) {
      navigate("/reset-password", { replace: true });
      return;
    }
    if (authLoading || rbacLoading || profileLoading) return;
    if (!user) return; // Show landing page for non-logged-in users

    if (highestRole && ADMIN_ROLES.includes(highestRole)) {
      navigate("/admin", { replace: true });
      return;
    }

    if (profile?.kyc_status === "VERIFIED" || profile?.kyc_status === "COMPLETED") {
      navigate("/profile", { replace: true });
      return;
    }
  }, [user, authLoading, rbacLoading, profileLoading, highestRole, profile, navigate, isPasswordRecovery]);

  if (authLoading || rbacLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <TrustSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
