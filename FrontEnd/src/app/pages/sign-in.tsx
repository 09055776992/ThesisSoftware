import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { GraduationCap, ShieldCheck, ArrowLeft, Eye, EyeOff } from "lucide-react";
import {
  buildNameFromEmail,
  clearStoredUser,
  getStoredUser,
  saveAuthToken,
  saveStoredUser,
} from "../lib/user-storage";
import {
  fetchUserProfile,
  pickProfileImageUrl,
  signIn,
  verifyOTP,
  resendOTP,
} from "../lib/api-client";

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
    // Accept only digits
    const digit = raw.replace(/\D/g, "").slice(-1);
    const next = [...value];
    next[index] = digit;
    onChange(next);
    if (digit && index < 5) {
      refs.current[index + 1]?.focus();
    }
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
    for (let i = 0; i < 6; i++) {
      next[i] = pasted[i] ?? "";
    }
    onChange(next);
    const lastFilled = Math.min(pasted.length, 5);
    refs.current[lastFilled]?.focus();
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
            w-11 h-14 text-center text-xl font-bold rounded-lg border-2 outline-none
            transition-colors
            ${digit ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-300 bg-white text-gray-900"}
            focus:border-blue-500 focus:ring-2 focus:ring-blue-200
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

  const formatted = `${Math.floor(timeLeft / 60)
    .toString()
    .padStart(2, "0")}:${(timeLeft % 60).toString().padStart(2, "0")}`;

  return { timeLeft, formatted, reset };
}

