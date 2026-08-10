import { useState } from "react";
import * as Sentry from "@sentry/react";
import { Button } from "@/components/ui/button";
import { isSentryEnabled } from "@/lib/sentry";

/**
 * DEVELOPMENT / TEST ONLY.
 *
 * Verifies the Sentry pipeline end to end (delivery + redaction). It is
 * rendered only from a `!import.meta.env.PROD` guard in App.tsx and the
 * import is dynamic, so this module is never bundled into a production
 * build. Never link to it from a route or the navigation.
 *
 * The payloads below deliberately contain fake regulated-looking values
 * (NRC, salary, JWT, email) so you can confirm in the Sentry UI that they
 * arrive as "[redacted]".
 */
const SentryTestPanel = () => {
  const [sent, setSent] = useState<string | null>(null);

  if (import.meta.env.PROD) return null;

  const throwRenderError = () => {
    throw new Error("Riverbanc Sentry test: unhandled render error");
  };

  const captureScrubbedError = () => {
    Sentry.captureException(
      new Error("Riverbanc Sentry test: nrc 123456/78/1 leaked into message"),
      {
        extra: {
          nrc_number: "123456/78/1",
          employee_number: "EMP-00123",
          salary: 18500,
          kyc_status: "VERIFIED",
          access_token: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.signature-part",
          contact: "test.person@example.com",
          safe_context: "checkout-step-2",
        },
      },
    );
    setSent("Captured. All sensitive fields above must show as [redacted].");
  };

  return (
    <div className="fixed bottom-4 right-4 z-[9999] w-72 rounded-lg border border-border bg-card p-4 shadow-lg">
      <p className="mb-1 text-sm font-semibold text-foreground">Sentry test (dev only)</p>
      <p className="mb-3 text-xs text-muted-foreground">
        DSN {isSentryEnabled() ? "configured" : "missing — events are dropped locally"}
      </p>
      <div className="flex flex-col gap-2">
        <Button size="sm" variant="outline" onClick={captureScrubbedError}>
          Send scrubbed test error
        </Button>
        <Button size="sm" variant="destructive" onClick={throwRenderError}>
          Throw unhandled error
        </Button>
      </div>
      {sent && <p className="mt-3 text-xs text-muted-foreground">{sent}</p>}
    </div>
  );
};

export default SentryTestPanel;
