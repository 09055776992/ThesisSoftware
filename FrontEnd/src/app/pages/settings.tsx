import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { getStoredUser, saveStoredUser } from "../lib/user-storage";

type VisibilityOption = "public" | "providers-only" | "private";

type NotificationSettings = {
  scholarshipRecommendations: boolean;
  deadlineReminders: boolean;
  approvalUpdates: boolean;
  newAnnouncements: boolean;
  promotionalEmails: boolean;
};

type PrivacySettings = {
  profileVisibility: VisibilityOption;
  showAcademicAchievements: boolean;
  showFinancialInformation: boolean;
  showContactInformation: boolean;
};

type PasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
};

const notificationDefaults: NotificationSettings = {
  scholarshipRecommendations: true,
  deadlineReminders: true,
  approvalUpdates: true,
  newAnnouncements: true,
  promotionalEmails: false,
};

const privacyDefaults: PrivacySettings = {
  profileVisibility: "public",
  showAcademicAchievements: true,
  showFinancialInformation: false,
  showContactInformation: true,
};

const languageOptions = ["English", "Filipino (Tagalog)"];
const themeOptions = ["Light", "Dark", "System Default"];

function getPasswordStrength(password: string) {
  if (!password) return { label: "Enter a new password", widthClass: "w-0", color: "bg-gray-300" };
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  if (score <= 1) return { label: "Weak", widthClass: "w-1/4", color: "bg-red-500" };
  if (score === 2) return { label: "Fair", widthClass: "w-1/2", color: "bg-amber-500" };
  if (score === 3) return { label: "Strong", widthClass: "w-3/4", color: "bg-blue-500" };
  return { label: "Very strong", widthClass: "w-full", color: "bg-emerald-500" };
}

type PasswordFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
  placeholder: string;
};

function PasswordField({ id, label, value, onChange, visible, onToggle, placeholder }: PasswordFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pr-10"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="absolute top-1/2 right-1 -translate-y-1/2"
          aria-label={visible ? `Hide ${label}` : `Show ${label}`}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </Button>
      </div>
    </div>
  );
}

