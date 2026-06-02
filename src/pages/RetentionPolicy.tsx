import Navbar from "@/components/Navbar";

const RetentionPolicy = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-display font-bold text-foreground mb-6">Data Retention Policy</h1>
        <div className="space-y-4 text-foreground/90 leading-relaxed">
          <p>Compliant with the Data Protection Act of 2021 and Zambian financial sector regulations.</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Incomplete/abandoned applications:</strong> Automatically purged after 12 months.</li>
            <li><strong>Active accounts:</strong> Retained for the duration of the service agreement.</li>
            <li>
              <strong>Concluded credit facilities:</strong> Transactional and identity records are securely
              archived for a minimum of 7 years to satisfy the statutory record-keeping obligations of the
              Banking and Financial Services Act and the Financial Intelligence Centre (FIC) Act.
            </li>
          </ul>
        </div>
      </main>
    </div>
  );
};

export default RetentionPolicy;
