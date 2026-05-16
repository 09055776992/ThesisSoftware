import { createBrowserRouter } from "react-router";
import { SignUp } from "./pages/sign-up";
import { SignIn } from "./pages/sign-in";
import { Redirect } from "./pages/redirect";
import { ProfileSetup } from "./pages/profile-setup";
import { Dashboard } from "./pages/dashboard";
import { Profile } from "./pages/profile";
import { Scholarships } from "./pages/scholarships";
import { Messages } from "./pages/messages";
import { Matches } from "./pages/matches";
import { SavedItems } from "./pages/saved";
import { Settings } from "./pages/settings";
import { MyApplications } from "./pages/my-applications";
import { ProviderDashboard } from "./pages/provider-dashboard";
import { AdminDashboard } from "./pages/admin/dashboard";
import { AdminUsers } from "./pages/admin/users";
import { AdminScholarships } from "./pages/admin/scholarships";
import { AdminApplications } from "./pages/admin/applications";
import { AdminMessages } from "./pages/admin/messages";
import { AdminReports } from "./pages/admin/reports";
import { AdminNotifications } from "./pages/admin/notifications";
import { AdminSettings } from "./pages/admin/settings";
import { RootLayout } from "./layouts/root-layout";
import { AuthLayout } from "./layouts/auth-layout";
import { DashboardLayout } from "./layouts/dashboard-layout";
import { AdminLayout } from "./layouts/admin-layout";

function RedirectToSignIn() {
  return <Redirect to="/auth/signin" />;
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: RootLayout,
    children: [
      {
        index: true,
        Component: RedirectToSignIn,
      },
      {
        path: "auth",
        Component: AuthLayout,
        children: [
          { path: "signup", Component: SignUp },
          { path: "signin", Component: SignIn },
        ],
      },
      {
        path: "profile-setup",
        Component: ProfileSetup,
      },
      {
        path: "dashboard",
        Component: DashboardLayout,
        children: [
          { index: true, Component: Dashboard },
          { path: "profile", Component: Profile },
          { path: "scholarships", Component: Scholarships },
          { path: "matches", Component: Matches },
          { path: "applications", Component: MyApplications },
          { path: "messages", Component: Messages },
          { path: "saved", Component: SavedItems },
          { path: "settings", Component: Settings },
        ],
      },
      {
        path: "admin",
        Component: AdminLayout,
        children: [
          { index: true, Component: AdminDashboard },
          { path: "users", Component: AdminUsers },
          { path: "scholarships", Component: AdminScholarships },
          { path: "applications", Component: AdminApplications },
          { path: "messages", Component: AdminMessages },
          { path: "reports", Component: AdminReports },
          { path: "notifications", Component: AdminNotifications },
          { path: "settings", Component: AdminSettings },
        ],
      },
      {
        path: "provider",
        children: [
          { path: "dashboard", Component: ProviderDashboard },
        ],
      },
      {
        path: "*",
        Component: RedirectToSignIn,
      },
    ],
  },
]);