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
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useRBAC } from "@/hooks/useRBAC";
import {
  Sidebar,
  SidebarContent,
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
  icon: any;
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
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const currentPath = location.pathname;
  const { permissions } = useRBAC();

  const isActive = (path: string) => currentPath === path;

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
            return (permissions as any)[item.requiredPermission] === true;
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
    </Sidebar>
  );
}