// ---------------------------------------------------------------------------
// Main SignIn component
// ---------------------------------------------------------------------------
export function SignIn() {
  const navigate = useNavigate();

  // Step 1 state
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Step 2 state
  const [step, setStep] = useState<"login" | "otp">("login");
  const [userId, setUserId] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const { timeLeft, formatted: timerDisplay, reset: resetTimer } = useCountdown(600);

  // Clear form on mount
  useEffect(() => {
    setFormData({ email: "", password: "" });
  }, []);

  // Resend cooldown countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((p) => p - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // ---------------------------------------------------------------------------
  // Step 1: Submit email + password
  // ---------------------------------------------------------------------------
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    try {
      setIsSubmitting(true);
      const normalizedEmail = formData.email.trim().toLowerCase();
      const result = await signIn({ email: normalizedEmail, password: formData.password });

      if (result.requiresOTP) {
        setUserId(result.userId);
        setMaskedEmail(result.maskedEmail);
        setStep("otp");
        resetTimer();
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to sign in.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Step 2: Verify OTP
  // ---------------------------------------------------------------------------
  const handleVerify = async () => {
    const otpString = otp.join("");
    if (otpString.length !== 6) {
      setOtpError("Please enter the complete 6-digit code.");
      return;
    }

    setOtpError("");
    setIsVerifying(true);

    try {
      const result = await verifyOTP(userId, otpString);

      if (result.success) {
        const user = result.user as Record<string, unknown>;
        const normalizedEmail = String(user.email || formData.email).toLowerCase();

        clearStoredUser();
        saveAuthToken(result.token ?? null);

        let profileFromServer: Record<string, unknown> = {};
        try {
          const profileResult = await fetchUserProfile(normalizedEmail);
          profileFromServer = profileResult.user ?? {};
        } catch {
          // fall back to signin payload
        }

        const avatarUrl =
          pickProfileImageUrl(profileFromServer) || pickProfileImageUrl(user);

        saveStoredUser({
          ...profileFromServer,
          email: normalizedEmail,
          fullName:
            String(user.fullName || "").trim() ||
            String(profileFromServer.fullName || "").trim() ||
            buildNameFromEmail(normalizedEmail),
          phone: String(user.phone || profileFromServer.phone || ""),
          userType:
            String(user.userType || profileFromServer.userType || "") || "student",
          profileImage: avatarUrl,
          profilePicture: avatarUrl,
        });

        const userType = String(user.userType || profileFromServer.userType || "").toLowerCase();
        if (userType === "admin") {
          navigate("/admin");
        } else if (userType === "provider") {
          navigate("/provider/dashboard");
        } else {
          navigate("/dashboard");
        }
      }
    } catch (error) {
      setOtpError(error instanceof Error ? error.message : "Verification failed.");
      // Clear OTP inputs on wrong code
      setOtp(["", "", "", "", "", ""]);
    } finally {
      setIsVerifying(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Resend OTP
  // ---------------------------------------------------------------------------
  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      await resendOTP(userId);
      resetTimer();
      setResendCooldown(60);
      setOtp(["", "", "", "", "", ""]);
      setOtpError("");
    } catch (error) {
      setOtpError(error instanceof Error ? error.message : "Failed to resend code.");
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">

          {/* ---- STEP 1: Login Form ---- */}
          {step === "login" && (
            <>
              <div className="flex justify-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl">
                  <GraduationCap className="w-9 h-9 text-white" />
                </div>
              </div>

              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome Back</h1>
                <p className="text-gray-600">Sign in to access your scholarship portal</p>
              </div>

              <form onSubmit={handleLoginSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-gray-700">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    required
                    autoComplete="new-email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="h-11 rounded-lg"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-gray-700">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      required
                      autoComplete="new-password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="h-11 rounded-lg pr-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end">
                  <Link
                    to="/auth/forgot-password"
                    className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    Forgot Password?
                  </Link>
                </div>

                {errorMessage && (
                  <p className="text-sm text-red-600">{errorMessage}</p>
                )}

                <Button
                  type="submit"
                  className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Signing in..." : "Login"}
                </Button>

                <div className="text-center text-sm text-gray-600 mt-6">
                  Don't have an account?{" "}
                  <Link
                    to="/auth/signup"
                    className="text-blue-600 hover:text-blue-700 font-medium hover:underline"
                  >
                    Sign Up
                  </Link>
                </div>
              </form>
            </>
          )}

          {/* ---- STEP 2: OTP Verification ---- */}
          {step === "otp" && (
            <>
              <div className="flex justify-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl">
                  <ShieldCheck className="w-9 h-9 text-white" />
                </div>
              </div>

              <div className="text-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Verify Your Identity</h1>
                <p className="text-gray-600 text-sm">
                  We sent a 6-digit code to:
                </p>
                <p className="text-blue-600 font-semibold mt-1">{maskedEmail}</p>
              </div>

              <div className="space-y-6">
                <div>
                  <p className="text-sm text-gray-600 text-center mb-3">Enter verification code:</p>
                  <OtpInput value={otp} onChange={setOtp} />
                </div>

                {/* Timer */}
                <div className="text-center">
                  {timeLeft > 0 ? (
                    <p className="text-sm text-gray-500">
                      Code expires in{" "}
                      <span className={`font-mono font-semibold ${timeLeft <= 60 ? "text-red-500" : "text-gray-700"}`}>
                        {timerDisplay}
                      </span>{" "}
                      ⏱
                    </p>
                  ) : (
                    <p className="text-sm text-red-500 font-medium">Code has expired. Please resend.</p>
                  )}
                </div>

                {otpError && (
                  <p className="text-sm text-red-600 text-center">{otpError}</p>
                )}

                <Button
                  onClick={handleVerify}
                  className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
                  disabled={isVerifying || otp.join("").length !== 6}
                >
                  {isVerifying ? "Verifying..." : "Verify Code"}
                </Button>

                {/* Resend */}
                <div className="text-center text-sm text-gray-600">
                  Didn't receive a code?{" "}
                  {resendCooldown > 0 ? (
                    <span className="text-gray-400">
                      Resend in {resendCooldown}s
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResend}
                      className="text-blue-600 hover:text-blue-700 font-medium hover:underline"
                    >
                      Resend Code
                    </button>
                  )}
                </div>

                {/* Back to login */}
                <button
                  type="button"
                  onClick={() => {
                    setStep("login");
                    setOtp(["", "", "", "", "", ""]);
                    setOtpError("");
                  }}
                  className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mx-auto"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Login
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
