import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Eye, EyeOff, Clock, Upload, X, FileText, AlertCircle } from "lucide-react";
import { API_URL } from "../../lib/api-client";
import { PasswordStrengthIndicator } from "../../components/password-strength";

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
  const [credentialFiles, setCredentialFiles] = useState<File[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCredentialAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const allowed = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
    const valid = files.filter((f) => allowed.includes(f.type) && f.size <= 10 * 1024 * 1024);
    if (valid.length !== files.length) {
      setErrorMessage("Some files were skipped. Only PDF, JPEG, PNG under 10 MB are allowed.");
    }
    setCredentialFiles((prev) => {
      const combined = [...prev, ...valid];
      return combined.slice(0, 5); // max 5 files
    });
    e.target.value = "";
  };

  const removeCredential = (idx: number) => {
    setCredentialFiles((prev) => prev.filter((_, i) => i !== idx));
  };

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

    if (credentialFiles.length === 0) {
      setErrorMessage("Please upload at least one verification document (e.g., organization ID, SEC registration, or authorization letter).");
      return;
    }

    try {
      setIsSubmitting(true);

      // Use FormData so credential files are sent as multipart/form-data
      const body = new FormData();
      body.append("fullName", formData.fullName.trim());
      body.append("email", formData.email.trim().toLowerCase());
      body.append("password", formData.password);
      body.append("phone", formData.phone.trim());
      body.append("organizationName", formData.organizationName.trim());
      body.append("position", formData.position.trim());
      credentialFiles.forEach((file) => body.append("credentials", file));

      const response = await fetch(`${API_URL}/api/provider/register`, {
        method: "POST",
        body, // no Content-Type header — browser sets multipart boundary automatically
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.message || "Registration failed");
      }

      setSubmitted(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to submit request");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Done / pending screen
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
          <p className="text-sm text-muted-foreground">This typically takes <strong>1–2 business days</strong>.</p>
          <p className="text-xs text-muted-foreground">You will not be able to log in until your account has been approved.</p>
          <Button className="w-full" onClick={onClose}>Back to Home</Button>
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
              onChange={(e) => {
                const cleaned = e.target.value.replace(/[^a-zA-Z\s\-'.]/g, "");
                setFormData({ ...formData, fullName: cleaned });
              }}
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

          {/* Credential Documents Upload */}
          <div className="space-y-2">
            <Label>
              Verification Documents <span className="text-destructive">*</span>
            </Label>
            <p className="text-xs text-muted-foreground">
              Upload at least one document to verify your organization (e.g., valid ID, SEC/DTI registration, authorization letter). PDF, JPEG, PNG — max 10 MB each, up to 5 files.
            </p>
            <div className="border-2 border-dashed border-border rounded-lg p-4 space-y-3">
              {credentialFiles.length > 0 && (
                <ul className="space-y-2">
                  {credentialFiles.map((file, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm bg-muted/50 rounded px-3 py-1.5">
                      <FileText className="size-4 text-blue-600 flex-shrink-0" />
                      <span className="flex-1 truncate">{file.name}</span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {(file.size / 1024).toFixed(0)} KB
                      </span>
                      <button
                        type="button"
                        onClick={() => removeCredential(idx)}
                        className="text-muted-foreground hover:text-destructive flex-shrink-0"
                        aria-label="Remove file"
                      >
                        <X className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {credentialFiles.length < 5 && (
                <label className="flex items-center gap-2 cursor-pointer text-sm text-blue-600 hover:text-blue-700 font-medium">
                  <Upload className="size-4" />
                  Add document
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    multiple
                    className="sr-only"
                    onChange={handleCredentialAdd}
                  />
                </label>
              )}
            </div>
            {credentialFiles.length === 0 && (
              <p className="flex items-center gap-1 text-xs text-amber-600">
                <AlertCircle className="size-3" /> At least one document is required.
              </p>
            )}
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
            <PasswordStrengthIndicator password={formData.password} />
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
            <div className="space-y-2">
              <p role="alert" className="text-sm text-destructive">{errorMessage}</p>
              {errorMessage.includes("already exists") && (
                <Button type="button" variant="outline" className="w-full" onClick={onSwitch}>
                  Go to Provider Sign In
                </Button>
              )}
            </div>
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
