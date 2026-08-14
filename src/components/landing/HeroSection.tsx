import { motion, useScroll, useTransform } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { useRef } from "react";

const trustPoints = [
  "Transparent loan comparison",
  "Clear consent and data controls",
  "Participating financial institutions",
];

const HeroSection = () => {
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start end", "end start"]
  });

  const contentY = useTransform(scrollYProgress, [0, 1], [0, -50]);
  const opacity = useTransform(scrollYProgress, [0, 0.5, 1], [1, 0.8, 0.6]);

  return (
    <section ref={heroRef} className="relative min-h-[90vh] flex items-center overflow-hidden bg-black">
      <div className="absolute inset-0 bg-gradient-to-br from-black via-black/95 to-primary/10" />

      <motion.div
        className="container mx-auto px-4 lg:px-8 relative z-10 pt-20"
        style={{ y: contentY, opacity }}
      >
        <div className="max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/20 text-accent text-sm font-medium mb-6">
              <ShieldCheck className="w-4 h-4" />
              Built for Zambia's salaried employees
            </span>
          </motion.div>

          <motion.h1
            className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-white leading-tight mb-6"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Compare loan options with clarity.{" "}
            <span className="text-gradient">Choose with confidence.</span>
          </motion.h1>

          <motion.p
            className="text-lg md:text-xl text-white/90 max-w-2xl mb-8"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Riverbanc helps you understand eligible loan options from participating
            financial institutions, so you can make a more informed choice.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row gap-4 mb-10"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <Button variant="hero" size="lg" asChild>
              <Link to="/compare">
                Start comparing loans <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
            <Button variant="hero-outline" size="lg" asChild>
              <Link to="/#how-it-works">How Riverbanc works</Link>
            </Button>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            {trustPoints.map((point) => (
              <div key={point} className="flex items-start gap-2 text-left">
                <ShieldCheck className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                <p className="text-sm text-white/80">{point}</p>
              </div>
            ))}
          </motion.div>

          <p className="text-xs text-white/60 max-w-2xl mt-8 leading-relaxed">
            Riverbanc is a technology platform, not a bank or lender. Loan products
            are provided and lending decisions are made by participating financial institutions.
          </p>
        </div>
      </motion.div>
    </section>
  );
};

export default HeroSection;
