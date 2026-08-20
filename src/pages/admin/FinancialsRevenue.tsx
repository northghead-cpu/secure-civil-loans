import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminHero, AdminPageShell, adminCardClass } from "@/components/admin/AdminPageShell";
import { TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Payout = {
  lender: string | null;
  amount_zmw: number | null;
  status: string | null;
  paid_date: string | null;
  created_at: string;
};

const FinancialsRevenue = () => {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const { data, error: queryError } = await supabase
        .from("payouts")
        .select("lender, amount_zmw, status, paid_date, created_at")
        .order("created_at", { ascending: false });
      if (!active) return;
      if (queryError) setError(queryError.message);
      else setPayouts((data ?? []) as Payout[]);
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, []);

  const months = useMemo(() => {
    const now = new Date();
    return [0, 1, 2].map((offset) => {
      const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth();
      const amount = payouts
        .filter((p) => {
          const status = p.status?.toLowerCase();
          if (status && !["paid", "completed", "processed", "success", "successful"].includes(status)) return false;
          const d = new Date(p.paid_date ?? p.created_at);
          return d.getUTCFullYear() === year && d.getUTCMonth() === month;
        })
        .reduce((sum, p) => sum + Number(p.amount_zmw ?? 0), 0);
      return { year, month, label: date.toLocaleString("en-US", { month: "short", timeZone: "UTC" }), amount };
    });
  }, [payouts]);

  const totalRecorded = payouts.reduce((sum, p) => {
    const status = p.status?.toLowerCase();
    return status && !["paid", "completed", "processed", "success", "successful"].includes(status) ? sum : sum + Number(p.amount_zmw ?? 0);
  }, 0);

  return (
    <AdminPageShell>
      <AdminHero
        badge="Financial activity"
        title="Recorded payout activity"
        description="Review recorded lender payout activity. Revenue, commission, and fee accounting are shown only when supported by a transaction ledger."
        stats={months.map((m) => ({ label: `${m.label} ${m.year}`, value: `K${m.amount.toLocaleString()}`, meta: "recorded payouts" }))}
      />

      {loading ? (
        <div className="flex items-center justify-center gap-2 p-10 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading financial activity…</div>
      ) : error ? (
        <Card className={adminCardClass}><CardContent className="p-6 text-sm text-destructive">Unable to load financial activity: {error}</CardContent></Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {months.map((m, index) => {
              const previous = months[index + 1]?.amount ?? 0;
              const trend = m.amount > previous ? "up" : m.amount < previous ? "down" : "flat";
              return (
                <Card key={`${m.year}-${m.month}`} className={adminCardClass}>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">{m.label} {m.year}</p>
                    <div className="text-2xl font-display font-bold text-foreground">K{m.amount.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      {trend === "up" ? <TrendingUp className="h-3 w-3 text-success" /> : trend === "down" ? <TrendingDown className="h-3 w-3 text-destructive" /> : null}
                      {index === months.length - 1 ? "No prior period in view" : trend === "up" ? "Higher than prior month" : trend === "down" ? "Lower than prior month" : "No change"}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className={adminCardClass}>
            <CardHeader><CardTitle className="text-base font-display">Recorded payout total</CardTitle></CardHeader>
            <CardContent>
              <div className="text-3xl font-display font-bold text-foreground">K{totalRecorded.toLocaleString()}</div>
              <p className="text-sm text-muted-foreground mt-1">This is payout activity, not Riverbanc revenue. Revenue streams require a dedicated financial ledger.</p>
            </CardContent>
          </Card>
        </>
      )}
    </AdminPageShell>
  );
};

export default FinancialsRevenue;
