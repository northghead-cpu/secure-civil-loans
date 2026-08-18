import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useRBAC, AppRole, RBACPermissions } from "@/hooks/useRBAC";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: AppRole[];
  /** Optional capability required after role authentication. */
  requiredPermission?: keyof RBACPermissions;
}

const ProtectedRoute = ({ children, allowedRoles, requiredPermission }: ProtectedRouteProps) => {
  const location = useLocation();
  const { user, loading: authLoading, isPasswordRecovery } = useAuth();
  const { highestRole, permissions, loading: rbacLoading } = useRBAC();

  if (isPasswordRecovery) return <Navigate to="/reset-password" replace />;

  if (authLoading || (allowedRoles && rbacLoading) || (requiredPermission && rbacLoading)) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  if (allowedRoles && (!highestRole || !allowedRoles.includes(highestRole))) {
    return <Navigate to="/" replace />;
  }

  if (requiredPermission && !permissions[requiredPermission]) {
    return <Navigate to="/admin" replace state={{ from: location.pathname, denied: requiredPermission }} />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
