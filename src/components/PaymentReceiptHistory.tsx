import { useEffect, useState } from 'react';
import { Download, Eye, FileText, Loader2, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface Receipt {
  id: string;
  receipt_number: string;
  amount: number;
  currency: 'ZMW';
  billing_period_start: string;
  billing_period_end: string;
  payment_method: 'payroll';
  payroll_reference: string;
  issued_at: string;
  document_path: string | null;
  email_delivery_status: 'available' | 'pending' | 'sent' | 'failed' | null;
}

const PaymentReceiptHistory = () => {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.rpc('get_my_payment_receipts');
      if (error) {
        toast.error('Unable to load payment receipts.');
      } else {
        setReceipts((data ?? []) as Receipt[]);
      }
      setLoading(false);
    };
    void load();
  }, []);

  const openReceipt = async (receipt: Receipt, mode: 'view' | 'download' | 'print') => {
    if (!receipt.document_path) {
      toast.info('This receipt document is still being prepared.');
      return;
    }
    setBusyId(receipt.id);
    try {
      const { data, error } = await supabase.storage.from('payment-receipts').createSignedUrl(receipt.document_path, 300);
      if (error || !data?.signedUrl) throw error ?? new Error('Signed URL unavailable');
      if (mode === 'download') {
        const anchor = document.createElement('a');
        anchor.href = data.signedUrl;
        anchor.download = `${receipt.receipt_number}.pdf`;
        anchor.target = '_blank';
        anchor.rel = 'noreferrer';
        anchor.click();
      } else {
        const opened = window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
        if (!opened) toast.info('Allow pop-ups to view your receipt.');
        if (mode === 'print') toast.info('Use your browser PDF viewer to print the receipt.');
      }
    } catch {
      toast.error('Unable to open this receipt right now.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-display flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Payment receipts
        </CardTitle>
        <p className="text-sm text-muted-foreground">Your K60 monthly Riverbanc subscription receipts. These are separate from lender loan repayments.</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : receipts.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4">No paid subscription receipts have been issued yet. A receipt is created only after payroll deduction is confirmed.</div>
        ) : (
          <div className="space-y-3">
            {receipts.map((receipt) => (
              <div key={receipt.id} className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-lg border border-border/60 bg-muted/20 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-sm text-foreground">{receipt.receipt_number}</p>
                    <Badge className="bg-success text-success-foreground">Paid</Badge>
                    {receipt.email_delivery_status === 'sent' && <Badge variant="outline">Emailed</Badge>}
                  </div>
                  <p className="text-sm text-foreground mt-1">{receipt.currency} {Number(receipt.amount).toFixed(2)} · Payroll deduction</p>
                  <p className="text-xs text-muted-foreground mt-1">Period {receipt.billing_period_start} to {receipt.billing_period_end} · Issued {new Date(receipt.issued_at).toLocaleDateString('en-ZM', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => void openReceipt(receipt, 'view')} disabled={busyId === receipt.id}><Eye className="h-4 w-4 mr-1" /> View</Button>
                  <Button size="sm" variant="outline" onClick={() => void openReceipt(receipt, 'download')} disabled={busyId === receipt.id}><Download className="h-4 w-4 mr-1" /> Download</Button>
                  <Button size="sm" variant="outline" onClick={() => void openReceipt(receipt, 'print')} disabled={busyId === receipt.id}><Printer className="h-4 w-4 mr-1" /> Print</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PaymentReceiptHistory;
