import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Eye, EyeOff } from "lucide-react";
import { clearStoredUser, saveRoleSession } from "../../lib/user-storage";
import { API_URL } from "../../lib/api-client";

interface ProviderSignInProps {
  onSwitch: () => void;
  onClose: () => void;
  onSuccess?: (user: Record<string, unknown>, token?: string) => void;
}

export function ProviderSignIn({ onSwitch, onClose, onSuccess }: ProviderSignInProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    try {
      setIsSubmitting(true);
      const API_BASE_URL = API_URL;
      
      const response = await fetch(`${API_BASE_URL}/api/provider/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        if (payload.pending) {
          throw new Error("Your account is pending admin approval. You will receive an email once it has been reviewed.");
        }
        if (payload.deactivated) {
          throw new Error("Your provider account has been deactivated. Please contact the administrator.");
        }
        throw new Error(payload.message || payload.error || "Sign in failed");
      }

      const result = await response.json();
      const token = result.token ?? "";
      saveRoleSession(token, {
        email: result.user.email,
        fullName: result.user.name,
        userType: "provider",
        organizationName: result.user.organizationName,
        position: result.user.position,
      });
      onSuccess?.(result.user, token);
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to sign in");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>Provider Login</CardTitle>
        <CardDescription>Scholarship provider portal</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="provider-email">Email Address</Label>
            <Input
              id="provider-email"
              type="email"
              placeholder="provider@example.com"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="provider-password">Password</Label>
            <div className="relative">
              <Input
                id="provider-password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {errorMessage && (
            <p className="text-sm text-destructive">{errorMessage}</p>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Login"}
          </Button>

          <div className="text-center text-sm space-y-2">
            <p className="text-muted-foreground">
              Don't have a provider account?{" "}
              <button type="button" onClick={onSwitch} className="text-primary hover:underline">
                Sign Up
              </button>
            </p>
            <button type="button" onClick={onClose} className="text-muted-foreground hover:underline text-xs">
              Back
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
