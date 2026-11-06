import { useEffect, useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router";
import { Home, User, Award, MessageSquare, Users, Bookmark, Settings, Star, Bell, CheckCheck, FileText, Menu, Rss } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import { Sheet, SheetContent } from "../components/ui/sheet";
import { clearStoredUser, getDisplayName, getInitials, getStoredUser, saveStoredUser, getActiveUserEmail, syncThemeForUser } from "../lib/user-storage";
import type { UserProfile } from "../lib/user-storage";
import { Button } from "../components/ui/button";
import { Redirect } from "../pages/redirect";
import {
  fetchScholarshipsWithEligibility,
  fetchUnreadCount,
  fetchUnreadMessageCount,
  markNotificationRead,
  fetchNotifications,
  resolvePublicAssetUrl,
  fetchUserProfile,
} from "../lib/api-client";
import { calculateCompleteness } from "../lib/profileCompleteness";

interface NotificationItem {
  _id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  scholarshipName?: string;
  link?: string;
}

function formatTimeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const sec = Math.floor((Date.now() - t) / 1000);
  if (sec < 45) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

export function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<UserProfile | null>(() => getStoredUser());
  // FIX 7: State for actual scholarship match count
  const [matchCount, setMatchCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Theme restore on every mount ──────────────────────────────────────────
  // The settings page adds/removes `.dark` on <html>, but that class is lost
  // on navigation. Re-apply it here from the stored preference so dark mode
  // persists across the whole dashboard session.
  useEffect(() => {
    syncThemeForUser(getStoredUser());
  }, []);

  // Sync user state on custom storage updates
  useEffect(() => {
    const handleStorageUpdate = () => {
      setUser(getStoredUser());
    };
    window.addEventListener("scholarship-portal-user-updated", handleStorageUpdate);
    window.addEventListener("storage", handleStorageUpdate);
    return () => {
      window.removeEventListener("scholarship-portal-user-updated", handleStorageUpdate);
      window.removeEventListener("storage", handleStorageUpdate);
    };
  }, []);

  // Fetch latest user details from server to guarantee user's actual full name is displayed
  useEffect(() => {
    const email = user?.email || getActiveUserEmail() || getStoredUser()?.email;
    if (!email) return;

    fetchUserProfile(email)
      .then((res) => {
        if (res?.user) {
          saveStoredUser(res.user);
          setUser(getStoredUser());
        }
      })
      .catch((err) => {
        console.warn("[DashboardLayout] Could not fetch fresh profile:", err);
      });
  }, [user?.email]);
  // FIX 7: Fetch actual scholarship matches
  useEffect(() => {
    if (!user?.email) return;
    
    fetchScholarshipsWithEligibility(user.email)
      .then((result: any) => {
        const scholarships = result.data || [];
        // Count scholarships with 100% match (or eligible status)
        const fullMatches = scholarships.filter((s: any) => 
          s.matchScore === 100 || s.eligibilityStatus === "eligible"
        ).length;
        setMatchCount(fullMatches);
      })
      .catch(() => {
        setMatchCount(0);
      });
  }, [user?.email]);

  // Fetch unread notification count
  useEffect(() => {
    if (!user?.email) return;
    const refresh = () => fetchUnreadCount(user.email!).then((result) => setUnreadCount(result.count || 0)).catch(() => {});
    refresh();
    const interval = window.setInterval(refresh, 15000);
    return () => window.clearInterval(interval);
  }, [user?.email]);

  useEffect(() => {
    if (!user?.email) return;
    let active = true;
    const refresh = () => fetchUnreadMessageCount(user.email!)
      .then((result) => {
        if (active) setUnreadMessageCount(result.count || 0);
      })
      .catch((error) => console.error("Failed to refresh unread message count:", error));
    void refresh();
    const interval = window.setInterval(refresh, 5000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [user?.email]);

  // Fetch notifications when panel opens
  useEffect(() => {
    if (!notificationPanelOpen || !user?.email) return;
    fetchNotifications(user.email)
      .then((result) => setNotifications((result.data as unknown as NotificationItem[]) || []))
      .catch(() => {});
  }, [notificationPanelOpen, user?.email]);

  const handleMarkRead = async (id: string) => {
    try {
      await markNotificationRead(id, user?.email);
      setNotifications((prev) => prev.map((n) => n._id === id ? { ...n, read: true } : n));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  };

  const handleMarkAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n._id);
    if (unreadIds.length === 0) return;
    try {
      await Promise.all(unreadIds.map((id) => markNotificationRead(id, user?.email)));
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Error marking all as read:", err);
    }
  };

  // Also refresh unread count when panel closes
  useEffect(() => {
    if (!notificationPanelOpen && user?.email) {
      fetchUnreadCount(user.email)
        .then((result) => setUnreadCount(result.count || 0))
        .catch(() => {});
    }
  }, [notificationPanelOpen]);

  if (!user?.email) {
    return <Redirect to="/auth/signin" />;
  }

  const accountRole = String(user.userType || user.role || "student").toLowerCase();
  if (accountRole === "provider") {
    return <Redirect to="/provider/dashboard" />;
  }
  if (accountRole === "admin") {
    return <Redirect to="/admin" />;
  }

  const displayName = getDisplayName(user);
  const displayHeadline = user?.fieldOfStudy || user?.educationLevel || user?.userType || "Complete your profile";
  const profileCompleteness = calculateCompleteness(user);
  const scholarshipMatchSignals = [user?.gpa, user?.fieldOfStudy, user?.educationLevel, user?.financialNeed, user?.location].filter(Boolean).length;
  const socialSignals = [user?.skills?.length || 0, user?.headline, user?.about].filter((value) => Boolean(value)).length;
  const isProfileEmpty = !user || (
    !user.fullName &&
    !user.email &&
    !user.gpa &&
    !user.fieldOfStudy &&
    !user.educationLevel &&
    !(user.financialNeed && user.financialNeed.length > 0) &&
    !user.profileImage
  );
  
  const navItems = [
    { href: "/dashboard", label: "Home", icon: Home },
    { href: "/dashboard/feed", label: "Discovery Feed", icon: Rss },
    { href: "/dashboard/profile", label: "My Profile", icon: User },
    { href: "/dashboard/scholarships", label: "Scholarships", icon: Award },
    { href: "/dashboard/matches", label: "Scholarship Matches", icon: Star },
    { href: "/dashboard/applications", label: "My Applications", icon: FileText },
    { href: "/dashboard/messages", label: "Messages", icon: MessageSquare },
    { href: "/dashboard/saved", label: "Saved Scholarships", icon: Bookmark },
    { href: "/dashboard/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Scholar Sidebar */}
      <aside className="hidden lg:flex flex-col w-[280px] shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 sticky top-0 h-screen overflow-y-auto">
        <div className="p-4">
          {/* User Header */}
          <div className="mb-6 pt-2">
            <div className="flex items-center gap-3 mb-1">
              <Avatar className="size-14 border-2 border-blue-100 dark:border-blue-900">
                <AvatarImage
                  key={user?.profileImage || user?.profilePicture}
                  src={resolvePublicAssetUrl(user?.profileImage || user?.profilePicture, true)}
                />
                <AvatarFallback className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-lg font-semibold">
                  {getInitials(user)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 dark:text-gray-100 text-base truncate">{displayName}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{displayHeadline}</p>
              </div>
            </div>
            <div className="mt-3 px-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  clearStoredUser();
                  navigate("/", { replace: true });
                }}
                className="w-full justify-start"
              >
                Sign out
              </Button>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                    isActive
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                >
                  <Icon className="size-5 flex-shrink-0" />
                  <span className="font-medium text-sm">{item.label}</span>
                  {item.href === "/dashboard/messages" && unreadMessageCount > 0 && (
                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-semibold leading-none text-white" aria-label={`${unreadMessageCount} unread messages`}>
                      {unreadMessageCount > 99 ? "99+" : unreadMessageCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Quick Stats Section */}
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3 px-3">
              Quick Stats
            </h3>
            <div className="space-y-2.5">
              {isProfileEmpty ? (
                <div className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
                  Complete your profile to see quick stats like completeness, signals, and matches.
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between px-3 py-1.5">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Profile Completeness</span>
                    <Badge className="bg-blue-600 hover:bg-blue-600 text-white px-2.5 py-0.5 text-xs font-semibold">
                      {profileCompleteness}%
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between px-3 py-1.5">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Profile Signals</span>
                    <Badge className="bg-blue-800 hover:bg-blue-800 text-white px-2.5 py-0.5 text-xs font-semibold">
                      {socialSignals}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between px-3 py-1.5">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Scholarship Matches</span>
                    <Badge className="bg-green-600 hover:bg-green-600 text-white px-2.5 py-0.5 text-xs font-semibold">
                      {matchCount}
                    </Badge>
                  </div>
                </>
              )}
            </div>
          </div>

        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        {/* Top Bar with Notification Bell */}
        <div className="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-2 flex items-center justify-end gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden mr-auto"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="size-5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="relative"
            onClick={() => setNotificationPanelOpen(true)}
          >
            <Bell className="size-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full size-5 flex items-center justify-center font-bold">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Button>
        </div>

        {/* Mobile Sidebar Drawer */}
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="w-[280px] p-0 overflow-y-auto bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
            <div className="p-4">
              {/* User Header */}
              <div className="mb-6 pt-2">
                <div className="flex items-center gap-3 mb-1">
                  <Avatar className="size-14 border-2 border-blue-100 dark:border-blue-900">
                    <AvatarImage
                      key={user?.profileImage || user?.profilePicture}
                      src={resolvePublicAssetUrl(user?.profileImage || user?.profilePicture, true)}
                    />
                    <AvatarFallback className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-lg font-semibold">
                      {getInitials(user)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-gray-100 text-base truncate">{displayName}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{displayHeadline}</p>
                  </div>
                </div>
                <div className="mt-3 px-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      clearStoredUser();
                      navigate("/", { replace: true });
                    }}
                    className="w-full justify-start"
                  >
                    Sign out
                  </Button>
                </div>
              </div>

              {/* Navigation Menu */}
              <nav className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                        isActive
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                      }`}
                    >
                      <Icon className="size-5 flex-shrink-0" />
                      <span className="font-medium text-sm">{item.label}</span>
                      {item.href === "/dashboard/messages" && unreadMessageCount > 0 && (
                        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-semibold leading-none text-white" aria-label={`${unreadMessageCount} unread messages`}>
                          {unreadMessageCount > 99 ? "99+" : unreadMessageCount}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>

              {/* Quick Stats Section */}
              <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800">
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3 px-3">
                  Quick Stats
                </h3>
                <div className="space-y-2.5">
                  {isProfileEmpty ? (
                    <div className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
                      Complete your profile to see quick stats like completeness, signals, and matches.
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between px-3 py-1.5">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Profile Completeness</span>
                        <Badge className="bg-blue-600 hover:bg-blue-600 text-white px-2.5 py-0.5 text-xs font-semibold">
                          {profileCompleteness}%
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between px-3 py-1.5">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Profile Signals</span>
                        <Badge className="bg-blue-800 hover:bg-blue-800 text-white px-2.5 py-0.5 text-xs font-semibold">
                          {socialSignals}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between px-3 py-1.5">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Scholarship Matches</span>
                        <Badge className="bg-green-600 hover:bg-green-600 text-white px-2.5 py-0.5 text-xs font-semibold">
                          {matchCount}
                        </Badge>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Notifications Side Panel using Sheet */}
        <Sheet open={notificationPanelOpen} onOpenChange={setNotificationPanelOpen}>
          <SheetContent side="right" className="w-full sm:max-w-[420px] p-0 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
            <div className="flex flex-col h-full">
              {/* Panel Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800 shrink-0">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-lg">Notifications</h2>
                  {unreadCount > 0 && (
                    <Badge className="bg-blue-600 text-white text-xs px-2 py-0.5">{unreadCount} new</Badge>
                  )}
                </div>
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={handleMarkAllRead} className="text-xs gap-1">
                    <CheckCheck className="size-3.5" />
                    Mark all read
                  </Button>
                )}
              </div>

              {/* Notifications List */}
              <div className="flex-1 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-10 text-center text-sm text-muted-foreground">
                    <Bell className="size-10 mx-auto mb-3 text-gray-300" />
                    <p>No notifications yet.</p>
                    <p className="text-xs mt-1">You&apos;ll see updates here when you apply for scholarships.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {notifications.map((notif) => (
                      <div
                        key={notif._id}
                        className={`p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${!notif.read ? "bg-blue-50/60 dark:bg-blue-950/40" : ""}`}
                        onClick={() => {
                          if (!notif.read) handleMarkRead(notif._id);
                          if (notif.link) navigate(notif.link);
                        }}
                        role={notif.link ? "button" : undefined}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {!notif.read && <span className="size-2 rounded-full bg-blue-600 flex-shrink-0" />}
                              <p className={`text-sm ${!notif.read ? "font-semibold" : "font-normal"} truncate`}>
                                {notif.title}
                              </p>
                            </div>
                            {(notif.scholarshipName || "").trim() ? (
                              <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{notif.scholarshipName}</p>
                            ) : null}
                            <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed mt-1">
                              {notif.message}
                            </p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">{formatTimeAgo(notif.createdAt)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <Outlet />
      </main>
    </div>
  );
}
