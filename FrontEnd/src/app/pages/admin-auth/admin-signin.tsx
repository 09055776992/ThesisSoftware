import { useState, useEffect, useRef } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Eye, EyeOff, ShieldCheck, ArrowLeft } from "lucide-react";
import { clearStoredUser, saveAuthToken, saveStoredUser } from "../../lib/user-storage";
import { adminSignIn, adminVerifyOTP, adminResendOTP } from "../../lib/api-client";

// ---------------------------------------------------------------------------
// OTP Input — 6 separate boxes with auto-advance
// ---------------------------------------------------------------------------
function OtpInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (index: number, raw: string) => {
    const digit = raw.replace(/\D/g, "").slice(-1);
    const next = [...value];
    next[index] = digit;
    onChange(next);
    if (digit && index < 5) refs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !value[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = [...value];
    for (let i = 0; i < 6; i++) next[i] = pasted[i] ?? "";
    onChange(next);
    refs.current[Math.min(pasted.length, 5)]?.focus();
  };

  return (
    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
      {value.map((digit, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className={`
            w-10 h-12 text-center text-lg font-bold rounded-lg border-2 outline-none
            transition-colors
            ${digit ? "border-primary bg-primary/10 text-primary" : "border-input bg-background"}
            focus:border-primary focus:ring-2 focus:ring-primary/20
          `}
        />
      ))}
    </div>
  );
}

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
  onSuccess?: (user: Record<string, unknown>) => void;
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
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
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
    const otpString = otp.join("");
    if (otpString.length !== 6) {
      setOtpError("Please enter the complete 6-digit code.");
      return;
    }

    setOtpError("");
    setIsVerifying(true);

    try {
      const result = await adminVerifyOTP(userId, otpString);

      if (result.success) {
        clearStoredUser();
        saveAuthToken(result.token ?? null);
        saveStoredUser({
          email: result.user.email as string,
          fullName: result.user.fullName as string,
          userType: "admin",
        });
        onSuccess?.(result.user);
        onClose();
      }
    } catch (error) {
      setOtpError(error instanceof Error ? error.message : "Verification failed");
      setOtp(["", "", "", "", "", ""]);
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
      setOtp(["", "", "", "", "", ""]);
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
            <div className="flex justify-center mb-2">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-primary rounded-xl">
                <ShieldCheck className="w-6 h-6 text-primary-foreground" />
              </div>
            </div>
            <CardTitle>Verify Your Identity</CardTitle>
            <CardDescription>
              We sent a code to <span className="font-semibold text-primary">{maskedEmail}</span>
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
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
          <div className="space-y-5">
            <div>
              <p className="text-sm text-muted-foreground text-center mb-3">
                Enter the 6-digit verification code:
              </p>
              <OtpInput value={otp} onChange={setOtp} />
            </div>

            {/* Timer */}
            <div className="text-center">
              {timeLeft > 0 ? (
                <p className="text-sm text-muted-foreground">
                  Expires in{" "}
                  <span className={`font-mono font-semibold ${timeLeft <= 60 ? "text-destructive" : ""}`}>
                    {timerDisplay}
                  </span>{" "}
                  ⏱
                </p>
              ) : (
                <p className="text-sm text-destructive font-medium">Code expired. Please resend.</p>
              )}
            </div>

            {otpError && <p className="text-sm text-destructive text-center">{otpError}</p>}

            <Button
              onClick={handleVerify}
              className="w-full"
              disabled={isVerifying || otp.join("").length !== 6}
            >
              {isVerifying ? "Verifying..." : "Verify Code"}
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              Didn't receive a code?{" "}
              {resendCooldown > 0 ? (
                <span className="text-muted-foreground/60">Resend in {resendCooldown}s</span>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  className="text-primary hover:underline font-medium"
                >
                  Resend Code
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setStep("login");
                setOtp(["", "", "", "", "", ""]);
                setOtpError("");
              }}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mx-auto"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Login
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
