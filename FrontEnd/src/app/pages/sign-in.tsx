import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { GraduationCap } from "lucide-react";
import { buildNameFromEmail, clearStoredUser, getStoredUser, saveAuthToken, saveStoredUser } from "../lib/user-storage";
import { fetchUserProfile, pickProfileImageUrl, signIn } from "../lib/api-client";

export function SignIn() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Clear form on mount to prevent browser autofill
  useEffect(() => {
    setFormData({ email: "", password: "" });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    try {
      setIsSubmitting(true);
      const normalizedEmail = formData.email.trim().toLowerCase();
      const result = await signIn({
        email: normalizedEmail,
        password: formData.password,
      });

      const user = result.user as Record<string, unknown>;

      clearStoredUser();
      saveAuthToken((result as { token?: string }).token ?? null);

      let profileFromServer: Record<string, unknown> = {};
      try {
        const profileResult = await fetchUserProfile(normalizedEmail);
        profileFromServer = profileResult.user ?? {};
      } catch {
        // Fall back to sign-in payload if profile fetch fails
      }

      const avatarUrl =
        pickProfileImageUrl(profileFromServer) || pickProfileImageUrl(user);

      saveStoredUser({
        ...profileFromServer,
        email: String(user.email || normalizedEmail),
        fullName:
          String(user.fullName || "").trim() ||
          String(profileFromServer.fullName || "").trim() ||
          buildNameFromEmail(normalizedEmail),
        phone: String(user.phone || profileFromServer.phone || ""),
        userType:
          String(user.userType || profileFromServer.userType || "") || "student",
        financialNeed: Array.isArray(profileFromServer.financialNeed)
          ? (profileFromServer.financialNeed as number[])
          : undefined,
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
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to sign in.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl">
              <GraduationCap className="w-9 h-9 text-white" />
            </div>
          </div>

          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Welcome Back
            </h1>
            <p className="text-gray-600">
              Sign in to access your scholarship portal
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-700">
                Email Address
              </Label>
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
              <Label htmlFor="password" className="text-gray-700">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                required
                autoComplete="new-password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="h-11 rounded-lg"
              />
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
              <p className="text-sm text-destructive">{errorMessage}</p>
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

          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              Sign in now uses backend database records.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}