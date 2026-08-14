import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Clock3, FileCheck2, Home, Loader2, MessageSquareText, Send, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface ApplicationHandoff {
  id: string;
  lender_name: string;
  product_name: string | null;
  requested_amount: number | null;
  term_months: number | null;
  interest_rate: number | null;
  estimated_monthly_repayment: number | null;
  total_repayment: number | null;
  status: string;
  created_at: string;
  updated_at: string;
}

const statusOrder = [
  "authorized",
  "preparing",
  "sent_to_lender",
  "lender_review",
  "approved",
];

const statusCopy: Record<string, { label: string; description: string }> = {
  authorized: { label: "Information sharing authorized", description: "Your authorized information is ready to be prepared for the selected financial institution." },
  preparing: { label: "Preparing your application", description: "Riverbanc is preparing your verified information for the selected financial institution." },
  sent_to_lender: { label: "Application sent", description: "Your application information has been sent to the selected financial institution." },
  lender_review: { label: "Application under review", description: "The financial institution is reviewing your application and will make the lending decision." },
  additional_information_requested: { label: "Action required", description: "The financial institution has requested additional information before it can continue its review." },
  approved: { label: "Application approved", description: "The selected financial institution has approved your application." },
  declined: { label: "Application decision", description: "The selected financial institution has declined your application." },
  disbursed: { label: "Loan disbursed", description: "The selected financial institution has reported that the loan has been disbursed." },
};

const ApplicationStatusPage = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [handoff, setHandoff] = useState<ApplicationHandoff | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }

    const fetchHandoff = async () => {
      // application_handoffs was introduced after the generated Supabase types;
      // keep this read narrow until the generated type definitions are refreshed.
      const { data } = await (supabase as any)
        .from("application_handoffs")
        .select("id, lender_name, product_name, requested_amount, term_months, interest_rate, estimated_monthly_repayment, total_repayment, status, created_at, updated_at")
        .eq("user_id", user.id)
        .neq("status", "pending_authorization")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setHandoff(data || null);
      setLoading(false);
    };

    fetchHandoff();

    const channel = supabase
      .channel(`application-handoff-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "application_handoffs", filter: `user_id=eq.${user.id}` }, fetchHandoff)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, authLoading, navigate]);

  const currentIndex = useMemo(() => {
    if (!handoff) return -1;
    if (handoff.status === "additional_information_requested") return 3;
    if (handoff.status === "approved" || handoff.status === "declined" || handoff.status === "disbursed") return 4;
    return Math.max(0, statusOrder.indexOf(handoff.status));
  }, [handoff]);

  if (authLoading || loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }

  if (!user) return null;

  const finalStatus = handoff ? statusCopy[handoff.status] : null;
  const isDecision = Boolean(handoff && ["approved", "declined", "disbursed"].includes(handoff.status));

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 lg:px-8 max-w-4xl space-y-6">
          <header>
            <p className="text-sm font-medium text-primary mb-2">Borrower dashboard</p>
            <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">Your application</h1>
            <p className="text-muted-foreground mt-2">Track your application and see who is responsible for the next step.</p>
          </header>

          {!handoff ? (
            <Card>
              <CardContent className="p-8 text-center">
                <FileCheck2 className="w-10 h-10 mx-auto mb-4 text-muted-foreground" />
                <h2 className="text-xl font-display font-semibold">No active application</h2>
                <p className="text-muted-foreground mt-2">Choose a verified loan offer to begin an application with a participating financial institution.</p>
                <Button className="mt-6" onClick={() => navigate("/compare")}>Compare loan options</Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div>
                      <CardTitle className="text-xl font-display">{handoff.lender_name}</CardTitle>
                      {handoff.product_name && <p className="text-sm text-muted-foreground mt-1">{handoff.product_name}</p>}
                    </div>
                    <Badge variant={isDecision ? "default" : "secondary"}>{finalStatus?.label || "Application in progress"}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    <div><p className="text-muted-foreground">Amount</p><p className="font-semibold">{handoff.requested_amount != null ? `K${Number(handoff.requested_amount).toLocaleString()}` : "—"}</p></div>
                    <div><p className="text-muted-foreground">Term</p><p className="font-semibold">{handoff.term_months != null ? `${handoff.term_months} months` : "—"}</p></div>
                    <div><p className="text-muted-foreground">Interest rate</p><p className="font-semibold">{handoff.interest_rate != null ? `${handoff.interest_rate}%` : "—"}</p></div>
                    <div><p className="text-muted-foreground">Monthly repayment</p><p className="font-semibold">{handoff.estimated_monthly_repayment != null ? `K${Number(handoff.estimated_monthly_repayment).toLocaleString()}` : "—"}</p></div>
                  </div>

                  <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                    <p className="font-medium text-foreground">{finalStatus?.label}</p>
                    <p className="text-sm text-muted-foreground mt-1">{finalStatus?.description}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-lg font-display">Application journey</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-5">
                    {[
                      ["Offer selected", "You've selected this financial institution.", CheckCircle2],
                      ["Information sharing authorized", "You authorized Riverbanc to share the agreed information.", Send],
                      ["Application prepared and sent", "Riverbanc prepares and sends your authorized information.", FileCheck2],
                      ["Financial institution review", "The financial institution reviews your application.", Clock3],
                      ["Decision", "The financial institution makes the lending decision.", isDecision && handoff.status === "declined" ? XCircle : CheckCircle2],
                    ].map(([title, description, Icon], index) => {
                      const complete = index < currentIndex || (index === 4 && isDecision);
                      const active = index === currentIndex && !isDecision;
                      return (
                        <div key={String(title)} className="flex items-start gap-3">
                          <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${complete ? "border-primary bg-primary/10 text-primary" : active ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <p className={`font-medium ${active ? "text-primary" : "text-foreground"}`}>{String(title)}</p>
                            <p className="text-sm text-muted-foreground">{String(description)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {handoff.status === "additional_information_requested" && (
                <Card className="border-warning/40">
                  <CardContent className="p-5 flex items-start gap-3">
                    <MessageSquareText className="w-5 h-5 text-warning mt-0.5 shrink-0" />
                    <div><p className="font-medium">Action required</p><p className="text-sm text-muted-foreground mt-1">The financial institution has requested additional information. Review the request before continuing.</p></div>
                  </CardContent>
                </Card>
              )}

              <p className="text-xs text-muted-foreground text-center">Riverbanc coordinates the application handoff and status information. The selected financial institution makes the lending decision.</p>
            </>
          )}

          <Button variant="outline" onClick={() => navigate("/profile")}><Home className="w-4 h-4 mr-2" /> Back to dashboard</Button>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ApplicationStatusPage;
