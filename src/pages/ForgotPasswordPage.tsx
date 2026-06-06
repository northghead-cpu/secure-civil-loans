import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowLeft } from "lucide-react";
import { checkThrottle, recordFailure, recordSuccess, formatRetry, normalizeEmail } from "@/lib/authThrottle";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email) {
      setError("Please enter your email");
      return;
    }

    const normalized = normalizeEmail(email);
    const scope = `reset:${normalized}`;
    const gate = checkThrottle(scope);
    if (!gate.allowed) {
      const msg = `Too many attempts. Please try again in ${formatRetry(gate.retryInMs)}.`;
      setError(msg);
      return;
    }

    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalized, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      // Always show generic success to prevent email enumeration.
      if (resetError) {
        recordFailure(scope);
        console.error("Password reset error:", resetError);
      } else {
        recordSuccess(scope);
      }
      setSent(true);
      toast({
        title: "Check your email",
        description: "If an account exists for that email, a reset link is on the way.",
      });
    } catch (err: unknown) {
      recordFailure(scope);
      const msg = err instanceof Error ? err.message : "Failed to send reset email";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
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
            If an account exists for <strong className="text-foreground">{email}</strong>, we've sent
            a password reset link. Please follow the instructions in the email to reset your password.
          </p>
          <Link to="/login">
            <Button className="w-full h-11">Back to login</Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Link to="/login" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to login
        </Link>
        <div className="mb-8 text-center">
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground mb-2">Reset your password</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Enter your email and we'll send you a link to reset your password.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="block mb-2 text-sm font-medium text-foreground">Email</label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              autoComplete="email"
              className="w-full h-11 px-4"
            />
          </div>
          {error && (
            <div className="text-destructive text-sm bg-destructive/10 px-3 py-2 rounded-md">{error}</div>
          )}
          <Button type="submit" disabled={loading} className="w-full h-11 text-base font-medium">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Send reset link
          </Button>
        </form>
      </motion.div>
    </div>
  );
};

export default ForgotPasswordPage;
