import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type ConsentKey =
  | "consent_marketing"
  | "consent_data_sharing_lenders"
  | "consent_crb_check"
  | "consent_analytics";

const ITEMS: { key: ConsentKey; title: string; description: string; required?: boolean }[] = [
  { key: "consent_crb_check", title: "Credit Reference Bureau (CRB) Checks", description: "Allow Riverbanc to query TransUnion/CRB Zambia to assess your creditworthiness during loan applications." },
  { key: "consent_data_sharing_lenders", title: "Sharing with Partner Lenders", description: "Share your KYC, payroll and affordability data with Bank of Zambia-licensed partner lenders for loan matching." },
  { key: "consent_analytics", title: "Product Analytics", description: "Allow anonymized usage analytics to help us improve the platform. No personal data is sold." },
  { key: "consent_marketing", title: "Marketing Communications", description: "Receive product updates, loan offers and financial-wellness tips via email and SMS. You can opt out at any time." },
];

const GranularConsentSection = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [values, setValues] = useState<Record<ConsentKey, boolean>>({
    consent_marketing: false,
    consent_data_sharing_lenders: false,
    consent_crb_check: false,
    consent_analytics: false,
  });
  const [saving, setSaving] = useState<ConsentKey | null>(null);

  useEffect(() => {
    if (!profile) return;
    setValues({
      consent_marketing: profile.consent_marketing,
      consent_data_sharing_lenders: profile.consent_data_sharing_lenders,
      consent_crb_check: profile.consent_crb_check,
      consent_analytics: profile.consent_analytics,
    });
  }, [profile]);

  const toggle = async (key: ConsentKey, next: boolean) => {
    if (!user) return;
    setSaving(key);
    const previous = values[key];
    setValues((v) => ({ ...v, [key]: next }));
    const update: Partial<Record<ConsentKey, boolean>> = { [key]: next };
    const { error } = await supabase
      .from("profiles")
      .update(update)
      .eq("user_id", user.id);
    if (error) {
      setValues((v) => ({ ...v, [key]: previous }));
      toast.error("Could not update preference. Please try again.");
    } else {
      toast.success("Preference updated");
      await refreshProfile();
    }
    setSaving(null);
  };

  const updatedAt = profile?.consents_updated_at;

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg font-display flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />Privacy & Consent Preferences</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-foreground/80 leading-relaxed">Manage how Riverbanc uses your data. Under the Data Protection Act 2021, you may withdraw any consent at any time. Withdrawing CRB or lender-sharing consent may prevent new loan applications from being processed.</p>
        <div className="divide-y divide-border/60 rounded-lg border border-border/50">
          {ITEMS.map((item) => (
            <div key={item.key} className="flex items-start justify-between gap-4 p-4">
              <div className="flex-1 min-w-0"><Label htmlFor={item.key} className="text-sm font-medium text-foreground">{item.title}</Label><p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.description}</p></div>
              <div className="flex items-center gap-2 shrink-0 pt-1">{saving === item.key && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}<Switch id={item.key} checked={values[item.key]} disabled={saving === item.key} onCheckedChange={(v) => toggle(item.key, v)} /></div>
            </div>
          ))}
        </div>
        {updatedAt && <p className="text-xs text-muted-foreground">Last updated {new Date(updatedAt).toLocaleString("en-ZA", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>}
      </CardContent>
    </Card>
  );
};

export default GranularConsentSection;
