import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, TrendingDown, Users, ShieldCheck } from "lucide-react";
import heroBg from "@/assets/hero-bg.jpg";

const stats = [
  { icon: Users, value: "300K+", label: "Civil Servants" },
  { icon: TrendingDown, value: "3.5%", label: "Avg Rate Saved" },
  { icon: ShieldCheck, value: "100%", label: "Secure & Encrypted" },
];

const HeroSection = () => {
  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${heroBg})` }}
      />
      <div className="absolute inset-0 hero-gradient opacity-90" />

      <div className="container mx-auto px-4 lg:px-8 relative z-10 pt-20">
        <div className="max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/20 text-accent text-sm font-medium mb-6">
              <ShieldCheck className="w-4 h-4" />
              Trusted by over 300,000 civil servants
            </span>
          </motion.div>

          <motion.h1
            className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-primary-foreground leading-tight mb-6"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Compare Loan Offers.{" "}
            <span className="text-gradient">Save Thousands.</span>
          </motion.h1>

          <motion.p
            className="text-lg md:text-xl text-primary-foreground/70 max-w-2xl mb-8"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            The only platform built for Zambian civil servants to compare loan
            offers from multiple lenders, check eligibility instantly, and
            refinance at better rates — all in one place.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row gap-4 mb-12"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <Button variant="hero" size="lg" asChild>
              <Link to="/compare">
                Compare Loan Offers <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
            <Button variant="hero-outline" size="lg" asChild>
              <Link to="/apply">Apply for Refinancing</Link>
            </Button>
          </motion.div>

          <motion.div
            className="grid grid-cols-3 gap-6 max-w-lg"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <stat.icon className="w-5 h-5 text-accent mx-auto mb-2" />
                <p className="text-2xl font-display font-bold text-primary-foreground">
                  {stat.value}
                </p>
                <p className="text-xs text-primary-foreground/50">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
