import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRBAC, ROLE_LABELS, AppRole } from "@/hooks/useRBAC";
import { AdminHero, AdminPageShell, adminCardClass } from "@/components/admin/AdminPageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Search,
  Download,
  Eye,
  UserCheck,
  UserX,
  Users,
  ArrowUpDown,
  Loader2,
  Shield,
  Plus,
  Trash2,
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

const assignableRoles: AppRole[] = ["super_user", "compliance_team", "data_entry_team", "admin"];

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
  const [newRole, setNewRole] = useState("");

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
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getUserRoles = (userId: string) => userRoles.filter((role) => role.user_id === userId);

  const employers = useMemo(
    () => [...new Set(users.map((user) => user.employer).filter(Boolean))] as string[],
    [users]
  );

  const filtered = useMemo(() => {
    let result = users;
    if (search) {
      const query = search.toLowerCase();
      result = result.filter(
        (user) =>
          user.full_name?.toLowerCase().includes(query) ||
          user.email?.toLowerCase().includes(query) ||
          user.phone?.includes(query) ||
          user.nrc_number?.toLowerCase().includes(query)
      );
    }
    if (employerFilter !== "all") {
      result = result.filter((user) => user.employer === employerFilter);
    }
    return [...result].sort((a, b) => {
      const first = new Date(a.created_at).getTime();
      const second = new Date(b.created_at).getTime();
      return sortAsc ? first - second : second - first;
    });
  }, [users, search, employerFilter, sortAsc]);

  const updateStatus = async (userId: string, status: string) => {
    const profile = users.find((user) => user.user_id === userId);
    const oldStatus = profile?.account_status;
    const { error } = await supabase
      .from("profiles")
      .update({ account_status: status } as never)
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
    if (getUserRoles(roleDialogUser.user_id).some((role) => role.role === newRole)) {
      toast.error("User already has this role");
      return;
    }
    const { error } = await supabase.from("user_roles").insert({
      user_id: roleDialogUser.user_id,
      role: newRole,
    } as never);
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
    toast.success("Role removed");
    fetchData();
  };

  const exportCSV = () => {
    if (!permissions.canExportData) {
      toast.error("You don't have permission to export data");
      return;
    }
    const headers = [
      "Full Name",
      "NRC/ID",
      "Phone",
      "Email",
      "Employer",
      "Employee No.",
      "Salary",
      "Status",
      "Roles",
      "Registered",
    ];
    const rows = filtered.map((user) => [
      user.full_name ?? "",
      user.nrc_number ?? "",
      user.phone ?? "",
      user.email ?? "",
      user.employer ?? "",
      user.employee_number ?? "",
      user.salary?.toString() ?? "",
      user.account_status,
      getUserRoles(user.user_id).map((role) => role.role).join("; "),
      new Date(user.created_at).toLocaleString(),
    ]);
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `users-export-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    logAction("export_csv", undefined, "profiles");
    toast.success("CSV exported");
  };

  const statusCounts = useMemo(
    () => ({
      total: users.length,
      active: users.filter((user) => user.account_status === "active").length,
      pending: users.filter((user) => user.account_status === "pending").length,
      suspended: users.filter((user) => user.account_status === "suspended").length,
    }),
    [users]
  );

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
        badge="Identity and access"
        title="User management for roles, status controls, and profile oversight"
        description="Search the borrower base, control account status, and manage admin-facing roles from a single operational surface."
        actions={
          permissions.canExportData ? (
            <Button
              variant="outline"
              onClick={exportCSV}
              className="gap-2 border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white"
            >
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          ) : null
        }
        stats={[
          { label: "Registered users", value: statusCounts.total.toString(), meta: "All profiles in the workspace" },
          { label: "Active", value: statusCounts.active.toString(), meta: "Approved and available to transact" },
          { label: "Pending", value: statusCounts.pending.toString(), meta: "Still awaiting review or activation" },
          { label: "Suspended", value: statusCounts.suspended.toString(), meta: "Currently blocked from use" },
        ]}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className={adminCardClass}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <span className="text-2xl font-display font-bold text-foreground">{statusCounts.total}</span>
            </div>
            <p className="text-sm text-muted-foreground">Total Users</p>
          </CardContent>
        </Card>
        <Card className={adminCardClass}>
          <CardContent className="pt-6">
            <div className="text-2xl font-display font-bold text-success">{statusCounts.active}</div>
            <p className="text-sm text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card className={adminCardClass}>
          <CardContent className="pt-6">
            <div className="text-2xl font-display font-bold text-warning">{statusCounts.pending}</div>
            <p className="text-sm text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card className={adminCardClass}>
          <CardContent className="pt-6">
            <div className="text-2xl font-display font-bold text-destructive">{statusCounts.suspended}</div>
            <p className="text-sm text-muted-foreground">Suspended</p>
          </CardContent>
        </Card>
      </div>

      <Card className={adminCardClass}>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, phone, or NRC..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={employerFilter} onValueChange={setEmployerFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="All Employers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employers</SelectItem>
                {employers.map((employer) => (
                  <SelectItem key={employer} value={employer}>
                    {employer}
                  </SelectItem>
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

      <Card className={`${adminCardClass} overflow-hidden`}>
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
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((user) => {
                  const roles = getUserRoles(user.user_id);
                  return (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.full_name ?? "-"}</TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">
                        {user.email ?? "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {roles.length === 0 ? (
                            <span className="text-xs text-muted-foreground">No roles</span>
                          ) : (
                            roles.map((role) => (
                              <Badge key={role.id} className={`text-xs ${roleBadgeColors[role.role] ?? ""}`}>
                                {ROLE_LABELS[role.role] ?? role.role}
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusBadge[user.account_status] ?? ""}>{user.account_status}</Badge>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">
                        {new Date(user.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setSelectedUser(user)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {permissions.canAssignRoles ? (
                            <Button size="sm" variant="ghost" onClick={() => setRoleDialogUser(user)}>
                              <Shield className="h-4 w-4" />
                            </Button>
                          ) : null}
                          {permissions.canDeactivateUsers && user.account_status !== "active" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-success"
                              onClick={() => updateStatus(user.user_id, "active")}
                            >
                              <UserCheck className="h-4 w-4" />
                            </Button>
                          ) : null}
                          {permissions.canDeactivateUsers && user.account_status !== "suspended" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => updateStatus(user.user_id, "suspended")}
                            >
                              <UserX className="h-4 w-4" />
                            </Button>
                          ) : null}
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

      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">User Profile</DialogTitle>
          </DialogHeader>
          {selectedUser ? (
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
                    <p className="font-medium text-foreground">{(value as string) ?? "-"}</p>
                  </div>
                ))}
              </div>
              <div className="border-t border-border pt-2">
                <p className="mb-2 text-xs text-muted-foreground">Roles</p>
                <div className="flex flex-wrap gap-1">
                  {getUserRoles(selectedUser.user_id).map((role) => (
                    <Badge key={role.id} className={`text-xs ${roleBadgeColors[role.role] ?? ""}`}>
                      {ROLE_LABELS[role.role] ?? role.role}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-2">
                <Badge className={statusBadge[selectedUser.account_status] ?? ""}>
                  {selectedUser.account_status}
                </Badge>
                <div className="flex gap-2">
                  {permissions.canDeactivateUsers && selectedUser.account_status !== "active" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-success/30 text-success"
                      onClick={() => updateStatus(selectedUser.user_id, "active")}
                    >
                      <UserCheck className="mr-1 h-4 w-4" /> Approve
                    </Button>
                  ) : null}
                  {permissions.canDeactivateUsers && selectedUser.account_status !== "suspended" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-destructive/30 text-destructive"
                      onClick={() => updateStatus(selectedUser.user_id, "suspended")}
                    >
                      <UserX className="mr-1 h-4 w-4" /> Suspend
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!roleDialogUser} onOpenChange={() => { setRoleDialogUser(null); setNewRole(""); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Manage Roles</DialogTitle>
          </DialogHeader>
          {roleDialogUser ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Managing roles for{" "}
                <span className="font-medium text-foreground">
                  {roleDialogUser.full_name ?? roleDialogUser.email}
                </span>
              </p>
              <div>
                <Label className="text-xs text-muted-foreground">Current Roles</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {getUserRoles(roleDialogUser.user_id).length === 0 ? (
                    <span className="text-xs text-muted-foreground">No roles assigned</span>
                  ) : (
                    getUserRoles(roleDialogUser.user_id).map((role) => (
                      <div key={role.id} className="flex items-center gap-1">
                        <Badge className={`text-xs ${roleBadgeColors[role.role] ?? ""}`}>
                          {ROLE_LABELS[role.role] ?? role.role}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 w-5 p-0 text-destructive hover:text-destructive"
                          onClick={() => removeRole(role)}
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
                    <SelectValue placeholder="Select role..." />
                  </SelectTrigger>
                  <SelectContent>
                    {assignableRoles.map((role) => (
                      <SelectItem key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={assignRole} disabled={!newRole} className="gap-1">
                  <Plus className="h-4 w-4" /> Assign
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </AdminPageShell>
  );
};

export default UserManagement;
