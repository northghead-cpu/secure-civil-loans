import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminHero, AdminPageShell, adminCardClass } from "@/components/admin/AdminPageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Loader2, ScrollText } from "lucide-react";
import { useRBAC } from "@/hooks/useRBAC";

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

const ComplianceAuditLogs = () => {
  const { permissions } = useRBAC();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");

  useEffect(() => {
    const fetchLogs = async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (!error && data) setLogs(data as unknown as AuditLog[]);
      setLoading(false);
    };
    fetchLogs();
  }, []);

  const actions = useMemo(() => [...new Set(logs.map((log) => log.action_performed))], [logs]);

  const filtered = useMemo(() => {
    let result = logs;
    if (search) {
      const query = search.toLowerCase();
      result = result.filter(
        (log) =>
          log.user_id.toLowerCase().includes(query) ||
          log.action_performed.toLowerCase().includes(query) ||
          log.record_id?.toLowerCase().includes(query) ||
          log.role.toLowerCase().includes(query)
      );
    }
    if (actionFilter !== "all") result = result.filter((log) => log.action_performed === actionFilter);
    if (dateFilter) result = result.filter((log) => log.created_at.startsWith(dateFilter));
    return result;
  }, [logs, search, actionFilter, dateFilter]);

  if (!permissions.canViewAuditLogs) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        You don&apos;t have permission to view audit logs.
      </div>
    );
  }

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
        badge="Compliance trail"
        title="Audit logs for role actions, record changes, and approvals"
        description="Search the full action trail when you need to understand who changed what, which role executed it, and when it happened."
        stats={[
          { label: "Entries loaded", value: logs.length.toString(), meta: "Latest audit records fetched" },
          { label: "Action types", value: actions.length.toString(), meta: "Distinct logged operations" },
          { label: "Visible results", value: filtered.length.toString(), meta: "Rows matching the current filters" },
        ]}
      />

      <Card className={adminCardClass}>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by user, action, record ID, or role..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="All Actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {actions.map((action) => (
                  <SelectItem key={action} value={action}>
                    {action}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value)}
              className="w-full sm:w-[180px]"
            />
          </div>
        </CardContent>
      </Card>

      <Card className={`${adminCardClass} overflow-hidden`}>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Record ID</TableHead>
                <TableHead className="hidden md:table-cell">Old Value</TableHead>
                <TableHead className="hidden md:table-cell">New Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                    <ScrollText className="mx-auto mb-2 h-8 w-8 opacity-40" />
                    No audit log entries found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(log.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {log.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm font-medium">{log.action_performed}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{log.record_id ?? "-"}</TableCell>
                    <TableCell className="hidden max-w-[200px] truncate text-xs text-muted-foreground md:table-cell">
                      {log.old_value ? JSON.stringify(log.old_value) : "-"}
                    </TableCell>
                    <TableCell className="hidden max-w-[200px] truncate text-xs text-muted-foreground md:table-cell">
                      {log.new_value ? JSON.stringify(log.new_value) : "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AdminPageShell>
  );
};

export default ComplianceAuditLogs;
