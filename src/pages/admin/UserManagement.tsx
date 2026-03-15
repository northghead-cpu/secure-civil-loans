import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRBAC, ROLE_LABELS, AppRole } from "@/hooks/useRBAC";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Search, Download, Eye, UserCheck, UserX, Users, ArrowUpDown,
  Loader2, Shield, Plus, Trash2,
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

interface UserRole {
  id: string;
  user_id: string;
  role: string;
}

const statusBadge: Record<string, string> = {
  active: "bg-success/10 text-success border-success/20",
  pending: "bg-warning/10 text-warning border-warning/20",
  suspended: "bg-destructive/10 text-destructive border-destructive/20",
};

const roleBadgeColors: Record<string, string> = {
  super_admin: "bg-destructive/10 text-destructive",
  admin: "bg-primary/10 text-primary",
  super_user: "bg-info/10 text-info",
  compliance_team: "bg-warning/10 text-warning",
  data_entry_team: "bg-success/10 text-success",
  user: "bg-muted text-muted-foreground",
};

const ASSIGNABLE_ROLES: AppRole[] = ["super_user", "compliance_team", "data_entry_team", "admin"];

const UserManagement = () => {
  const { permissions, logAction } = useRBAC();
  const [users, setUsers] = useState<Profile[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [employerFilter, setEmployerFilter] = useState("all");
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [roleDialogUser, setRoleDialogUser] = useState<Profile | null>(null);
  const [newRole, setNewRole] = useState<string>("");

  const fetchData = async () => {
    const [profilesRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("*"),
    ]);
    if (!profilesRes.error) setUsers((profilesRes.data as unknown as Profile[]) ?? []);
    if (!rolesRes.error) setUserRoles((rolesRes.data as unknown as UserRole[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel("profiles-realtime-mgmt")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const getUserRoles = (userId: string) =>
    userRoles.filter((r) => r.user_id === userId);

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
    return [...result].sort((a, b) => {
      const da = new Date(a.created_at).getTime();
      const db = new Date(b.created_at).getTime();
      return sortAsc ? da - db : db - da;
    });
  }, [users, search, employerFilter, sortAsc]);

  const updateStatus = async (userId: string, status: string) => {
    const profile = users.find((u) => u.user_id === userId);
    const oldStatus = profile?.account_status;
    const { error } = await supabase
      .from("profiles")
      .update({ account_status: status } as any)
      .eq("user_id", userId);
    if (error) {
      toast.error("Failed to update status");
      return;
    }
    await logAction(
      status === "active" ? "activate_user" : "deactivate_user",
      userId,
      "profiles",
      { account_status: oldStatus },
      { account_status: status }
    );
    toast.success(`User ${status === "active" ? "activated" : "suspended"}`);
    setSelectedUser(null);
  };

  const assignRole = async () => {
    if (!roleDialogUser || !newRole) return;
    const existing = getUserRoles(roleDialogUser.user_id);
    if (existing.some((r) => r.role === newRole)) {
      toast.error("User already has this role");
      return;
    }
    const { error } = await supabase.from("user_roles").insert({
      user_id: roleDialogUser.user_id,
      role: newRole,
    } as any);
    if (error) {
      toast.error("Failed to assign role");
      return;
    }
    await logAction("assign_role", roleDialogUser.user_id, "user_roles", null, { role: newRole });
    toast.success(`Role ${ROLE_LABELS[newRole] ?? newRole} assigned`);
    setNewRole("");
    fetchData();
  };

  const removeRole = async (roleRecord: UserRole) => {
    const { error } = await supabase.from("user_roles").delete().eq("id", roleRecord.id);
    if (error) {
      toast.error("Failed to remove role");
      return;
    }
    await logAction("remove_role", roleRecord.user_id, "user_roles", { role: roleRecord.role }, null);
    toast.success(`Role removed`);
    fetchData();
  };

  const exportCSV = () => {
    if (!permissions.canExportData) {
      toast.error("You don't have permission to export data");
      return;
    }
    const headers = [
      "Full Name", "NRC/ID", "Phone", "Email", "Employer",
      "Employee No.", "Salary", "Status", "Roles", "Registered",
    ];
    const rows = filtered.map((u) => [
      u.full_name ?? "", u.nrc_number ?? "", u.phone ?? "", u.email ?? "",
      u.employer ?? "", u.employee_number ?? "", u.salary?.toString() ?? "",
      u.account_status,
      getUserRoles(u.user_id).map((r) => r.role).join("; "),
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
    logAction("export_csv", undefined, "profiles");
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
          <p className="text-sm text-muted-foreground">{statusCounts.total} registered users</p>
        </div>
        {permissions.canExportData && (
          <Button variant="outline" onClick={exportCSV} className="gap-2">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        )}
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
          <CardTitle className="text-base font-display">Users ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead>Roles</TableHead>
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
                filtered.map((user) => {
                  const roles = getUserRoles(user.user_id);
                  return (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.full_name ?? "—"}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {user.email ?? "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {roles.length === 0 ? (
                            <span className="text-xs text-muted-foreground">No roles</span>
                          ) : (
                            roles.map((r) => (
                              <Badge key={r.id} className={`text-xs ${roleBadgeColors[r.role] ?? ""}`}>
                                {ROLE_LABELS[r.role] ?? r.role}
                              </Badge>
                            ))
                          )}
                        </div>
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
                          {permissions.canAssignRoles && (
                            <Button size="sm" variant="ghost" onClick={() => setRoleDialogUser(user)}>
                              <Shield className="h-4 w-4" />
                            </Button>
                          )}
                          {permissions.canDeactivateUsers && user.account_status !== "active" && (
                            <Button
                              size="sm" variant="ghost" className="text-success"
                              onClick={() => updateStatus(user.user_id, "active")}
                            >
                              <UserCheck className="h-4 w-4" />
                            </Button>
                          )}
                          {permissions.canDeactivateUsers && user.account_status !== "suspended" && (
                            <Button
                              size="sm" variant="ghost" className="text-destructive"
                              onClick={() => updateStatus(user.user_id, "suspended")}
                            >
                              <UserX className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
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
                {[
                  ["Full Name", selectedUser.full_name],
                  ["NRC / ID", selectedUser.nrc_number],
                  ["Phone", selectedUser.phone],
                  ["Email", selectedUser.email],
                  ["Employer", selectedUser.employer],
                  ["Employee No.", selectedUser.employee_number],
                  ["Salary", selectedUser.salary ? `K${selectedUser.salary.toLocaleString()}` : null],
                  ["Registered", new Date(selectedUser.created_at).toLocaleString()],
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <p className="text-muted-foreground">{label}</p>
                    <p className="font-medium text-foreground">{(value as string) ?? "—"}</p>
                  </div>
                ))}
              </div>
              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2">Roles</p>
                <div className="flex flex-wrap gap-1">
                  {getUserRoles(selectedUser.user_id).map((r) => (
                    <Badge key={r.id} className={`text-xs ${roleBadgeColors[r.role] ?? ""}`}>
                      {ROLE_LABELS[r.role] ?? r.role}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <Badge className={statusBadge[selectedUser.account_status] ?? ""}>
                  {selectedUser.account_status}
                </Badge>
                <div className="flex gap-2">
                  {permissions.canDeactivateUsers && selectedUser.account_status !== "active" && (
                    <Button
                      size="sm" variant="outline" className="text-success border-success/30"
                      onClick={() => updateStatus(selectedUser.user_id, "active")}
                    >
                      <UserCheck className="h-4 w-4 mr-1" /> Approve
                    </Button>
                  )}
                  {permissions.canDeactivateUsers && selectedUser.account_status !== "suspended" && (
                    <Button
                      size="sm" variant="outline" className="text-destructive border-destructive/30"
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

      {/* Role Assignment Dialog */}
      <Dialog open={!!roleDialogUser} onOpenChange={() => { setRoleDialogUser(null); setNewRole(""); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Manage Roles</DialogTitle>
          </DialogHeader>
          {roleDialogUser && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Managing roles for <span className="font-medium text-foreground">{roleDialogUser.full_name ?? roleDialogUser.email}</span>
              </p>
              <div>
                <Label className="text-xs text-muted-foreground">Current Roles</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {getUserRoles(roleDialogUser.user_id).length === 0 ? (
                    <span className="text-xs text-muted-foreground">No roles assigned</span>
                  ) : (
                    getUserRoles(roleDialogUser.user_id).map((r) => (
                      <div key={r.id} className="flex items-center gap-1">
                        <Badge className={`text-xs ${roleBadgeColors[r.role] ?? ""}`}>
                          {ROLE_LABELS[r.role] ?? r.role}
                        </Badge>
                        <Button
                          size="sm" variant="ghost"
                          className="h-5 w-5 p-0 text-destructive hover:text-destructive"
                          onClick={() => removeRole(r)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select role…" />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSIGNABLE_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={assignRole} disabled={!newRole} className="gap-1">
                  <Plus className="h-4 w-4" /> Assign
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagement;
