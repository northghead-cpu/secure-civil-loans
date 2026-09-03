import { Navigate, Outlet } from "react-router-dom";
import { useRBAC } from "@/hooks/useRBAC";

export type AdminCapability =
  | "canViewProfiles"
  | "canManageUsers"
  | "canViewLoanApplications"
  | "canViewAuditLogs"
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
  capability?: AdminCapability;
};

export default function ProtectedAdminRoute({ capability }: ProtectedAdminRouteProps) {
  const { permissions, highestRole, loading } = useRBAC();

  if (loading) return null;
  if (!capability || permissions[capability]) return <Outlet />;

  return <Navigate to="/admin" replace state={{ denied: true, role: highestRole, capability }} />;
}
