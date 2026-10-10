import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import * as Sentry from "@sentry/react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowLeft, Mail, RotateCcw } from "lucide-react";
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
    if (!email.trim()) {
      setError("Please enter your email");
      return;
    }

    const normalized = normalizeEmail(email);
    const scope = `reset:${normalized}`;
    const gate = checkThrottle(scope);
    if (!gate.allowed) {
      setError(`Too many attempts. Please try again in ${formatRetry(gate.retryInMs)}.`);
      return;
    }

    setLoading(true);
    try {
      // Production reset links always return to Riverbanc's canonical domain,
      // even when the request originates from a Vercel preview deployment.
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalized, {
        redirectTo: `${import.meta.env.PROD ? "https://riverbanc.co.zm" : window.location.origin}/reset-password`,
      });

      if (resetError) {
        recordFailure(scope);
        // Record only non-PII diagnostics. Never attach the submitted email or
        // raw provider error to telemetry, and never reveal account existence.
        Sentry.captureMessage("Password reset request rejected by auth provider", {
          level: "error",
          tags: { flow: "password-reset", provider: "supabase-auth" },
          extra: {
            errorName: resetError.name,
            errorCode: "code" in resetError ? resetError.code : undefined,
            status: "status" in resetError ? resetError.status : undefined,
          },
        });
      } else {
        recordSuccess(scope);
      }

      // Keep the same confirmation for every address and provider outcome to
      // prevent account enumeration. The copy does not claim delivery occurred.
      setSent(true);
      toast({
        title: "Check your email",
        description: "If an account exists, a reset email may arrive shortly. Check the on-screen guidance if it does not.",
      });
    } catch {
      recordFailure(scope);
      Sentry.captureMessage("Password reset request threw unexpectedly", {
        level: "error",
        tags: { flow: "password-reset", provider: "supabase-auth" },
      });
      // Use the same non-enumerating recovery guidance for unexpected failures.
      setSent(true);
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
            <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-display font-bold text-foreground">Check Your Email</h2>
          <p className="text-muted-foreground">
            If an account exists for <strong className="text-foreground">{email.trim()}</strong>, a password reset email should arrive shortly.
          </p>
          <div className="rounded-lg border border-border bg-muted/40 p-4 text-left space-y-2">
            <p className="text-sm font-medium text-foreground">Didn't receive the email?</p>
            <p className="text-sm text-muted-foreground">
              Check your spam or junk folder and wait a few minutes. If it still hasn't arrived, try again or contact Riverbanc Support.
            </p>
            <a
              href="mailto:support@riverbanc.co.zm?subject=Password%20reset%20help"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary underline underline-offset-4"
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              Contact support
            </a>
          </div>
          <div className="flex flex-col gap-3">
            <Button onClick={() => { setSent(false); setError(""); }} variant="outline" className="w-full h-11">
              <RotateCcw className="mr-2 h-4 w-4" />
              Try again
            </Button>
            <Link to="/login">
              <Button className="w-full h-11">Back to login</Button>
            </Link>
          </div>
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
        <Link to="/login" className="inline-flex items-center text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to login
        </Link>

        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground mb-2">Forgot your password?</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Enter your email address and we'll help you recover access to your account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="block mb-2 text-sm font-medium text-foreground">
              Email address
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
              className="w-full h-11 px-4"
            />
          </div>

          {error && <div role="alert" className="text-destructive text-sm bg-destructive/10 px-3 py-2 rounded-md">{error}</div>}

          <Button type="submit" disabled={loading} className="w-full h-11 text-base font-medium">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {loading ? "Sending…" : "Send reset link"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Need help? <a href="mailto:support@riverbanc.co.zm?subject=Password%20reset%20help" className="text-primary underline underline-offset-4">Contact Riverbanc Support</a>
        </p>
      </motion.div>
    </div>
  );
};

export default ForgotPasswordPage;
