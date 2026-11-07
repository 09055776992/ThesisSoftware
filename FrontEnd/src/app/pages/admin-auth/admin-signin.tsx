import { useState, useEffect } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Eye, EyeOff, ShieldCheck, ArrowLeft } from "lucide-react";
import { clearStoredUser, saveRoleSession } from "../../lib/user-storage";
import { adminSignIn, adminVerifyOTP, adminResendOTP } from "../../lib/api-client";

// ---------------------------------------------------------------------------
// Countdown timer hook
// ---------------------------------------------------------------------------
function useCountdown(initial: number) {
  const [timeLeft, setTimeLeft] = useState(initial);
  const reset = () => setTimeLeft(initial);
  useEffect(() => {
    if (timeLeft <= 0) return;
    const t = setTimeout(() => setTimeLeft((p) => p - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft]);
  const formatted = `${Math.floor(timeLeft / 60).toString().padStart(2, "0")}:${(timeLeft % 60).toString().padStart(2, "0")}`;
  return { timeLeft, formatted, reset };
}

// ---------------------------------------------------------------------------
// AdminSignIn component
// ---------------------------------------------------------------------------
interface AdminSignInProps {
  onSwitch: () => void;
  onClose: () => void;
  onSuccess?: (user: Record<string, unknown>, token?: string) => void;
}

export function AdminSignIn({ onSwitch, onClose, onSuccess }: AdminSignInProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // OTP step
  const [step, setStep] = useState<"login" | "otp">("login");
  const [userId, setUserId] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const { timeLeft, formatted: timerDisplay, reset: resetTimer } = useCountdown(600);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((p) => p - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // Step 1: email + password
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    try {
      setIsSubmitting(true);
      // Clear any stale token before starting a new login
      clearStoredUser();
      const result = await adminSignIn({
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
      });

      if (result.requiresOTP) {
        setUserId(result.userId);
        setMaskedEmail(result.maskedEmail);
        setStep("otp");
        resetTimer();
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Sign in failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 2: verify OTP
  const handleVerify = async () => {
    if (otp.length !== 6) {
      setOtpError("Please enter the complete 6-digit code.");
      return;
    }

    setOtpError("");
    setIsVerifying(true);

    try {
      const result = await adminVerifyOTP(userId, otp);

      if (result.success) {
        const token = result.token ?? "";
        saveRoleSession(token, {
          _id: String(result.user._id ?? ""),
          id: String(result.user.id ?? ""),
          email: result.user.email as string,
          fullName: result.user.fullName as string,
          userType: "admin",
          role: typeof result.user.role === "string" ? result.user.role : undefined,
          preferences: result.user.preferences && typeof result.user.preferences === "object"
            ? result.user.preferences as { language?: string; theme?: string }
            : undefined,
        });
        onSuccess?.(result.user, token);
        onClose();
      }
    } catch (error) {
      setOtpError(error instanceof Error ? error.message : "Verification failed");
      setOtp("");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      await adminResendOTP(userId);
      resetTimer();
      setResendCooldown(60);
      setOtp("");
      setOtpError("");
    } catch (error) {
      setOtpError(error instanceof Error ? error.message : "Failed to resend code.");
    }
  };

  return (
    <Card>
      <CardHeader className="text-center">
        {step === "login" ? (
          <>
            <CardTitle>Admin Login</CardTitle>
            <CardDescription>Administrator access portal</CardDescription>
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
        {/* ---- Step 1: Login Form ---- */}
        {step === "login" && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-email">Email Address</Label>
              <Input
                id="admin-email"
                type="email"
                placeholder="admin@example.com"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-password">Password</Label>
              <div className="relative">
                <Input
                  id="admin-password"
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

            {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Signing in..." : "Login"}
            </Button>

            <div className="text-center text-sm space-y-2">
              <p className="text-muted-foreground">
                Don't have an admin account?{" "}
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

        {/* ---- Step 2: OTP Verification ---- */}
        {step === "otp" && (
          <form onSubmit={(event) => { event.preventDefault(); void handleVerify(); }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-login-otp">Verification Code</Label>
              <Input
                id="admin-login-otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                className="h-12 text-center text-xl font-bold tracking-widest"
                required
              />
              {timeLeft > 0 ? (
                <p className="text-xs text-muted-foreground">The code expires in {timerDisplay}.</p>
              ) : (
                <p className="text-xs text-destructive">Code expired. Please resend.</p>
              )}
            </div>
            {otpError && <p role="alert" className="text-sm text-destructive">{otpError}</p>}
            <Button type="submit" className="w-full" disabled={isVerifying || otp.length !== 6}>
              {isVerifying ? "Verifying..." : "Verify and Sign In"}
            </Button>
            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0}
                className="text-primary hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground"
              >
                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("login");
                  setOtp("");
                  setOtpError("");
                }}
                className="inline-flex items-center gap-1 text-muted-foreground hover:underline"
              >
                <ArrowLeft className="size-3" />
                Back
              </button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
