import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const TermsOfService = () => (
  <div className="min-h-screen bg-background flex flex-col">
    <Helmet>
      <title>Terms of Service — Riverbanc</title>
      <meta name="description" content="Terms governing access to and use of the Riverbanc loan-comparison technology platform." />
      <link rel="canonical" href="https://riverbanc.co.zm/terms" />
    </Helmet>
    <Navbar />
    <main className="container mx-auto w-full max-w-4xl px-4 lg:px-8 pt-28 pb-16 flex-1">
      <header className="mb-10 border-b border-border pb-8">
        <p className="text-sm font-semibold tracking-wide uppercase text-accent mb-3">Legal &amp; privacy</p>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-4">Terms of Service</h1>
        <p className="text-base leading-7 text-muted-foreground max-w-3xl">These terms govern your access to and use of Riverbanc's technology marketplace. Please read them together with the Privacy Policy and Data Retention Policy.</p>
        <p className="text-sm text-muted-foreground mt-4">Last reviewed: 11 October 2026</p>
      </header>
      <div className="space-y-9 text-base leading-7 text-foreground/90">
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold text-foreground">1. About Riverbanc</h2>
          <p>Riverbanc Technology Limited ("Riverbanc", "we", "us" or "our") operates a technology platform that helps users compare loan options from participating financial institutions. Riverbanc is not a bank or lender, does not provide loan funds, and does not make a lender's final credit decision.</p>
        </section>
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold text-foreground">2. Comparison information and lender decisions</h2>
          <p>Information displayed on the platform is provided to help you compare available options. Rates, fees, repayment amounts, eligibility and availability may depend on the lender's current products and your circumstances. Figures or pre-qualification indicators may be estimates and must be confirmed with the relevant institution.</p>
          <p>A comparison, pre-qualification result or referral is not a loan offer, approval, guarantee of eligibility or promise of disbursement. The participating institution independently decides whether to accept an application, what terms to offer and whether to disburse funds. You should review the lender's own contract and disclosures before accepting a loan.</p>
        </section>
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold text-foreground">3. Your account and information</h2>
          <p>You must provide information that is accurate, complete and current to the best of your knowledge, correct material errors when identified, and submit only documents you are authorised to provide. You must keep your login credentials confidential and notify Riverbanc if you suspect unauthorised access.</p>
          <p>You must not misuse the platform, attempt to access another person's account or information, interfere with platform security, submit fraudulent information, or use the service for an unlawful purpose. We may restrict access where reasonably necessary to protect users, investigate suspected misuse or comply with law.</p>
        </section>
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold text-foreground">4. Information sharing and authorization</h2>
          <p>Riverbanc handles personal information as described in the <Link className="text-primary underline underline-offset-4 hover:text-accent" to="/privacy-policy">Privacy Policy</Link>. Information is shared with a participating institution only where the relevant lawful basis and required authorization are in place. A general preference to enable lender data sharing does not itself authorise disclosure to every lender; any lender-specific authorization required for a referral must be presented separately.</p>
          <p>Once a lender receives your information, it may process that information under its own legal obligations, privacy notice and lending process. You are responsible for reviewing the lender's terms before proceeding.</p>
        </section>
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold text-foreground">5. Riverbanc subscription and charges</h2>
          <p>Where the subscription service is offered and you enrol, the Riverbanc platform subscription is K60 per month and is administered through payroll deduction where that arrangement is available and authorised. This is a fee for access to Riverbanc's platform and services. It is separate from any loan principal, interest, lender fee or repayment owed to a financial institution.</p>
          <p>Any applicable charge and its collection method must be communicated before enrolment or a material change. If a payroll-deduction arrangement is unavailable or has not been authorised, Riverbanc will not represent that the deduction has been established.</p>
        </section>
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold text-foreground">6. Privacy, retention and user requests</h2>
          <p>The <Link className="text-primary underline underline-offset-4 hover:text-accent" to="/privacy-policy">Privacy Policy</Link> explains how personal information is collected, used and disclosed. The <Link className="text-primary underline underline-offset-4 hover:text-accent" to="/retention-policy">Data Retention Policy</Link> describes how records are retained and deleted. You may exercise applicable data protection rights by contacting <a className="text-primary underline underline-offset-4 hover:text-accent" href="mailto:support@riverbanc.co.zm?subject=Privacy%20request">support@riverbanc.co.zm</a>. A request is assessed under applicable law; records may be retained only where a valid legal or other lawful basis applies.</p>
        </section>
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold text-foreground">7. Availability and changes</h2>
          <p>We aim to keep the platform available and information accurate, but we do not guarantee uninterrupted access, error-free operation or that every lender product will always be available. Features and participating institutions may change. We may suspend access where needed for maintenance, security, suspected misuse or compliance with law.</p>
          <p>We may update these terms from time to time. The current version will be published on this page with its review date. Where applicable law requires notice or consent for a change, we will take the required steps.</p>
        </section>
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold text-foreground">8. Third-party services</h2>
          <p>The platform may link to or connect with services operated by third parties, including participating financial institutions. Those services are governed by their own terms and privacy notices. Riverbanc is not responsible for a lender's independent underwriting decision, product terms or service operation, except to the extent responsibility cannot lawfully be excluded.</p>
        </section>
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold text-foreground">9. Liability and legal rights</h2>
          <p>Nothing in these terms removes a right or responsibility that cannot lawfully be excluded or limited. To the extent permitted by law, Riverbanc is not responsible for a lender's independent decision, changes to a lender's products, or your decision to enter into a loan contract with a lender. You remain responsible for reviewing the lender's final offer and deciding whether it meets your needs.</p>
        </section>
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold text-foreground">10. Governing law and contact</h2>
          <p>These terms are governed by the laws of the Republic of Zambia, subject to any mandatory legal protections that apply. Questions about the platform or these terms may be sent to <a className="text-primary underline underline-offset-4 hover:text-accent" href="mailto:support@riverbanc.co.zm">support@riverbanc.co.zm</a> or raised by calling <a className="text-primary underline underline-offset-4 hover:text-accent" href="tel:+260961874540">+260 961 874 540</a>.</p>
        </section>
      </div>
    </main>
    <Footer />
  </div>
);

export default TermsOfService;
