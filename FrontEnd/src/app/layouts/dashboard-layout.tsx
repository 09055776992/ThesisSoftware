import { useEffect, useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router";
import { Home, User, Award, MessageSquare, Users, Bookmark, Settings, Star, Bell, CheckCheck, FileText } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import { Sheet, SheetContent } from "../components/ui/sheet";
import { clearStoredUser, getDisplayName, getInitials, getStoredUser } from "../lib/user-storage";
import { Button } from "../components/ui/button";
import { Redirect } from "../pages/redirect";
import {
  fetchScholarshipsWithEligibility,
  fetchUnreadCount,
  markNotificationRead,
  fetchNotifications,
  resolvePublicAssetUrl,
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
  const user = getStoredUser();
  // FIX 7: State for actual scholarship match count
  const [matchCount, setMatchCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [sidebarNotifications, setSidebarNotifications] = useState<NotificationItem[]>([]);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
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
    fetchUnreadCount(user.email)
      .then((result) => setUnreadCount(result.count || 0))
      .catch(() => {});
  }, [user?.email]);

  // Fetch notifications when panel opens
  useEffect(() => {
    if (!notificationPanelOpen || !user?.email) return;
    fetchNotifications(user.email)
      .then((result) => setNotifications((result.data as NotificationItem[]) || []))
      .catch(() => {});
  }, [notificationPanelOpen, user?.email]);

  useEffect(() => {
    if (!user?.email) return;
    fetchNotifications(user.email)
      .then((result) => {
        const list = ((result.data as NotificationItem[]) || []).slice();
        const unreadFirst = list.filter((n) => !n.read).slice(0, 3);
        setSidebarNotifications(unreadFirst);
      })
      .catch(() => {});
  }, [user?.email, unreadCount]);

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
    { href: "/dashboard/profile", label: "My Profile", icon: User },
    { href: "/dashboard/scholarships", label: "Scholarships", icon: Award },
    { href: "/dashboard/matches", label: "Scholarship Matches", icon: Star },
    { href: "/dashboard/applications", label: "My Applications", icon: FileText },
    { href: "/dashboard/messages", label: "Messages", icon: MessageSquare },
    { href: "/dashboard/saved", label: "Saved Scholarships", icon: Bookmark },
    { href: "/dashboard/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Scholar Sidebar */}
      <aside className="w-[280px] shrink-0 bg-white border-r border-gray-200 sticky top-0 h-screen overflow-y-auto">
        <div className="p-4">
          {/* User Header */}
          <div className="mb-6 pt-2">
            <div className="flex items-center gap-3 mb-1">
              <Avatar className="h-14 w-14 border-2 border-blue-100">
                <AvatarImage src={resolvePublicAssetUrl(user?.profileImage || user?.profilePicture)} />
                <AvatarFallback className="bg-blue-100 text-blue-700 text-lg font-semibold">
                  {getInitials(user)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-base truncate">{displayName}</p>
                <p className="text-sm text-gray-600 truncate">{displayHeadline}</p>
              </div>
            </div>
            <div className="mt-3 px-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  clearStoredUser();
                  navigate("/auth/signin", { replace: true });
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
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <span className="font-medium text-sm">{item.label}</span>
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
              {isProfileEmpty ? (
                <div className="px-3 py-2 text-sm text-gray-600">
                  Complete your profile to see quick stats like completeness, signals, and matches.
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between px-3 py-1.5">
                    <span className="text-sm text-gray-600">Profile Completeness</span>
                    <Badge className="bg-blue-600 hover:bg-blue-600 text-white px-2.5 py-0.5 text-xs font-semibold">
                      {profileCompleteness}%
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between px-3 py-1.5">
                    <span className="text-sm text-gray-600">Profile Signals</span>
                    <Badge className="bg-blue-800 hover:bg-blue-800 text-white px-2.5 py-0.5 text-xs font-semibold">
                      {socialSignals}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between px-3 py-1.5">
                    <span className="text-sm text-gray-600">Scholarship Matches</span>
                    <Badge className="bg-green-600 hover:bg-green-600 text-white px-2.5 py-0.5 text-xs font-semibold">
                      {matchCount}
                    </Badge>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Notifications preview (sidebar) */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-between px-3 mb-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Notifications {unreadCount > 0 && `(${unreadCount})`}
              </h3>
              {unreadCount > 0 && (
                <Badge className="bg-red-500 text-white text-xs px-1.5 py-0">{unreadCount}</Badge>
              )}
            </div>
            {sidebarNotifications.length === 0 ? (
              <p className="px-3 text-sm text-gray-500">No unread notifications.</p>
            ) : (
              <div className="space-y-2 px-2">
                {sidebarNotifications.map((n) => (
                  <button
                    key={n._id}
                    type="button"
                    className="w-full text-left rounded-lg px-2 py-2 hover:bg-gray-50 transition-colors"
                    onClick={() => {
                      setNotificationPanelOpen(true);
                      if (!n.read && user?.email) handleMarkRead(n._id);
                    }}
                  >
                    <div className="flex items-start gap-2">
                      {!n.read && <span className="mt-1.5 h-2 w-2 rounded-full bg-blue-600 flex-shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{n.title}</p>
                        {(n.scholarshipName || "").trim() ? (
                          <p className="text-xs text-gray-600 truncate">{n.scholarshipName}</p>
                        ) : null}
                        <p className="text-xs text-gray-400 mt-0.5">{formatTimeAgo(n.createdAt)}</p>
                      </div>
                    </div>
                  </button>
                ))}
                <button
                  type="button"
                  className="w-full text-center text-sm text-blue-600 font-medium py-2 hover:underline"
                  onClick={() => setNotificationPanelOpen(true)}
                >
                  View all
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        {/* Top Bar with Notification Bell */}
        <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-6 py-2 flex items-center justify-end gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="relative"
            onClick={() => setNotificationPanelOpen(true)}
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Button>
        </div>

        {/* Notifications Side Panel using Sheet */}
        <Sheet open={notificationPanelOpen} onOpenChange={setNotificationPanelOpen}>
          <SheetContent side="right" className="w-full sm:max-w-[420px] p-0">
            <div className="flex flex-col h-full">
              {/* Panel Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-lg">Notifications</h2>
                  {unreadCount > 0 && (
                    <Badge className="bg-blue-600 text-white text-xs px-2 py-0.5">{unreadCount} new</Badge>
                  )}
                </div>
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={handleMarkAllRead} className="text-xs gap-1">
                    <CheckCheck className="h-3.5 w-3.5" />
                    Mark all read
                  </Button>
                )}
              </div>

              {/* Notifications List */}
              <div className="flex-1 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-10 text-center text-sm text-muted-foreground">
                    <Bell className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                    <p>No notifications yet.</p>
                    <p className="text-xs mt-1">You&apos;ll see updates here when you apply for scholarships.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {notifications.map((notif) => (
                      <div
                        key={notif._id}
                        className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${!notif.read ? "bg-blue-50/60" : ""}`}
                        onClick={() => { if (!notif.read) handleMarkRead(notif._id); }}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {!notif.read && <span className="h-2 w-2 rounded-full bg-blue-600 flex-shrink-0" />}
                              <p className={`text-sm ${!notif.read ? "font-semibold" : "font-normal"} truncate`}>
                                {notif.title}
                              </p>
                            </div>
                            {(notif.scholarshipName || "").trim() ? (
                              <p className="text-xs text-gray-600 truncate">{notif.scholarshipName}</p>
                            ) : null}
                            <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed mt-1">
                              {notif.message}
                            </p>
                            <p className="text-xs text-gray-400 mt-2">{formatTimeAgo(notif.createdAt)}</p>
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
