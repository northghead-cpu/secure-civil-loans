import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const TermsOfService = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 lg:px-8 py-16 max-w-4xl">
        <h1 className="font-display text-3xl font-bold text-foreground mb-4">Terms of Service</h1>
        <p className="text-muted-foreground mb-10">These terms describe your use of the Riverbanc platform.</p>

        <div className="space-y-8 text-sm leading-7 text-foreground/80">
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-2">1. About Riverbanc</h2>
            <p>Riverbanc Technology Limited operates a technology platform that helps users compare loan options from participating financial institutions. Riverbanc is not a bank or lender and does not make lending decisions.</p>
          </section>
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-2">2. Loan products</h2>
            <p>Loan products displayed through the platform are provided by participating financial institutions. Availability, eligibility, pricing, approval and disbursement are determined by the relevant institution.</p>
          </section>
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-2">3. Riverbanc subscription</h2>
            <p>Where applicable, access to Riverbanc services is subject to a K60 monthly subscription deducted through payroll. This subscription is for Riverbanc's platform and services and is separate from any loan principal, interest, fees or repayment obligations owed to a lender.</p>
          </section>
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-2">4. Information and authorization</h2>
            <p>You are responsible for providing accurate information and for reviewing any authorization before you submit it. Information may be shared with a participating financial institution only in accordance with the applicable authorization and privacy terms.</p>
          </section>
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-2">5. Privacy</h2>
            <p>Your information is handled according to our <Link className="text-primary underline" to="/privacy-policy">Privacy Policy</Link> and <Link className="text-primary underline" to="/retention-policy">Data Retention Policy</Link>.</p>
          </section>
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-2">6. Changes and availability</h2>
            <p>Riverbanc may update the platform, these terms or available services from time to time. We will not represent a lender's decision as a Riverbanc decision.</p>
          </section>
          <section>
            <h2 className="font-display text-xl font-semibold text-foreground mb-2">7. Contact</h2>
            <p>For questions about these terms, contact Riverbanc through the support contact provided on the platform.</p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default TermsOfService;
