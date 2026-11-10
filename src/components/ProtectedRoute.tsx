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
  const {
    user,
    profile,
    profileLoading,
    loading: authLoading,
    isPasswordRecovery,
    signOut,
  } = useAuth();
  const { highestRole, loading: rbacLoading } = useRBAC();

  // A recovery session must never unlock authenticated areas. Always bounce
  // the user to the dedicated reset page until they complete (or abandon)
  // the password change.
  if (isPasswordRecovery) {
    return <Navigate to="/reset-password" replace />;
  }

  if (authLoading || profileLoading || (allowedRoles && rbacLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  if (profile?.account_status && profile.account_status !== "active")
    return (
      <main className="max-w-lg mx-auto p-8 pt-24">
        <h1 className="text-2xl font-semibold">Account access paused</h1>
        <p className="my-4">
          Contact support@riverbanc.co.zm for help with your account.
        </p>
        <button className="underline" onClick={() => void signOut()}>
          Sign out
        </button>
      </main>
    );

  if (allowedRoles && (!highestRole || !allowedRoles.includes(highestRole))) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
