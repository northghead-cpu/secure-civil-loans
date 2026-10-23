import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useRBAC } from "@/hooks/useRBAC";
import { untypedDb } from "@/integrations/supabase/untyped";
import { supabase } from "@/integrations/supabase/client";
import {
  NotificationCenter,
  type BorrowerNotification,
} from "@/components/notifications/NotificationCenter";
import { Button } from "@/components/ui/button";
export default function BorrowerUpdates() {
  const { user } = useAuth();
  const { roles, loading } = useRBAC();
  const navigate = useNavigate();
  const eligible =
    !!user &&
    !loading &&
    roles.includes("user") &&
    roles.every((role) => role === "user");
  const [items, setItems] = useState<BorrowerNotification[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const load = useCallback(async () => {
    if (!eligible || !user) return;
    const { data, error } = await untypedDb
      .from("notifications")
      .select("id,title,message,created_at,read_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setLoadedFor(user.id);
    setError(Boolean(error));
    if (!error)
      setItems(
        (data || []).map((row) => ({
          id: row.id,
          title: row.title,
          message: row.message,
          createdAt: row.created_at,
          read: !!row.read_at,
          type: "application_update" as const,
          href: "/profile",
        })),
      );
  }, [eligible, user]);
  useEffect(() => {
    setItems([]);
    if (!eligible || !user) return;
    void load();
    const channel = supabase
      .channel(`borrower-updates-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [eligible, user, load]);
  if (!eligible) return null;
  if (error || loadedFor !== user?.id)
    return (
      <Button size="sm" variant="ghost" onClick={() => void load()}>
        Retry updates
      </Button>
    );
  return (
    <NotificationCenter
      key={user?.id}
      notifications={items}
      onRead={async (id) => {
        const { error } = await untypedDb
          .from("notifications")
          .update({ read_at: new Date().toISOString() })
          .eq("id", id)
          .select("id")
          .single();
        if (error) setError(true);
      }}
      onNavigate={(href) => navigate(href)}
    />
  );
}
