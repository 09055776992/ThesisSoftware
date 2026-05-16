import { useState, useEffect } from "react";
import { Outlet, useNavigate } from "react-router";
import { AdminAuthModal } from "../pages/admin-auth/admin-auth-modal";
import { ProviderAuthModal } from "../pages/provider-auth/provider-auth-modal";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { clearStoredUser, saveStoredUser, getStoredUser, getAuthToken } from "../lib/user-storage";
import { fetchUserProfile, pickProfileImageUrl } from "../lib/api-client";

export function RootLayout() {
  const navigate = useNavigate();
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showProviderModal, setShowProviderModal] = useState(false);
  const [isAuthRestored, setIsAuthRestored] = useState(false);

  // Keyboard shortcuts hook - must be called before any conditional returns
  useKeyboardShortcuts({
    onAdminPanel: () => setShowAdminModal(true),
    onProviderPanel: () => setShowProviderModal(true),
  });

  // Restore auth state from localStorage on mount (refresh profile image from MongoDB)
  useEffect(() => {
    const token = getAuthToken();
    const user = getStoredUser();

    const finishRestore = (profileUser: typeof user) => {
      if (token && profileUser) {
        if (profileUser.userType === "admin") {
          navigate("/admin", { replace: true });
        } else if (profileUser.userType === "provider") {
          navigate("/provider/dashboard", { replace: true });
        } else {
          navigate("/dashboard/home", { replace: true });
        }
      }
      setIsAuthRestored(true);
    };

    if (!token || !user?.email) {
      finishRestore(user);
      return;
    }

    fetchUserProfile(user.email)
      .then((result) => {
        const server = result.user ?? {};
        const avatarUrl = pickProfileImageUrl(server);
        if (avatarUrl) {
          saveStoredUser({
            ...server,
            email: user.email,
            profileImage: avatarUrl,
            profilePicture: avatarUrl,
          });
        }
        finishRestore(getStoredUser());
      })
      .catch(() => finishRestore(user));
  }, [navigate]);

  // Don't render until auth is restored to prevent flash
  if (!isAuthRestored) {
    return null;
  }

  const handleAdminSuccess = (user: Record<string, unknown>) => {
    clearStoredUser();
    saveStoredUser({
      email: user.email as string,
      fullName: user.fullName as string || "Admin",
      userType: "admin",
    });
    setShowAdminModal(false);
    navigate("/admin");
  };

  const handleProviderSuccess = (user: Record<string, unknown>) => {
    clearStoredUser();
    saveStoredUser({
      email: user.email as string,
      fullName: user.fullName as string || "Provider",
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
