import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type AppRole = "admin" | "super_admin" | "super_user" | "compliance_team" | "data_entry_team" | "user";

export interface RBACPermissions {
  canViewProfiles: boolean;
  canEditProfiles: boolean;
  canEditProfileIdentity: boolean; // full_name, nrc_number only
  canEditProfileEmployment: boolean; // employer, employee_number, salary
  canEditLoanApplications: boolean;
  canExportData: boolean;
  canViewAuditLogs: boolean;
  canViewLoanApplications: boolean;
  canChangeSystemSettings: boolean;
  canManageUsers: boolean;
  canAssignRoles: boolean;
  canDeactivateUsers: boolean;
  canDeleteRecords: boolean;
  canApproveChanges: boolean;
  canUploadDocuments: boolean;
}

const ROLE_PERMISSIONS: Record<string, RBACPermissions> = {
  super_admin: {
    canViewProfiles: true,
    canEditProfiles: true,
    canEditProfileIdentity: true,
    canEditProfileEmployment: true,
    canEditLoanApplications: true,
    canExportData: true,
    canViewAuditLogs: true,
    canViewLoanApplications: true,
    canChangeSystemSettings: true,
    canManageUsers: true,
    canAssignRoles: true,
    canDeactivateUsers: true,
    canDeleteRecords: true,
    canApproveChanges: true,
    canUploadDocuments: true,
  },
  admin: {
    canViewProfiles: true,
    canEditProfiles: true,
    canEditProfileIdentity: true,
    canEditProfileEmployment: true,
    canEditLoanApplications: true,
    canExportData: true,
    canViewAuditLogs: true,
    canViewLoanApplications: true,
    canChangeSystemSettings: false,
    canManageUsers: true,
    canAssignRoles: true,
    canDeactivateUsers: true,
    canDeleteRecords: false,
    canApproveChanges: true,
    canUploadDocuments: true,
  },
  super_user: {
    canViewProfiles: true,
    canEditProfiles: true,
    canEditProfileIdentity: true,
    canEditProfileEmployment: true,
    canEditLoanApplications: true,
    canExportData: true,
    canViewAuditLogs: true,
    canViewLoanApplications: true,
    canChangeSystemSettings: false,
    canManageUsers: false,
    canAssignRoles: false,
    canDeactivateUsers: false,
    canDeleteRecords: false,
    canApproveChanges: false,
    canUploadDocuments: true,
  },
  compliance_team: {
    canViewProfiles: true,
    canEditProfiles: false,
    canEditProfileIdentity: false,
    canEditProfileEmployment: false,
    canEditLoanApplications: false,
    canExportData: false,
    canViewAuditLogs: true,
    canViewLoanApplications: true,
    canChangeSystemSettings: false,
    canManageUsers: false,
    canAssignRoles: false,
    canDeactivateUsers: false,
    canDeleteRecords: false,
    canApproveChanges: false,
    canUploadDocuments: false,
  },
  data_entry_team: {
    canViewProfiles: true,
    canEditProfiles: true,
    canEditProfileIdentity: true,
    canEditProfileEmployment: false,
    canEditLoanApplications: false,
    canExportData: false,
    canViewAuditLogs: false,
    canViewLoanApplications: false,
    canChangeSystemSettings: false,
    canManageUsers: false,
    canAssignRoles: false,
    canDeactivateUsers: false,
    canDeleteRecords: false,
    canApproveChanges: false,
    canUploadDocuments: true,
  },
  user: {
    canViewProfiles: true,
    canEditProfiles: false,
    canEditProfileIdentity: false,
    canEditProfileEmployment: false,
    canEditLoanApplications: false,
    canExportData: false,
    canViewAuditLogs: false,
    canViewLoanApplications: false,
    canChangeSystemSettings: false,
    canManageUsers: false,
    canAssignRoles: false,
    canDeactivateUsers: false,
    canDeleteRecords: false,
    canApproveChanges: false,
    canUploadDocuments: true,
  },
};

// Fields that data_entry_team can edit
export const DATA_ENTRY_EDITABLE_FIELDS = ["full_name", "nrc_number"];

