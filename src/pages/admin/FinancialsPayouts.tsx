import { readAllRows } from "@/lib/readAllRows";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRBAC } from "@/hooks/useRBAC";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Payout {
  id: string;
  lender: string;
  amount_zmw: number;
  period: string;
  status: string;
  paid_date: string | null;
  created_at: string;
}

const formatK = (n: number) =>
  `K${n.toLocaleString("en-ZM", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const statusColors: Record<string, string> = {
  paid: "bg-success/10 text-success",
  pending: "bg-warning/10 text-warning",
  processing: "bg-info/10 text-info",
};

const FinancialsPayouts = () => {
  const { hasRole, logAction } = useRBAC();
  const { user } = useAuth();
  const isSuperAdmin = hasRole("super_admin");

  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const fetchPayouts = useCallback(async () => {
    try {
      const rows = await readAllRows((from,to) => supabase.from("payouts").select("*").order("created_at",{ascending:false}).order("id").range(from,to));
      setPayouts(rows as Payout[]); setLoadError(false);
    } catch { setLoadError(true); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchPayouts();

    const channel = supabase
      .channel("payouts_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payouts" },
        () => {
          fetchPayouts();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPayouts]);

  const totalThisMonth = payouts
    .filter((p) => {
      const date = new Date(p.created_at);
      const now = new Date();
      return (
        date.getUTCFullYear() === now.getUTCFullYear() &&
        date.getUTCMonth() === now.getUTCMonth()
      );
    })
    .reduce((s, p) => s + Number(p.amount_zmw), 0);
  const paidOut = payouts
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + Number(p.amount_zmw), 0);
  const outstanding = payouts
    .filter((p) => p.status !== "paid")
    .reduce((s, p) => s + Number(p.amount_zmw), 0);

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">
            Payouts
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage lender commission payouts
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          Read-only commission register. Payments are settled outside this
          platform; no transfer service is connected.
        </p>
      </div>

      {loadError && (
        <p role="alert">
          Payouts could not load.{" "}
          <Button
            onClick={() => {
              setLoading(true);
              void fetchPayouts();
            }}
          >
            Try again
          </Button>
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-display font-bold text-foreground">
              {loadError
                ? "Unavailable"
                : loading
                  ? "..."
                  : formatK(totalThisMonth)}
            </div>
            <p className="text-sm text-muted-foreground">Total This Month</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-display font-bold text-success">
              {loadError ? "Unavailable" : loading ? "..." : formatK(paidOut)}
            </div>
            <p className="text-sm text-muted-foreground">Paid Out</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-display font-bold text-warning">
              {loadError
                ? "Unavailable"
                : loading
                  ? "..."
                  : formatK(outstanding)}
            </div>
            <p className="text-sm text-muted-foreground">Outstanding</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {loadError ? (
            <p role="alert" className="p-6">
              Payout data unavailable.
            </p>
          ) : loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lender</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead className="hidden md:table-cell">Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">
                    Paid Date
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No payouts yet
                    </TableCell>
                  </TableRow>
                ) : (
                  payouts.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.lender}</TableCell>
                      <TableCell className="font-medium">
                        {formatK(Number(p.amount_zmw))}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {p.period}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            statusColors[p.status] ||
                            "bg-muted text-muted-foreground"
                          }
                        >
                          {p.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">
                        {p.paid_date || "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FinancialsPayouts;
