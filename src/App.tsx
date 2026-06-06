import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AuthProvider } from "@/hooks/useAuth";
import { RBACProvider } from "@/hooks/useRBAC";
import ProtectedRoute from "@/components/ProtectedRoute";

// Public, always-loaded routes
import Index from "./pages/Index";
import ComparePage from "./pages/ComparePage";
import AuthPage from "./pages/AuthPage";
import NotFound from "./pages/NotFound";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import RetentionPolicy from "./pages/RetentionPolicy";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";

// Authenticated routes — lazy loaded so unauthenticated visitors never
// download these JS bundles. ProtectedRoute short-circuits the lazy
// import for users without a valid session.
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const KYCPage = lazy(() => import("./pages/KYCPage"));
const ApplicationConfirmation = lazy(() => import("./pages/ApplicationConfirmation"));
const UnderwritingPage = lazy(() => import("./pages/UnderwritingPage"));

// Admin routes — lazy loaded and gated behind admin roles.
const AdminLayout = lazy(() => import("./components/admin/AdminLayout"));
const Dashboard = lazy(() => import("./pages/admin/Dashboard"));
const UserManagement = lazy(() => import("./pages/admin/UserManagement"));
const UsersKYC = lazy(() => import("./pages/admin/UsersKYC"));
const UsersApplications = lazy(() => import("./pages/admin/UsersApplications"));
const UsersHistory = lazy(() => import("./pages/admin/UsersHistory"));
const LendersProducts = lazy(() => import("./pages/admin/LendersProducts"));
const LendersPerformance = lazy(() => import("./pages/admin/LendersPerformance"));
const LendersCommission = lazy(() => import("./pages/admin/LendersCommission"));
const FinancialsRevenue = lazy(() => import("./pages/admin/FinancialsRevenue"));
const FinancialsPayouts = lazy(() => import("./pages/admin/FinancialsPayouts"));
const FinancialsReports = lazy(() => import("./pages/admin/FinancialsReports"));
const ComplianceRiskFlags = lazy(() => import("./pages/admin/ComplianceRiskFlags"));
const ComplianceAuditLogs = lazy(() => import("./pages/admin/ComplianceAuditLogs"));
const CompliancePayroll = lazy(() => import("./pages/admin/CompliancePayroll"));
const Automations = lazy(() => import("./pages/admin/Automations"));
const SystemSettings = lazy(() => import("./pages/admin/SystemSettings"));
const RolePermissions = lazy(() => import("./pages/admin/RolePermissions"));
const CreditBureau = lazy(() => import("./pages/admin/CreditBureau"));

const ADMIN_ROLES = ["super_admin", "admin", "super_user", "compliance_team", "data_entry_team"] as const;

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
  </div>
);

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <RBACProvider>
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/compare" element={<ComparePage />} />
                  <Route path="/login" element={<AuthPage />} />
                  <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                  <Route path="/retention-policy" element={<RetentionPolicy />} />

                  <Route
                    path="/profile"
                    element={
                      <ProtectedRoute>
                        <ProfilePage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/apply"
                    element={
                      <ProtectedRoute>
                        <KYCPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/application-submitted"
                    element={
                      <ProtectedRoute>
                        <ApplicationConfirmation />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/underwriting"
                    element={
                      <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
                        <UnderwritingPage />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="/admin"
                    element={
                      <ProtectedRoute allowedRoles={[...ADMIN_ROLES]}>
                        <AdminLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<Dashboard />} />
                    <Route path="users/management" element={<UserManagement />} />
                    <Route path="users/kyc" element={<UsersKYC />} />
                    <Route path="users/applications" element={<UsersApplications />} />
                    <Route path="users/history" element={<UsersHistory />} />
                    <Route path="lenders/products" element={<LendersProducts />} />
                    <Route path="lenders/performance" element={<LendersPerformance />} />
                    <Route path="lenders/commission" element={<LendersCommission />} />
                    <Route path="financials/revenue" element={<FinancialsRevenue />} />
                    <Route path="financials/payouts" element={<FinancialsPayouts />} />
                    <Route path="financials/reports" element={<FinancialsReports />} />
                    <Route path="compliance/risk-flags" element={<ComplianceRiskFlags />} />
                    <Route path="compliance/audit-logs" element={<ComplianceAuditLogs />} />
                    <Route path="compliance/payroll" element={<CompliancePayroll />} />
                    <Route path="automations" element={<Automations />} />
                    <Route path="role-permissions" element={<RolePermissions />} />
                    <Route path="system-settings" element={<SystemSettings />} />
                    <Route path="credit-bureau" element={<CreditBureau />} />
                  </Route>

                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </RBACProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
