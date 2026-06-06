import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

const ResetPasswordPage = () => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Supabase delivers a recovery session via the URL hash. The client
    // parses it automatically and emits a PASSWORD_RECOVERY event.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });

    // Also check existing session for users who land here already signed in
    // via the recovery link.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

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
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      setSuccess(true);
      toast({ title: "Password updated", description: "You can now sign in with your new password." });

      // Sign out the recovery session so the user must log in fresh.
      await supabase.auth.signOut();
      setTimeout(() => navigate("/login"), 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update password";
      setError(msg);
      toast({ title: "Error", description: msg, variant: "destructive" });
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
              : "Verifying your reset link..."}
          </p>
        </div>

        {!ready ? (
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
              <label htmlFor="confirm" className="block mb-2 text-sm font-medium text-foreground">Confirm password</label>
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
