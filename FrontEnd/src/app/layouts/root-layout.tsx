import { useState } from "react";
import { Outlet, useNavigate } from "react-router";
import { AdminAuthModal } from "../pages/admin-auth/admin-auth-modal";
import { ProviderAuthModal } from "../pages/provider-auth/provider-auth-modal";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { clearStoredUser, saveStoredUser } from "../lib/user-storage";

export function RootLayout() {
  const navigate = useNavigate();
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showProviderModal, setShowProviderModal] = useState(false);

  useKeyboardShortcuts({
    onAdminPanel: () => setShowAdminModal(true),
    onProviderPanel: () => setShowProviderModal(true),
  });

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