// Fields that super_user can edit on profiles
export const SUPER_USER_PROFILE_FIELDS = [
  "full_name", "nrc_number", "phone", "email",
  "employer", "employee_number", "salary",
];

interface RBACContextType {
  roles: AppRole[];
  permissions: RBACPermissions;
  loading: boolean;
  highestRole: AppRole | null;
  hasRole: (role: AppRole) => boolean;
  logAction: (action: string, recordId?: string, tableName?: string, oldValue?: unknown, newValue?: unknown) => Promise<void>;
}

const defaultPermissions: RBACPermissions = {
  canViewProfiles: false,
  canEditProfiles: false,
  canEditProfileIdentity: false,
  canEditProfileEmployment: false,
  canEditLoanApplications: false,
  canExportData: false,
  canViewAuditLogs: false,
  canViewLoanApplications: false,
  canChangeSystemSettings: false,
  canManageUsers: false,
  canAssignRoles: false,
  canDeactivateUsers: false,
  canDeleteRecords: false,
  canApproveChanges: false,
  canUploadDocuments: false,
};

const RBACContext = createContext<RBACContextType>({
  roles: [],
  permissions: defaultPermissions,
  loading: true,
  highestRole: null,
  hasRole: () => false,
  logAction: async () => {},
});

const ROLE_PRIORITY: AppRole[] = ["super_admin", "admin", "super_user", "compliance_team", "data_entry_team", "user"];

function mergePermissions(roles: AppRole[]): RBACPermissions {
  const merged = { ...defaultPermissions };
  for (const role of roles) {
    const perms = ROLE_PERMISSIONS[role];
    if (!perms) continue;
    for (const key of Object.keys(merged) as (keyof RBACPermissions)[]) {
      if (perms[key]) merged[key] = true;
    }
  }
  return merged;
}

export const RBACProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRoles([]);
      setLoading(false);
      return;
    }

    const fetchRoles = async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      
      const userRoles = (data?.map((r) => r.role) ?? []) as AppRole[];
      setRoles(userRoles);
      setLoading(false);
    };

    fetchRoles();
  }, [user]);

  const permissions = mergePermissions(roles);
  const highestRole = ROLE_PRIORITY.find((r) => roles.includes(r)) ?? null;

  const hasRole = useCallback((role: AppRole) => roles.includes(role), [roles]);

  interface AuditLogParams {
    _user_id: string;
    _role: AppRole | "unknown";
    _action: string;
    _record_id: string | null;
    _table_name: string | null;
    _old_value: string | null;
    _new_value: string | null;
  }

  const logAction = useCallback(
    async (action: string, recordId?: string, tableName?: string, oldValue?: unknown, newValue?: unknown) => {
      if (!user) return;
      const payload: AuditLogParams = {
        _user_id: user.id,
        _role: highestRole ?? "unknown",
        _action: action,
        _record_id: recordId ?? null,
        _table_name: tableName ?? null,
        _old_value: oldValue ? JSON.stringify(oldValue) : null,
        _new_value: newValue ? JSON.stringify(newValue) : null,
      };

      await supabase.rpc("log_audit", payload);
    },
    [user, highestRole]
  );

  return (
    <RBACContext.Provider value={{ roles, permissions, loading, highestRole, hasRole, logAction }}>
      {children}
    </RBACContext.Provider>
  );
};

export const useRBAC = () => useContext(RBACContext);

// Role display helpers
export const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  super_user: "Super User",
  compliance_team: "Compliance Team",
  data_entry_team: "Data Entry Team",
  user: "User",
};

export const ROLE_DESCRIPTIONS: Record<string, string> = {
  super_admin: "Full platform access including system settings and configuration",
  admin: "Full admin access except system settings",
  super_user: "Can view and edit all data, export reports, view audit logs. Cannot change system settings or manage users.",
  compliance_team: "Read-only access to all profiles, applications, and audit logs for regulatory monitoring.",
  data_entry_team: "Can edit basic identity fields (name, NRC number) and upload ID documents only.",
};
