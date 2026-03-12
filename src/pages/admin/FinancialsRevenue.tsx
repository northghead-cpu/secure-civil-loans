import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";

const monthlyRevenue = [
  { month: "Jan", revenue: 185000, growth: 12 },
  { month: "Feb", revenue: 210000, growth: 13.5 },
  { month: "Mar", revenue: 245000, growth: 16.7 },
];

const revenueStreams = [
  { source: "Commission Fees", amount: "K145,000", share: "59%", trend: "up" },
  { source: "Processing Fees", amount: "K52,000", share: "21%", trend: "up" },
  { source: "Late Payment Fees", amount: "K28,000", share: "11%", trend: "down" },
  { source: "Insurance Premiums", amount: "K20,000", share: "8%", trend: "up" },
];

const FinancialsRevenue = () => {
  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Revenue</h1>
        <p className="text-sm text-muted-foreground">Revenue tracking and breakdown</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {monthlyRevenue.map((m) => (
          <Card key={m.month}>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{m.month} 2026</p>
              <div className="text-2xl font-display font-bold text-foreground">K{m.revenue.toLocaleString()}</div>
              <p className="text-xs text-success flex items-center gap-1 mt-1">
                <TrendingUp className="h-3 w-3" /> +{m.growth}%
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-display">Revenue Streams</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {revenueStreams.map((s) => (
            <div key={s.source} className="flex items-center justify-between p-3 rounded-lg border border-border">
              <div>
                <p className="text-sm font-medium text-foreground">{s.source}</p>
                <p className="text-xs text-muted-foreground">{s.share} of total</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-display font-bold text-foreground">{s.amount}</span>
                {s.trend === "up" ? (
                  <ArrowUpRight className="h-4 w-4 text-success" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 text-destructive" />
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default FinancialsRevenue;