export function Settings() {
  const user = getStoredUser();

  // Account & Security state
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(
    user?.notificationSettings ?? notificationDefaults,
  );
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>(() => {
    const stored = user?.privacySettings;
    return {
      ...privacyDefaults,
      ...(stored ?? {}),
      profileVisibility: (stored?.profileVisibility ?? privacyDefaults.profileVisibility) as VisibilityOption,
    };
  });
  const [passwordForm, setPasswordForm] = useState<PasswordForm>({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  // Preferences state
  const [language, setLanguage] = useState(user?.preferences?.language ?? "English");
  const [theme, setTheme] = useState(user?.preferences?.theme ?? "Light");

  const saveNotificationSettings = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    saveStoredUser({ notificationSettings });
    setNotificationOpen(false);
    toast.success("Notification settings updated.");
  };

  const savePrivacySettings = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    saveStoredUser({ privacySettings });
    setPrivacyOpen(false);
    toast.success("Privacy settings updated.");
  };

  const savePassword = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (passwordForm.newPassword.length < 8) {
      toast.error("New password must be at least 8 characters long.");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    saveStoredUser({ password: passwordForm.newPassword });
    setPasswordOpen(false);
    setPasswordForm({ currentPassword: "", newPassword: "", confirmNewPassword: "" });
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    toast.success("Password updated successfully.");
  };

  const handlePreferenceSave = (nextLanguage: string, nextTheme: string) => {
    setLanguage(nextLanguage);
    setTheme(nextTheme);
    saveStoredUser({ preferences: { language: nextLanguage, theme: nextTheme } });
    if (nextTheme === "Dark") {
      document.documentElement.classList.add("dark");
    } else if (nextTheme === "Light") {
      document.documentElement.classList.remove("dark");
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (prefersDark) document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");
    }
    toast.success("Preferences updated.");
  };

  const passwordStrength = getPasswordStrength(passwordForm.newPassword);

  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your account security and preferences.
            To update your profile information, visit{" "}
            <a href="/dashboard/profile" className="text-blue-600 hover:underline">My Profile</a>.
          </p>
        </div>

        {/* Account & Security */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Account &amp; Security</h2>
          <p className="text-sm text-gray-500 mb-4">Manage your password, notifications, and privacy.</p>
          <div className="space-y-0 divide-y divide-gray-100">
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-gray-900">Email Notifications</p>
                <p className="text-sm text-gray-500">Receive scholarship and application updates</p>
              </div>
              <Button type="button" variant="outline" onClick={() => setNotificationOpen(true)}>Configure</Button>
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-gray-900">Privacy Settings</p>
                <p className="text-sm text-gray-500">Control who can see your profile details</p>
              </div>
              <Button type="button" variant="outline" onClick={() => setPrivacyOpen(true)}>Manage</Button>
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-gray-900">Password</p>
                <p className="text-sm text-gray-500">Update your login password</p>
              </div>
              <Button type="button" variant="outline" onClick={() => setPasswordOpen(true)}>Update</Button>
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-gray-900">Two-Factor Authentication</p>
                <p className="text-sm text-gray-500">Add an extra layer of security to your account</p>
              </div>
              <Button type="button" variant="outline" disabled>Configure</Button>
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Preferences</h2>
          <p className="text-sm text-gray-500 mb-4">Customize your language and display theme.</p>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <Select value={language} onValueChange={(v) => handlePreferenceSave(v, theme)}>
                <SelectTrigger id="language"><SelectValue placeholder="Choose a language" /></SelectTrigger>
                <SelectContent>
                  {languageOptions.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="theme">Theme</Label>
              <Select value={theme} onValueChange={(v) => handlePreferenceSave(language, v)}>
                <SelectTrigger id="theme"><SelectValue placeholder="Choose a theme" /></SelectTrigger>
                <SelectContent>
                  {themeOptions.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Notification Settings Dialog */}
      <Dialog open={notificationOpen} onOpenChange={setNotificationOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Email Notifications</DialogTitle>
            <DialogDescription>Choose which messages you want to receive.</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveNotificationSettings} className="space-y-4">
            <div className="space-y-3">
              {([
                { key: "scholarshipRecommendations", label: "Receive scholarship recommendations" },
                { key: "deadlineReminders", label: "Application deadline reminders" },
                { key: "approvalUpdates", label: "Approval/rejection updates" },
                { key: "newAnnouncements", label: "New scholarship announcements" },
                { key: "promotionalEmails", label: "Promotional/marketing emails" },
              ] as const).map(({ key, label }) => (
                <label key={key} className="flex items-start gap-3 rounded-lg border border-gray-200 p-3">
                  <Checkbox
                    checked={notificationSettings[key]}
                    onCheckedChange={(v) => setNotificationSettings((prev) => ({ ...prev, [key]: v === true }))}
                  />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
            </div>
            <DialogFooter><Button type="submit">Save Changes</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Privacy Settings Dialog */}
      <Dialog open={privacyOpen} onOpenChange={setPrivacyOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Privacy Settings</DialogTitle>
            <DialogDescription>Control how much of your profile is visible.</DialogDescription>
          </DialogHeader>
          <form onSubmit={savePrivacySettings} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="profileVisibility">Profile Visibility</Label>
              <Select
                value={privacySettings.profileVisibility}
                onValueChange={(v) => setPrivacySettings((prev) => ({ ...prev, profileVisibility: v as VisibilityOption }))}
              >
                <SelectTrigger id="profileVisibility"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="providers-only">Scholarship Providers Only</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              {([
                { key: "showAcademicAchievements", label: "Show academic achievements" },
                { key: "showFinancialInformation", label: "Show financial information" },
                { key: "showContactInformation", label: "Show contact information" },
              ] as const).map(({ key, label }) => (
                <label key={key} className="flex items-start gap-3 rounded-lg border border-gray-200 p-3">
                  <Checkbox
                    checked={privacySettings[key]}
                    onCheckedChange={(v) => setPrivacySettings((prev) => ({ ...prev, [key]: v === true }))}
                  />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
            </div>
            <DialogFooter><Button type="submit">Save Changes</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Password Dialog */}
      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Update Password</DialogTitle>
            <DialogDescription>Enter your current password and choose a new one.</DialogDescription>
          </DialogHeader>
          <form onSubmit={savePassword} className="space-y-4">
            <PasswordField id="currentPassword" label="Current Password" value={passwordForm.currentPassword}
              onChange={(v) => setPasswordForm((p) => ({ ...p, currentPassword: v }))}
              visible={showCurrentPassword} onToggle={() => setShowCurrentPassword((v) => !v)}
              placeholder="Enter current password" />
            <PasswordField id="newPassword" label="New Password" value={passwordForm.newPassword}
              onChange={(v) => setPasswordForm((p) => ({ ...p, newPassword: v }))}
              visible={showNewPassword} onToggle={() => setShowNewPassword((v) => !v)}
              placeholder="Enter new password" />
            <div className="space-y-2">
              <PasswordField id="confirmNewPassword" label="Confirm New Password" value={passwordForm.confirmNewPassword}
                onChange={(v) => setPasswordForm((p) => ({ ...p, confirmNewPassword: v }))}
                visible={showConfirmPassword} onToggle={() => setShowConfirmPassword((v) => !v)}
                placeholder="Confirm new password" />
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span>Password strength</span><span>{passwordStrength.label}</span>
                </div>
                <div className="h-2 rounded-full bg-gray-200">
                  <div className={`h-full rounded-full ${passwordStrength.color} ${passwordStrength.widthClass}`} />
                </div>
              </div>
            </div>
            <DialogFooter><Button type="submit">Update Password</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
