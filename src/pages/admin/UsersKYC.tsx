import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { untypedDb } from "@/integrations/supabase/untyped";
import { useRBAC } from "@/hooks/useRBAC";
import { readAllRows } from "@/lib/readAllRows";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
type Profile = {
  user_id: string;
  full_name: string | null;
  nrc_number: string | null;
  kyc_status: string | null;
  kyc_submitted_at: string | null;
  gov_id_type: string | null;
  gov_id_number: string | null;
  kyc_signature: string | null;
  kyc_review_revision: string;
};
type Document = {
  id: string;
  document_type: string;
  storage_path: string;
  validation_status: string;
  pay_period: string | null;
  rejection_reason: string | null;
};
export default function UsersKYC() {
  const { hasRole } = useRBAC();
  const canReview = hasRole("admin") || hasRole("super_admin");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<Profile | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [documentError, setDocumentError] = useState(false);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setProfiles(
        await readAllRows<Profile>((from, to) =>
          untypedDb
            .from("profiles")
            .select(
              "user_id,full_name,nrc_number,kyc_status,kyc_submitted_at,gov_id_type,gov_id_number,kyc_signature,kyc_review_revision",
            )
            .order("user_id")
            .range(from, to),
        ),
      );
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!selected) return;
    let active = true;
    setDocuments([]);
    setDocumentsLoading(true);
    setDocumentError(false);
    setReason("");
    void readAllRows<Document>((from, to) =>
      untypedDb
        .from("kyc_documents")
        .select(
          "id,document_type,storage_path,validation_status,pay_period,rejection_reason",
        )
        .eq("user_id", selected.user_id)
        .order("id")
        .range(from, to),
    )
      .then((rows) => {
        if (active) setDocuments(rows);
      })
      .catch(() => {
        if (active) setDocumentError(true);
      })
      .finally(() => {
        if (active) setDocumentsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selected]);
  const openDocument = async (document: Document) => {
    const popup = window.open("about:blank", "_blank");
    if (!popup) {
      toast.error("Allow pop-ups to view verification evidence.");
      return;
    }
    popup.opener = null;
    popup.document.body.textContent = "Opening verification evidence…";
    try {
      const { data, error } = await supabase.storage
        .from("kyc-documents")
        .createSignedUrl(document.storage_path, 300);
      if (error || !data?.signedUrl) throw error;
      popup.location.href = data.signedUrl;
    } catch {
      popup.close();
      toast.error(
        "Document could not be opened. Retry or contact an administrator.",
      );
    }
  };
  const review = async (status: "COMPLETED" | "REJECTED") => {
    if (!selected || saving || !selected.kyc_review_revision) return;
    setSaving(true);
    try {
      const { error } = await untypedDb.rpc("review_kyc_verification", {
        _user_id: selected.user_id,
        _status: status,
        _reason: reason.trim() || null,
        _expected_revision: selected.kyc_review_revision,
      });
      if (error) throw error;
      toast.success(
        status === "COMPLETED"
          ? "Verification completed"
          : "Verification returned for correction",
      );
      setSelected(null);
      await load();
    } catch (e) {
      if ((e as { message?: string })?.message?.includes("submission changed")) {
        setSelected(null);
        await load();
      }
      toast.error(
        (e as { message?: string })?.message || "Review could not be saved",
      );
    } finally {
      setSaving(false);
    }
  };
  const counts = {
    review: profiles.filter((p) => p.kyc_status === "IN_REVIEW").length,
    verified: profiles.filter((p) =>
      ["COMPLETED", "VERIFIED"].includes(p.kyc_status || ""),
    ).length,
    rejected: profiles.filter((p) => p.kyc_status === "REJECTED").length,
  };
  return (
    <main className="space-y-5">
      <h1 className="text-2xl font-semibold">
        Identity and employment verification
      </h1>
      <p>
        In review: {error ? "Unavailable" : counts.review} · Verified:{" "}
        {error ? "Unavailable" : counts.verified} · Returned:{" "}
        {error ? "Unavailable" : counts.rejected}
      </p>
      <Button variant="outline" disabled={loading} onClick={() => void load()}>
        Refresh
      </Button>
      {error ? (
        <p role="alert">
          Verification records could not load. Use Refresh to retry.
        </p>
      ) : loading ? (
        <p role="status">Loading verification records…</p>
      ) : (
        <Card>
          <CardContent className="p-4 space-y-3">
            {profiles
              .filter(
                (p) =>
                  p.kyc_submitted_at ||
                  ["PENDING", "IN_REVIEW", "REJECTED"].includes(
                    p.kyc_status || "",
                  ),
              )
              .map((p) => (
                <div
                  key={p.user_id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b py-3"
                >
                  <div>
                    <p className="font-medium">
                      {p.full_name || "Unnamed customer"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {p.kyc_status} ·{" "}
                      {p.kyc_submitted_at
                        ? new Date(p.kyc_submitted_at).toLocaleString()
                        : "No submission time recorded"}
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => setSelected(p)}>
                    Review evidence
                  </Button>
                </div>
              ))}
            {profiles.length === 0 && <p>No verification records.</p>}
          </CardContent>
        </Card>
      )}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open && !saving) setSelected(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Verification evidence</DialogTitle>
            <DialogDescription>Review the submitted evidence before recording a verification decision.</DialogDescription>
          </DialogHeader>
          {selected && (
            <>
              <p>
                {selected.full_name} · {selected.nrc_number}
              </p>
              <p className="text-sm">
                Government ID: {selected.gov_id_type || "Not recorded"} ·{" "}
                {selected.gov_id_number || "Not recorded"}
              </p>
              <p className="text-sm">
                Submission signature: {selected.kyc_signature || "Not recorded"}
              </p>
              {documentsLoading ? (
                <p>Loading evidence…</p>
              ) : documentError ? (
                <p role="alert">
                  Evidence could not load. Close and reopen to retry.
                </p>
              ) : (
                <div className="space-y-2">
                  {documents.map((d) => (
                    <div key={d.id} className="rounded border p-3">
                      <p>
                        {d.document_type} {d.pay_period} · {d.validation_status}
                      </p>
                      {d.rejection_reason && (
                        <p className="text-sm">{d.rejection_reason}</p>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void openDocument(d)}
                      >
                        Open {d.document_type.toLowerCase().replace(/_/g, " ")}{" "}
                        evidence
                      </Button>
                    </div>
                  ))}
                  {!documents.length && (
                    <p>No submitted evidence is recorded.</p>
                  )}
                </div>
              )}
              {canReview && selected.kyc_status === "IN_REVIEW" && (
                <>
                  <label htmlFor="review-reason">
                    Reason for correction (required when returning)
                  </label>
                  <textarea
                    id="review-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full border rounded p-2"
                    maxLength={2000}
                  />
                  <div className="flex gap-3">
                    <Button
                      disabled={
                        saving ||
                        documentsLoading ||
                        documentError ||
                        !documents.length ||
                        ["COMPLETED", "VERIFIED"].includes(
                          selected.kyc_status || "",
                        )
                      }
                      onClick={() => void review("COMPLETED")}
                    >
                      Verify KYC
                    </Button>
                    <Button
                      variant="outline"
                      disabled={
                        saving ||
                        documentsLoading ||
                        documentError ||
                        reason.trim().length < 5
                      }
                      onClick={() => void review("REJECTED")}
                    >
                      Return for correction
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
