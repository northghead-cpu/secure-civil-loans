import { useEffect, useState } from "react";
import { useNavigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { RBACProvider, useRBAC, AppRole } from "@/hooks/useRBAC";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";
// 1. The Import (Make sure this path matches your file name exactly)
import { CosmicParallaxBg } from "../ui/parallax-cosmic-background";

const ADMIN_ROLES: AppRole[] = ["admin", "super_admin", "super_user", "compliance_team", "data_entry_team"];

const AdminContent = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { roles, loading: rbacLoading, highestRole } = useRBAC();
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
    // 2. Wrap everything in a container to hold the background
    <div className="relative min-h-screen w-full overflow-hidden">
      
      {/* 3. The Cosmic Background - stays fixed behind everything */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <CosmicParallaxBg 
          head="RIVERBANK" 
          text="Secure, Intelligence, Control" 
          loop={true} 
        />
      </div>

      <SidebarProvider>
        {/* 4. We set z-10 to bring the dashboard content in front of the stars */}
        <div className="relative z-10 min-h-screen flex w-full bg-transparent">
          <AdminSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            {/* 5. Semi-transparent header */}
            <header className="h-14 flex items-center border-b border-white/10 px-4 bg-black/20 backdrop-blur-md">
              <SidebarTrigger className="mr-4" />
              <span className="font-display text-sm font-semibold text-white">Riverbanc Admin</span>
              {highestRole && (
                <span className="ml-3 px-2 py-0.5 text-xs rounded-full bg-primary/20 text-primary-foreground font-medium">
                  {highestRole.replace("_", " ")}
                </span>
              )}
            </header>

            {/* 6. Main content area made transparent */}
            <main className="flex-1 overflow-auto p-3 sm:p-6 bg-transparent">
              <Outlet />
            </main>
          </div>
        </div>
      </SidebarProvider>
    </div>
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