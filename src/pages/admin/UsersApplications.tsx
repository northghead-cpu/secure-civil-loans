import { useState } from "react";
import HandoffQueue from "@/components/admin/HandoffQueue";
import LegacyApplications from "./LegacyApplications";
import { Button } from "@/components/ui/button";
export default function UsersApplications() {
  const [legacy, setLegacy] = useState(false);
  return (
    <main className="space-y-5">
      <div className="flex flex-wrap gap-3">
        <Button
          variant={legacy ? "outline" : "default"}
          onClick={() => setLegacy(false)}
        >
          Current lender handoffs
        </Button>
        <Button
          variant={legacy ? "default" : "outline"}
          onClick={() => setLegacy(true)}
        >
          Legacy application records
        </Button>
      </div>
      {legacy ? <LegacyApplications /> : <HandoffQueue />}
    </main>
  );
}
