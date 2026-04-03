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

const getDashboardPath = (role: AppRole | null | undefined) => {
  if (["super_admin", "admin", "super_user", "compliance_team", "data_entry_team"].includes(role ?? "")) return "/admin";
  return "/profile";
};

const Index = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { highestRole, loading: rbacLoading } = useRBAC();

  useEffect(() => {
    if (authLoading || rbacLoading) return;
    if (!user) return;

    const targetPath = getDashboardPath(highestRole || "user");
    if (window.location.pathname === "/") {
      navigate(targetPath, { replace: true });
    }
  }, [user, authLoading, rbacLoading, highestRole, navigate]);

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
