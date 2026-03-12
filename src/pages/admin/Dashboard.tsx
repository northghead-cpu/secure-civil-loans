import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, FileCheck, DollarSign, ShieldAlert, TrendingUp, Clock } from "lucide-react";

const stats = [
  { label: "Total Users", value: "2,847", change: "+12%", icon: Users },
  { label: "Pending Applications", value: "34", change: "+5", icon: FileCheck },
  { label: "Monthly Revenue", value: "K 245,000", change: "+18%", icon: DollarSign },
  { label: "Active Risk Flags", value: "7", change: "-2", icon: ShieldAlert },
];

const recentActivity = [
  { action: "New application submitted", user: "John Mwale", time: "2 min ago", type: "application" },
  { action: "KYC documents uploaded", user: "Grace Banda", time: "15 min ago", type: "kyc" },
  { action: "Loan approved", user: "Peter Zulu", time: "1 hour ago", type: "approval" },
  { action: "Risk flag raised", user: "Mary Phiri", time: "2 hours ago", type: "risk" },
  { action: "Commission payout processed", user: "Stanbic Bank", time: "3 hours ago", type: "payout" },
];

const Dashboard = () => {
  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of platform activity</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-display font-bold text-foreground">{stat.value}</div>
              <p className="text-xs text-success flex items-center gap-1 mt-1">
                <TrendingUp className="h-3 w-3" /> {stat.change} from last month
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-display">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentActivity.map((item, i) => (
              <div key={i} className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.action}</p>
                  <p className="text-xs text-muted-foreground">{item.user}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{item.time}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-display">Application Pipeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { stage: "Submitted", count: 34, color: "bg-info" },
              { stage: "KYC Review", count: 18, color: "bg-warning" },
              { stage: "CRB Check", count: 12, color: "bg-accent" },
              { stage: "Approved", count: 156, color: "bg-success" },
              { stage: "Rejected", count: 23, color: "bg-destructive" },
            ].map((stage) => (
              <div key={stage.stage} className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground w-24">{stage.stage}</span>
                <div className="flex-1 bg-muted rounded-full h-2">
                  <div
                    className={`${stage.color} h-2 rounded-full`}
                    style={{ width: `${(stage.count / 156) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-foreground w-8 text-right">{stage.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
