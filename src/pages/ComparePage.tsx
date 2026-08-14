import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { LampContainer } from "@/components/ui/lamp";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ArrowRight, Info, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useRBAC } from "@/hooks/useRBAC";

interface LoanOffer {
  id: string;
  lender: string;
  rate: number;
  term: number;
  monthlyPayment: number;
  totalCost: number;
  maxAmount: number;
  featured?: boolean;
  rating?: number;
  processingTime?: string;
}

// Live lender/product data will populate this list. No synthetic financial offers
// are shown to borrowers when verified live data is unavailable.
const liveOffers: LoanOffer[] = [];

const ComparePage = () => {
  const [amount, setAmount] = useState([100000]);
  const [sortBy, setSortBy] = useState("rate");
  const [termFilter, setTermFilter] = useState("all");
  const navigate = useNavigate();
  const { user, profile, loading, profileLoading, refreshProfile } = useAuth();
  const { hasRole } = useRBAC();

  useEffect(() => {
    if (user) refreshProfile();
  }, [user, refreshProfile]);

  useEffect(() => {
    if (loading || profileLoading) return;

    if (!user) {
      navigate("/login", { replace: true });
      return;
    }

    const isAdmin = hasRole("super_admin") || hasRole("admin") || hasRole("super_user");
    if (isAdmin) return;

    const kycStatus = profile?.kyc_status;
    if (kycStatus !== "VERIFIED" && kycStatus !== "COMPLETED") {
      navigate("/apply", { replace: true });
    }
  }, [user, profile, loading, profileLoading, hasRole, navigate]);

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const filtered = liveOffers
    .filter((offer) => termFilter === "all" || offer.term === parseInt(termFilter, 10))
    .sort((a, b) => {
      if (sortBy === "rate") return a.rate - b.rate;
      if (sortBy === "monthly") return a.monthlyPayment - b.monthlyPayment;
      if (sortBy === "total") return a.totalCost - b.totalCost;
      return 0;
    });

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Compare Loan Options — Riverbanc</title>
        <meta
          name="description"
          content="Compare verified loan options from participating financial institutions through Riverbanc."
        />
        <link rel="canonical" href="https://riverbanc.co.zm/compare" />
        <meta property="og:title" content="Compare Loan Options — Riverbanc" />
        <meta
          property="og:description"
          content="Compare verified loan options from participating financial institutions through Riverbanc."
        />
        <meta property="og:url" content="https://riverbanc.co.zm/compare" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Service",
          "name": "Loan Comparison",
          "provider": { "@type": "Organization", "name": "Riverbanc" },
          "areaServed": "ZM",
          "serviceType": "Loan comparison platform"
        })}</script>
      </Helmet>

      <Navbar />
      <main className="pt-24 pb-16">
        <LampContainer className="h-48 bg-background">
          <span />
        </LampContainer>

        <motion.div
          className="container mx-auto px-4 lg:px-8 mt-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="max-w-3xl">
            <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-2">
              Compare Loan Options
            </h1>
            <p className="text-muted-foreground text-lg">
              Compare verified offers available to you from participating financial institutions.
            </p>
          </div>
        </motion.div>

        <div className="container mx-auto px-4 lg:px-8 mt-6">
          <motion.div
            className="bg-card rounded-xl p-6 border border-border/50 card-elevated mb-8"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="grid md:grid-cols-3 gap-6 items-end">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Loan Amount: K{amount[0].toLocaleString()}
                </label>
                <Slider
                  value={amount}
                  onValueChange={setAmount}
                  min={10000}
                  max={500000}
                  step={5000}
                  className="mt-3"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>K10,000</span>
                  <span>K500,000</span>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Term</label>
                <Select value={termFilter} onValueChange={setTermFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Terms</SelectItem>
                    <SelectItem value="36">36 Months</SelectItem>
                    <SelectItem value="48">48 Months</SelectItem>
                    <SelectItem value="60">60 Months</SelectItem>
                    <SelectItem value="72">72 Months</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Sort By</label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rate">Interest Rate</SelectItem>
                    <SelectItem value="monthly">Monthly Payment</SelectItem>
                    <SelectItem value="total">Total Cost</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </motion.div>

          {filtered.length === 0 ? (
            <motion.div
              className="rounded-2xl border border-border/60 bg-card p-8 sm:p-12 text-center card-elevated"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Info className="h-6 w-6 text-primary" />
              </div>
              <Badge variant="outline" className="mb-4">Live offers only</Badge>
              <h2 className="text-2xl font-display font-semibold text-foreground">
                Loan offers are being added
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-muted-foreground leading-relaxed">
                We're onboarding participating financial institutions. Once verified offers are
                available for you, they'll appear here.
              </p>
              <p className="mx-auto mt-4 max-w-xl text-xs text-muted-foreground">
                Riverbanc does not create or alter lender pricing. Loan products and lending
                decisions are provided by participating financial institutions.
              </p>
              <Button variant="outline" className="mt-6" onClick={() => navigate("/profile")}>
                Return to my journey <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </motion.div>
          ) : (
            <div className="space-y-4">
              {filtered.map((offer, i) => (
                <motion.div
                  key={offer.id}
                  className="bg-card rounded-xl p-6 border border-border/50 card-elevated"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + i * 0.05 }}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                    <div className="flex-1">
                      <h2 className="font-display font-semibold text-foreground text-base mb-2">{offer.lender}</h2>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {offer.processingTime && <span>Processing: {offer.processingTime}</span>}
                        <span>Maximum: K{offer.maxAmount.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-6 lg:gap-10 text-center">
                      <div>
                        <p className="text-2xl font-display font-bold text-foreground">{offer.rate}%</p>
                        <p className="text-xs text-muted-foreground">Annual Rate</p>
                      </div>
                      <div>
                        <p className="text-2xl font-display font-bold text-foreground">K{offer.monthlyPayment.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Monthly</p>
                      </div>
                      <div>
                        <p className="text-2xl font-display font-bold text-foreground">{offer.term} mo</p>
                        <p className="text-xs text-muted-foreground">Term</p>
                      </div>
                    </div>

                    <Button>
                      View offer <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Riverbanc is a technology platform, not a bank or lender. Participating financial
            institutions provide the loan products and make lending decisions.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ComparePage;
