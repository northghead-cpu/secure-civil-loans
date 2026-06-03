import { Helmet } from "react-helmet-async";
import Navbar from "@/components/Navbar";

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Privacy Policy — Riverbanc</title>
        <meta name="description" content="Riverbanc's privacy practices, compliant with Zambia's Data Protection Act No. 3 of 2021." />
        <link rel="canonical" href="https://secure-civil-loans.lovable.app/privacy-policy" />
        <meta property="og:title" content="Privacy Policy — Riverbanc" />
        <meta property="og:description" content="How Riverbanc collects, stores, and protects civil-servant data under Zambian law." />
        <meta property="og:url" content="https://secure-civil-loans.lovable.app/privacy-policy" />
      </Helmet>
      <Navbar />
      <main className="container mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-display font-bold text-foreground mb-6">Privacy Policy</h1>
        <div className="space-y-4 text-foreground/90 leading-relaxed">
          <p>Compliant with the Data Protection Act No. 3 of 2021 (Zambia).</p>
          <p>
            We collect Identity (Name, NRC), Employment (PMEC number, Payslips), and Financial data
            solely to facilitate loan processing with Bank of Zambia-licensed financial institutions.
            All personal data is hosted securely on infrastructure maintained within the Republic of
            Zambia.
          </p>
        </div>
      </main>
    </div>
  );
};

export default PrivacyPolicy;
