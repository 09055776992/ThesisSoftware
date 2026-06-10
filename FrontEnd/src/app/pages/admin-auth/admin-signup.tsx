import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Eye, EyeOff } from "lucide-react";
import { saveRoleSession } from "../../lib/user-storage";

interface AdminSignUpProps {
  onSwitch: () => void;
  onClose: () => void;
  onSuccess?: (user: Record<string, unknown>, token?: string) => void;
}

export function AdminSignUp({ onSwitch, onClose, onSuccess }: AdminSignUpProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (formData.password !== formData.confirmPassword) {
      setErrorMessage("Passwords do not match");
      return;
    }

    try {
      setIsSubmitting(true);
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
      
      const response = await fetch(`${API_BASE_URL}/api/auth/admin/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: formData.fullName.trim(),
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Sign up failed");
      }

      const result = await response.json();
      const token = result.token ?? "";
      saveRoleSession(token, {
        email: result.user.email,
        fullName: result.user.fullName,
        userType: "admin",
      });
      onSuccess?.(result.user, token);
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to create admin account");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>Create Admin Account</CardTitle>
        <CardDescription>Administrator access portal</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="admin-fullName">Full Name</Label>
            <Input
              id="admin-fullName"
              placeholder="Admin name"
              required
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin-email-signup">Email Address</Label>
            <Input
              id="admin-email-signup"
              type="email"
              placeholder="admin@example.com"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin-password-signup">Password</Label>
            <div className="relative">
              <Input
                id="admin-password-signup"
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

          <div className="space-y-2">
            <Label htmlFor="admin-confirmPassword">Confirm Password</Label>
            <div className="relative">
              <Input
                id="admin-confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm password"
                required
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {errorMessage && (
            <p className="text-sm text-destructive">{errorMessage}</p>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Creating account..." : "Create Account"}
          </Button>

          <div className="text-center text-sm space-y-2">
            <p className="text-muted-foreground">
              Already have an admin account?{" "}
              <button type="button" onClick={onSwitch} className="text-primary hover:underline">
                Sign In
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
