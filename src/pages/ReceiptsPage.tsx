import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { FileText, Loader2, Printer, ReceiptText } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { receiptService, type PaymentReceipt } from "@/services/receiptService";

const ReceiptsPage = () => {
  const { user, loading: authLoading } = useAuth();
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await receiptService.listMine();
        if (!cancelled) setReceipts(data);
      } catch {
        if (!cancelled) setError("We couldn't load your payment receipts. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [authLoading, user]);

  if (authLoading || (user && loading)) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  if (!user) return <div className="min-h-screen bg-background"><Navbar /><main className="pt-24 pb-16"><div className="container mx-auto px-4 max-w-3xl"><Card><CardContent className="p-8 text-center"><ReceiptText className="w-10 h-10 mx-auto mb-4 text-muted-foreground" /><p className="text-muted-foreground">Please sign in to view your receipts.</p></CardContent></Card></div></main><Footer /></div>;

  return <div className="min-h-screen bg-background"><Helmet><title>Payment Receipts — Riverbanc</title></Helmet><Navbar /><main className="pt-24 pb-16"><div className="container mx-auto px-4 lg:px-8 max-w-4xl space-y-6"><div><p className="text-sm font-medium text-primary mb-2">Account</p><h1 className="text-3xl font-display font-bold text-foreground">Payment Receipts</h1><p className="text-muted-foreground mt-2">Your monthly Riverbanc subscription receipts are recorded here.</p></div>{error ? <Card><CardContent className="p-8 text-center text-sm text-destructive">{error}</CardContent></Card> : receipts.length === 0 ? <Card><CardContent className="p-10 text-center"><ReceiptText className="w-10 h-10 mx-auto mb-4 text-muted-foreground" /><h2 className="text-xl font-display font-semibold">No receipts yet</h2><p className="text-sm text-muted-foreground mt-2">A receipt will appear here when a confirmed monthly payroll payment has been receipted.</p></CardContent></Card> : <div className="space-y-4">{receipts.map((receipt) => <Card key={receipt.id} className="overflow-hidden print:shadow-none"><CardHeader className="border-b border-border/60"><div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><div><CardTitle className="font-display">{receipt.receipt_number}</CardTitle><p className="text-sm text-muted-foreground mt-1">Issued {new Date(receipt.issued_at).toLocaleString()}</p></div><Badge variant="secondary">{receipt.payment_method === "payroll" ? "Payroll" : receipt.payment_method}</Badge></div></CardHeader><CardContent className="p-6"><div className="grid sm:grid-cols-2 gap-x-8 gap-y-4 text-sm"><div><p className="text-muted-foreground">Billing period</p><p className="font-medium mt-1">{receipt.billing_period_start} to {receipt.billing_period_end}</p></div><div><p className="text-muted-foreground">Amount</p><p className="font-display text-lg font-semibold mt-1">{receipt.currency} {Number(receipt.amount).toFixed(2)}</p></div><div><p className="text-muted-foreground">Payroll reference</p><p className="font-mono text-xs mt-1 break-all">{receipt.payroll_reference}</p></div><div><p className="text-muted-foreground">Email delivery</p><p className="font-medium mt-1">{receipt.email_delivery_status ?? "Not recorded"}</p></div></div><div className="mt-6 flex justify-end print:hidden"><Button variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4 mr-2" /> Print receipt</Button></div></CardContent></Card>)}</div>}<p className="text-xs text-muted-foreground text-center">Receipts are retrieved from your authenticated Riverbanc account. They are not shared with other account holders.</p></div></main><Footer /></div>;
};

export default ReceiptsPage;
