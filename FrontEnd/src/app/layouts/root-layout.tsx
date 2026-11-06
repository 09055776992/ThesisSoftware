import { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router";
import { AdminAuthModal } from "../pages/admin-auth/admin-auth-modal";
import { ProviderAuthModal } from "../pages/provider-auth/provider-auth-modal";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { saveRoleSession, saveStoredUser, getStoredUser, getAuthToken, resetTheme, syncThemeForUser } from "../lib/user-storage";
import { fetchUserProfile, pickProfileImageUrl } from "../lib/api-client";

export function RootLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showProviderModal, setShowProviderModal] = useState(false);
  const [isAuthRestored, setIsAuthRestored] = useState(false);

  // Check if we're on the landing page (root path)
  const isLandingPage = location.pathname === "/";
  const isPublicRoute = isLandingPage || location.pathname.startsWith("/auth");

  // Keyboard shortcuts hook - must be called before any conditional returns
  useKeyboardShortcuts({
    onAdminPanel: () => setShowAdminModal(true),
    onProviderPanel: () => setShowProviderModal(true),
  });

  useEffect(() => {
    const openProviderAuth = () => setShowProviderModal(true);
    window.addEventListener("scholar:open-provider-auth", openProviderAuth);
    return () => window.removeEventListener("scholar:open-provider-auth", openProviderAuth);
  }, []);

  // Restore auth state from localStorage on mount (refresh profile image from MongoDB)
  useEffect(() => {
    const token = getAuthToken();
    const user = getStoredUser();

    const finishRestore = (profileUser: typeof user) => {
      if (isPublicRoute || !token || !profileUser) {
        resetTheme();
      } else {
        syncThemeForUser(profileUser);
      }
      // Only redirect authenticated users if they're on a non-auth, non-landing page
      if (token && profileUser && !isLandingPage && !location.pathname.startsWith("/auth")) {
        const path = location.pathname;
        if (profileUser.userType === "admin" && !path.startsWith("/admin")) {
          navigate("/admin", { replace: true });
        } else if (profileUser.userType === "provider" && !path.startsWith("/provider")) {
          navigate("/provider/dashboard", { replace: true });
        } else if (
          profileUser.userType !== "admin" &&
          profileUser.userType !== "provider" &&
          !path.startsWith("/dashboard") &&
          path !== "/profile-setup"
        ) {
          navigate("/dashboard", { replace: true });
        }
      }
      setIsAuthRestored(true);
    };

    if (!token || !user?.email || isPublicRoute) {
      finishRestore(user);
      return;
    }

    // Admin/provider sessions use role-specific auth — do not load student profile (can overwrite userType)
    if (user.userType === "admin" || user.userType === "provider") {
      finishRestore(user);
      return;
    }

    fetchUserProfile(user.email)
      .then((result) => {
        const server = result.user ?? {};
        const avatarUrl = pickProfileImageUrl(server) || pickProfileImageUrl(user as Record<string, unknown>);
        saveStoredUser({
          ...server,
          email: user.email,
          ...(avatarUrl ? { profileImage: avatarUrl, profilePicture: avatarUrl } : {}),
        });
        finishRestore(getStoredUser());
      })
      .catch(() => finishRestore(user));
  }, [navigate, isLandingPage, isPublicRoute, location.pathname]);

  // Don't render until auth is restored to prevent flash,
  // except on the landing page or any /auth/* route (signin, signup, forgot-password)
  const isAuthRoute = location.pathname.startsWith("/auth");
  if (!isAuthRestored && !isLandingPage && !isAuthRoute) {
    return null;
  }

  const handleAdminSuccess = (user: Record<string, unknown>, token?: string) => {
    const sessionToken = token || getAuthToken();
    saveRoleSession(sessionToken, {
      email: user.email as string,
      fullName: (user.fullName as string) || "Admin",
      userType: "admin",
    });
    setShowAdminModal(false);
    navigate("/admin");
  };

  const handleProviderSuccess = (user: Record<string, unknown>, token?: string) => {
    const sessionToken = token || getAuthToken();
    saveRoleSession(sessionToken, {
      email: user.email as string,
      fullName: (user.fullName as string) || "Provider",
      userType: "provider",
    });
    setShowProviderModal(false);
    navigate("/provider/dashboard");
  };

  return (
    <>
      <Outlet />
      <AdminAuthModal isOpen={showAdminModal} onClose={() => setShowAdminModal(false)} onSuccess={handleAdminSuccess} />
      <ProviderAuthModal isOpen={showProviderModal} onClose={() => setShowProviderModal(false)} onSuccess={handleProviderSuccess} />
    </>
  );
}
