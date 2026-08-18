import { Navigate, Outlet } from "react-router-dom";
import { useRBAC } from "@/hooks/useRBAC";

export type AdminCapability =
  | "canViewLoanApplications"
  | "canViewAuditLogs"
  | "canManageUsers"
  | "canManageLenderProducts"
  | "canManageCommissions"
  | "canViewFinancials"
  | "canManagePayouts"
  | "canManageAutomations"
  | "canManageRoles"
  | "canExportCustomerData"
  | "canPerformCreditChecks"
  | "canChangeSystemSettings";

type ProtectedAdminRouteProps = {
  capability: AdminCapability;
};

/**
 * Defense-in-depth guard for Admin child routes.
 * The Admin shell still establishes authentication and broad Admin-role access;
 * this guard enforces the specific capability required by a sensitive surface.
 */
export default function ProtectedAdminRoute({ capability }: ProtectedAdminRouteProps) {
  const { permissions, highestRole } = useRBAC();

  if (permissions[capability]) {
    return <Outlet />;
  }

  return <Navigate to="/admin" replace state={{ denied: true, role: highestRole, capability }} />;
}
