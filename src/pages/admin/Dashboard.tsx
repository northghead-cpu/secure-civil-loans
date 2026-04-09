import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PulseBeams } from "@/components/ui/pulse-beams";
import {
  Activity,
  ArrowUpRight,
  Banknote,
  BriefcaseBusiness,
  Clock3,
  FileCheck,
  ShieldAlert,
  Siren,
  TrendingUp,
  Users,
} from "lucide-react";

const beams = [
  {
    path: "M269 220.5H16.5C10.9772 220.5 6.5 224.977 6.5 230.5V398.5",
    gradientConfig: {
      initial: { x1: "0%", x2: "0%", y1: "80%", y2: "100%" },
      animate: {
        x1: ["0%", "0%", "200%"],
        x2: ["0%", "0%", "180%"],
        y1: ["80%", "0%", "0%"],
        y2: ["100%", "20%", "20%"],
      },
      transition: {
        duration: 2,
        repeat: Infinity,
        repeatType: "loop" as const,
        ease: "linear",
        repeatDelay: 2,
        delay: 0.2,
      },
    },
    connectionPoints: [
      { cx: 6.5, cy: 398.5, r: 6 },
      { cx: 269, cy: 220.5, r: 6 },
    ],
  },
  {
    path: "M568 200H841C846.523 200 851 195.523 851 190V40",
    gradientConfig: {
      initial: { x1: "0%", x2: "0%", y1: "80%", y2: "100%" },
      animate: {
        x1: ["20%", "100%", "100%"],
        x2: ["0%", "90%", "90%"],
        y1: ["80%", "80%", "-20%"],
        y2: ["100%", "100%", "0%"],
      },
      transition: {
        duration: 2,
        repeat: Infinity,
        repeatType: "loop" as const,
        ease: "linear",
        repeatDelay: 2,
        delay: 1,
      },
    },
    connectionPoints: [
      { cx: 851, cy: 34, r: 6.5 },
      { cx: 568, cy: 200, r: 6 },
    ],
  },
  {
    path: "M425.5 274V333C425.5 338.523 421.023 343 415.5 343H152C146.477 343 142 347.477 142 353V426.5",
    gradientConfig: {
      initial: { x1: "0%", x2: "0%", y1: "80%", y2: "100%" },
      animate: {
        x1: ["20%", "100%", "100%"],
        x2: ["0%", "90%", "90%"],
        y1: ["80%", "80%", "-20%"],
        y2: ["100%", "100%", "0%"],
      },
      transition: {
        duration: 2,
        repeat: Infinity,
        repeatType: "loop" as const,
        ease: "linear",
        repeatDelay: 2,
        delay: 1.4,
      },
    },
    connectionPoints: [
      { cx: 142, cy: 427, r: 6.5 },
      { cx: 425.5, cy: 274, r: 6 },
    ],
  },
];

const gradientColors = {
  start: "#18CCFC",
  middle: "#6344F5",
  end: "#AE48FF",
};

const stats = [
  {
    label: "Active borrowers",
    value: "2,847",
    delta: "+12% this month",
    icon: Users,
    tone: "from-sky-500/20 to-sky-400/5",
  },
  {
    label: "Pending applications",
    value: "34",
    delta: "9 require review today",
    icon: FileCheck,
    tone: "from-amber-400/20 to-amber-300/5",
  },
  {
    label: "Monthly revenue",
    value: "K 245,000",
    delta: "+18% versus March",
    icon: Banknote,
    tone: "from-emerald-400/20 to-emerald-300/5",
  },
  {
    label: "Risk alerts",
    value: "7",
    delta: "2 escalated in the last hour",
    icon: ShieldAlert,
    tone: "from-rose-400/20 to-rose-300/5",
  },
];

const priorityQueue = [
  {
    title: "KYC mismatch on payroll upload",
    owner: "Compliance team",
    eta: "Due in 18 min",
    badge: "Urgent",
    badgeClass: "bg-rose-500/15 text-rose-200 border-rose-400/20",
  },
  {
    title: "Manual review for civil service deduction cap",
    owner: "Credit operations",
    eta: "Due in 42 min",
    badge: "Needs review",
    badgeClass: "bg-amber-400/15 text-amber-100 border-amber-300/20",
  },
  {
    title: "Stanbic payout reconciliation exception",
    owner: "Finance desk",
    eta: "Ready now",
    badge: "Finance",
    badgeClass: "bg-sky-500/15 text-sky-100 border-sky-400/20",
  },
];

const recentActivity = [
  { action: "Loan approved", user: "Peter Zulu", time: "11:08", tone: "bg-emerald-500" },
  { action: "Risk flag raised", user: "Mary Phiri", time: "10:41", tone: "bg-rose-500" },
  { action: "KYC packet uploaded", user: "Grace Banda", time: "10:19", tone: "bg-sky-500" },
  { action: "New application submitted", user: "John Mwale", time: "10:06", tone: "bg-amber-400" },
];

const pipeline = [
  { stage: "Submitted", count: 34, share: 22, tone: "bg-sky-500" },
  { stage: "KYC review", count: 18, share: 12, tone: "bg-cyan-400" },
  { stage: "CRB check", count: 12, share: 8, tone: "bg-violet-500" },
  { stage: "Approved", count: 156, share: 82, tone: "bg-emerald-500" },
  { stage: "Rejected", count: 23, share: 15, tone: "bg-rose-500" },
];

