import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import * as Sentry from "@sentry/react";

const ResetPasswordPage = () => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [success, setSuccess] = useState(false);
  const [linkInvalid, setLinkInvalid] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isPasswordRecovery, clearPasswordRecovery } = useAuth();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    let active = true;
    let recoveryConfirmed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let subscription: { unsubscribe: () => void } | undefined;

    const markReady = () => {
      if (!active) return;
      recoveryConfirmed = true;
      if (timer) clearTimeout(timer);
      setLinkInvalid(false);
      setReady(true);
    };

    const markInvalid = () => {
      if (active && !recoveryConfirmed) setLinkInvalid(true);
    };

    const code = searchParams.get("code");
    timer = setTimeout(markInvalid, 10000);

    if (code) {
      // PKCE: exchange the one-time code and confirm a real session before
      // allowing a password update.
      void (async () => {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) throw exchangeError;
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session?.user) throw sessionError ?? new Error("Recovery session unavailable");
        markReady();
      })().catch(() => markInvalid());
    } else {
      // Implicit/hash flow: PASSWORD_RECOVERY is the authoritative signal.
      const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "PASSWORD_RECOVERY") {
          if (session?.user) markReady();
          else markInvalid();
        }
      });
      subscription = authSubscription;

      // The auth provider seeds recovery mode from the initial URL. If Supabase
      // has already processed the hash, only accept it once a session exists.
      if (isPasswordRecovery) {
        void supabase.auth.getSession().then(({ data: { session }, error: sessionError }) => {
          if (!sessionError && session?.user) markReady();
        }).catch(() => undefined);
      }
    }

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      subscription?.unsubscribe();
    };
  // The recovery URL is processed once per route visit. Auth events and getSession
  // handle session readiness without re-exchanging a one-time PKCE code.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.user) {
        setReady(false);
        setLinkInvalid(true);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      setSuccess(true);
      toast({ title: "Password updated", description: "Please sign in with your new password." });

      // Tear down the recovery session entirely so the user must log in fresh.
      await supabase.auth.signOut();
      clearPasswordRecovery();
      setTimeout(
        () =>
          navigate("/login", {
            replace: true,
            state: { notice: "Password updated successfully. Please log in." },
          }),
        1200,
      );
    } catch (err: unknown) {
      const providerError = err as { name?: string; code?: string; status?: number };
      Sentry.captureMessage("Password reset update rejected by auth provider", {
        level: "error",
        tags: { flow: "password-reset", provider: "supabase-auth", stage: "update-password" },
        extra: {
          errorName: providerError?.name,
          errorCode: providerError?.code,
          status: providerError?.status,
        },
      });
      const msg = "We couldn't update your password. Your reset link may have expired. Request a new reset link and try again.";
      setError(msg);
      toast({ title: "Password update failed", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="mb-8 text-center">
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground mb-2">Set a new password</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            {ready
              ? "Choose a new password for your account."
              : linkInvalid
                ? "This password reset link is invalid or has expired."
                : "Verifying your reset link..."}
          </p>
        </div>

        {linkInvalid && !ready ? (
          <div className="text-center space-y-4">
            <div className="text-destructive text-sm bg-destructive/10 px-3 py-3 rounded-md">
              Please request a new password reset link.
            </div>
            <Button onClick={() => navigate("/forgot-password")} className="w-full h-11">
              Request a new link
            </Button>
          </div>
        ) : !ready ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : success ? (
          <div className="text-center text-success text-sm bg-success/10 px-3 py-3 rounded-md">
            Password updated. Redirecting to login...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="password" className="block mb-2 text-sm font-medium text-foreground">New password</label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                className="w-full h-11 px-4"
              />
            </div>
            <div>
              <label htmlFor="confirm" className="block mb-2 text-sm font-medium text-foreground">Confirm new password</label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter your new password"
                autoComplete="new-password"
                className="w-full h-11 px-4"
              />
            </div>
            {error && (
              <div className="text-destructive text-sm bg-destructive/10 px-3 py-2 rounded-md">{error}</div>
            )}
            <Button type="submit" disabled={loading} className="w-full h-11 text-base font-medium">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Update password
            </Button>
          </form>
        )}
      </motion.div>
    </div>
  );
};

export default ResetPasswordPage;