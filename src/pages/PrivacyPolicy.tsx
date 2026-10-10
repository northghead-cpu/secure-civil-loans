import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const PrivacyPolicy = () => (
  <div className="min-h-screen bg-background flex flex-col">
    <Helmet>
      <title>Privacy Policy — Riverbanc</title>
      <meta name="description" content="How Riverbanc Technology Limited collects, uses, shares, protects and retains personal information under Zambia's Data Protection Act." />
      <link rel="canonical" href="https://riverbanc.co.zm/privacy-policy" />
      <meta property="og:title" content="Privacy Policy — Riverbanc" />
      <meta property="og:description" content="Understand how Riverbanc handles personal information and how you can exercise your data protection rights." />
      <meta property="og:url" content="https://riverbanc.co.zm/privacy-policy" />
    </Helmet>
    <Navbar />
    <main className="container mx-auto w-full max-w-4xl px-4 lg:px-8 pt-28 pb-16 flex-1">
      <header className="mb-10 border-b border-border pb-8">
        <p className="text-sm font-semibold tracking-wide uppercase text-accent mb-3">Legal &amp; privacy</p>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-4">Privacy Policy</h1>
        <p className="text-base leading-7 text-muted-foreground max-w-3xl">This policy explains what personal information Riverbanc handles, why it is used, when it may be shared, how long it is kept, and the rights available to you.</p>
        <p className="text-sm text-muted-foreground mt-4">Last reviewed: 11 October 2026</p>
      </header>
      <div className="space-y-9 text-base leading-7 text-foreground/90">
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold text-foreground">1. Who we are and our role</h2>
          <p>Riverbanc Technology Limited ("Riverbanc", "we", "us" or "our") operates a technology marketplace that helps users compare loan options offered by participating financial institutions. Riverbanc is not a bank or lender, does not advance loan funds, and does not make a participating lender's final credit decision.</p>
          <p>Riverbanc may act as a data controller for information it processes to operate accounts, provide the comparison service, administer subscriptions, maintain security and meet its own obligations. In some workflows, Riverbanc may process information on behalf of a participating institution under an agreed arrangement. The institution may separately act as a controller for its own lending assessment, records and decisions.</p>
        </section>
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold text-foreground">2. Personal information we may collect</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Identity and contact details:</strong> name, contact details and identity-document information, including NRC information where required for verification.</li>
            <li><strong>Employment and payroll information:</strong> employer or ministry, employee identifiers, employment details and payslip information supplied for verification or affordability calculations.</li>
            <li><strong>Financial and application information:</strong> income and deduction figures, declared commitments, affordability or debt-to-income calculations, application status, comparison preferences and information needed to prepare a referral or pre-qualification summary.</li>
            <li><strong>Verification and credit-check information:</strong> results returned by a verification or credit-reference provider, but only where the relevant service is enabled, the check is lawful and any required authorization has been obtained.</li>
            <li><strong>Consent and communication records:</strong> the choices you make about data sharing, credit checks, marketing or analytics, the time and source of those choices, support messages and notices sent to you.</li>
            <li><strong>Technical and security information:</strong> account activity, service logs, device or browser information and events needed to protect the platform, investigate errors and detect misuse.</li>
          </ul>
          <p>Please provide only information that is accurate and requested for the relevant purpose. Do not upload another person's personal information unless you are legally authorised to provide it.</p>
        </section>
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold text-foreground">3. Why we use the information</h2>
          <p>We use personal information only for specified and legitimate purposes, including to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>create and administer your account and provide access to the marketplace;</li>
            <li>verify identity or employment where required for the service;</li>
            <li>read information from submitted documents and calculate affordability indicators or pre-qualification summaries;</li>
            <li>display and compare lender information and, where you authorise it, transmit relevant information to a selected participating institution;</li>
            <li>administer the Riverbanc subscription and related payroll-deduction arrangements where applicable;</li>
            <li>respond to support requests, maintain platform security, investigate suspected fraud or misuse, and improve reliability;</li>
            <li>keep records of consent, disclosures, transactions and decisions where necessary; and</li>
            <li>comply with applicable law, lawful requests, dispute resolution and the establishment or defence of legal claims.</li>
          </ul>
          <p>We do not treat your general preference to enable lender data sharing as permission to send your information to every lender. Where a lender-specific authorization is required, it will be presented separately before the relevant information is shared.</p>
        </section>
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold text-foreground">4. Legal grounds and your choices</h2>
          <p>Depending on the activity, processing may be based on your consent, steps needed to provide a service you request, compliance with a legal obligation, or another lawful ground permitted by the Data Protection Act No. 3 of 2021. Where consent is the applicable ground, you may withdraw it for future processing. Withdrawal does not make earlier lawful processing unlawful and does not require us to erase information that we must retain on another lawful ground.</p>
          <p>Where information is necessary to provide a requested feature, you may be unable to use that feature if you do not provide it. We will not describe a voluntary choice as mandatory unless it is required for the relevant service or by law.</p>
        </section>
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold text-foreground">5. When information may be shared</h2>
          <p>We may disclose the minimum information reasonably necessary to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>a participating lender you select, where the applicable authorization and lawful basis are in place;</li>
            <li>service providers supporting functions such as hosting, authentication, document processing, communications, monitoring or security, subject to appropriate instructions and safeguards;</li>
            <li>competent authorities, regulators, courts or law-enforcement bodies where disclosure is required or lawfully requested;</li>
            <li>professional advisers or parties involved in a dispute, where necessary and lawful; or</li>
            <li>a successor in a business transaction, subject to applicable confidentiality and data-protection requirements.</li>
          </ul>
          <p>We do not sell your personal information. A lender that receives your information may process it under its own privacy notice, legal duties and lending procedures. You should review that institution's terms before proceeding with a loan application.</p>
        </section>
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold text-foreground">6. Storage, service providers and cross-border processing</h2>
          <p>We use technical and organisational safeguards appropriate to the information and risks, and limit access to authorised persons who need it for their duties. Some service providers may process information in locations outside Zambia. Where a cross-border transfer occurs, Riverbanc will apply the requirements and safeguards required by applicable Zambian law. We do not promise that all personal information is stored exclusively in Zambia.</p>
          <p>No online service can guarantee absolute security. If a personal-data incident occurs, Riverbanc will assess it and take the notification and remediation steps required by applicable law.</p>
        </section>
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold text-foreground">7. Automated calculations and lender decisions</h2>
          <p>The platform may use document extraction and calculations to organise payslip information, estimate affordability or debt-to-income indicators, and prepare a pre-qualification summary. These outputs may contain errors and should be checked against the source information. They are not a promise of approval or a substitute for a lender's own assessment. The participating institution makes its own lending decision and sets its own final terms.</p>
          <p>Where applicable law gives you rights concerning automated processing, you may ask us for information about the processing and raise a concern using the contact details below.</p>
        </section>
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold text-foreground">8. How long information is kept</h2>
          <p>We retain personal information only for as long as it remains necessary for the purpose for which it was collected, subject to the minimum periods or other requirements imposed by law and the need to establish, exercise or defend legal claims. The periods depend on the type of record and the reason it is held; not every record is subject to the same retention period.</p>
          <p>The <Link to="/retention-policy" className="text-primary underline underline-offset-4 hover:text-accent">Data Retention Policy</Link> explains the configured automatic deletion periods, the treatment of records that require further review, and what happens when a purpose ends or an erasure request is made.</p>
        </section>
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold text-foreground">9. Your data protection rights</h2>
          <p>Subject to the Data Protection Act and any lawful exceptions, you may have the right to request access to your personal information, correction of inaccurate or incomplete information, erasure, restriction of processing, objection to processing, or a portable copy of information. You may also withdraw consent where processing relies on consent and object to direct-marketing processing.</p>
          <p>To make a request, email <a className="text-primary underline underline-offset-4 hover:text-accent" href="mailto:support@riverbanc.co.zm?subject=Privacy%20request">support@riverbanc.co.zm</a> with the subject "Privacy request". We may ask for reasonable information to verify your identity and protect your data from disclosure to the wrong person. We will assess the request under applicable law, explain any lawful reason for refusing or limiting it, and respond within the applicable statutory timeframe. An erasure request does not automatically require deletion of records that must lawfully be retained, but any retained information will remain subject to purpose limitation and access controls.</p>
          <p>You may also raise a complaint with the Data Protection Commissioner in Zambia if you believe your personal information has been handled unlawfully.</p>
        </section>
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold text-foreground">10. Cookies, analytics and marketing</h2>
          <p>Essential technical storage may be used to maintain sessions, protect accounts and make the service function. Where non-essential analytics or marketing processing requires a choice or consent, we will apply the relevant preference controls. You may change available preferences through the platform; withdrawing a preference will not affect processing that has another lawful basis.</p>
        </section>
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold text-foreground">11. Changes to this policy</h2>
          <p>We may update this policy to reflect changes to the service, processing practices or applicable law. The current version will be published on this page with its review date. If a change requires renewed notice or consent, we will take the steps required by law.</p>
        </section>
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold text-foreground">12. Contact Riverbanc</h2>
          <p>For privacy questions or requests, contact Riverbanc Technology Limited at <a className="text-primary underline underline-offset-4 hover:text-accent" href="mailto:support@riverbanc.co.zm">support@riverbanc.co.zm</a> or call <a className="text-primary underline underline-offset-4 hover:text-accent" href="tel:+260961874540">+260 961 874 540</a>. Riverbanc is based in Lusaka, Zambia.</p>
        </section>
      </div>
    </main>
    <Footer />
  </div>
);

export default PrivacyPolicy;
