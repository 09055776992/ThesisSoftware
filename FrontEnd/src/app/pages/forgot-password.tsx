import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { GraduationCap, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { API_URL } from "../lib/api-client";

type Step = "email" | "code" | "newPassword" | "done";

export function ForgotPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ── Step 1: send reset code ───────────────────────────────────────────────
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send reset code.");
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reset code.");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: verify code ───────────────────────────────────────────────────
  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (code.trim().length !== 6) {
      setError("Please enter the 6-digit code.");
      return;
    }
    setStep("newPassword");
  };

  // ── Step 3: set new password ──────────────────────────────────────────────
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          token: code.trim(),
          newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset password.");
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">

          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex items-center justify-center size-16 bg-blue-600 rounded-2xl">
              <GraduationCap className="size-9 text-white" />
            </div>
          </div>

          {/* ── Step 1: Enter email ─────────────────────────────────────── */}
          {step === "email" && (
            <>
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Forgot Password?</h1>
                <p className="text-gray-600 text-sm">
                  Enter your registered email and we'll send you a reset code.
                </p>
              </div>

              <form onSubmit={handleSendCode} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="fp-email" className="text-gray-700">Email Address</Label>
                  <Input
                    id="fp-email"
                    type="email"
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 rounded-lg"
                  />
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <Button
                  type="submit"
                  className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
                  disabled={loading}
                >
                  {loading ? "Sending..." : "Send Reset Code"}
                </Button>

                <div className="text-center">
                  <Link
                    to="/auth/signin"
                    className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
                  >
                    <ArrowLeft className="size-4" />
                    Back to Sign In
                  </Link>
                </div>
              </form>
            </>
          )}

          {/* ── Step 2: Enter code ──────────────────────────────────────── */}
          {step === "code" && (
            <>
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Enter Reset Code</h1>
                <p className="text-gray-600 text-sm">
                  We sent a 6-digit code to{" "}
                  <span className="font-semibold text-blue-600">{email}</span>.
                  Check your inbox (and spam folder).
                </p>
              </div>

              <form onSubmit={handleVerifyCode} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="fp-code" className="text-gray-700">6-Digit Code</Label>
                  <Input
                    id="fp-code"
                    type="text"
                    inputMode="numeric"
                    placeholder="123456"
                    maxLength={6}
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="h-11 rounded-lg text-center text-xl tracking-widest font-bold"
                  />
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <Button
                  type="submit"
                  className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
                >
                  Continue
                </Button>

                <div className="flex justify-between text-sm">
                  <button
                    type="button"
                    onClick={() => { setStep("email"); setError(""); setCode(""); }}
                    className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-700"
                  >
                    <ArrowLeft className="size-4" />
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => { setStep("email"); setError(""); setCode(""); }}
                    className="text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    Resend code
                  </button>
                </div>
              </form>
            </>
          )}

          {/* ── Step 3: New password ────────────────────────────────────── */}
          {step === "newPassword" && (
            <>
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Set New Password</h1>
                <p className="text-gray-600 text-sm">Choose a strong password for your account.</p>
              </div>

              <form onSubmit={handleResetPassword} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="fp-new" className="text-gray-700">New Password</Label>
                  <div className="relative">
                    <Input
                      id="fp-new"
                      type={showPassword ? "text" : "password"}
                      placeholder="At least 8 characters"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="h-11 rounded-lg pr-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fp-confirm" className="text-gray-700">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id="fp-confirm"
                      type={showConfirm ? "text" : "password"}
                      placeholder="Repeat your new password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="h-11 rounded-lg pr-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      aria-label={showConfirm ? "Hide password" : "Show password"}
                    >
                      {showConfirm ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                    </button>
                  </div>
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <Button
                  type="submit"
                  className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
                  disabled={loading}
                >
                  {loading ? "Resetting..." : "Reset Password"}
                </Button>
              </form>
            </>
          )}

          {/* ── Step 4: Success ─────────────────────────────────────────── */}
          {step === "done" && (
            <div className="text-center space-y-6">
              <div className="flex justify-center">
                <div className="size-16 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-3xl">✓</span>
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Password Reset!</h1>
                <p className="text-gray-600 text-sm">
                  Your password has been updated. You can now sign in with your new password.
                </p>
              </div>
              <Button
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
                onClick={() => navigate("/auth/signin")}
              >
                Back to Sign In
              </Button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
