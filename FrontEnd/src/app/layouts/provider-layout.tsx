import { useState, useEffect } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router";
import { LayoutDashboard, Award, FileText, MessageSquare, Bell, Loader2, LogOut, User as UserIcon, Menu } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import { Sheet, SheetContent } from "../components/ui/sheet";
import { Button } from "../components/ui/button";
import { Redirect } from "../pages/redirect";
import { getStoredUser, getAuthToken, clearStoredUser, getInitials } from "../lib/user-storage";
import { API_URL } from "../lib/api-client";

interface ProviderStats {
  totalScholarships: number;
  pendingApplications: number;
}

export function ProviderLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [stats, setStats] = useState<ProviderStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const user = getStoredUser();

  // Guard: must be a provider
  if (!user || (user.userType !== "provider" && user.role !== "provider")) {
    return <Redirect to="/auth/signin" />;
  }

  const navItems = [
    { href: "/provider/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/provider/profile", label: "Organization Profile", icon: UserIcon },
    { href: "/provider/scholarships", label: "My Scholarships", icon: Award },
    { href: "/provider/applications", label: "Applications", icon: FileText },
    { href: "/provider/messages", label: "Messages", icon: MessageSquare },
    { href: "/provider/notifications", label: "Notifications", icon: Bell },
  ];

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = getAuthToken();
        const res = await fetch(`${API_URL}/api/provider/dashboard/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setStats({
            totalScholarships: data.stats?.totalScholarships ?? 0,
            pendingApplications: data.stats?.pendingApplications ?? 0,
          });
        }
      } catch {
        // silently fail — stats are non-critical
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const handleLogout = () => {
    clearStoredUser();
    navigate("/auth/signin");
  };

  const displayName = user.fullName || user.email?.split("@")[0] || "Provider";
  const orgName = (user as any).organizationName || "QCYDO";

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Provider Sidebar */}
      <aside className="hidden lg:flex flex-col w-[280px] bg-white border-r border-gray-200 sticky top-0 h-screen overflow-y-auto shrink-0">
        <div className="p-4">
          {/* Provider Header */}
          <div className="mb-6 pt-2">
            <div className="flex items-center gap-3 mb-1">
              <Avatar className="size-14 border-2 border-blue-100">
                <AvatarFallback className="bg-blue-100 text-blue-700 text-lg font-semibold">
                  {getInitials(user)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-base truncate">{displayName}</p>
                <p className="text-xs text-muted-foreground truncate">{orgName}</p>
                <Badge className="bg-blue-600 hover:bg-blue-600 text-white text-xs px-2 py-0.5 mt-1">
                  Provider
                </Badge>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                location.pathname === item.href ||
                (item.href !== "/provider/dashboard" && location.pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                    isActive
                      ? "bg-[#1E3A5F] text-white shadow-sm"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <Icon className="size-5 flex-shrink-0" />
                  <span className="font-medium text-sm">{item.label}</span>
                  {item.href === "/provider/applications" &&
                    (stats?.pendingApplications ?? 0) > 0 && (
                      <Badge className="ml-auto bg-amber-500 hover:bg-amber-500 text-white text-xs px-1.5 py-0">
                        {stats!.pendingApplications}
                      </Badge>
                    )}
                </Link>
              );
            })}
          </nav>

          {/* Quick Stats */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 px-3">
              Quick Stats
            </h3>
            <div className="space-y-2.5">
              {loading ? (
                <div className="flex items-center justify-center px-3 py-4">
                  <Loader2 className="size-4 animate-spin text-gray-400" />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between px-3 py-1.5">
                    <span className="text-sm text-gray-600">My Scholarships</span>
                    <Badge className="bg-[#1E3A5F] hover:bg-[#1E3A5F] text-white px-2.5 py-0.5 text-xs font-semibold">
                      {stats?.totalScholarships ?? "—"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between px-3 py-1.5">
                    <span className="text-sm text-gray-600">Pending Applications</span>
                    <Badge className="bg-amber-600 hover:bg-amber-600 text-white px-2.5 py-0.5 text-xs font-semibold">
                      {stats?.pendingApplications ?? "—"}
                    </Badge>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Logout */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-gray-600 hover:bg-gray-100 text-sm font-medium w-full"
            >
              <LogOut className="size-4" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar Drawer */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-[280px] p-0 overflow-y-auto">
          <div className="p-4">
            {/* Provider Header */}
            <div className="mb-6 pt-2">
              <div className="flex items-center gap-3 mb-1">
                <Avatar className="size-14 border-2 border-blue-100">
                  <AvatarFallback className="bg-blue-100 text-blue-700 text-lg font-semibold">
                    {getInitials(user)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-base truncate">{displayName}</p>
                  <p className="text-xs text-muted-foreground truncate">{orgName}</p>
                  <Badge className="bg-blue-600 hover:bg-blue-600 text-white text-xs px-2 py-0.5 mt-1">
                    Provider
                  </Badge>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  location.pathname === item.href ||
                  (item.href !== "/provider/dashboard" && location.pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                      isActive
                        ? "bg-[#1E3A5F] text-white shadow-sm"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <Icon className="size-5 flex-shrink-0" />
                    <span className="font-medium text-sm">{item.label}</span>
                    {item.href === "/provider/applications" &&
                      (stats?.pendingApplications ?? 0) > 0 && (
                        <Badge className="ml-auto bg-amber-500 hover:bg-amber-500 text-white text-xs px-1.5 py-0">
                          {stats!.pendingApplications}
                        </Badge>
                      )}
                  </Link>
                );
              })}
            </nav>

            {/* Quick Stats */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 px-3">
                Quick Stats
              </h3>
              <div className="space-y-2.5">
                {loading ? (
                  <div className="flex items-center justify-center px-3 py-4">
                    <Loader2 className="size-4 animate-spin text-gray-400" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between px-3 py-1.5">
                      <span className="text-sm text-gray-600">My Scholarships</span>
                      <Badge className="bg-[#1E3A5F] hover:bg-[#1E3A5F] text-white px-2.5 py-0.5 text-xs font-semibold">
                        {stats?.totalScholarships ?? "—"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between px-3 py-1.5">
                      <span className="text-sm text-gray-600">Pending Applications</span>
                      <Badge className="bg-amber-600 hover:bg-amber-600 text-white px-2.5 py-0.5 text-xs font-semibold">
                        {stats?.pendingApplications ?? "—"}
                      </Badge>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Logout */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-gray-600 hover:bg-gray-100 text-sm font-medium w-full"
              >
                <LogOut className="size-4" />
                Sign Out
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        {/* Mobile Top Bar */}
        <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 lg:hidden">
          <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(true)}>
            <Menu className="size-5" />
          </Button>
          <span className="font-semibold text-sm">Provider Panel</span>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
