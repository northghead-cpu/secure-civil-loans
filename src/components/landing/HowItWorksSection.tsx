import { motion } from "framer-motion";
import { UserCheck, Search, FileSignature, Banknote } from "lucide-react";

const steps = [
  {
    icon: UserCheck,
    step: "01",
    title: "Verify Your Identity",
    description: "Complete the identity and document checks required to access protected platform features.",
  },
  {
    icon: Search,
    step: "02",
    title: "Compare Offers",
    description: "Review available product information from participating financial institutions and compare the terms and estimated costs shown.",
  },
  {
    icon: FileSignature,
    step: "03",
    title: "Follow the Lender’s Process",
    description: "Review the relevant disclosures and authorisations, then continue through the application or handoff process provided for that product.",
  },
  {
    icon: Banknote,
    step: "04",
    title: "Lender Makes the Decision",
    description: "The financial institution assesses your application and decides whether to offer financing. Riverbanc does not lend or approve loans.",
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
            How to Compare Loan Options
          </h2>
          <p className="text-muted-foreground text-lg">
            Riverbanc helps you compare available options. Each participating financial institution controls its application process, eligibility requirements and lending decisions.
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
