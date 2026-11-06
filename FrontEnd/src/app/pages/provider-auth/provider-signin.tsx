import { useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { ArrowLeft, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { clearStoredUser, saveRoleSession } from "../../lib/user-storage";
import {
  providerSignIn,
  resendProviderLoginOTP,
  verifyProviderLoginOTP,
} from "../../lib/api-client";

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
  const [step, setStep] = useState<"login" | "otp">("login");
  const [providerId, setProviderId] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setTimeout(() => setResendCooldown((current) => current - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  const completeSignIn = (user: Record<string, unknown>, token: string) => {
    clearStoredUser();
    saveRoleSession(token, {
      _id: String(user.id || ""),
      id: String(user.id || ""),
      email: String(user.email || ""),
      fullName: String(user.name || ""),
      userType: "provider",
      role: "provider",
      organizationName: typeof user.organizationName === "string" ? user.organizationName : "",
      position: typeof user.position === "string" ? user.position : "",
    });
    onSuccess?.(user, token);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    try {
      setIsSubmitting(true);
      const result = await providerSignIn({
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
      });
      setProviderId(result.userId);
      setMaskedEmail(result.maskedEmail);
      setOtpCode("");
      setOtpError("");
      setResendCooldown(60);
      setStep("otp");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to sign in");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError("");
    if (otpCode.length !== 6) {
      setOtpError("Please enter the complete 6-digit code.");
      return;
    }

    try {
      setIsVerifying(true);
      const result = await verifyProviderLoginOTP(providerId, otpCode);
      completeSignIn(result.user, result.token);
    } catch (error) {
      setOtpError(error instanceof Error ? error.message : "Verification failed.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setOtpError("");
    try {
      const result = await resendProviderLoginOTP(providerId);
      setMaskedEmail(result.maskedEmail || maskedEmail);
      setOtpCode("");
      setResendCooldown(60);
    } catch (error) {
      setOtpError(error instanceof Error ? error.message : "Failed to resend the code.");
    }
  };

  return (
    <Card>
      <CardHeader className="text-center">
        {step === "login" ? (
          <>
            <CardTitle>Provider Login</CardTitle>
            <CardDescription>Scholarship provider portal</CardDescription>
          </>
        ) : (
          <>
            <div className="mb-2 flex justify-center">
              <div className="rounded-full bg-blue-100 p-3">
                <ShieldCheck className="size-8 text-blue-600" />
              </div>
            </div>
            <CardTitle>Verify Your Sign-In</CardTitle>
            <CardDescription>
              Enter the 6-digit code sent to <strong>{maskedEmail}</strong>
            </CardDescription>
          </>
        )}
      </CardHeader>
      <CardContent>
        {step === "otp" ? (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="provider-login-otp">Verification Code</Label>
              <Input
                id="provider-login-otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                value={otpCode}
                onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                className="h-12 text-center text-xl font-bold tracking-widest"
                required
              />
              <p className="text-xs text-muted-foreground">The code expires in 10 minutes.</p>
            </div>
            {otpError && <p role="alert" className="text-sm text-destructive">{otpError}</p>}
            <Button type="submit" className="w-full" disabled={isVerifying || otpCode.length !== 6}>
              {isVerifying ? "Verifying..." : "Verify and Sign In"}
            </Button>
            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendCooldown > 0}
                className="text-primary hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground"
              >
                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("login");
                  setOtpCode("");
                  setOtpError("");
                }}
                className="inline-flex items-center gap-1 text-muted-foreground hover:underline"
              >
                <ArrowLeft className="size-3" />
                Back
              </button>
            </div>
          </form>
        ) : (
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
        )}
      </CardContent>
    </Card>
  );
}
