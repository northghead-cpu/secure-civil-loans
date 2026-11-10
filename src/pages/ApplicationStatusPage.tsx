import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { untypedDb } from "@/integrations/supabase/untyped";
import { supabase } from "@/integrations/supabase/client";
import { readAllRows } from "@/lib/readAllRows";
import { handoffProgress, handoffStatusLabel } from "@/lib/handoffProgress";
import { toast } from "sonner";
type Handoff = {
  id: string;
  lender_name: string;
  requested_amount: number | null;
  term_months: number | null;
  estimated_monthly_repayment: number | null;
  status: string;
  information_request: string | null;
  delivery_reference: string | null;
  updated_at: string;
};
export default function ApplicationStatusPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [handoffs, setHandoffs] = useState<Handoff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!user) return;
    let active = true;
    const load = async () => {
      try {
        const rows = await readAllRows<Handoff>((from, to) =>
          untypedDb
            .from("application_handoffs")
            .select(
              "id,lender_name,requested_amount,term_months,estimated_monthly_repayment,status,information_request,delivery_reference,updated_at",
            )
            .eq("user_id", user.id)
            .neq("status", "pending_authorization")
            .order("updated_at", { ascending: false })
            .order("id")
            .range(from, to),
        );
        if (active) {
          setHandoffs(rows);
          setError(false);
        }
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    };
    setLoading(true);
    void load();
    const channel = supabase
      .channel(`handoff-tracking-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "application_handoffs",
          filter: `user_id=eq.${user.id}`,
        },
        () => void load(),
      )
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [user, attempt]);
  const id = params.get("id");
  const current = id ? handoffs.find((h) => h.id === id) : handoffs[0];
  const progress = handoffProgress(current?.status || "");

  return (
    <>
      <Navbar />
      <main className="container mx-auto max-w-3xl px-4 pt-24 pb-12 space-y-5">
        <h1 className="text-3xl font-semibold">Your applications</h1>
        {error ? (
          <div role="alert">
            <p>Application status could not load.</p>
            <Button onClick={() => setAttempt((v) => v + 1)}>Try again</Button>
          </div>
        ) : loading ? (
          <p role="status">Loading applications…</p>
        ) : (
          <>
            {handoffs.length > 0 && (
              <div>
                <label htmlFor="handoff-select">Choose an application</label>
                <select
                  id="handoff-select"
                  className="mt-2 w-full rounded border bg-background p-3"
                  value={current?.id || ""}
                  onChange={(e) => setParams({ id: e.target.value })}
                >
                  {!current && <option value="">Select an application</option>}
                  {handoffs.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.lender_name} · {h.id.slice(0, 8)} ·{" "}
                      {handoffStatusLabel(h.status)}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {current ? (
              <>
                <Card>
                  <CardContent className="p-5 space-y-3">
                    <h2 className="text-xl font-semibold">
                      {current.lender_name}
                    </h2>
                    <p>{handoffStatusLabel(current.status)}</p>
                    <p>
                      Requested: K
                      {current.requested_amount?.toLocaleString() || "—"} ·{" "}
                      {current.term_months} months
                    </p>
                    <p>
                      Monthly estimate:{" "}
                      {current.estimated_monthly_repayment == null
                        ? "Not recorded"
                        : `K${Number(current.estimated_monthly_repayment).toLocaleString()}`}
                    </p>
                    {current.delivery_reference && (
                      <p>Delivery reference: {current.delivery_reference}</p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      Updated {new Date(current.updated_at).toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
                <ol className="space-y-3">
                  {[
                    "Offer selected",
                    "Information sharing authorized",
                    "Application prepared and sent",
                    "Financial institution review",
                    "Decision",
                  ].map((label, index) => (
                    <li
                      key={label}
                      className="rounded border p-3"
                      aria-current={
                        progress.current === index ? "step" : undefined
                      }
                    >
                      {index < progress.completed
                        ? "✓ "
                        : progress.current === index
                          ? "→ "
                          : "○ "}
                      {label}
                    </li>
                  ))}
                </ol>
                {current.status === "additional_information_requested" && (
                  <Card>
                    <CardContent className="p-5 space-y-3">
                      <h2 className="font-semibold">
                        Additional information requested
                      </h2>
                      <p className="whitespace-pre-wrap">
                        {current.information_request ||
                          "The institution has requested more information. Contact Riverbanc support to obtain the exact request before sending documents."}
                      </p>
                      <p className="text-sm">
                        Quote application {current.id}. Use support to arrange a
                        secure response; do not send identity documents in chat.
                      </p>
                      <Button asChild>
                        <Link to={`/support?application=${current.id}`}>
                          Review request with support
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card>
                <CardContent className="p-6">
                  <p>
                    {id
                      ? "This application is unavailable to this account. Choose another application above."
                      : "No active application. Choose a loan offer to start a handoff."}
                  </p>
                  <Button asChild className="mt-3">
                    <Link to="/compare">Compare loan options</Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}
        <Button variant="outline" asChild>
          <Link to="/profile">Back to dashboard</Link>
        </Button>
        <p className="text-xs text-muted-foreground">
          Riverbanc coordinates the handoff. Only the selected institution makes
          lending decisions.
        </p>
      </main>
      <Footer />
    </>
  );
}
