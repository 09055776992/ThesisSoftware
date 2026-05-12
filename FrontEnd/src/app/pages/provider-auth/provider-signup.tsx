import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Eye, EyeOff } from "lucide-react";
import { clearStoredUser, saveAuthToken, saveStoredUser } from "../../lib/user-storage";

interface ProviderSignUpProps {
  onSwitch: () => void;
  onClose: () => void;
  onSuccess?: (user: Record<string, unknown>) => void;
}

export function ProviderSignUp({ onSwitch, onClose, onSuccess }: ProviderSignUpProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    organizationName: "",
    email: "",
    contactPerson: "",
    phone: "",
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
      
      const response = await fetch(`${API_BASE_URL}/api/auth/provider/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: formData.organizationName.trim(),
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          phone: formData.phone.trim(),
          contactPerson: formData.contactPerson.trim(),
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Sign up failed");
      }

      const result = await response.json();
      clearStoredUser();
      saveAuthToken(result.token ?? null);
      saveStoredUser({
        email: result.user.email,
        fullName: result.user.fullName,
        userType: "provider",
      });
      onSuccess?.(result.user);
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to create provider account");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>Create Provider Account</CardTitle>
        <CardDescription>Scholarship provider portal</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3 max-h-[60vh] overflow-y-auto">
          <div className="space-y-2">
            <Label htmlFor="provider-orgName">Organization Name</Label>
            <Input
              id="provider-orgName"
              placeholder="Your organization"
              required
              value={formData.organizationName}
              onChange={(e) => setFormData({ ...formData, organizationName: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="provider-contact">Contact Person</Label>
            <Input
              id="provider-contact"
              placeholder="Contact person name"
              required
              value={formData.contactPerson}
              onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="provider-email-signup">Email Address</Label>
            <Input
              id="provider-email-signup"
              type="email"
              placeholder="provider@example.com"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="provider-phone">Phone Number</Label>
            <Input
              id="provider-phone"
              type="tel"
              placeholder="+1 (555) 000-0000"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="provider-password-signup">Password</Label>
            <div className="relative">
              <Input
                id="provider-password-signup"
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
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="provider-confirmPassword">Confirm Password</Label>
            <div className="relative">
              <Input
                id="provider-confirmPassword"
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
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
              Already have a provider account?{" "}
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
