import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Capture the callback before the Supabase client consumes the fragment.
const inviteParams = typeof window === "undefined"
  ? null
  : new URLSearchParams(window.location.hash.slice(1));
// Supabase can return a failed email-link callback without type=invite.
const expiredEmailLink = inviteParams?.get("error_code") === "otp_expired";

function ExpiredEmailLink() {
  useEffect(() => {
    window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <section className="w-full max-w-md space-y-4">
        <h1 className="text-2xl font-display font-bold">This email link can’t be used</h1>
        <p role="alert">
          The link may have expired or already been used. If you already have a password, sign in.
          If you still need to set one, request a password reset or contact Riverbanc for a new invitation.
        </p>
        <div className="flex flex-wrap gap-4">
          <a className="text-primary underline" href="/login">Go to sign in</a>
          <a className="text-primary underline" href="/forgot-password">Request a password reset</a>
        </div>
      </section>
    </main>
  );
}

const inviteCallback = inviteParams?.get("type") === "invite";
const inviteAccessToken = inviteCallback ? inviteParams?.get("access_token") : null;

const inviteTokenHash = typeof window !== "undefined" && window.location.pathname === "/login" && inviteCallback
  ? inviteParams?.get("token_hash")
  : null;

function InvitationSetup() {
  const [status, setStatus] = useState<"confirm" | "checking" | "ready" | "invalid" | "complete">(inviteTokenHash ? "confirm" : "checking");
  const [verifiedAccessToken, setVerifiedAccessToken] = useState(inviteAccessToken);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (inviteTokenHash) return;
    let active = true;
    const timer = window.setTimeout(() => {
      if (active) setStatus((current) => current === "checking" ? "invalid" : current);
    }, 10000);

    void (async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (!active) return;

      if (new URLSearchParams(window.location.hash.slice(1)).get("type") === "invite") {
        window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
      }

      const matchesInvite = Boolean(inviteAccessToken && session?.access_token === inviteAccessToken);
      setStatus(!sessionError && matchesInvite ? "ready" : "invalid");
    })().catch(() => {
      if (active) setStatus("invalid");
    }).finally(() => window.clearTimeout(timer));

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);

  async function acceptInvitation() {
    if (!inviteTokenHash || status !== "confirm") return;
    setStatus("checking");
    setError("");
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error: verificationError } = await supabase.auth.verifyOtp({
        token_hash: inviteTokenHash,
        type: "invite",
      });
      window.history.replaceState(window.history.state, "", "/login");
      if (verificationError || !data.session) {
        setStatus("invalid");
        return;
      }
      setVerifiedAccessToken(data.session.access_token);
      setStatus("ready");
    } catch {
      setStatus("confirm");
      setError("We couldn’t check your invitation. Try again.");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status !== "ready" || submitting) return;
    if (password.length < 8 || password !== confirmation) {
      setError("Use at least 8 characters and make sure both passwords match.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !verifiedAccessToken || session?.access_token !== verifiedAccessToken) {
        setStatus("invalid");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      setPassword("");
      setConfirmation("");
      setStatus("complete");
    } catch {
      setError("We couldn’t set your password. Try again or contact Riverbanc support.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <section className="w-full max-w-md space-y-4">
        <h1 className="text-2xl font-display font-bold">Set up your Riverbanc account</h1>
        {status === "confirm" && (
          <>
            <p>Accept your invitation to set up your Marketplace sign-in.</p>
            {error && <p role="alert" className="text-destructive">{error}</p>}
            <Button type="button" onClick={() => void acceptInvitation()}>Accept invitation</Button>
          </>
        )}
        {status === "checking" && <p role="status">Checking your invitation…</p>}
        {status === "invalid" && (
          <p role="alert">This invitation is invalid, expired, or already used. Contact Riverbanc support for help signing in.</p>
        )}
        {status === "ready" && (
          <form onSubmit={submit} className="space-y-4">
            <label className="block space-y-1">
              <span>New password</span>
              <Input type="password" autoComplete="new-password" minLength={8} required value={password}
                onChange={(event) => setPassword(event.target.value)} />
            </label>
            <label className="block space-y-1">
              <span>Confirm password</span>
              <Input type="password" autoComplete="new-password" minLength={8} required value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)} />
            </label>
            {error && <p role="alert" className="text-destructive">{error}</p>}
            <Button type="submit" disabled={submitting}>{submitting ? "Saving…" : "Set password"}</Button>
          </form>
        )}
        {status === "complete" && (
          <>
            <p role="status">Your password is set.</p>
            <a className="text-primary underline" href="/">Continue to Marketplace</a>
          </>
        )}
        {status === "invalid" && <a className="text-primary underline" href="/login">Go to sign in</a>}
      </section>
    </main>
  );
}

export default function InvitationGate({ children }: { children: ReactNode }) {
  if (expiredEmailLink) return <ExpiredEmailLink />;
  return inviteCallback ? <InvitationSetup /> : <>{children}</>;
}
