import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Search, Download, Eye, UserCheck, UserX, Users, ArrowUpDown, Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  nrc_number: string | null;
  phone: string | null;
  email: string | null;
  employer: string | null;
  employee_number: string | null;
  salary: number | null;
  account_status: string;
  created_at: string;
}

const statusBadge: Record<string, string> = {
  active: "bg-success/10 text-success border-success/20",
  pending: "bg-warning/10 text-warning border-warning/20",
  suspended: "bg-destructive/10 text-destructive border-destructive/20",
};

const UserManagement = () => {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [employerFilter, setEmployerFilter] = useState("all");
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Failed to load users");
      return;
    }
    setUsers((data as unknown as Profile[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();

    const channel = supabase
      .channel("profiles-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => fetchUsers()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const employers = useMemo(
    () => [...new Set(users.map((u) => u.employer).filter(Boolean))] as string[],
    [users]
  );

  const filtered = useMemo(() => {
    let result = users;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (u) =>
          u.full_name?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          u.phone?.includes(q) ||
          u.nrc_number?.toLowerCase().includes(q)
      );
    }

    if (employerFilter !== "all") {
      result = result.filter((u) => u.employer === employerFilter);
    }

    result = [...result].sort((a, b) => {
      const da = new Date(a.created_at).getTime();
      const db = new Date(b.created_at).getTime();
      return sortAsc ? da - db : db - da;
    });

    return result;
  }, [users, search, employerFilter, sortAsc]);

  const updateStatus = async (userId: string, status: string) => {
    const { error } = await supabase
      .from("profiles")
      .update({ account_status: status } as any)
      .eq("user_id", userId);
    if (error) {
      toast.error("Failed to update status");
      return;
    }
    toast.success(`User ${status === "active" ? "approved" : "suspended"}`);
    setSelectedUser(null);
  };

  const exportCSV = () => {
    const headers = [
      "Full Name", "NRC/ID", "Phone", "Email", "Employer",
      "Employee No.", "Salary", "Status", "Registered",
    ];
    const rows = filtered.map((u) => [
      u.full_name ?? "",
      u.nrc_number ?? "",
      u.phone ?? "",
      u.email ?? "",
      u.employer ?? "",
      u.employee_number ?? "",
      u.salary?.toString() ?? "",
      u.account_status,
      new Date(u.created_at).toLocaleString(),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  const statusCounts = useMemo(() => ({
    total: users.length,
    active: users.filter((u) => u.account_status === "active").length,
    pending: users.filter((u) => u.account_status === "pending").length,
    suspended: users.filter((u) => u.account_status === "suspended").length,
  }), [users]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">User Management</h1>
          <p className="text-sm text-muted-foreground">
            {statusCounts.total} registered users
          </p>
        </div>
        <Button variant="outline" onClick={exportCSV} className="gap-2">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <span className="text-2xl font-display font-bold text-foreground">{statusCounts.total}</span>
            </div>
            <p className="text-sm text-muted-foreground">Total Users</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-display font-bold text-success">{statusCounts.active}</div>
            <p className="text-sm text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-display font-bold text-warning">{statusCounts.pending}</div>
            <p className="text-sm text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-display font-bold text-destructive">{statusCounts.suspended}</div>
            <p className="text-sm text-muted-foreground">Suspended</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, phone, or NRC…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={employerFilter} onValueChange={setEmployerFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="All Employers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employers</SelectItem>
                {employers.map((emp) => (
                  <SelectItem key={emp} value={emp}>{emp}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => setSortAsc(!sortAsc)} className="gap-2">
              <ArrowUpDown className="h-4 w-4" />
              {sortAsc ? "Oldest first" : "Newest first"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-display">
            Users ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead className="hidden lg:table-cell">Employer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Registered</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.full_name ?? "—"}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {user.email ?? "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {user.employer ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusBadge[user.account_status] ?? ""}>
                        {user.account_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => setSelectedUser(user)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {user.account_status !== "active" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-success"
                            onClick={() => updateStatus(user.user_id, "active")}
                          >
                            <UserCheck className="h-4 w-4" />
                          </Button>
                        )}
                        {user.account_status !== "suspended" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => updateStatus(user.user_id, "suspended")}
                          >
                            <UserX className="h-4 w-4" />
                          </Button>
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

      {/* Profile Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">User Profile</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Full Name</p>
                  <p className="font-medium text-foreground">{selectedUser.full_name ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">NRC / ID</p>
                  <p className="font-medium text-foreground">{selectedUser.nrc_number ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Phone</p>
                  <p className="font-medium text-foreground">{selectedUser.phone ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p className="font-medium text-foreground">{selectedUser.email ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Employer</p>
                  <p className="font-medium text-foreground">{selectedUser.employer ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Employee No.</p>
                  <p className="font-medium text-foreground">{selectedUser.employee_number ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Salary</p>
                  <p className="font-medium text-foreground">
                    {selectedUser.salary ? `K${selectedUser.salary.toLocaleString()}` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Registered</p>
                  <p className="font-medium text-foreground">
                    {new Date(selectedUser.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <Badge className={statusBadge[selectedUser.account_status] ?? ""}>
                  {selectedUser.account_status}
                </Badge>
                <div className="flex gap-2">
                  {selectedUser.account_status !== "active" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-success border-success/30"
                      onClick={() => updateStatus(selectedUser.user_id, "active")}
                    >
                      <UserCheck className="h-4 w-4 mr-1" /> Approve
                    </Button>
                  )}
                  {selectedUser.account_status !== "suspended" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive border-destructive/30"
                      onClick={() => updateStatus(selectedUser.user_id, "suspended")}
                    >
                      <UserX className="h-4 w-4 mr-1" /> Suspend
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagement;
