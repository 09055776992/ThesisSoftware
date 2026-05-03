import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Checkbox } from "../components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { Separator } from "../components/ui/separator";
import { Progress } from "../components/ui/progress";
import { Eye, EyeOff } from "lucide-react";
import { clearStoredUser, saveStoredUser } from "../lib/user-storage";
import { signUp } from "../lib/api-client";

export function SignUp() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    userType: "student",
    agreeToTerms: false,
  });

  const [passwordStrength, setPasswordStrength] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePasswordChange = (value: string) => {
    setFormData({ ...formData, password: value });
    
    // Calculate password strength
    let strength = 0;
    if (value.length >= 8) strength += 25;
    if (/[a-z]/.test(value) && /[A-Z]/.test(value)) strength += 25;
    if (/\d/.test(value)) strength += 25;
    if (/[^a-zA-Z\d]/.test(value)) strength += 25;
    setPasswordStrength(strength);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (formData.password !== formData.confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await signUp({
        fullName: formData.fullName.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        phone: formData.phone.trim(),
        userType: formData.userType,
      });

      const user = result.user as {
        fullName?: string;
        email?: string;
        phone?: string;
        userType?: string;
        profileImage?: string;
      };

      clearStoredUser();
      saveStoredUser({
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        userType: user.userType,
        profileImage: user.profileImage || "",
        joinDate: new Date().toLocaleString("en-US", { month: "long", year: "numeric" }),
      });

      navigate("/profile-setup");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to create account.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="bg-card/95 backdrop-blur">
      <CardHeader className="text-center">
        <div className="mb-2">
          <div className="inline-block p-3 bg-primary/10 rounded-full mb-4">
            <div className="w-12 h-12 bg-primary rounded-full" />
          </div>
        </div>
        <CardTitle>Create Your Account</CardTitle>
        <CardDescription>Connect with Your Future</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name *</Label>
            <Input
              id="fullName"
              required
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password *</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                value={formData.password}
                onChange={(e) => handlePasswordChange(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {formData.password && (
              <div className="space-y-1">
                <Progress value={passwordStrength} className="h-1" />
                <p className="text-xs text-muted-foreground">
                  Password strength: {passwordStrength < 50 ? "Weak" : passwordStrength < 75 ? "Medium" : "Strong"}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password *</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
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

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number (Optional)</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>

          <div className="space-y-3">
            <Label>User Type *</Label>
            <RadioGroup
              value={formData.userType}
              onValueChange={(value) => setFormData({ ...formData, userType: value })}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="student" id="student" />
                <Label htmlFor="student" className="font-normal cursor-pointer">Student</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="provider" id="provider" />
                <Label htmlFor="provider" className="font-normal cursor-pointer">Scholarship Provider</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="mentor" id="mentor" />
                <Label htmlFor="mentor" className="font-normal cursor-pointer">Mentor</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="flex items-start space-x-2">
            <Checkbox
              id="terms"
              checked={formData.agreeToTerms}
              onCheckedChange={(checked) => 
                setFormData({ ...formData, agreeToTerms: checked as boolean })
              }
            />
            <Label htmlFor="terms" className="text-sm font-normal cursor-pointer">
              I agree to the{" "}
              <a href="#" className="text-primary hover:underline">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="#" className="text-primary hover:underline">
                Privacy Policy
              </a>
            </Label>
          </div>

          {errorMessage && (
            <p className="text-sm text-destructive">{errorMessage}</p>
          )}

          <Button type="submit" className="w-full" disabled={!formData.agreeToTerms || isSubmitting}>
            {isSubmitting ? "Creating account..." : "Create Account"}
          </Button>

          <div className="relative my-6">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-sm text-muted-foreground">
              or continue with
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button type="button" variant="outline">
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Google
            </Button>
            <Button type="button" variant="outline">
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.5 0h1.02c3.45.252 6.463 2.035 8.512 4.573l-3.72 3.72c-1.14-1.39-2.91-2.293-4.812-2.293-3.514 0-6.293 2.78-6.293 6.293s2.78 6.293 6.293 6.293c2.573 0 4.658-1.369 5.598-3.366H12v-5.22h11c.165.825.25 1.68.25 2.562 0 6.902-5.348 12.438-12.25 12.438C5.373 25 .5 20.127.5 14.5S5.373 4 11 4h.5z"/>
              </svg>
              Microsoft
            </Button>
          </div>

          <div className="text-center text-sm">
            <span className="text-muted-foreground">Already have an account? </span>
            <Link to="/auth/signin" className="text-primary hover:underline">
              Sign In
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
