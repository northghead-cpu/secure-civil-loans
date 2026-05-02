import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface AuditLog {
  id: string;
  user_id: string;
  role: string;
  action_performed: string;
  record_id: string | null;
  table_name: string | null;
  old_value: unknown;
  new_value: unknown;
  created_at: string;
}

const actionBadgeColor = (action: string): string => {
  if (action.includes("approve") || action.includes("resolve")) return "bg-success/10 text-success";
  if (action.includes("reject") || action.includes("delete")) return "bg-destructive/10 text-destructive";
  if (action.includes("process") || action.includes("update")) return "bg-info/10 text-info";
  return "bg-warning/10 text-warning";
};

const UsersHistory = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    const { data, error } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (!error && data) setLogs(data as AuditLog[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">User History</h1>
        <p className="text-sm text-muted-foreground">Complete activity log across all users (audit trail)</p>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead className="hidden sm:table-cell">Table</TableHead>
                  <TableHead className="hidden md:table-cell">Record</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="hidden lg:table-cell">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No audit logs yet</TableCell></TableRow>
                ) : logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Badge className={actionBadgeColor(log.action_performed)}>
                        {log.action_performed.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">{log.table_name || "—"}</TableCell>
                    <TableCell className="hidden md:table-cell font-mono text-xs text-muted-foreground">{log.record_id ? log.record_id.substring(0, 12) + "…" : "—"}</TableCell>
                    <TableCell><Badge variant="outline">{log.role}</Badge></TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">{new Date(log.created_at).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UsersHistory;
