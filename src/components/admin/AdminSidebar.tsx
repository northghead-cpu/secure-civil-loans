import {
  LayoutDashboard,
  Users,
  FileCheck,
  ClipboardList,
  History,
  Building2,
  Package,
  BarChart3,
  Percent,
  DollarSign,
  Wallet,
  CreditCard,
  FileBarChart,
  ShieldAlert,
  ScrollText,
  Link2,
  Zap,
  Settings,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
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

const menuGroups = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
    ],
  },
  {
    label: "Users",
    items: [
      { title: "KYC", url: "/admin/users/kyc", icon: FileCheck },
      { title: "Applications", url: "/admin/users/applications", icon: ClipboardList },
      { title: "History", url: "/admin/users/history", icon: History },
    ],
  },
  {
    label: "Lenders",
    items: [
      { title: "Products", url: "/admin/lenders/products", icon: Package },
      { title: "Performance", url: "/admin/lenders/performance", icon: BarChart3 },
      { title: "Commission Settings", url: "/admin/lenders/commission", icon: Percent },
    ],
  },
  {
    label: "Financials",
    items: [
      { title: "Revenue", url: "/admin/financials/revenue", icon: DollarSign },
      { title: "Payouts", url: "/admin/financials/payouts", icon: Wallet },
      { title: "Reports", url: "/admin/financials/reports", icon: FileBarChart },
    ],
  },
  {
    label: "Compliance",
    items: [
      { title: "Risk Flags", url: "/admin/compliance/risk-flags", icon: ShieldAlert },
      { title: "Audit Logs", url: "/admin/compliance/audit-logs", icon: ScrollText },
      { title: "Payroll Integration", url: "/admin/compliance/payroll", icon: Link2 },
    ],
  },
  {
    label: "Tools",
    items: [
      { title: "Automations", url: "/admin/automations", icon: Zap },
      { title: "System Settings", url: "/admin/system-settings", icon: Settings, superAdminOnly: true },
    ],
  },
];

interface AdminSidebarProps {
  isSuperAdmin?: boolean;
}

export function AdminSidebar({ isSuperAdmin = false }: AdminSidebarProps) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const currentPath = location.pathname;

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
          const visibleItems = group.items.filter(
            (item) => !(item as any).superAdminOnly || isSuperAdmin
          );
          if (visibleItems.length === 0) return null;

          return (
            <SidebarGroup key={group.label} defaultOpen>
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
