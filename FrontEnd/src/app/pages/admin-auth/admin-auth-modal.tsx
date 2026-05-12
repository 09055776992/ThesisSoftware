import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { AdminSignIn } from "./admin-signin";
import { AdminSignUp } from "./admin-signup";

interface AdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (user: Record<string, unknown>) => void;
}

export function AdminAuthModal({ isOpen, onClose, onSuccess }: AdminAuthModalProps) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  const handleSuccess = (user: Record<string, unknown>) => {
    onSuccess?.(user);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">Admin Portal</DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          {mode === "signin" ? (
            <AdminSignIn
              onSwitch={() => setMode("signup")}
              onClose={onClose}
              onSuccess={handleSuccess}
            />
          ) : (
            <AdminSignUp
              onSwitch={() => setMode("signin")}
              onClose={onClose}
              onSuccess={handleSuccess}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
