import { motion } from "framer-motion";
import { Building2, FileCheck2, LockKeyhole, Scale } from "lucide-react";

const trustItems = [
  {
    icon: Scale,
    title: "Transparent comparison",
    desc: "Clear information to help you compare available loan options.",
  },
  {
    icon: LockKeyhole,
    title: "Privacy-focused",
    desc: "Your information is handled with security and privacy in mind.",
  },
  {
    icon: Building2,
    title: "Participating institutions",
    desc: "Loan products come from participating financial institutions.",
  },
  {
    icon: FileCheck2,
    title: "Clear data controls",
    desc: "Understand and manage how your information is used and shared.",
  },
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
