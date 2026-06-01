import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useRBAC, AppRole } from "@/hooks/useRBAC";

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** If provided, only these roles may access the route. */
  allowedRoles?: AppRole[];
}

/**
 * Client-side route guard. Combined with React.lazy on the wrapped route
 * components, unauthenticated visitors never download privileged code bundles
 * because the lazy import is never triggered when access is denied.
 */
const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { highestRole, loading: rbacLoading } = useRBAC();

  if (authLoading || (allowedRoles && rbacLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (allowedRoles && (!highestRole || !allowedRoles.includes(highestRole))) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
