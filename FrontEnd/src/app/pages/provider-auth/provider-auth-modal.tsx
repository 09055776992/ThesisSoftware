import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { ProviderSignIn } from "./provider-signin";
import { ProviderSignUp } from "./provider-signup";

interface ProviderAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (user: Record<string, unknown>) => void;
}

export function ProviderAuthModal({ isOpen, onClose, onSuccess }: ProviderAuthModalProps) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  const handleSuccess = (user: Record<string, unknown>) => {
    onSuccess?.(user);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">Provider Portal</DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          {mode === "signin" ? (
            <ProviderSignIn
              onSwitch={() => setMode("signup")}
              onClose={onClose}
              onSuccess={handleSuccess}
            />
          ) : (
            <ProviderSignUp
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
