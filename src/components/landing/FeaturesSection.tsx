import { motion } from "framer-motion";
import {
  BarChart3,
  FileCheck,
  Calculator,
  CreditCard,
  ShieldCheck,
  Zap,
} from "lucide-react";

const features = [
  {
    icon: BarChart3,
    title: "Compare Multiple Lenders",
    description:
      "Side-by-side comparison of rates, terms, and total cost from 20+ licensed lenders across Zambia.",
  },
  {
    icon: FileCheck,
    title: "Instant KYC Verification",
    description:
      "Upload your NRC and Government ID for instant identity verification with automated document processing.",
  },
  {
    icon: Calculator,
    title: "Net Salary Calculator",
    description:
      "Automated payroll parsing to calculate your exact take-home pay and maximum affordable repayment.",
  },
  {
    icon: ShieldCheck,
    title: "CRB Pre-Check",
    description:
      "Check your credit standing before applying so you know exactly which offers you qualify for.",
  },
  {
    icon: CreditCard,
    title: "Payroll Deduction Consent",
    description:
      "Secure e-signature for payroll deduction authorization — no paperwork, no queues.",
  },
  {
    icon: Zap,
    title: "Fast Refinancing",
    description:
      "Switch to a better rate in days, not weeks. Our digital-first process eliminates unnecessary delays.",
  },
];

const FeaturesSection = () => {
  return (
    <section className="py-20 lg:py-28 bg-background" id="features">
      <div className="container mx-auto px-4 lg:px-8">
        <motion.div
          className="text-center max-w-2xl mx-auto mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <span className="text-accent font-semibold text-sm uppercase tracking-wider">
            Features
          </span>
          <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mt-3 mb-4">
            Everything You Need to Get the Best Loan
          </h2>
          <p className="text-muted-foreground text-lg">
            From identity verification to loan disbursement — we handle every
            step digitally so you don't have to visit a single branch.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              className="bg-card rounded-xl p-6 card-elevated border border-border/50"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
            >
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                <feature.icon className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-lg font-display font-semibold text-foreground mb-2">
                {feature.title}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
