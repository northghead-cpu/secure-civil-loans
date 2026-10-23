import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
export default function SystemSettings() {
  return (
    <main className="max-w-4xl space-y-5">
      <h1 className="text-2xl font-semibold">Platform configuration</h1>
      <p className="text-muted-foreground">
        Operational settings and integration availability. Changes to server
        configuration are deployed through the reviewed release process.
      </p>
      <Card>
        <CardHeader>
          <CardTitle>Identity and support</CardTitle>
        </CardHeader>
        <CardContent>
          Riverbanc Technology Limited · support@riverbanc.co.zm
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p>Administrator MFA is required and enforced by the server.</p>
          <p>
            Client idle timeout: 30 minutes. Absolute session cap: 12 hours.
            These are additional client protections; server session limits are
            managed in Auth configuration.
          </p>
          <p>
            IP allowlisting and public maintenance mode have no configured
            application control.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Integrations and delivery</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p>
            Use Customer Data Workbook for its actual connection status and sync
            controls.
          </p>
          <p>
            Payroll connections are an administrative registry. Automated
            provider connection testing is unavailable.
          </p>
          <p>
            Application updates are available in the dashboard. Application
            email, SMS and Slack delivery are not configured by this screen.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
