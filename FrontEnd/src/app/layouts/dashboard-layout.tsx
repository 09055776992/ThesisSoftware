import { Outlet, Link, useLocation, useNavigate } from "react-router";
import { Home, User, Award, MessageSquare, Users, Bookmark, Settings } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import { getDisplayName, getInitials, getStoredUser } from "../lib/user-storage";
import { Button } from "../components/ui/button";

function countCompletedProfileFields(user: ReturnType<typeof getStoredUser>) {
  if (!user) return 0;

  const fields = [
    user.fullName,
    user.email,
    user.phone,
    user.headline,
    user.location,
    user.dateOfBirth,
    user.gpa,
    user.gpaScale,
    user.educationLevel,
    user.fieldOfStudy,
    user.graduationYear,
    user.netWorth,
    user.currency,
    user.incomeCategory,
    user.profileImage,
  ];

  return fields.filter((value) => String(value ?? "").trim().length > 0).length;
}

export function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = getStoredUser();
  const displayName = getDisplayName(user);
  const displayHeadline = user?.fieldOfStudy || user?.educationLevel || user?.userType || "Complete your profile";
  const completedFields = countCompletedProfileFields(user);
  const totalTrackedFields = 15;
  const profileCompleteness = Math.round((completedFields / totalTrackedFields) * 100);
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
    { href: "/dashboard/messages", label: "Messages", icon: MessageSquare },
    { href: "/dashboard/network", label: "Network", icon: Users },
    { href: "/dashboard/saved", label: "Saved Items", icon: Bookmark },
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
                <AvatarImage src={user?.profileImage} />
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
                      {scholarshipMatchSignals}
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
        <Outlet />
      </main>
    </div>
  );
}
