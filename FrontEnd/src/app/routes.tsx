import { createBrowserRouter } from "react-router";
import { SignUp } from "./pages/sign-up";
import { SignIn } from "./pages/sign-in";
import { ForgotPassword } from "./pages/forgot-password";
import { Redirect } from "./pages/redirect";
import { LandingPage } from "./pages/landing";
import { ProfileSetup } from "./pages/profile-setup";
import { Dashboard } from "./pages/dashboard";
import { Profile } from "./pages/profile";
import { Scholarships } from "./pages/scholarships";
import { StudentFeed } from "./pages/student-feed";
import { Messages } from "./pages/messages";
import { Matches } from "./pages/matches";
import { SavedItems } from "./pages/saved";
import { Settings } from "./pages/settings";
import { MyApplications } from "./pages/my-applications";
import { PrivacyPolicy, TermsOfService } from "./pages/legal";

// Admin pages
import { AdminDashboard } from "./pages/admin/dashboard";
import { AdminUsers } from "./pages/admin/users";
import { AdminScholarships } from "./pages/admin/scholarships";
import { AdminApplications } from "./pages/admin/applications";
import { AdminMessages } from "./pages/admin/messages";
import { AdminReports } from "./pages/admin/reports";
import { AdminNotifications } from "./pages/admin/notifications";
import { AdminSettings } from "./pages/admin/settings";
import { AdminProviders } from "./pages/admin/providers";
import { AdminStudentPostModeration } from "./pages/admin/student-post-moderation";
import { AdminProfilePage } from "./pages/admin/profile";

// Provider pages
import { ProviderDashboard } from "./pages/provider-dashboard";
import { ProviderScholarships } from "./pages/provider/scholarships";
import { ProviderScholarshipCreate } from "./pages/provider/scholarship-create";
import { ProviderScholarshipEdit } from "./pages/provider/scholarship-edit";
import { ProviderProfilePage } from "./pages/provider/profile";
import { ProviderApplications } from "./pages/provider/applications";
import { ProviderRenewals } from "./pages/provider/renewals";
import { ProviderMessages } from "./pages/provider/messages";
import { ProviderNotifications } from "./pages/provider/notifications";
import { ProviderTimeline } from "./pages/provider/timeline";

// Layouts
import { RootLayout } from "./layouts/root-layout";
import { AuthLayout } from "./layouts/auth-layout";
import { DashboardLayout } from "./layouts/dashboard-layout";
import { AdminLayout } from "./layouts/admin-layout";
import { ProviderLayout } from "./layouts/provider-layout";

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
        Component: LandingPage,
      },
      {
        path: "auth",
        Component: AuthLayout,
        children: [
          { path: "signup", Component: SignUp },
          { path: "signin", Component: SignIn },
          { path: "forgot-password", Component: ForgotPassword },
          { path: "terms", Component: TermsOfService },
          { path: "privacy", Component: PrivacyPolicy },
        ],
      },
      {
        path: "profile-setup",
        Component: ProfileSetup,
      },
      // Student dashboard
      {
        path: "dashboard",
        Component: DashboardLayout,
        children: [
          { index: true, Component: Dashboard },
          { path: "feed", Component: StudentFeed },
          { path: "profile", Component: Profile },
          { path: "scholarships", Component: Scholarships },
          { path: "matches", Component: Matches },
          { path: "applications", Component: MyApplications },
          { path: "messages", Component: Messages },
          { path: "saved", Component: SavedItems },
          { path: "settings", Component: Settings },
        ],
      },
      // Admin panel
      {
        path: "admin",
        Component: AdminLayout,
        children: [
          { index: true, Component: AdminDashboard },
          { path: "profile", Component: AdminProfilePage },
          { path: "users", Component: AdminUsers },
          { path: "providers", Component: AdminProviders },
          { path: "scholarships", Component: AdminScholarships },
          { path: "applications", Component: AdminApplications },
          { path: "student-posts", Component: AdminStudentPostModeration },
          { path: "messages", Component: AdminMessages },
          { path: "reports", Component: AdminReports },
          { path: "notifications", Component: AdminNotifications },
          { path: "settings", Component: AdminSettings },
        ],
      },
      // Provider panel
      {
        path: "provider",
        Component: ProviderLayout,
        children: [
          { path: "dashboard", Component: ProviderDashboard },
          { path: "timeline", Component: ProviderTimeline },
          { path: "scholarships", Component: ProviderScholarships },
          { path: "scholarships/create", Component: ProviderScholarshipCreate },
          { path: "scholarships/:id/edit", Component: ProviderScholarshipEdit },
          { path: "profile", Component: ProviderProfilePage },
          { path: "applications", Component: ProviderApplications },
          { path: "renewals", Component: ProviderRenewals },
          { path: "messages", Component: ProviderMessages },
          { path: "notifications", Component: ProviderNotifications },
        ],
      },
      {
        path: "*",
        Component: RedirectToSignIn,
      },
    ],
  },
]);
