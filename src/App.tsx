import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { RBACProvider } from "@/hooks/useRBAC";
import Index from "./pages/Index";
import ComparePage from "./pages/ComparePage";
import KYCPage from "./pages/KYCPage";
import AuthPage from "./pages/AuthPage";
import ProfilePage from "./pages/ProfilePage";
import ApplicationConfirmation from "./pages/ApplicationConfirmation";
import AdminLayout from "./components/admin/AdminLayout";
import Dashboard from "./pages/admin/Dashboard";
import UserManagement from "./pages/admin/UserManagement";
import UsersKYC from "./pages/admin/UsersKYC";
import UsersApplications from "./pages/admin/UsersApplications";
import UsersHistory from "./pages/admin/UsersHistory";
import LendersProducts from "./pages/admin/LendersProducts";
import LendersPerformance from "./pages/admin/LendersPerformance";
import LendersCommission from "./pages/admin/LendersCommission";
import FinancialsRevenue from "./pages/admin/FinancialsRevenue";
import FinancialsPayouts from "./pages/admin/FinancialsPayouts";
import FinancialsReports from "./pages/admin/FinancialsReports";
import ComplianceRiskFlags from "./pages/admin/ComplianceRiskFlags";
import ComplianceAuditLogs from "./pages/admin/ComplianceAuditLogs";
import CompliancePayroll from "./pages/admin/CompliancePayroll";
import Automations from "./pages/admin/Automations";
import SystemSettings from "./pages/admin/SystemSettings";
import RolePermissions from "./pages/admin/RolePermissions";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <RBACProvider>
            <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/login" element={<AuthPage />} />
            <Route path="/apply" element={<KYCPage />} />
            <Route path="/application-submitted" element={<ApplicationConfirmation />} />

            <Route path="/admin" element={<AdminLayout />}>
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
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </RBACProvider>
      </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
