import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Calculator, TrendingUp } from "lucide-react";

const formatZMW = (amount: number | null) => {
  if (amount == null) return "—";
  return `K ${Number(amount).toLocaleString("en-ZM", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

interface QueueRecord {
  id: string;
  zmw_client_id: string;
  income_zmw: number;
  debt_zmw: number;
  score_result: number | null;
  status: string;
  created_at: string;
}

interface LoanResult {
  id: string;
  zmw_client_id: string;
  max_limit_zmw: number | null;
  interest_rate: number | null;
  created_at: string;
}

const UnderwritingPage = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [clientId, setClientId] = useState("");
  const [income, setIncome] = useState("");
  const [debt, setDebt] = useState("");
  const [processing, setProcessing] = useState(false);
  const [queue, setQueue] = useState<QueueRecord[]>([]);
  const [results, setResults] = useState<LoanResult[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  const fetchData = useCallback(async () => {
    setLoadingData(true);
    const [qRes, lRes] = await Promise.all([
      supabase.from("underwriting_queue").select("*").order("created_at", { ascending: false }),
      supabase.from("loan_results").select("*").order("created_at", { ascending: false }),
    ]);
    if (qRes.data) setQueue(qRes.data as QueueRecord[]);
    if (lRes.data) setResults(lRes.data as LoanResult[]);
    setLoadingData(false);
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
      return;
    }
    if (user) {
      // Check if user has admin or super_admin role
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .then(({ data }) => {
          const roles = (data || []).map((r: { role: string }) => r.role);
          const hasAdminRole = roles.some((r: string) => ["admin", "super_admin"].includes(r));
          setIsAdmin(hasAdminRole);
          if (!hasAdminRole) {
            navigate("/");
          } else {
            fetchData();
          }
        });
    }
  }, [user, authLoading, navigate, fetchData]);

  const handleSubmit = async () => {
    if (!clientId.trim()) {
      toast({ title: "Client UUID required", variant: "destructive" });
      return;
    }
    const incomeVal = parseFloat(income);
    const debtVal = parseFloat(debt);
    if (isNaN(incomeVal) || incomeVal < 0) {
      toast({ title: "Enter a valid income amount", variant: "destructive" });
      return;
    }
    if (isNaN(debtVal) || debtVal < 0) {
      toast({ title: "Enter a valid debt amount", variant: "destructive" });
      return;
    }

    setProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Not authenticated", variant: "destructive" });
        return;
      }

      const res = await supabase.functions.invoke("process-loan", {
        body: { zmw_client_id: clientId.trim(), income_zmw: incomeVal, debt_zmw: debtVal },
      });

      if (res.error) throw new Error(res.error.message);

      const data = res.data;
      toast({
        title: "Scoring Complete",
        description: `Score: ${data.score} | Max Limit: ${formatZMW(data.max_limit_zmw)} | Rate: ${data.interest_rate}%`,
      });

      await fetchData();
      setClientId("");
      setIncome("");
      setDebt("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  if (authLoading || isAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const getScoreBadge = (score: number | null) => {
    if (score == null) return <Badge variant="secondary">Pending</Badge>;
    if (score >= 600) return <Badge className="bg-green-600 text-white">{score}</Badge>;
    if (score >= 400) return <Badge className="bg-yellow-500 text-white">{score}</Badge>;
    return <Badge variant="destructive">{score}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    if (status === "completed") return <Badge className="bg-green-600 text-white">Completed</Badge>;
    if (status === "processing") return <Badge className="bg-blue-500 text-white">Processing</Badge>;
    return <Badge variant="secondary">{status}</Badge>;
  };

  // Merge queue with results for the dashboard
  const mergedRecords = queue.map((q) => {
    const result = results.find((r) => r.zmw_client_id === q.zmw_client_id);
    return { ...q, max_limit_zmw: result?.max_limit_zmw ?? null, interest_rate: result?.interest_rate ?? null };
  });

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-8 space-y-8">
        <div className="flex items-center gap-3">
          <Calculator className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">ZMW Underwriting</h1>
            <p className="text-muted-foreground">Score clients and determine loan limits in Zambian Kwacha</p>
          </div>
        </div>

        {/* Input Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">New Underwriting Request</CardTitle>
            <CardDescription>Enter the anonymized client UUID and financial details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="clientId">Client UUID</Label>
                <Input
                  id="clientId"
                  placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="income">Monthly Income (ZMW)</Label>
                <Input
                  id="income"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 8500.00"
                  value={income}
                  onChange={(e) => setIncome(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="debt">Total Debt (ZMW)</Label>
                <Input
                  id="debt"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 2000.00"
                  value={debt}
                  onChange={(e) => setDebt(e.target.value)}
                />
              </div>
            </div>
            <Button onClick={handleSubmit} disabled={processing} className="mt-4">
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Sync & Score
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Results Dashboard */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Underwriting Results</CardTitle>
            <CardDescription>All scored clients with loan limits in ZMW</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingData ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : mergedRecords.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No underwriting records yet. Submit a request above.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client UUID</TableHead>
                      <TableHead className="text-right">Income</TableHead>
                      <TableHead className="text-right">Debt</TableHead>
                      <TableHead className="text-center">Score</TableHead>
                      <TableHead className="text-right">Max Limit</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mergedRecords.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">{r.zmw_client_id.slice(0, 8)}…</TableCell>
                        <TableCell className="text-right">{formatZMW(r.income_zmw)}</TableCell>
                        <TableCell className="text-right">{formatZMW(r.debt_zmw)}</TableCell>
                        <TableCell className="text-center">{getScoreBadge(r.score_result)}</TableCell>
                        <TableCell className="text-right">{formatZMW(r.max_limit_zmw)}</TableCell>
                        <TableCell className="text-right">{r.interest_rate != null ? `${r.interest_rate}%` : "—"}</TableCell>
                        <TableCell className="text-center">{getStatusBadge(r.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default UnderwritingPage;
