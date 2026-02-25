import { motion } from "framer-motion";
import { UserCheck, Search, FileSignature, Banknote } from "lucide-react";

const steps = [
  {
    icon: UserCheck,
    step: "01",
    title: "Verify Your Identity",
    description: "Upload your NRC and Government ID. Our automated system verifies you in under 2 minutes.",
  },
  {
    icon: Search,
    step: "02",
    title: "Compare Offers",
    description: "We pull real-time offers from 20+ lenders. Sort by rate, term, or total cost to find your best deal.",
  },
  {
    icon: FileSignature,
    step: "03",
    title: "Apply & E-Sign",
    description: "Choose your offer, complete the CRB check, and e-sign your payroll deduction consent digitally.",
  },
  {
    icon: Banknote,
    step: "04",
    title: "Get Funded",
    description: "Funds are deposited directly into your account. Refinancing settles your old loan automatically.",
  },
];

const HowItWorksSection = () => {
  return (
    <section className="py-20 lg:py-28 bg-muted/50" id="how-it-works">
      <div className="container mx-auto px-4 lg:px-8">
        <motion.div
          className="text-center max-w-2xl mx-auto mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="text-accent font-semibold text-sm uppercase tracking-wider">
            How It Works
          </span>
          <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mt-3 mb-4">
            Four Simple Steps to a Better Loan
          </h2>
          <p className="text-muted-foreground text-lg">
            Our streamlined digital process takes you from application to funding faster than any traditional lender.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, i) => (
            <motion.div
              key={step.step}
              className="relative text-center"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
            >
              <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4">
                <step.icon className="w-7 h-7 text-primary-foreground" />
              </div>
              <span className="text-accent font-display font-bold text-sm">{step.step}</span>
              <h3 className="text-lg font-display font-semibold text-foreground mt-1 mb-2">
                {step.title}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
