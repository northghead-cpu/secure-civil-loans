import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRBAC } from "@/hooks/useRBAC";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminHero, AdminPageShell, adminCardClass } from "@/components/admin/AdminPageShell";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, CheckCircle2, XCircle, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";

interface KYCProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  nrc_number: string | null;
  kyc_status: string;
  created_at: string;
}

const statusBadge: Record<string, string> = {
  PENDING: "bg-warning/10 text-warning border-warning/20",
  IN_REVIEW: "bg-info/10 text-info border-info/20",
  COMPLETED: "bg-success/10 text-success border-success/20",
  REJECTED: "bg-destructive/10 text-destructive border-destructive/20",
};

const UsersKYC = () => {
  const { permissions, logAction } = useRBAC();
  const [profiles, setProfiles] = useState<KYCProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState<KYCProfile | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const fetchKYC = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, user_id, full_name, nrc_number, kyc_status, created_at")
        .in("kyc_status", ["PENDING", "IN_REVIEW", "REJECTED"])
        .order("created_at", { ascending: false });
      setProfiles((data as unknown as KYCProfile[]) ?? []);
      setLoading(false);
    };
    fetchKYC();
  }, []);

  const statusCounts = {
    pending: profiles.filter(p => p.kyc_status === "PENDING").length,
    inReview: profiles.filter(p => p.kyc_status === "IN_REVIEW").length,
    completed: profiles.filter(p => p.kyc_status === "COMPLETED").length,
    rejected: profiles.filter(p => p.kyc_status === "REJECTED").length,
  };

  const updateKYCStatus = async (userId: string, status: "COMPLETED" | "REJECTED") => {
    if (!permissions.canEditProfiles) {
      toast.error("You don't have permission to update KYC status");
      return;
    }
    setUpdating(true);
    const { error } = await supabase
      .from("profiles")
      .update({ kyc_status: status } as never)
      .eq("user_id", userId);
    if (error) {
      toast.error("Failed to update KYC status");
    } else {
      await logAction("update_kyc_status", userId, "profiles", null, { kyc_status: status });
      toast.success(`KYC ${status === "COMPLETED" ? "verified" : "rejected"}`);
      setProfiles(prev => prev.map(p => p.user_id === userId ? { ...p, kyc_status: status } : p));
    }
    setUpdating(false);
    setSelectedProfile(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <AdminPageShell>
      <AdminHero
        badge="Identity review"
        title="KYC verification queue for civil servant applicants"
        description="Keep document review moving, surface risk early, and push complete files into underwriting without losing the audit trail."
        stats={[
          { label: "Pending review", value: statusCounts.pending.toString(), meta: "Awaiting first operator pass" },
          { label: "In review", value: statusCounts.inReview.toString(), meta: "Currently being verified" },
          { label: "Rejected", value: statusCounts.rejected.toString(), meta: "Files sent back or declined" },
        ]}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className={adminCardClass}>
          <CardContent className="pt-6">
            <div className="text-2xl font-display font-bold text-warning">{statusCounts.pending}</div>
            <p className="text-sm text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card className={adminCardClass}>
          <CardContent className="pt-6">
            <div className="text-2xl font-display font-bold text-info">{statusCounts.inReview}</div>
            <p className="text-sm text-muted-foreground">In Review</p>
          </CardContent>
        </Card>
        <Card className={adminCardClass}>
          <CardContent className="pt-6">
            <div className="text-2xl font-display font-bold text-success">{statusCounts.completed}</div>
            <p className="text-sm text-muted-foreground">Verified</p>
          </CardContent>
        </Card>
        <Card className={adminCardClass}>
          <CardContent className="pt-6">
            <div className="text-2xl font-display font-bold text-destructive">{statusCounts.rejected}</div>
            <p className="text-sm text-muted-foreground">Rejected</p>
          </CardContent>
        </Card>
      </div>

      <Card className={`${adminCardClass} overflow-hidden`}>
        <CardHeader>
          <CardTitle className="text-base font-display">KYC Submissions</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">NRC Number</TableHead>
                <TableHead className="hidden md:table-cell">User ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Submitted</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No KYC submissions found
                  </TableCell>
                </TableRow>
              ) : (
                profiles.map((profile) => (
                  <TableRow key={profile.id}>
                    <TableCell className="font-medium">{profile.full_name ?? "—"}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">{profile.nrc_number ?? "—"}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground font-mono">
                      {profile.user_id.slice(0, 8)}...
                    </TableCell>
                    <TableCell>
                      <Badge className={statusBadge[profile.kyc_status] ?? ""}>{profile.kyc_status}</Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {new Date(profile.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => setSelectedProfile(profile)}
                          title="View details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {permissions.canEditProfiles && (
                          <>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="text-success"
                              onClick={() => updateKYCStatus(profile.user_id, "COMPLETED")}
                              title="Verify"
                              disabled={updating}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="text-destructive"
                              onClick={() => updateKYCStatus(profile.user_id, "REJECTED")}
                              title="Reject"
                              disabled={updating}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedProfile} onOpenChange={() => setSelectedProfile(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">KYC Details</DialogTitle>
          </DialogHeader>
          {selectedProfile && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Full Name</p>
                  <p className="font-medium">{selectedProfile.full_name ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">NRC Number</p>
                  <p className="font-medium">{selectedProfile.nrc_number ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge className={statusBadge[selectedProfile.kyc_status] ?? ""}>
                    {selectedProfile.kyc_status}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Submitted</p>
                  <p className="font-medium">{new Date(selectedProfile.created_at).toLocaleString()}</p>
                </div>
              </div>
              <div className="flex gap-2 border-t pt-4">
                {permissions.canEditProfiles && (
                  <>
                    <Button 
                      className="flex-1 bg-success hover:bg-success/90"
                      onClick={() => updateKYCStatus(selectedProfile.user_id, "COMPLETED")}
                      disabled={updating}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" /> Verify KYC
                    </Button>
                    <Button 
                      variant="destructive"
                      className="flex-1"
                      onClick={() => updateKYCStatus(selectedProfile.user_id, "REJECTED")}
                      disabled={updating}
                    >
                      <XCircle className="h-4 w-4 mr-2" /> Reject KYC
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminPageShell>
  );
};

export default UsersKYC;
