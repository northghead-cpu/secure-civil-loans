import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const RetentionPolicy = () => (
  <div className="min-h-screen bg-background flex flex-col">
    <Helmet>
      <title>Data Retention Policy — Riverbanc</title>
      <meta name="description" content="How Riverbanc retains, reviews, deletes and anonymises personal information under Zambia's Data Protection Act and applicable record-keeping duties." />
      <link rel="canonical" href="https://riverbanc.co.zm/retention-policy" />
      <meta property="og:title" content="Data Retention Policy — Riverbanc" />
      <meta property="og:description" content="The retention schedule, automatic deletion rules and exceptions that apply to personal information held by Riverbanc." />
      <meta property="og:url" content="https://riverbanc.co.zm/retention-policy" />
    </Helmet>
    <Navbar />
    <main className="container mx-auto w-full max-w-4xl px-4 lg:px-8 pt-28 pb-16 flex-1">
      <header className="mb-10 border-b border-border pb-8">
        <p className="text-sm font-semibold tracking-wide uppercase text-accent mb-3">Legal &amp; privacy</p>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-4">Data Retention Policy</h1>
        <p className="text-base leading-7 text-muted-foreground max-w-3xl">This policy explains how long Riverbanc keeps different categories of information, which records the platform deletes automatically, what happens when the purpose for holding a record ends, and when a lawful exception may require further retention.</p>
        <p className="text-sm text-muted-foreground mt-4">Last reviewed: 11 October 2026</p>
      </header>
      <div className="space-y-9 text-base leading-7 text-foreground/90">
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold text-foreground">1. Purpose and legal framework</h2>
          <p>Riverbanc Technology Limited ("Riverbanc", "we", "us" or "our") operates a loan-comparison technology platform. We are not a lender. This policy applies the storage-limitation and retention requirements of the Data Protection Act No. 3 of 2021, including section 51, together with any other legal or contractual record-keeping duty that actually applies to a particular record or service.</p>
          <p>Personal information must not be kept indefinitely simply because it was once collected. We retain it while it is relevant to a specified purpose and for any additional period required by applicable law, then securely delete it or irreversibly anonymise it when retention is no longer justified.</p>
        </section>
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold text-foreground">2. Automatic deletion rules currently configured</h2>
          <p>The platform runs an automated retention task daily at 02:00 UTC. It deletes the following records when the stated conditions are met:</p>
          <div className="space-y-4">
            <div className="rounded-lg border border-border p-4 sm:p-5">
              <h3 className="font-semibold text-foreground mb-1">Draft, abandoned or incomplete loan applications — 12 months</h3>
              <p>Applications created more than 12 months ago are deleted by the scheduled task only where the status is <em>draft</em>, <em>abandoned</em> or <em>incomplete</em> and no decision has been recorded. Submitted applications, applications with a decision, and records in other statuses are not deleted by this rule.</p>
            </div>
            <div className="rounded-lg border border-border p-4 sm:p-5">
              <h3 className="font-semibold text-foreground mb-1">Platform notifications — 24 months</h3>
              <p>Notification records older than 24 months are deleted by the scheduled task. This rule applies to notification records, not automatically to the underlying account, application or correspondence.</p>
            </div>
            <div className="rounded-lg border border-border p-4 sm:p-5">
              <h3 className="font-semibold text-foreground mb-1">Edge request logs — 90 days</h3>
              <p>Edge request-log records older than 90 days are deleted by the scheduled task. If a record is needed for a security investigation, legal claim or other lawful hold, it may need to be preserved under controlled access instead of being deleted on the ordinary schedule.</p>
            </div>
          </div>
          <p>The task records a summary of its deletion counts for authorised administration and compliance review. These rules are limited to the record types and conditions described above; they do not mean every record in an account is automatically deleted after 12 months.</p>
        </section>
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold text-foreground">3. Other categories of information</h2>
          <p>The categories below are not covered by the three automatic deletion rules above. Their retention must be assessed by purpose, applicable law and any documented arrangement with a participating institution. Account closure alone does not mean every related record is automatically erased.</p>
          <ul className="list-disc pl-6 space-y-3">
            <li><strong>Account and profile information:</strong> retained while the account is active and the information is needed to operate the service. After closure, information must be reviewed for deletion or anonymisation once it is no longer necessary, subject to applicable statutory minimum periods, unresolved matters and lawful claims.</li>
            <li><strong>Identity, employment and payslip documents:</strong> retained only to support the relevant verification, affordability, pre-qualification or authorised referral purpose and any applicable legal or contractual record-keeping requirement. Unneeded document copies should be erased or anonymised when the permitted retention period ends.</li>
            <li><strong>Submitted applications and referral records:</strong> retained while required to administer the requested service, evidence what was submitted or authorised, resolve a complaint, or meet an applicable legal or contractual obligation. A completed or decided application is not covered by the automatic 12-month draft-application purge.</li>
            <li><strong>Consent and disclosure history:</strong> retained as evidence of the choices recorded, the relevant purpose and any disclosures made, for as long as that evidence is necessary or a lawful retention obligation applies. Consent history is not currently covered by the automated deletion task.</li>
            <li><strong>Subscription and payroll-deduction records:</strong> retained for administration, reconciliation, accounting, dispute handling and any applicable statutory or contractual period. Only records needed for those purposes should be kept.</li>
            <li><strong>Support and complaint records:</strong> retained while needed to answer the request, document the outcome, address a recurring service issue or handle a dispute or legal claim. Access is limited to personnel who need the record for those purposes.</li>
          </ul>
        </section>
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold text-foreground">4. Financial-sector records and lender instructions</h2>
          <p>Some financial institutions are subject to specific record-keeping periods, which may include a minimum period of ten years under applicable financial-services or financial-intelligence requirements. Riverbanc is a comparison technology platform, not a lender; a lender's statutory obligation does not automatically make every record held by Riverbanc subject to the same period.</p>
          <p>Where Riverbanc is legally required, or is lawfully instructed under a documented arrangement to retain a defined record on behalf of a participating institution, the relevant record will be retained for the period that applies to that record and arrangement. We will not apply a blanket seven- or ten-year period to every user's information without a valid basis.</p>
        </section>
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold text-foreground">5. What happens when a retention period ends</h2>
          <p>When a record reaches the end of its applicable retention period, Riverbanc will delete it from active systems or irreversibly anonymise it, unless a lawful exception requires further retention. Where deletion is used, the record should no longer be available for ordinary account or business use. Where anonymisation is used, identifying information must be removed so the remaining information cannot reasonably identify you.</p>
          <p>Deletion from active systems may not remove a record from every backup at the same instant. Backup copies are managed under the applicable backup cycle and are not used as ordinary working records. If a backup is restored for disaster recovery, deletion requests and expired records must be reapplied where applicable. Records subject to a legal hold are access-restricted and deleted when the hold ends and no other retention basis remains.</p>
        </section>
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold text-foreground">6. Erasure requests and account closure</h2>
          <p>You may request erasure under section 60 of the Data Protection Act. We will verify the request, assess the purpose and lawful basis for each relevant category, and erase information without undue delay where the legal conditions are met. An active loan or financial obligation does not automatically justify retaining every category of your data; any continued retention must have a valid legal, contractual or claims-related basis.</p>
          <p>If a record must lawfully be retained, we will explain the reason where appropriate, limit its use to the permitted purpose and protect it against unnecessary access. Where practicable and required by law, we will also communicate an erasure or correction to recipients to whom the affected information was disclosed.</p>
          <p>To make a request, email <a className="text-primary underline underline-offset-4 hover:text-accent" href="mailto:support@riverbanc.co.zm?subject=Privacy%20request">support@riverbanc.co.zm</a> with the subject "Privacy request". We may ask for information needed to verify your identity. The applicable statutory response timeframe will be observed.</p>
        </section>
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold text-foreground">7. Security and accountability</h2>
          <p>Retention is not permission for unrestricted access. Records retained for a lawful purpose remain subject to access controls and appropriate technical and organisational safeguards. The platform's automated retention task records the categories and counts it deletes; access to retention-run information is restricted to authorised administration and compliance roles.</p>
          <p>This policy describes the automatic deletion rules currently configured in the application and the principles governing other records. It does not represent that every data category has an automatic expiry timer. Riverbanc must continue to review categories without an automated expiry rule and maintain a documented retention decision for them.</p>
        </section>
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold text-foreground">8. Changes to this policy</h2>
          <p>We may update this policy when the platform's retention controls, the services provided or applicable law changes. The current version and review date will be published on this page. A policy update does not authorise retention beyond what is necessary or lawful.</p>
        </section>
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold text-foreground">9. Contact</h2>
          <p>For questions about retention or to request access, correction or erasure, contact Riverbanc Technology Limited at <a className="text-primary underline underline-offset-4 hover:text-accent" href="mailto:support@riverbanc.co.zm">support@riverbanc.co.zm</a> or call <a className="text-primary underline underline-offset-4 hover:text-accent" href="tel:+260961874540">+260 961 874 540</a>. You may also review the <Link to="/privacy-policy" className="text-primary underline underline-offset-4 hover:text-accent">Privacy Policy</Link>.</p>
        </section>
      </div>
    </main>
    <Footer />
  </div>
);

export default RetentionPolicy;
