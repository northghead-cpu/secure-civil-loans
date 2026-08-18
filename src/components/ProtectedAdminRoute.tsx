import { Navigate, Outlet } from "react-router-dom";
import { useRBAC } from "@/hooks/useRBAC";

export type AdminCapability =
  | "canViewProfiles"
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
  | "canChangeSystemSettings"
  | "canViewPayroll";

type ProtectedAdminRouteProps = { capability: AdminCapability };

/** Defense-in-depth guard for Admin child routes. */
export default function ProtectedAdminRoute({ capability }: ProtectedAdminRouteProps) {
  const { permissions, highestRole } = useRBAC();
  if (permissions[capability]) return <Outlet />;
  return <Navigate to="/admin" replace state={{ denied: true, role: highestRole, capability }} />;
}