import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const ChangePasswordPage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const validate = () => {
    if (!currentPassword || !newPassword || !confirmPassword) return "Complete all password fields.";
    if (newPassword.length < 8) return "Your new password must be at least 8 characters.";
    if (newPassword === currentPassword) return "Your new password must be different from your current password.";
    if (newPassword !== confirmPassword) return "New password and confirmation do not match.";
    return null;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user?.email) return;
    const validationError = validate();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSaving(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
      if (signInError) throw new Error("Your current password is incorrect.");

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      toast.success("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      navigate("/profile");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We couldn't change your password. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-2xl pt-24">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-display flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" />Change password</CardTitle>
            <p className="text-sm text-muted-foreground">Update your Riverbanc account password while signed in.</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="current-password">Current password</Label>
                <div className="relative"><Input id="current-password" type={showCurrent ? "text" : "password"} autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="pr-10" /> <button type="button" aria-label={showCurrent ? "Hide current password" : "Show current password"} onClick={() => setShowCurrent(!showCurrent)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"><span className="sr-only">Toggle password visibility</span>{showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <div className="relative"><Input id="new-password" type={showNew ? "text" : "password"} autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="pr-10" /> <button type="button" aria-label={showNew ? "Hide new password" : "Show new password"} onClick={() => setShowNew(!showNew)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"><span className="sr-only">Toggle password visibility</span>{showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
                <p className="text-xs text-muted-foreground">Use at least 8 characters.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <div className="relative"><Input id="confirm-password" type={showConfirm ? "text" : "password"} autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pr-10" /> <button type="button" aria-label={showConfirm ? "Hide confirmation password" : "Show confirmation password"} onClick={() => setShowConfirm(!showConfirm)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"><span className="sr-only">Toggle password visibility</span>{showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
              </div>
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => navigate("/profile")} disabled={saving}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Changing...</> : "Change password"}</Button></div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ChangePasswordPage;
