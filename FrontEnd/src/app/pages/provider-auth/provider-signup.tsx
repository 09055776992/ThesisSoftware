import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Eye, EyeOff, Clock } from "lucide-react";
import { API_URL } from "../../lib/api-client";

interface ProviderSignUpProps {
  onSwitch: () => void;
  onClose: () => void;
}

export function ProviderSignUp({ onSwitch, onClose }: ProviderSignUpProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    organizationName: "",
    position: "",
    email: "",
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

    if (formData.password.length < 8) {
      setErrorMessage("Password must be at least 8 characters");
      return;
    }

    try {
      setIsSubmitting(true);
      const API_BASE_URL = API_URL;

      const response = await fetch(`${API_BASE_URL}/api/provider/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: formData.fullName.trim(),
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          phone: formData.phone.trim(),
          organizationName: formData.organizationName.trim(),
          position: formData.position.trim(),
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.message || "Registration failed");
      }

      // Show pending state — do NOT log the user in
      setSubmitted(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to submit request");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Pending confirmation screen
  if (submitted) {
    return (
      <Card>
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <div className="p-3 rounded-full bg-amber-100">
              <Clock className="size-8 text-amber-600" />
            </div>
          </div>
          <CardTitle>Request Submitted</CardTitle>
          <CardDescription>Your account request is pending review</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            Thank you for submitting your provider account request. An administrator will review
            your request and you will receive an email notification once it has been approved or rejected.
          </p>
          <p className="text-sm text-muted-foreground">
            This typically takes <strong>1–2 business days</strong>.
          </p>
          <p className="text-xs text-muted-foreground">
            You will not be able to log in until your account has been approved.
          </p>
          <Button className="w-full" onClick={onClose}>
            Back to Home
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>Request Provider Account</CardTitle>
        <CardDescription>QCYDO staff scholarship provider portal</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">

          <div className="space-y-2">
            <Label htmlFor="provider-fullName">Full Name</Label>
            <Input
              id="provider-fullName"
              placeholder="Your full name"
              required
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="provider-orgName">Organization Name</Label>
            <Input
              id="provider-orgName"
              placeholder="e.g. QCYDO"
              required
              value={formData.organizationName}
              onChange={(e) => setFormData({ ...formData, organizationName: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="provider-position">Position / Role in Organization</Label>
            <Input
              id="provider-position"
              placeholder="e.g. Scholarship Coordinator"
              required
              value={formData.position}
              onChange={(e) => setFormData({ ...formData, position: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="provider-email-signup">Official Email Address</Label>
            <Input
              id="provider-email-signup"
              type="email"
              placeholder="yourname@qcydo.gov.ph"
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
              placeholder="+63 9XX XXX XXXX"
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
                placeholder="At least 8 characters"
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
                {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {errorMessage && (
            <p className="text-sm text-destructive">{errorMessage}</p>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Submitting request..." : "Request Account"}
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
