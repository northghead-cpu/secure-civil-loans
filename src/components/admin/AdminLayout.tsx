import { useEffect, useState } from "react";
import { useNavigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { RBACProvider, useRBAC, AppRole } from "@/hooks/useRBAC";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";

const ADMIN_ROLES: AppRole[] = ["admin", "super_admin", "super_user", "compliance_team", "data_entry_team"];

const AdminContent = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { roles, loading: rbacLoading, permissions, highestRole, hasRole } = useRBAC();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (authLoading || rbacLoading) return;
    if (!user) {
      navigate("/login");
      return;
    }
    const hasAdminRole = roles.some((r) => ADMIN_ROLES.includes(r));
    if (!hasAdminRole) {
      toast.error("Access denied — you don't have admin privileges");
      navigate("/");
      return;
    }
    setChecked(true);
  }, [user, authLoading, rbacLoading, roles, navigate]);

  if (authLoading || rbacLoading || !checked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AdminSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center border-b border-border px-4 bg-card/80 backdrop-blur-lg">
            <SidebarTrigger className="mr-4" />
            <span className="font-display text-sm font-semibold text-foreground">Riverbank Admin</span>
            {highestRole && (
              <span className="ml-3 px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary font-medium">
                {highestRole.replace("_", " ")}
              </span>
            )}
          </header>
          <main className="flex-1 overflow-auto p-3 sm:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

const AdminLayout = () => {
  return (
    <RBACProvider>
      <AdminContent />
    </RBACProvider>
  );
};

export default AdminLayout;
