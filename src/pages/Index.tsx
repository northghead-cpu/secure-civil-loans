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

/**
 * Determines redirect path based on role and KYC status
 */
const getDashboardPath = async (role: AppRole | null | undefined, profile: { kyc_status: string | null } | null): Promise<string> => {
  // Admin users go to admin dashboard
  if (role && ["super_admin", "admin", "super_user", "compliance_team", "data_entry_team"].includes(role)) {
    return "/admin";
  }
  
  // For regular users, check KYC status
  const kycStatus = profile?.kyc_status;
  if (kycStatus === "VERIFIED") {
    return "/profile";
  }
  
  // Not verified → KYC page
  if (kycStatus !== "VERIFIED") {
    return "/apply";
  }
  
  return "/profile";
};

const Index = () => {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const { highestRole, loading: rbacLoading } = useRBAC();

  useEffect(() => {
    if (authLoading || rbacLoading) return;
    
    // If user is not logged in, stay on home page (show landing)
    if (!user) {
      return;
    }

    // User is logged in, determine where to redirect
    const redirect = async () => {
      const targetPath = await getDashboardPath(highestRole || "user", profile);
      if (window.location.pathname === "/") {
        navigate(targetPath, { replace: true });
      }
    };
    
    redirect();
  }, [user, authLoading, rbacLoading, highestRole, profile, navigate]);

  // Show loading while checking auth
  if (authLoading || rbacLoading) {
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
