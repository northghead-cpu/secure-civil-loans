import { ReactNode, useEffect, useState } from "react";
import { Check, Copy, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRBAC } from "@/hooks/useRBAC";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const PRIVILEGED_ROLES = new Set(["super_admin", "admin", "super_user", "compliance_team", "data_entry_team"]);

export default function AdminMfaGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { roles, loading: rolesLoading } = useRBAC();
  const [loading, setLoading] = useState(true);
  const [needsEnrollment, setNeedsEnrollment] = useState(false);
  const [factorId, setFactorId] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [setupKey, setSetupKey] = useState("");
  const [copiedSetupKey, setCopiedSetupKey] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const privileged = roles.some((role) => PRIVILEGED_ROLES.has(role));

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (!user || rolesLoading || !privileged) {
        if (!cancelled) setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      const { data, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalError) {
        if (!cancelled) { setError("Unable to verify administrator MFA status."); setLoading(false); }
        return;
      }

      if (data.currentLevel === "aal2") {
        if (!cancelled) setLoading(false);
        return;
      }

      const { data: factors, error: factorError } = await supabase.auth.mfa.listFactors();
      if (factorError) {
        if (!cancelled) { setError("Unable to load administrator MFA factors."); setLoading(false); }
        return;
      }

      const verifiedTotp = factors.totp.find((factor) => factor.status === "verified");
      if (verifiedTotp) {
        if (!cancelled) setFactorId(verifiedTotp.id);
        const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: verifiedTotp.id });
        if (challengeError || !challenge) {
          if (!cancelled) {
            setError("Unable to start the administrator MFA challenge. Retry with a fresh code.");
            setLoading(false);
          }
          return;
        }
        if (!cancelled) {
          setChallengeId(challenge.id);
          setLoading(false);
        }
        return;
      }

      const pendingFactor = factors.totp.find((factor) => factor.status !== "verified");
      if (pendingFactor) {
        const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: pendingFactor.id });
        if (unenrollError) {
          if (!cancelled) {
            setError("An unfinished MFA setup could not be reset. Retry, or contact the system administrator.");
            setLoading(false);
          }
          return;
        }
      }

      const { data: enrollment, error: enrollmentError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Riverbanc Administrator",
      });
      if (enrollmentError || !enrollment) {
        if (!cancelled) {
          setError("Unable to start administrator MFA enrollment. Retry to start a fresh setup.");
          setLoading(false);
        }
        return;
      }
      if (!cancelled) {
        setFactorId(enrollment.id);
        setQrCode(enrollment.totp.qr_code);
        setSetupKey(enrollment.totp.secret);
        setNeedsEnrollment(true);
        setLoading(false);
      }
    };

    void check().catch(() => {
      if (!cancelled) {
        setError("MFA setup could not reach the authentication service. Retry when the connection is available.");
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [user, rolesLoading, privileged, retryCount]);

  const retryMfaSetup = () => {
    setError("");
    setLoading(true);
    setFactorId("");
    setChallengeId("");
    setNeedsEnrollment(false);
    setQrCode("");
    setSetupKey("");
    setCopiedSetupKey(false);
    setRetryCount((count) => count + 1);
  };

  const verify = async () => {
    setError("");
    if (!factorId || !code.match(/^\d{6}$/)) {
      setError("Enter the 6-digit authenticator code.");
      return;
    }

    let activeChallengeId = challengeId;
    try {
      if (!activeChallengeId) {
        const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
        if (challengeError || !challenge) {
          setError("Unable to start the MFA challenge. Retry to request a fresh challenge.");
          setChallengeId("");
          return;
        }
        activeChallengeId = challenge.id;
        setChallengeId(challenge.id);
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: activeChallengeId,
        code,
      });

      if (verifyError) {
        setError("Authenticator code was not accepted. Check your device time and retry with the current code.");
        setChallengeId("");
        return;
      }

      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        setError("MFA was verified, but the session could not be refreshed. Retry verification before continuing.");
        setChallengeId("");
        return;
      }
    } catch {
      setError("MFA verification could not be completed because of a network or session error. Retry.");
      setChallengeId("");
      return;
    }
    setCode("");
    setNeedsEnrollment(false);
    setQrCode("");
    setSetupKey("");
    setCopiedSetupKey(false);
    setChallengeId("");
    setFactorId("");
    setLoading(true);
    try {
      const { data, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalError || data.currentLevel !== "aal2") {
        setError("MFA verification did not establish AAL2. Access remains blocked; retry verification.");
        setLoading(false);
        return;
      }
      setError("");
      setLoading(false);
    } catch {
      setError("MFA was verified, but the assurance level could not be confirmed. Access remains blocked; retry.");
      setLoading(false);
    }
  };

  if (!privileged) return <>{children}</>;
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  if (needsEnrollment || error || factorId) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Administrator MFA required</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {needsEnrollment ? (
              <>
                <p className="text-sm text-muted-foreground">Set up an authenticator app before accessing privileged Riverbanc functions.</p>
                {qrCode && <img src={qrCode} alt="Riverbanc administrator MFA QR code" className="mx-auto h-48 w-48" />}
                {setupKey && (
                  <section className="space-y-2 rounded-md border p-3" aria-label="Manual authenticator setup">
                    <p className="text-sm font-medium">Can't scan the QR code?</p>
                    <p className="text-xs text-muted-foreground">In your authenticator app, choose to enter a setup key manually. Keep this key private.</p>
                    <div className="flex items-center gap-2">
                      <code className="min-w-0 flex-1 break-all rounded bg-muted p-2 text-sm select-all">{setupKey}</code>
                      <Button type="button" variant="outline" size="icon" aria-label="Copy MFA setup key" onClick={async () => {
                        try { await navigator.clipboard.writeText(setupKey); setCopiedSetupKey(true); }
                        catch { setError("Copy is unavailable in this browser. Select the setup key and copy it manually."); }
                      }}>
                        {copiedSetupKey ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    {copiedSetupKey && <p className="text-xs text-muted-foreground">Setup key copied. Store it only in your authenticator app.</p>}
                  </section>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Enter the current code from your authenticator app.</p>
            )}
            <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" />
            {error && <p className="text-sm text-destructive">{error}</p>}
            {error && !factorId && (
              <Button type="button" variant="outline" className="w-full" onClick={retryMfaSetup}>
                Retry MFA setup
              </Button>
            )}
            <Button className="w-full" onClick={verify} disabled={code.length !== 6 || !factorId}>Verify MFA</Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return <>{children}</>;
}
