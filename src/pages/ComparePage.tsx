import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import { ArrowRight, Star } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useRBAC } from "@/hooks/useRBAC";
import { Loader2 } from "lucide-react";
import ApplyLoanModal from "@/components/ApplyLoanModal";

interface LoanOffer {
  id: string;
  lender: string;
  rate: number;
  term: number;
  monthlyPayment: number;
  totalCost: number;
  maxAmount: number;
  featured: boolean;
  rating: number;
  processingTime: string;
}

const mockOffers: LoanOffer[] = [
  { id: "1", lender: "Zambia National Building Society", rate: 18.5, term: 60, monthlyPayment: 2580, totalCost: 154800, maxAmount: 150000, featured: true, rating: 4.8, processingTime: "2 days" },
  { id: "2", lender: "Atlas Mara Bank", rate: 21.0, term: 48, monthlyPayment: 2890, totalCost: 138720, maxAmount: 120000, featured: false, rating: 4.5, processingTime: "3 days" },
  { id: "3", lender: "Indo Zambia Bank", rate: 19.5, term: 60, monthlyPayment: 2650, totalCost: 159000, maxAmount: 200000, featured: true, rating: 4.6, processingTime: "2 days" },
  { id: "4", lender: "First National Bank", rate: 20.0, term: 36, monthlyPayment: 3200, totalCost: 115200, maxAmount: 100000, featured: false, rating: 4.4, processingTime: "5 days" },
  { id: "5", lender: "Stanbic Bank Zambia", rate: 17.5, term: 72, monthlyPayment: 2350, totalCost: 169200, maxAmount: 250000, featured: true, rating: 4.9, processingTime: "1 day" },
  { id: "6", lender: "Bayport Financial", rate: 22.5, term: 48, monthlyPayment: 3050, totalCost: 146400, maxAmount: 80000, featured: false, rating: 4.2, processingTime: "Same day" },
];

const ComparePage = () => {
  const [amount, setAmount] = useState([100000]);
  const [sortBy, setSortBy] = useState("rate");
  const [termFilter, setTermFilter] = useState("all");
  const [loanModalOpen, setLoanModalOpen] = useState(false);
  const navigate = useNavigate();
  const { user, profile, loading, profileLoading, refreshProfile } = useAuth();
  const { hasRole } = useRBAC();

  useEffect(() => {
    if (user) refreshProfile();
  }, [user]);

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

  const filtered = mockOffers
    .filter((o) => termFilter === "all" || o.term === parseInt(termFilter))
    .sort((a, b) => {
      if (sortBy === "rate") return a.rate - b.rate;
      if (sortBy === "monthly") return a.monthlyPayment - b.monthlyPayment;
      if (sortBy === "total") return a.totalCost - b.totalCost;
      return 0;
    });

  return (
    <div className="min-h-screen bg-background">
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
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-2">
            Compare Loan Offers
          </h1>
          <p className="text-muted-foreground text-lg">
            Real-time rates from licensed lenders across Zambia
          </p>
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
                <Slider value={amount} onValueChange={setAmount} min={10000} max={500000} step={5000} className="mt-3" />
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

          <div className="space-y-4">
            {filtered.map((offer, i) => (
              <motion.div
                key={offer.id}
                className={`bg-card rounded-xl p-6 border card-elevated ${
                  offer.featured ? "border-accent/30" : "border-border/50"
                }`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.05 }}
              >
                <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-display font-semibold text-foreground">{offer.lender}</h3>
                      {offer.featured && (
                        <Badge className="bg-accent/10 text-accent border-accent/20 text-xs">
                          <Star className="w-3 h-3 mr-1" /> Top Pick
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <span>⭐ {offer.rating}</span>
                      <span className="mx-2">•</span>
                      <span>Processing: {offer.processingTime}</span>
                      <span className="mx-2">•</span>
                      <span>Max: K{offer.maxAmount.toLocaleString()}</span>
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

                  <Button onClick={() => setLoanModalOpen(true)}>
                    Apply Now <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
      <ApplyLoanModal open={loanModalOpen} onClose={() => setLoanModalOpen(false)} />
    </div>
  );
};

export default ComparePage;
