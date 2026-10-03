import { useState, useEffect } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router";
import { LayoutDashboard, Users, Award, FileText, MessageSquare, BarChart3, Settings, Loader2, ShieldCheck, Menu } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import { Sheet, SheetContent } from "../components/ui/sheet";
import { Button } from "../components/ui/button";
import { Redirect } from "../pages/redirect";
import { getStoredUser, getDisplayName, getInitials, clearStoredUser } from "../lib/user-storage";
import { API_URL } from "../lib/api-client";

interface QuickStats {
  totalScholars: number;
  pendingApplications: number;
  activeScholarships: number;
  pendingProviders?: number;
}

export function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [quickStats, setQuickStats] = useState<QuickStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const user = getStoredUser();

  if (user?.userType !== "admin") {
    return <Redirect to="/" />;
  }

  const navItems = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/users", label: "Manage Users", icon: Users },
    { href: "/admin/providers", label: "Provider Accounts", icon: ShieldCheck },
    { href: "/admin/scholarships", label: "Scholarships", icon: Award },
    { href: "/admin/applications", label: "Applications", icon: FileText },
    { href: "/admin/messages", label: "Messages", icon: MessageSquare },
    { href: "/admin/reports", label: "Reports", icon: BarChart3 },
    { href: "/admin/settings", label: "Settings", icon: Settings },
  ];

  useEffect(() => {
    const fetchQuickStats = async () => {
      try {
        const API_BASE = API_URL;
        const response = await fetch(`${API_BASE}/api/admin/analytics`);
        if (response.ok) {
          const data = await response.json();
          setQuickStats(data.quickStats);
        }
      } catch (err) {
        console.error("Error fetching quick stats:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchQuickStats();
  }, []);

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Admin Sidebar */}
      <aside className="hidden lg:flex flex-col w-[280px] bg-white border-r border-gray-200 sticky top-0 h-screen overflow-y-auto shrink-0">
        <div className="p-4">
          {/* Admin Header */}
          <div className="mb-6 pt-2">
            <div className="flex items-center gap-3 mb-1">
              <Avatar className="size-14 border-2 border-orange-100">
                <AvatarImage src={user?.profilePicture || user?.profileImage || ""} />
                <AvatarFallback className="bg-orange-100 text-orange-700 text-lg font-semibold">
                  {getInitials(user)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-base truncate">{getDisplayName(user)}</p>
                <Badge className="bg-orange-600 hover:bg-orange-600 text-white text-xs px-2 py-0.5 mt-1">
                  Administrator
                </Badge>
              </div>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                location.pathname === item.href ||
                (item.href !== "/admin" && location.pathname.startsWith(item.href));
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
                  {item.href === "/admin/providers" && (quickStats?.pendingProviders ?? 0) > 0 && (
                    <Badge className="ml-auto bg-amber-500 hover:bg-amber-500 text-white text-xs px-1.5 py-0">
                      {quickStats!.pendingProviders}
                    </Badge>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Quick Stats Section */}
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
                    <span className="text-sm text-gray-600">Total Scholars</span>
                    <Badge className="bg-[#1E3A5F] hover:bg-[#1E3A5F] text-white px-2.5 py-0.5 text-xs font-semibold">
                      {quickStats?.totalScholars?.toLocaleString() ?? "—"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between px-3 py-1.5">
                    <span className="text-sm text-gray-600">Pending Applications</span>
                    <Badge className="bg-amber-600 hover:bg-amber-600 text-white px-2.5 py-0.5 text-xs font-semibold">
                      {quickStats?.pendingApplications?.toLocaleString() ?? "—"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between px-3 py-1.5">
                    <span className="text-sm text-gray-600">Active Scholarships</span>
                    <Badge className="bg-green-600 hover:bg-green-600 text-white px-2.5 py-0.5 text-xs font-semibold">
                      {quickStats?.activeScholarships?.toLocaleString() ?? "—"}
                    </Badge>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Back to Scholar Panel Link */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <Link
              to="/dashboard"
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-gray-600 hover:bg-gray-100 text-sm font-medium"
            >
              ← Back to Scholar Panel
            </Link>
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar Drawer */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-[280px] p-0 overflow-y-auto">
          <div className="p-4">
            {/* Admin Header */}
            <div className="mb-6 pt-2">
              <div className="flex items-center gap-3 mb-1">
                <Avatar className="size-14 border-2 border-orange-100">
                  <AvatarImage src={user?.profilePicture || user?.profileImage || ""} />
                  <AvatarFallback className="bg-orange-100 text-orange-700 text-lg font-semibold">
                    {getInitials(user)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-base truncate">{getDisplayName(user)}</p>
                  <Badge className="bg-orange-600 hover:bg-orange-600 text-white text-xs px-2 py-0.5 mt-1">
                    Administrator
                  </Badge>
                </div>
              </div>
            </div>

            {/* Navigation Menu */}
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  location.pathname === item.href ||
                  (item.href !== "/admin" && location.pathname.startsWith(item.href));
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
                    {item.href === "/admin/providers" && (quickStats?.pendingProviders ?? 0) > 0 && (
                      <Badge className="ml-auto bg-amber-500 hover:bg-amber-500 text-white text-xs px-1.5 py-0">
                        {quickStats!.pendingProviders}
                      </Badge>
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Quick Stats Section */}
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
                      <span className="text-sm text-gray-600">Total Scholars</span>
                      <Badge className="bg-[#1E3A5F] hover:bg-[#1E3A5F] text-white px-2.5 py-0.5 text-xs font-semibold">
                        {quickStats?.totalScholars?.toLocaleString() ?? "—"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between px-3 py-1.5">
                      <span className="text-sm text-gray-600">Pending Applications</span>
                      <Badge className="bg-amber-600 hover:bg-amber-600 text-white px-2.5 py-0.5 text-xs font-semibold">
                        {quickStats?.pendingApplications?.toLocaleString() ?? "—"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between px-3 py-1.5">
                      <span className="text-sm text-gray-600">Active Scholarships</span>
                      <Badge className="bg-green-600 hover:bg-green-600 text-white px-2.5 py-0.5 text-xs font-semibold">
                        {quickStats?.activeScholarships?.toLocaleString() ?? "—"}
                      </Badge>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Back to Scholar Panel Link */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <Link
                to="/dashboard"
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-gray-600 hover:bg-gray-100 text-sm font-medium"
              >
                ← Back to Scholar Panel
              </Link>
            </div>

            {/* Logout */}
            <div className="mt-4">
              <button
                onClick={() => { clearStoredUser(); navigate("/", { replace: true }); }}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-gray-600 hover:bg-gray-100 text-sm font-medium w-full"
              >
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
          <span className="font-semibold text-sm">Admin Panel</span>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
