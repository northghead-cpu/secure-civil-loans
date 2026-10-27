import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { untypedDb } from "@/integrations/supabase/untyped";
import { supabase } from "@/integrations/supabase/client";
import { useRBAC } from "@/hooks/useRBAC";
import { readAllRows } from "@/lib/readAllRows";
import { handoffStatusLabel } from "@/lib/handoffProgress";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
type Handoff = {
  id: string;
  user_id: string;
  lender_name: string;
  status: string;
  requested_amount: number | null;
  created_at: string;
  authorization_text: string;
  delivery_reference: string | null;
  handshake_transfer_status: "pending" | "accepted" | null;
  handshake_transfer_last_attempt_at: string | null;
  handshake_transfer_last_error: string | null;
};
export default function HandoffQueue() {
  const { hasRole } = useRBAC();
  const canManage = hasRole("admin") || hasRole("super_admin");
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState<Handoff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reference, setReference] = useState("");
  const [attested, setAttested] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const current = rows.find((row) => row.id === params.get("id"));
  const load = useCallback(async () => {
    setError(false);
    setLoading(true);
    try {
      setRows(
        await readAllRows<Handoff>((from, to) =>
          untypedDb
            .from("application_handoffs")
            .select(
              "id,user_id,lender_name,status,requested_amount,created_at,authorization_text,delivery_reference,handshake_transfer_status,handshake_transfer_last_attempt_at,handshake_transfer_last_error",
            )
            .order("created_at", { ascending: false })
            .order("id")
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
    const channel = supabase
      .channel("admin-handoff-queue")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "application_handoffs" },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);
  useEffect(() => {
    setReference("");
    setAttested(false);
  }, [current?.id]);
  const retryHandshake = async () => {
    if (!current || !canManage || retrying ||
        !["authorized", "preparing", "sent_to_lender"].includes(current.status) ||
        current.handshake_transfer_status === "accepted") return;
    setRetrying(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-handshake-referral", {
        body: { handoff_id: current.id },
      });
      if (error || data?.accepted !== true) {
        toast.error("Handshake receipt is not confirmed", {
          description: "Check the integration status before retrying again.",
        });
      } else {
        toast.success("Handshake referral accepted", {
          description: "Handshake acceptance does not confirm full lender delivery or a lending decision.",
        });
      }
      await load();
    } catch {
      toast.error("Handshake retry failed", { description: "The transfer outcome is unconfirmed." });
    } finally {
      setRetrying(false);
    }
  };
  const advance = async (status: "preparing" | "sent_to_lender") => {
    if (
      !current ||
      saving ||
      !canManage ||
      (status === "sent_to_lender" &&
        (!attested || reference.trim().length < 5))
    )
      return;
    setSaving(true);
    try {
      const { error } = await untypedDb.rpc("advance_application_handoff", {
        _id: current.id,
        _status: status,
        _reference: reference.trim() || null,
      });
      if (error) throw error;
      toast.success("Handoff milestone recorded");
      await load();
    } catch (e) {
      toast.error(
        (e as { message?: string })?.message ||
          "Milestone could not be recorded",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-semibold">Lender handoff queue</h1>
      <p className="text-sm text-muted-foreground">
        Prepare authorised information, arrange secure delivery through the
        agreed institution channel, then record the actual delivery reference.
        Recording a milestone does not send files or determine a lending
        decision.
      </p>
      <Button variant="outline" disabled={loading} onClick={() => void load()}>
        Refresh handoffs
      </Button>
      {error ? (
        <p role="alert">Handoffs could not load. Use Refresh to retry.</p>
      ) : loading ? (
        <p role="status">Loading handoffs…</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <Card key={row.id}>
              <CardContent className="p-4 flex flex-wrap justify-between items-center gap-3">
                <div>
                  <p className="font-medium">
                    {row.lender_name} · K
                    {row.requested_amount?.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {handoffStatusLabel(row.status)} ·{" "}
                    {new Date(row.created_at).toLocaleString()}
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setParams({ id: row.id })}
                >
                  Review handoff {row.id.slice(0, 8)}
                </Button>
              </CardContent>
            </Card>
          ))}
          {!rows.length && <p>No authorised lender handoffs.</p>}
        </div>
      )}
      {current && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <h2 className="font-semibold">Application {current.id}</h2>
            <p>Customer reference: {current.user_id}</p>
            <p className="whitespace-pre-wrap break-words text-sm">
              {current.authorization_text.replace(/\\n/g, "\n")}
            </p>
            <p>Status: {handoffStatusLabel(current.status)}</p>
            <div className="rounded-md border p-4 space-y-2">
              <h3 className="font-semibold">Handshake referral transfer</h3>
              <p>Transfer status: {current.handshake_transfer_status === "accepted" ? "Accepted by Handshake" : "Pending / unconfirmed"}</p>
              {current.handshake_transfer_last_attempt_at && <p className="text-sm text-muted-foreground">Last attempt: {new Date(current.handshake_transfer_last_attempt_at).toLocaleString()}</p>}
              {current.handshake_transfer_last_error && <p className="text-sm text-destructive">Last error: {current.handshake_transfer_last_error}</p>}
              {canManage && ["authorized", "preparing", "sent_to_lender"].includes(current.status) && current.handshake_transfer_status !== "accepted" && (
                <Button disabled={retrying || saving} onClick={() => void retryHandshake()}>
                  {retrying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  {retrying ? "Sending Handshake referral…" : current.handshake_transfer_last_attempt_at ? "Retry Handshake transfer" : "Send Handshake referral"}
                </Button>
              )}
            </div>
            {current.delivery_reference && (
              <p>Delivery reference: {current.delivery_reference}</p>
            )}
            {canManage && current.status === "authorized" && (
              <Button
                disabled={saving}
                onClick={() => void advance("preparing")}
              >
                Start preparing authorised handoff
              </Button>
            )}
            {canManage && current.status === "preparing" && (
              <>
                <label htmlFor="delivery-reference">
                  Actual delivery reference
                </label>
                <Input
                  id="delivery-reference"
                  value={reference}
                  maxLength={500}
                  onChange={(e) => setReference(e.target.value)}
                />
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={attested}
                    onChange={(e) => setAttested(e.target.checked)}
                  />
                  <span>
                    I verified delivery to the authorised institution using our
                    agreed secure channel.
                  </span>
                </label>
                <Button
                  disabled={saving || !attested || reference.trim().length < 5}
                  onClick={() => void advance("sent_to_lender")}
                >
                  Record confirmed delivery
                </Button>
              </>
            )}
            <Button variant="outline" onClick={() => setParams({})}>
              Close handoff
            </Button>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
