import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Payout = {
  lender: string | null;
  amount_zmw: number | null;
  period: string | null;
  status: string | null;
  paid_date: string | null;
  created_at: string;
};

type LenderMetric = {
  lender: string;
  disbursed: number;
  totalValue: number;
  trend: "up" | "down" | "flat";
};

const LendersPerformance = () => {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      const { data, error: queryError } = await supabase
        .from("payouts")
        .select("lender, amount_zmw, period, status, paid_date, created_at")
        .order("created_at", { ascending: false });

      if (!active) return;
      if (queryError) {
        setError(queryError.message);
      } else {
        setPayouts((data ?? []) as Payout[]);
      }
      setLoading(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  const metrics = useMemo<LenderMetric[]>(() => {
    const grouped = new Map<string, { current: number; previous: number; count: number }>();
    const now = new Date();
    const currentMonth = now.getUTCMonth();
    const currentYear = now.getUTCFullYear();
    const previousDate = new Date(Date.UTC(currentYear, currentMonth - 1, 1));
    const previousMonth = previousDate.getUTCMonth();
    const previousYear = previousDate.getUTCFullYear();

    for (const payout of payouts) {
      if (payout.status && !["paid", "completed", "processed", "success", "successful"].includes(payout.status.toLowerCase())) continue;
      const lender = payout.lender?.trim() || "Unassigned lender";
      const amount = Number(payout.amount_zmw ?? 0);
      const dateValue = payout.paid_date ?? payout.created_at;
      const date = new Date(dateValue);
      const bucket = grouped.get(lender) ?? { current: 0, previous: 0, count: 0 };
      bucket.count += 1;
      if (date.getUTCFullYear() === currentYear && date.getUTCMonth() === currentMonth) bucket.current += amount;
      if (date.getUTCFullYear() === previousYear && date.getUTCMonth() === previousMonth) bucket.previous += amount;
      grouped.set(lender, bucket);
    }

    return [...grouped.entries()]
      .map(([lender, value]) => ({
        lender,
        disbursed: value.count,
        totalValue: payouts
          .filter((p) => (p.lender?.trim() || "Unassigned lender") === lender && (!p.status || ["paid", "completed", "processed", "success", "successful"].includes(p.status.toLowerCase())))
          .reduce((sum, p) => sum + Number(p.amount_zmw ?? 0), 0),
        trend: value.current > value.previous ? "up" : value.current < value.previous ? "down" : "flat",
      }))
      .sort((a, b) => b.totalValue - a.totalValue);
  }, [payouts]);

  const totalDisbursed = metrics.reduce((sum, metric) => sum + metric.disbursed, 0);
  const totalValue = metrics.reduce((sum, metric) => sum + metric.totalValue, 0);

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Lender Performance</h1>
        <p className="text-sm text-muted-foreground">Track lender metrics and KPIs from recorded payout activity</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><div className="text-xl sm:text-2xl font-display font-bold text-foreground">{totalDisbursed.toLocaleString()}</div><p className="text-xs sm:text-sm text-muted-foreground">Recorded Disbursements</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xl sm:text-2xl font-display font-bold text-foreground">K{totalValue.toLocaleString()}</div><p className="text-xs sm:text-sm text-muted-foreground">Recorded Value</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xl sm:text-2xl font-display font-bold text-foreground">—</div><p className="text-xs sm:text-sm text-muted-foreground">Avg Processing</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xl sm:text-2xl font-display font-bold text-foreground">—</div><p className="text-xs sm:text-sm text-muted-foreground">Default Rate</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading lender performance…</div>
          ) : error ? (
            <div className="p-10 text-sm text-destructive">Unable to load lender performance: {error}</div>
          ) : metrics.length === 0 ? (
            <div className="p-10 text-sm text-muted-foreground">No recorded payout activity is available yet.</div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Lender</TableHead><TableHead>Disbursed</TableHead><TableHead>Total Value</TableHead><TableHead>Avg Processing</TableHead><TableHead>Default Rate</TableHead><TableHead>Trend</TableHead></TableRow></TableHeader>
              <TableBody>
                {metrics.map((metric) => (
                  <TableRow key={metric.lender}>
                    <TableCell className="font-medium">{metric.lender}</TableCell>
                    <TableCell>{metric.disbursed}</TableCell>
                    <TableCell>K{metric.totalValue.toLocaleString()}</TableCell>
                    <TableCell>—</TableCell>
                    <TableCell>—</TableCell>
                    <TableCell>{metric.trend === "up" ? <TrendingUp className="h-4 w-4 text-success" /> : metric.trend === "down" ? <TrendingDown className="h-4 w-4 text-destructive" /> : <span className="text-muted-foreground">—</span>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LendersPerformance;
