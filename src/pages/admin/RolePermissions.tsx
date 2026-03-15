import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Eye, Edit, Download, Upload, Settings, Users, Trash2, CheckCircle } from "lucide-react";
import { ROLE_LABELS, ROLE_DESCRIPTIONS } from "@/hooks/useRBAC";

const permissionList = [
  { key: "canViewProfiles", label: "View all profiles", icon: Eye },
  { key: "canEditProfiles", label: "Edit profiles", icon: Edit },
  { key: "canEditProfileIdentity", label: "Edit identity fields (name, NRC)", icon: Edit },
  { key: "canEditProfileEmployment", label: "Edit employment fields (salary, employer)", icon: Edit },
  { key: "canEditLoanApplications", label: "Edit loan applications", icon: Edit },
  { key: "canExportData", label: "Export data/reports", icon: Download },
  { key: "canViewAuditLogs", label: "View audit logs", icon: Eye },
  { key: "canViewLoanApplications", label: "View loan applications", icon: Eye },
  { key: "canChangeSystemSettings", label: "Change system settings", icon: Settings },
  { key: "canManageUsers", label: "Manage users", icon: Users },
  { key: "canAssignRoles", label: "Assign roles", icon: Shield },
  { key: "canDeactivateUsers", label: "Deactivate users", icon: Users },
  { key: "canDeleteRecords", label: "Delete records", icon: Trash2 },
  { key: "canApproveChanges", label: "Approve changes", icon: CheckCircle },
  { key: "canUploadDocuments", label: "Upload documents", icon: Upload },
];

const ROLE_PERMISSIONS_MAP: Record<string, Record<string, boolean>> = {
  super_admin: {
    canViewProfiles: true, canEditProfiles: true, canEditProfileIdentity: true,
    canEditProfileEmployment: true, canEditLoanApplications: true, canExportData: true,
    canViewAuditLogs: true, canViewLoanApplications: true, canChangeSystemSettings: true,
    canManageUsers: true, canAssignRoles: true, canDeactivateUsers: true,
    canDeleteRecords: true, canApproveChanges: true, canUploadDocuments: true,
  },
  admin: {
    canViewProfiles: true, canEditProfiles: true, canEditProfileIdentity: true,
    canEditProfileEmployment: true, canEditLoanApplications: true, canExportData: true,
    canViewAuditLogs: true, canViewLoanApplications: true, canChangeSystemSettings: false,
    canManageUsers: true, canAssignRoles: true, canDeactivateUsers: true,
    canDeleteRecords: false, canApproveChanges: true, canUploadDocuments: true,
  },
  super_user: {
    canViewProfiles: true, canEditProfiles: true, canEditProfileIdentity: true,
    canEditProfileEmployment: true, canEditLoanApplications: true, canExportData: true,
    canViewAuditLogs: true, canViewLoanApplications: true, canChangeSystemSettings: false,
    canManageUsers: false, canAssignRoles: false, canDeactivateUsers: false,
    canDeleteRecords: false, canApproveChanges: false, canUploadDocuments: true,
  },
  compliance_team: {
    canViewProfiles: true, canEditProfiles: false, canEditProfileIdentity: false,
    canEditProfileEmployment: false, canEditLoanApplications: false, canExportData: false,
    canViewAuditLogs: true, canViewLoanApplications: true, canChangeSystemSettings: false,
    canManageUsers: false, canAssignRoles: false, canDeactivateUsers: false,
    canDeleteRecords: false, canApproveChanges: false, canUploadDocuments: false,
  },
  data_entry_team: {
    canViewProfiles: true, canEditProfiles: true, canEditProfileIdentity: true,
    canEditProfileEmployment: false, canEditLoanApplications: false, canExportData: false,
    canViewAuditLogs: false, canViewLoanApplications: false, canChangeSystemSettings: false,
    canManageUsers: false, canAssignRoles: false, canDeactivateUsers: false,
    canDeleteRecords: false, canApproveChanges: false, canUploadDocuments: true,
  },
};

const roleBadgeColors: Record<string, string> = {
  super_admin: "bg-destructive/10 text-destructive border-destructive/20",
  admin: "bg-primary/10 text-primary border-primary/20",
  super_user: "bg-info/10 text-info border-info/20",
  compliance_team: "bg-warning/10 text-warning border-warning/20",
  data_entry_team: "bg-success/10 text-success border-success/20",
};

const RolePermissions = () => {
  const roles = ["super_admin", "admin", "super_user", "compliance_team", "data_entry_team"];

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Role Permissions</h1>
        <p className="text-sm text-muted-foreground">Overview of permissions for each role</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {roles.map((role) => (
          <Card key={role}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-display">
                  {ROLE_LABELS[role]}
                </CardTitle>
                <Badge className={roleBadgeColors[role]}>{role}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {permissionList.map((perm) => {
                  const hasPermission = ROLE_PERMISSIONS_MAP[role]?.[perm.key] ?? false;
                  return (
                    <div
                      key={perm.key}
                      className={`flex items-center gap-2 text-xs py-1 px-2 rounded ${
                        hasPermission
                          ? "text-foreground bg-success/5"
                          : "text-muted-foreground/50 line-through"
                      }`}
                    >
                      <perm.icon className="h-3 w-3 shrink-0" />
                      <span>{perm.label}</span>
                      {hasPermission && (
                        <CheckCircle className="h-3 w-3 ml-auto text-success shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default RolePermissions;
