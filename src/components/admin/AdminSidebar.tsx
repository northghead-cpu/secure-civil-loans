import {
  LayoutDashboard,
  Users,
  FileCheck,
  ClipboardList,
  History,
  Package,
  BarChart3,
  Percent,
  DollarSign,
  Wallet,
  FileBarChart,
  ShieldAlert,
  ScrollText,
  Link2,
  Zap,
  Settings,
  Shield,
  BoxIcon,
  AlertOctagon,
  Plug,
  LucideIcon,
  LogOut,
  CreditCard,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { useRBAC } from "@/hooks/useRBAC";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

interface MenuItem {
  title: string;
  url: string;
  icon: LucideIcon;
  requiredPermission?: string;
}

interface MenuGroup {
  label: string;
  items: MenuItem[];
}

const menuGroups: MenuGroup[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
    ],
  },
  {
    label: "Users",
    items: [
      { title: "User Management", url: "/admin/users/management", icon: Users, requiredPermission: "canManageUsers" },
      { title: "KYC", url: "/admin/users/kyc", icon: FileCheck, requiredPermission: "canViewProfiles" },
      { title: "Applications", url: "/admin/users/applications", icon: ClipboardList, requiredPermission: "canViewLoanApplications" },
      { title: "History", url: "/admin/users/history", icon: History, requiredPermission: "canViewProfiles" },
    ],
  },
  {
    label: "Lenders",
    items: [
      { title: "Products", url: "/admin/lenders/products", icon: Package, requiredPermission: "canViewLoanApplications" },
      { title: "Performance", url: "/admin/lenders/performance", icon: BarChart3, requiredPermission: "canViewLoanApplications" },
      { title: "Commission Settings", url: "/admin/lenders/commission", icon: Percent, requiredPermission: "canChangeSystemSettings" },
    ],
  },
  {
    label: "Financials",
    items: [
      { title: "Revenue", url: "/admin/financials/revenue", icon: DollarSign, requiredPermission: "canViewLoanApplications" },
      { title: "Payouts", url: "/admin/financials/payouts", icon: Wallet, requiredPermission: "canViewLoanApplications" },
      { title: "Reports", url: "/admin/financials/reports", icon: FileBarChart, requiredPermission: "canExportData" },
    ],
  },
  {
    label: "Compliance",
    items: [
      { title: "Risk Flags", url: "/admin/compliance/risk-flags", icon: ShieldAlert, requiredPermission: "canViewLoanApplications" },
      { title: "Audit Logs", url: "/admin/compliance/audit-logs", icon: ScrollText, requiredPermission: "canViewAuditLogs" },
      { title: "Payroll Integration", url: "/admin/compliance/payroll", icon: Link2, requiredPermission: "canViewLoanApplications" },
      { title: "Credit Bureau Check", url: "/admin/credit-bureau", icon: CreditCard, requiredPermission: "canViewLoanApplications" },
    ],
  },
  {
    label: "Tools",
    items: [
      { title: "Automations", url: "/admin/automations", icon: Zap, requiredPermission: "canApproveChanges" },
      { title: "Role Permissions", url: "/admin/role-permissions", icon: Shield, requiredPermission: "canManageUsers" },
      { title: "System Settings", url: "/admin/system-settings", icon: Settings, requiredPermission: "canChangeSystemSettings" },
    ],
  },
  {
    label: "Super Admin",
    items: [
      { title: "System Settings", url: "/admin/system-settings", icon: Settings, requiredPermission: "canChangeSystemSettings" },
      { title: "Credit Bureau", url: "/admin/credit-bureau", icon: CreditCard, requiredPermission: "canChangeSystemSettings" },
    ],
  },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const currentPath = location.pathname;
  const { permissions } = useRBAC();
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const isActive = (path: string) => currentPath === path;

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success("Logged out successfully");
      navigate("/");
    } catch (error) {
      toast.error("Failed to logout");
    }
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className={`px-4 py-5 ${collapsed ? "px-2" : ""}`}>
          {!collapsed && (
            <h2 className="font-display text-lg font-bold text-sidebar-foreground">
              Admin Portal
            </h2>
          )}
        </div>

        {menuGroups.map((group) => {
          const visibleItems = group.items.filter((item) => {
            if (!item.requiredPermission) return true;
            return (permissions as unknown as Record<string, boolean>)[item.requiredPermission] === true;
          });
          if (visibleItems.length === 0) return null;

          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={isActive(item.url)}>
                        <NavLink
                          to={item.url}
                          end
                          className="hover:bg-sidebar-accent/50"
                          activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                        >
                          <item.icon className="mr-2 h-4 w-4" />
                          {!collapsed && <span>{item.title}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      {/* Logout Button in Sidebar Footer */}
      <SidebarFooter>
        <div className={`p-2 ${collapsed ? "px-2" : "px-4"}`}>
          <Button
            variant="ghost"
            onClick={handleLogout}
            className={`w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 ${
              collapsed ? "px-2" : ""
            }`}
            title="Logout"
          >
            <LogOut className="h-4 w-4 mr-2" />
            {!collapsed && <span>Logout</span>}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