const lenders = [
  { name: "Bayport", fill: 82, subtitle: "Fastest approval turnaround" },
  { name: "Stanbic", fill: 68, subtitle: "Payout queue stable" },
  { name: "Zanaco", fill: 54, subtitle: "Under document pressure" },
];

const Dashboard = () => {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PulseBeams
        beams={beams}
        gradientColors={gradientColors}
        width={1200}
        height={520}
        className="!h-auto min-h-[360px] overflow-hidden rounded-[28px] border border-white/10 bg-slate-950 shadow-2xl"
      >
        <div className="w-full p-6 md:p-8 lg:p-10">
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl space-y-4">
                <Badge className="border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
                  Daily operations overview
                </Badge>
                <div className="space-y-3">
                  <h1 className="max-w-2xl text-4xl font-display font-bold leading-tight text-white md:text-5xl">
                    Admin command center for
                    {" "}
                    <span className="text-gradient">live lending activity</span>
                  </h1>
                  <p className="max-w-2xl text-base text-white/70 md:text-lg">
                    Track application flow, revenue health, and compliance pressure in one surface built for operators.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:w-[420px]">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                  <p className="text-xs uppercase tracking-[0.24em] text-white/45">Throughput</p>
                  <div className="mt-3 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-3xl font-display font-bold text-white">91%</p>
                      <p className="text-sm text-white/60">same-day first-touch rate</p>
                    </div>
                    <TrendingUp className="h-5 w-5 text-emerald-300" />
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                  <p className="text-xs uppercase tracking-[0.24em] text-white/45">Attention</p>
                  <div className="mt-3 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-3xl font-display font-bold text-white">3</p>
                      <p className="text-sm text-white/60">queues crossing SLA</p>
                    </div>
                    <Siren className="h-5 w-5 text-amber-300" />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className={`rounded-2xl border border-white/10 bg-gradient-to-br ${stat.tone} p-5 backdrop-blur-sm`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <p className="text-sm text-white/60">{stat.label}</p>
                      <p className="text-3xl font-display font-bold text-white">{stat.value}</p>
                    </div>
                    <div className="rounded-full border border-white/10 bg-white/10 p-2 text-white/80">
                      <stat.icon className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="mt-4 flex items-center gap-2 text-sm text-white/70">
                    <ArrowUpRight className="h-4 w-4" />
                    {stat.delta}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </PulseBeams>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card className="card-elevated border-border/70 bg-card/95">
          <CardHeader className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="text-xl font-display">Priority Queue</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Work items that need a decision before the next payout cycle.
                </p>
              </div>
              <Badge variant="secondary" className="rounded-full px-3 py-1">
                3 high-priority items
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {priorityQueue.map((item) => (
              <div
                key={item.title}
                className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-background/70 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                    <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.owner}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className={`border ${item.badgeClass}`}>{item.badge}</Badge>
                  <span className="text-sm text-muted-foreground">{item.eta}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="card-elevated border-border/70 bg-card/95">
          <CardHeader>
            <CardTitle className="text-xl font-display">Live Activity</CardTitle>
            <p className="text-sm text-muted-foreground">
              Most recent platform events across applications, KYC, and risk.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentActivity.map((item) => (
              <div key={`${item.action}-${item.time}`} className="flex items-start gap-3">
                <div className={`mt-1.5 h-2.5 w-2.5 rounded-full ${item.tone}`} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{item.action}</p>
                  <p className="text-sm text-muted-foreground">{item.user}</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock3 className="h-3.5 w-3.5" />
                  {item.time}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="card-elevated border-border/70 bg-card/95">
          <CardHeader>
            <CardTitle className="text-xl font-display">Application Pipeline</CardTitle>
            <p className="text-sm text-muted-foreground">
              Distribution across the current lending workflow.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            {pipeline.map((stage) => (
              <div key={stage.stage} className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${stage.tone}`} />
                    <span className="text-sm font-medium text-foreground">{stage.stage}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-muted-foreground">{stage.share}% of flow</span>
                    <span className="font-semibold text-foreground">{stage.count}</span>
                  </div>
                </div>
                <Progress value={stage.share} className="h-2.5" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="card-elevated border-border/70 bg-card/95">
          <CardHeader>
            <CardTitle className="text-xl font-display">Lender Health</CardTitle>
            <p className="text-sm text-muted-foreground">
              Operational pulse across partner lenders this afternoon.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            {lenders.map((lender) => (
              <div key={lender.name} className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <BriefcaseBusiness className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{lender.name}</p>
                      <p className="text-xs text-muted-foreground">{lender.subtitle}</p>
                    </div>
                  </div>
                  <span className="text-sm font-medium text-foreground">{lender.fill}%</span>
                </div>
                <Progress value={lender.fill} className="h-2.5" />
              </div>
            ))}

            <div className="rounded-2xl border border-border/70 bg-muted/40 p-4">
              <div className="flex items-center gap-3">
                <Activity className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Settlement window opens in 52 minutes</p>
                  <p className="text-sm text-muted-foreground">
                    Finance and compliance queues should clear exceptions before then.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
