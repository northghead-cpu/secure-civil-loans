import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Determines the redirect path after login based on user role and KYC status
 */
const getRedirectPath = async (userId: string): Promise<string> => {
  try {
    // Check user roles first
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (!roleError && roleData?.length) {
      const roles = roleData.map((item: { role: string }) => item.role);
      
      // If user has admin role, redirect to admin dashboard
      if (roles.some((r) => ["super_admin", "admin", "super_user", "compliance_team", "data_entry_team"].includes(r))) {
        return "/admin";
      }
    }

    // For regular users, check KYC status
    const { data: profileData } = await supabase
      .from("profiles")
      .select("kyc_status")
      .eq("user_id", userId)
      .maybeSingle();

    const kycStatus = profileData?.kyc_status;
    
    // If KYC is completed, allow access to compare page
    if (kycStatus === "COMPLETED") {
      return "/compare";
    }

    // For PENDING, IN_REVIEW, or no status, redirect to profile
    return "/profile";
  } catch (error) {
    // On error, default to profile
    console.error("Error determining redirect path:", error);
    return "/profile";
  }
};

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        toast({ title: "Welcome back!", description: "You've signed in successfully." });

        const userId = data?.user?.id;
        
        if (userId) {
          // Get the appropriate redirect path based on role and KYC status
          const redirectPath = await getRedirectPath(userId);
          navigate(redirectPath);
        } else {
          // Fallback if no user ID
          navigate("/profile");
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast({
          title: "Account created!",
          description: "Please check your email to verify your account before signing in.",
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const onToggleMode = () => setIsLogin(!isLogin);

  const onThirdPartySignIn = async (provider: "google" | "apple") => {
    try {
      const { error } = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
      });
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    } catch (err) {
      toast({ title: "Error", description: "Failed to sign in", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-2xl sm:text-3xl font-extrabold text-foreground">
            {isLogin ? "Sign in to your account" : "Create your account"}
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            {!isLogin && (
              <div>
                <label htmlFor="full-name" className="sr-only">Full Name</label>
                <Input
                  id="full-name"
                  name="fullName"
                  type="text"
                  required={!isLogin}
                  className="rounded-none rounded-t-md"
                  placeholder="Full Name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            )}
            <div>
              <label htmlFor="email-address" className="sr-only">Email address</label>
              <Input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className={`rounded-none ${isLogin ? "rounded-t-md" : ""}`}
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="rounded-none rounded-b-md"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Processing..." : isLogin ? "Sign in" : "Sign up"}
            </Button>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={onToggleMode}
              className="text-primary hover:text-primary/80 text-sm"
            >
              {isLogin ? "Need an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-background text-muted-foreground">Or continue with</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <Button type="button" onClick={() => onThirdPartySignIn("google")} variant="outline" className="w-full">
                Google
              </Button>
              <Button type="button" onClick={() => onThirdPartySignIn("apple")} variant="outline" className="w-full">
                Apple
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AuthPage;
