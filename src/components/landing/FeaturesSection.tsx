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
    title: "Compare Available Loan Options",
    description:
      "Review available rates, terms, and estimated repayment costs for products listed by participating financial institutions.",
  },
  {
    icon: FileCheck,
    title: "Identity Verification",
    description:
      "Complete the identity and document checks required to access the platform’s protected comparison and application features.",
  },
  {
    icon: Calculator,
    title: "Affordability Information",
    description:
      "Use your salary and deduction information to understand estimated repayment affordability before approaching a lender.",
  },
  {
    icon: ShieldCheck,
    title: "Lender Assessment",
    description:
      "Where required and separately authorised, credit-reference checks and lending assessments are handled as part of the lender’s process.",
  },
  {
    icon: CreditCard,
    title: "Clear Consent Controls",
    description:
      "Review relevant permissions and authorisations before your information is shared with a participating financial institution.",
  },
  {
    icon: Zap,
    title: "Application Handoff",
    description:
      "Choose an available product and follow the application or handoff process supported by the participating financial institution.",
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
            Tools to Compare Loan Options More Clearly
          </h2>
          <p className="text-muted-foreground text-lg">
            From comparing available product information to understanding the next steps, Riverbanc helps you make an informed choice. Each lender manages its own application and lending decision.
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
