import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { checkThrottle, recordFailure, recordSuccess, formatRetry } from "@/lib/authThrottle";

const getRedirectPath = async (userId: string): Promise<string> => {
  try {
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (!roleError && roleData?.length) {
      const roles = roleData.map((item: { role: string }) => item.role);
      if (roles.some((r) => ["super_admin", "admin", "super_user", "compliance_team", "data_entry_team"].includes(r))) {
        return "/admin";
      }
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("kyc_status")
      .eq("user_id", userId)
      .maybeSingle();

    const kycStatus = profileData?.kyc_status;
    if (kycStatus === "VERIFIED" || kycStatus === "IN_REVIEW" || kycStatus === "COMPLETED") {
      return "/profile";
    }
    return "/apply";
  } catch (error) {
    console.error("Error determining redirect path:", error);
    return "/profile";
  }
};

const AuthPage = () => {
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "login";
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [signupSuccess, setSignupSuccess] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!email || !password || (mode === "signup" && !fullName)) {
      setError("Please fill in all fields");
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      setLoading(false);
      return;
    }

    try {
      if (mode === "login") {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;

        toast({ title: "Welcome back!", description: "You've signed in successfully." });

        const userId = data?.user?.id;
        if (userId) {
          const redirectPath = await getRedirectPath(userId);
          navigate(redirectPath);
        } else {
          navigate("/profile");
        }
      } else {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: window.location.origin + "/login",
          },
        });
        if (signUpError) throw signUpError;

        setSignupSuccess(true);
        toast({
          title: "Account created!",
          description: "Please check your email to verify your account before signing in.",
        });
      }
    } catch (err: unknown) {
      const rawMessage = err instanceof Error ? err.message : "Unknown error";
      // Auth-enumeration hardening: collapse credential/lookup errors into one generic message.
      const lower = rawMessage.toLowerCase();
      const isAuthLookupError =
        mode === "login" ||
        lower.includes("invalid") ||
        lower.includes("password") ||
        lower.includes("user not found") ||
        lower.includes("email not confirmed") ||
        lower.includes("credentials");
      const displayMessage = isAuthLookupError
        ? "Invalid email or password combination."
        : rawMessage;
      setError(displayMessage);
      toast({ title: "Error", description: displayMessage, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const switchToLogin = () => {
    setMode("login");
    setError("");
    setSignupSuccess(false);
  };

  const onThirdPartySignIn = async (provider: "google" | "apple") => {
    try {
      const { error } = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
      });
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    } catch {
      toast({ title: "Error", description: "Failed to sign in", variant: "destructive" });
    }
  };

  // After signup success, show confirmation message with button to switch to login
  if (signupSuccess) {
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-background p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md text-center space-y-6"
        >
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-display font-bold text-foreground">Check Your Email</h2>
          <p className="text-muted-foreground">
            We've sent a confirmation link to <strong className="text-foreground">{email}</strong>. 
            Please verify your email address, then sign in below.
          </p>
          <Button onClick={switchToLogin} className="w-full h-11">
            Go to Login
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-background p-4 overflow-hidden">
      {/* Sparkle dots background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(30)].map((_, i) => (
            <div
              key={`sparkle-${i}`}
              className="absolute w-1 h-1 bg-primary/40 rounded-full animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
              }}
            />
          ))}
        </div>
      </div>
      
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/95 to-transparent z-[1]" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="mb-8 text-center">
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground mb-2">Welcome</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            {mode === "login" ? "Sign in to your account" : "Create your account"}
          </p>
        </div>

        <div className="mb-6 flex gap-2 p-1 bg-muted rounded-lg">
          <button
            type="button"
            onClick={() => { setMode("login"); setError(""); }}
            className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
              mode === "login" ? "bg-background shadow-sm text-foreground" : "hover:bg-background/50 text-muted-foreground"
            }`}
          >Log in</button>
          <button
            type="button"
            onClick={() => { setMode("signup"); setError(""); }}
            className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
              mode === "signup" ? "bg-background shadow-sm text-foreground" : "hover:bg-background/50 text-muted-foreground"
            }`}
          >Sign up</button>
        </div>

        <motion.form
          key={mode}
          initial={{ opacity: 0, x: mode === "login" ? -20 : 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          onSubmit={handleSubmit}
          className="space-y-5"
        >
          {mode === "signup" && (
            <div>
              <label htmlFor="name" className="block mb-2 text-sm font-medium text-foreground">Name</label>
              <Input id="name" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Enter your name" className="w-full h-11 px-4" autoComplete="name" />
            </div>
          )}
          <div>
            <label htmlFor="email" className="block mb-2 text-sm font-medium text-foreground">Email</label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" className="w-full h-11 px-4" autoComplete="email" />
          </div>
          <div>
            <label htmlFor="password" className="block mb-2 text-sm font-medium text-foreground">Password</label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" className="w-full h-11 px-4" autoComplete={mode === "login" ? "current-password" : "new-password"} />
          </div>
          {error && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-destructive text-sm bg-destructive/10 px-3 py-2 rounded-md">{error}</motion.div>
          )}
          <Button type="submit" disabled={loading} className="w-full h-11 text-base font-medium">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {mode === "login" ? "Log in" : "Sign up"}
          </Button>
          {mode === "login" && (
            <div className="text-center">
              <button type="button" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Forgot password?</button>
            </div>
          )}
        </motion.form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
          <div className="relative flex justify-center text-xs"><span className="px-2 bg-background text-muted-foreground">Or continue with</span></div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button type="button" onClick={() => onThirdPartySignIn("google")} variant="outline" className="h-11">
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            <span className="hidden sm:inline">Continue with</span> Google
          </Button>
          <Button type="button" onClick={() => onThirdPartySignIn("apple")} variant="outline" className="h-11">
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
            <span className="hidden sm:inline">Continue with</span> Apple
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default AuthPage;
