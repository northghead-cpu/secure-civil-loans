import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Home, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ApplicationConfirmation = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 lg:px-8 max-w-2xl">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="bg-card rounded-xl p-8 lg:p-12 border border-border/50 card-elevated text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            >
              <CheckCircle2 className="w-20 h-20 text-success mx-auto mb-6" />
            </motion.div>

            <h1 className="text-3xl font-display font-bold text-foreground mb-3">
              Application Submitted!
            </h1>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              Your KYC verification and loan application have been successfully submitted. We'll review your documents and get back to you within 24–48 hours.
            </p>

            <div className="bg-muted/50 rounded-lg p-6 border border-border/50 mb-8 text-left space-y-3">
              <h2 className="font-display font-semibold text-foreground text-sm">What happens next?</h2>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <FileText className="w-4 h-4 mt-0.5 text-accent shrink-0" />
                  Your documents will be verified by our team.
                </li>
                <li className="flex items-start gap-2">
                  <FileText className="w-4 h-4 mt-0.5 text-accent shrink-0" />
                  A credit bureau check will be completed.
                </li>
                <li className="flex items-start gap-2">
                  <FileText className="w-4 h-4 mt-0.5 text-accent shrink-0" />
                  You'll receive loan offers from matching lenders.
                </li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button variant="outline" onClick={() => navigate("/")}>
                <Home className="w-4 h-4" /> Back to Home
              </Button>
              <Button onClick={() => navigate("/compare")}>
                Compare Loans <FileText className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ApplicationConfirmation;
