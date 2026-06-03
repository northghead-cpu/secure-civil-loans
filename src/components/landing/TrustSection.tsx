import { motion } from "framer-motion";
import { Shield, Lock, Award, Building2 } from "lucide-react";

const trustItems = [
  { icon: Shield, title: "Bank of Zambia Regulated", desc: "All partner lenders are BOZ licensed" },
  { icon: Lock, title: "256-bit Encryption", desc: "Your data is encrypted at rest and in transit" },
  { icon: Award, title: "ISO 27001 Certified", desc: "International security standard compliance" },
  { icon: Building2, title: "20+ Licensed Lenders", desc: "Only vetted, regulated financial institutions" },
];

const TrustSection = () => {
  return (
    <section className="py-16 bg-primary">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {trustItems.map((item, i) => (
            <motion.div
              key={item.title}
              className="text-center"
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <item.icon className="w-8 h-8 text-accent mx-auto mb-3" />
              <h3 className="font-display font-semibold text-primary-foreground text-sm mb-1">
                {item.title}
              </h3>
              <p className="text-primary-foreground/60 text-xs">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrustSection;
