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
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { getStoredUser, saveStoredUser, getInitials } from "../lib/user-storage";
import { updateUserProfile, API_BASE_URL } from "../lib/api-client";

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

const incomeCategoryOptions = [
  "₱10,000 – ₱25,000",
  "₱25,000 – ₱50,000",
  "₱50,000 – ₱100,000",
  "₱100,000+",
];

// School Type Options
const schoolTypeOptions = [
  { value: "Public University / State University (SUC)", label: "Public University / State University (SUC)" },
  { value: "Private University / College", label: "Private University / College" },
  { value: "Public Senior High School", label: "Public Senior High School" },
  { value: "Private Senior High School", label: "Private Senior High School" },
  { value: "Public Junior High School", label: "Public Junior High School" },
  { value: "Private Junior High School", label: "Private Junior High School" },
  { value: "TESDA-accredited Institution", label: "TESDA-accredited Institution" },
  { value: "Vocational School", label: "Vocational School" },
  { value: "Graduate School", label: "Graduate School" },
];

// School Location Options
const schoolLocationOptions = [
  { value: "Quezon City", label: "Quezon City ✓ (Auto-verified)" },
  { value: "Outside Quezon City (Metro Manila)", label: "Outside Quezon City (Metro Manila) — Requires verification" },
  { value: "Outside Metro Manila", label: "Outside Metro Manila — Requires verification" },
];

const languageOptions = ["English", "Filipino (Tagalog)"];

const themeOptions = ["Light", "Dark", "System Default"];

// Education Level and Year Level Options
const educationLevelOptions = [
  { value: "Junior High School", label: "Junior High School (Grade 7–10)" },
  { value: "Senior High School", label: "Senior High School (Grade 11–12)" },
  { value: "College / Undergraduate", label: "College / Undergraduate" },
  { value: "Vocational / TESDA", label: "Vocational / TESDA" },
  { value: "Postgraduate (Masters / Doctorate)", label: "Postgraduate (Masters / Doctorate)" },
];

const yearLevelOptions: Record<string, { value: string; label: string }[]> = {
  "Junior High School": [
    { value: "Grade 7", label: "Grade 7" },
    { value: "Grade 8", label: "Grade 8" },
    { value: "Grade 9", label: "Grade 9" },
    { value: "Grade 10", label: "Grade 10" },
  ],
  "Senior High School": [
    { value: "Grade 11", label: "Grade 11" },
    { value: "Grade 12", label: "Grade 12" },
  ],
  "College / Undergraduate": [
    { value: "1st Year", label: "1st Year" },
    { value: "2nd Year", label: "2nd Year" },
    { value: "3rd Year", label: "3rd Year" },
    { value: "4th Year", label: "4th Year" },
    { value: "5th Year", label: "5th Year" },
  ],
  "Vocational / TESDA": [
    { value: "1st Year", label: "1st Year" },
    { value: "2nd Year", label: "2nd Year" },
  ],
  "Postgraduate (Masters / Doctorate)": [
    { value: "Masters - 1st Year", label: "Masters - 1st Year" },
    { value: "Masters - 2nd Year", label: "Masters - 2nd Year" },
    { value: "Doctorate - 1st Year", label: "Doctorate - 1st Year" },
    { value: "Doctorate - 2nd Year", label: "Doctorate - 2nd Year" },
    { value: "Doctorate - 3rd Year+", label: "Doctorate - 3rd Year+" },
  ],
};

const pesoFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

function formatPeso(value: string) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return "₱0";
  }

  return pesoFormatter.format(numericValue);
}

function sanitizeGpaInput(value: string) {
  return value.replace(/-/g, "");
}

function getPasswordStrength(password: string) {
  if (!password) {
    return { label: "Enter a new password", widthClass: "w-0", color: "bg-gray-300" };
  }

  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 1) {
    return { label: "Weak", widthClass: "w-1/4", color: "bg-red-500" };
  }

  if (score === 2) {
    return { label: "Fair", widthClass: "w-1/2", color: "bg-amber-500" };
  }

  if (score === 3) {
    return { label: "Strong", widthClass: "w-3/4", color: "bg-blue-500" };
  }

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

function PasswordField({
  id,
  label,
  value,
  onChange,
  visible,
  onToggle,
  placeholder,
}: PasswordFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
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
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

export function Settings() {
  const user = getStoredUser();
  const [bio, setBio] = useState(user?.about ?? "");
  const [profileImage, setProfileImage] = useState(user?.profileImage ?? "");
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [location, setLocation] = useState(user?.location ?? "");
  const [skills, setSkills] = useState((user?.skills ?? []).join(", "));
  const [gpa, setGpa] = useState(user?.gpa ?? "");
  const [educationLevel, setEducationLevel] = useState(user?.educationLevel ?? "");
  const [yearLevel, setYearLevel] = useState(user?.yearLevel ?? "");
  const [fieldOfStudy, setFieldOfStudy] = useState(user?.fieldOfStudy ?? "");
  const [graduationYear, setGraduationYear] = useState(user?.graduationYear ?? "");
  const [netWorth, setNetWorth] = useState(user?.netWorth ?? "");
  const [incomeCategory, setIncomeCategory] = useState(user?.incomeCategory ?? "");
  const [financialNeed, setFinancialNeed] = useState(String(user?.financialNeed?.[0] ?? 3));
  
  // School Information
  const [schoolName, setSchoolName] = useState(user?.schoolName ?? "");
  const [schoolCampus, setSchoolCampus] = useState(user?.schoolCampus ?? "");
  const [schoolType, setSchoolType] = useState(user?.schoolType ?? "");
  const [schoolLocation, setSchoolLocation] = useState(user?.schoolLocation ?? "");
  
  // Special Categories for Athletic/Arts/Leadership Scholarships
  const [isAthlete, setIsAthlete] = useState(user?.isAthlete ?? false);
  const [isArtist, setIsArtist] = useState(user?.isArtist ?? false);
  const [isSKOfficial, setIsSKOfficial] = useState(user?.isSKOfficial ?? false);
  const [isStudentLeader, setIsStudentLeader] = useState(user?.isStudentLeader ?? false);
  const [isIndigent, setIsIndigent] = useState(user?.isIndigent ?? false);
  const [isPWD, setIsPWD] = useState(user?.isPWD ?? false);
  const [isSoloParent, setIsSoloParent] = useState(user?.isSoloParent ?? false);
  
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(
    user?.notificationSettings ?? notificationDefaults,
  );
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>(() => {
    const storedSettings = user?.privacySettings;
    return {
      ...privacyDefaults,
      ...(storedSettings ?? {}),
      profileVisibility: (storedSettings?.profileVisibility ?? privacyDefaults.profileVisibility) as VisibilityOption,
    };
  });
  const [language, setLanguage] = useState(user?.preferences?.language ?? "English");
  const [theme, setTheme] = useState(user?.preferences?.theme ?? "Light");
  const [bioSaved, setBioSaved] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState<PasswordForm>({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });

  const saveBio = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    saveStoredUser({ about: bio.trim() });
    setBioSaved(true);
    toast.success("Bio updated successfully.");
    window.setTimeout(() => setBioSaved(false), 2000);
  };

  const [profileSaved, setProfileSaved] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [academicSaving, setAcademicSaving] = useState(false);

  const handleProfileImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setProfileImage(String(reader.result ?? ""));
    };
    reader.readAsDataURL(file);
  };

  const handleProfileSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setProfileSaving(true);

    let newProfileImage = profileImage;

    // Upload avatar to server if a new file was selected
    if (avatarFile) {
      try {
        const formData = new FormData();
        formData.append("avatar", avatarFile);
        formData.append("email", email.trim().toLowerCase());
        const res = await fetch(`${API_BASE_URL}/api/user/upload-avatar`, { method: "POST", body: formData });
        if (res.ok) {
          const data = await res.json();
          newProfileImage = data.avatarUrl;
          setProfileImage(data.avatarUrl);
          setAvatarFile(null);
        }
      } catch (err) {
        console.error("Failed to upload avatar:", err);
      }
    }

    const skillList = skills
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    // Save to localStorage
    saveStoredUser({
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      location: location.trim(),
      about: bio.trim(),
      skills: skillList,
      profileImage: newProfileImage,
    });

    // Sync other profile fields to backend API
    try {
      await updateUserProfile({
        email: email.trim().toLowerCase(),
        fullName: fullName.trim(),
        phone: phone.trim(),
        location: location.trim(),
        about: bio.trim(),
        headline: user?.headline ?? "",
        skills: skillList,
      });
      toast.success("Profile saved successfully.");
    } catch (error) {
      console.error("Failed to sync profile to server:", error);
      toast.error("Profile saved locally but failed to sync to server.");
    } finally {
      setProfileSaving(false);
    }

    setProfileSaved(true);
    window.setTimeout(() => setProfileSaved(false), 2000);
  };

  const saveAcademicAndFinancial = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAcademicSaving(true);

    // Save to localStorage first
    saveStoredUser({
      email: email.trim().toLowerCase(),
      gpa: gpa.trim(),
      educationLevel: educationLevel.trim(),
      yearLevel: yearLevel.trim(),
      fieldOfStudy: fieldOfStudy.trim(),
      graduationYear: graduationYear.trim(),
      netWorth: netWorth.trim(),
      currency: "PHP",
      incomeCategory: incomeCategory.trim(),
      financialNeed: [Number(financialNeed) || 3],
      schoolName: schoolName.trim(),
      schoolCampus: schoolCampus.trim(),
      schoolType: schoolType.trim(),
      schoolLocation: schoolLocation.trim(),
      enrolledInQCSchool: schoolLocation === "Quezon City",
      isAthlete,
      isArtist,
      isSKOfficial,
      isStudentLeader,
      isIndigent,
      isPWD,
      isSoloParent,
    });
    
    // Sync to backend API
    try {
      await updateUserProfile({
        email: email.trim().toLowerCase(),
        gpa: gpa.trim(),
        educationLevel: educationLevel.trim(),
        yearLevel: yearLevel.trim(),
        fieldOfStudy: fieldOfStudy.trim(),
        graduationYear: graduationYear.trim(),
        netWorth: netWorth.trim(),
        incomeCategory: incomeCategory.trim(),
        financialNeed: [Number(financialNeed) || 3],
        schoolName: schoolName.trim(),
        schoolCampus: schoolCampus.trim(),
        schoolType: schoolType.trim(),
        schoolLocation: schoolLocation.trim(),
        enrolledInQCSchool: schoolLocation === "Quezon City",
        isAthlete,
        isArtist,
        isSKOfficial,
        isStudentLeader,
        isIndigent,
        isPWD,
        isSoloParent,
        currency: "PHP",
      });
      toast.success("Academic & financial details saved.");
    } catch (error) {
      console.error("Failed to sync academic details to server:", error);
      toast.error("Details saved locally but failed to sync to server.");
    } finally {
      setAcademicSaving(false);
    }
  };

  const handleGpaBlur = () => {
    if (!gpa) {
      return;
    }

    const numericValue = Number(gpa);
    if (!Number.isFinite(numericValue)) {
      return;
    }

    const clampedValue = Math.min(5, Math.max(1, numericValue));
    setGpa(clampedValue.toFixed(2));
  };

  const saveNotificationSettings = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    saveStoredUser({ notificationSettings });
    setNotificationOpen(false);
    toast.success("Settings updated successfully.");
  };

  const savePrivacySettings = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    saveStoredUser({ privacySettings });
    setPrivacyOpen(false);
    toast.success("Settings updated successfully.");
  };

  const savePassword = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (passwordForm.newPassword.length < 8) {
      toast.error("New password must be at least 8 characters long.");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
      toast.error("New passwords do not match.");
      return;
    }

    if (user?.password && passwordForm.currentPassword !== user.password) {
      toast.error("Current password is incorrect.");
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
    
    // Apply theme immediately
    if (nextTheme === 'Dark') {
      document.documentElement.classList.add('dark');
    } else if (nextTheme === 'Light') {
      document.documentElement.classList.remove('dark');
    } else if (nextTheme === 'System Default') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
    
    toast.success("Theme updated successfully.");
  };

  const passwordStrength = getPasswordStrength(passwordForm.newPassword);

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="grid gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <form onSubmit={handleProfileSave} className="space-y-4">
              <div className="space-y-3">
                <Label htmlFor="profileImage">Profile Picture</Label>
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={profileImage} />
                    <AvatarFallback>{getInitials(user)}</AvatarFallback>
                  </Avatar>
                  <Input
                    id="profileImage"
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={handleProfileImageChange}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your full name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@school.edu"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="City, Country"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="about">Bio</Label>
                <Textarea
                  id="about"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell others about your background and goals"
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="skills">Skills (comma-separated)</Label>
                <Input
                  id="skills"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  placeholder="Python, Data Analysis, Machine Learning"
                />
              </div>

              <div className="flex items-center gap-3">
                <Button type="submit" disabled={profileSaving}>
                  {profileSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save Profile"
                  )}
                </Button>
                {profileSaved && <p className="text-sm text-green-600">Profile updated</p>}
              </div>
            </form>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="gpa" className="block text-sm font-medium text-gray-700 mb-1.5">GPA</Label>
                <Input
                  id="gpa"
                  type="number"
                  min="1"
                  max="5"
                  step="0.01"
                  inputMode="decimal"
                  value={gpa}
                  onChange={(event) => setGpa(sanitizeGpaInput(event.target.value))}
                  onBlur={handleGpaBlur}
                  placeholder="1.00"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md bg-white text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-0 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none transition-all"
                />
                <p className="text-xs text-gray-600 mt-1.5">
                  Philippine GPA scale: 1.00 = Highest (Excellent), 3.00 = Minimum Passing, 5.00 = Failing.
                </p>
              </div>
              <form onSubmit={saveAcademicAndFinancial} className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="educationLevel" className="block text-sm font-medium text-gray-700 mb-1.5">Education Level</Label>
                    <Select
                      value={educationLevel}
                      onValueChange={(value) => {
                        setEducationLevel(value);
                        // Reset year level when education level changes
                        setYearLevel("");
                      }}
                    >
                      <SelectTrigger id="educationLevel" className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md bg-white text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-0 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] transition-all">
                        <SelectValue placeholder="Select your education level" />
                      </SelectTrigger>
                      <SelectContent>
                        {educationLevelOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="yearLevel" className="block text-sm font-medium text-gray-700 mb-1.5">Year Level</Label>
                    <Select
                      value={yearLevel}
                      onValueChange={setYearLevel}
                      disabled={!educationLevel}
                    >
                      <SelectTrigger id="yearLevel" className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md bg-white text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed focus:border-blue-500 focus:outline-none focus:ring-0 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] transition-all">
                        <SelectValue placeholder={educationLevel ? "Select your year level" : "Select education level first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {educationLevel && yearLevelOptions[educationLevel]?.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* School Information Section */}
                <div className="border-t border-gray-200 pt-6 mt-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs">REQUIRED FOR ELIGIBILITY</span>
                    School / Institution Information
                  </h3>
                  
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="schoolName" className="block text-sm font-medium text-gray-700 mb-1.5">School / Institution Name</Label>
                      <Input
                        id="schoolName"
                        value={schoolName}
                        onChange={(event) => setSchoolName(event.target.value)}
                        placeholder="e.g. University of the Philippines, Quezon City"
                        className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md bg-white text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-0 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] transition-all"
                      />
                      <p className="text-xs text-gray-600 mt-1.5">
                        Enter the full name of your current school
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="schoolCampus" className="block text-sm font-medium text-gray-700 mb-1.5">Campus / Branch (Optional)</Label>
                      <Input
                        id="schoolCampus"
                        value={schoolCampus}
                        onChange={(event) => setSchoolCampus(event.target.value)}
                        placeholder="e.g. Diliman, Main Campus"
                        className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md bg-white text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-0 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid gap-6 md:grid-cols-2 mt-6">
                    <div className="space-y-2">
                      <Label htmlFor="schoolType" className="block text-sm font-medium text-gray-700 mb-1.5">School Type</Label>
                      <Select value={schoolType} onValueChange={setSchoolType}>
                        <SelectTrigger id="schoolType" className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md bg-white text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-0 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] transition-all">
                          <SelectValue placeholder="Select school type" />
                        </SelectTrigger>
                        <SelectContent>
                          {schoolTypeOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="schoolLocation" className="block text-sm font-medium text-gray-700 mb-1.5">School Location</Label>
                      <Select value={schoolLocation} onValueChange={setSchoolLocation}>
                        <SelectTrigger id="schoolLocation" className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md bg-white text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-0 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] transition-all">
                          <SelectValue placeholder="Select school location" />
                        </SelectTrigger>
                        <SelectContent>
                          {schoolLocationOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-600 mt-1.5">
                        Schools in Quezon City are auto-verified for QC scholarships
                      </p>
                    </div>
                  </div>
                </div>

                {/* Special Categories for Athletic/Arts/Leadership Scholarships */}
                <div className="border-t border-gray-200 pt-6 mt-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs">SCHOLARSHIP ELIGIBILITY</span>
                    Special Categories (Check all that apply)
                  </h3>
                  <p className="text-xs text-gray-500 mb-4">
                    These categories are required for specific scholarships (Athletic, Arts, Youth Leadership, etc.)
                  </p>
                  
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="isAthlete"
                        checked={isAthlete}
                        onChange={(e) => setIsAthlete(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        aria-label="Athlete (for Athletic Scholarships)"
                      />
                      <Label htmlFor="isAthlete" className="text-sm font-normal cursor-pointer">
                        Athlete (for Athletic Scholarships)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="isArtist"
                        checked={isArtist}
                        onChange={(e) => setIsArtist(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        aria-label="Artist (for Arts & Culture Scholarships)"
                      />
                      <Label htmlFor="isArtist" className="text-sm font-normal cursor-pointer">
                        Artist (for Arts & Culture Scholarships)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="isSKOfficial"
                        checked={isSKOfficial}
                        onChange={(e) => setIsSKOfficial(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        aria-label="SK Official / Youth Leader"
                      />
                      <Label htmlFor="isSKOfficial" className="text-sm font-normal cursor-pointer">
                        SK Official / Youth Leader
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="isStudentLeader"
                        checked={isStudentLeader}
                        onChange={(e) => setIsStudentLeader(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        aria-label="Student Council / Government Leader"
                      />
                      <Label htmlFor="isStudentLeader" className="text-sm font-normal cursor-pointer">
                        Student Council / Government Leader
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="isIndigent"
                        checked={isIndigent}
                        onChange={(e) => setIsIndigent(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        aria-label="From Indigent / Low-income Family"
                      />
                      <Label htmlFor="isIndigent" className="text-sm font-normal cursor-pointer">
                        From Indigent / Low-income Family
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="isPWD"
                        checked={isPWD}
                        onChange={(e) => setIsPWD(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        aria-label="Person with Disability (PWD)"
                      />
                      <Label htmlFor="isPWD" className="text-sm font-normal cursor-pointer">
                        Person with Disability (PWD)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="isSoloParent"
                        checked={isSoloParent}
                        onChange={(e) => setIsSoloParent(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        aria-label="Solo Parent"
                      />
                      <Label htmlFor="isSoloParent" className="text-sm font-normal cursor-pointer">
                        Solo Parent
                      </Label>
                    </div>
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="fieldOfStudy" className="block text-sm font-medium text-gray-700 mb-1.5">Field of Study</Label>
                    <Input
                      id="fieldOfStudy"
                      value={fieldOfStudy}
                      onChange={(event) => setFieldOfStudy(event.target.value)}
                      placeholder="Computer Science"
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md bg-white text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-0 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="graduationYear" className="block text-sm font-medium text-gray-700 mb-1.5">Graduation Year</Label>
                    <Input
                      id="graduationYear"
                      value={graduationYear}
                      onChange={(event) => setGraduationYear(event.target.value)}
                      placeholder="2026"
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md bg-white text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-0 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="financialNeed" className="block text-sm font-medium text-gray-700 mb-1.5">Financial Need (1-5)</Label>
                    <Input
                      id="financialNeed"
                      type="number"
                      min="1"
                      max="5"
                      value={financialNeed}
                      onChange={(event) => setFinancialNeed(event.target.value)}
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md bg-white text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-0 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] transition-all"
                    />
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="netWorth" className="block text-sm font-medium text-gray-700 mb-1.5">Net Worth</Label>
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm text-gray-500 font-medium">
                        ₱
                      </span>
                      <Input
                        id="netWorth"
                        type="number"
                        min="0"
                        step="1"
                        value={netWorth}
                        onChange={(event) => setNetWorth(event.target.value)}
                        placeholder="50000"
                        className="w-full pl-8 pr-3.5 py-2.5 border border-gray-300 rounded-md bg-white text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-0 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] transition-all"
                      />
                    </div>
                    <p className="text-xs text-gray-600 mt-1.5">Current value: {formatPeso(netWorth)}</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currency" className="block text-sm font-medium text-gray-700 mb-1.5">Currency</Label>
                    <Input 
                      id="currency" 
                      value="PHP (₱)" 
                      readOnly 
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md bg-gray-50 text-gray-900 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="incomeCategory" className="block text-sm font-medium text-gray-700 mb-1.5">Income Category</Label>
                    <Select value={incomeCategory} onValueChange={setIncomeCategory}>
                      <SelectTrigger id="incomeCategory" className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md bg-white text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-0 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] transition-all">
                        <SelectValue placeholder="Select a peso-based bracket" />
                      </SelectTrigger>
                      <SelectContent>
                        {incomeCategoryOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button type="submit" className="w-full md:w-auto" disabled={academicSaving}>
                      {academicSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin inline" />
                          Saving…
                        </>
                      ) : (
                        "Save Academic & Financial"
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4 border-b border-gray-200 py-3">
                <div>
                  <p className="font-medium text-gray-900">Email Notifications</p>
                  <p className="text-sm text-gray-600">Receive scholarship and application updates</p>
                </div>
                <Button type="button" variant="outline" onClick={() => setNotificationOpen(true)}>
                  Configure
                </Button>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-gray-200 py-3">
                <div>
                  <p className="font-medium text-gray-900">Privacy Settings</p>
                  <p className="text-sm text-gray-600">Control who can see your profile details</p>
                </div>
                <Button type="button" variant="outline" onClick={() => setPrivacyOpen(true)}>
                  Manage
                </Button>
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="font-medium text-gray-900">Password</p>
                  <p className="text-sm text-gray-600">Update your login password</p>
                </div>
                <Button type="button" variant="outline" onClick={() => setPasswordOpen(true)}>
                  Update
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="language">Language</Label>
                  <Select
                    value={language}
                    onValueChange={(value) => handlePreferenceSave(value, theme)}
                  >
                    <SelectTrigger id="language">
                      <SelectValue placeholder="Choose a language" />
                    </SelectTrigger>
                    <SelectContent>
                      {languageOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="theme">Theme</Label>
                  <Select value={theme} onValueChange={(value) => handlePreferenceSave(language, value)}>
                    <SelectTrigger id="theme">
                      <SelectValue placeholder="Choose a theme" />
                    </SelectTrigger>
                    <SelectContent>
                      {themeOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={notificationOpen} onOpenChange={setNotificationOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Email Notifications</DialogTitle>
            <DialogDescription>
              Choose which messages you want to receive.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={saveNotificationSettings} className="space-y-4">
            <div className="space-y-3">
              <label className="flex items-start gap-3 rounded-lg border border-gray-200 p-3">
                <Checkbox
                  checked={notificationSettings.scholarshipRecommendations}
                  onCheckedChange={(checked) =>
                    setNotificationSettings((prev) => ({
                      ...prev,
                      scholarshipRecommendations: checked === true,
                    }))
                  }
                />
                <span className="text-sm text-gray-700">Receive scholarship recommendations</span>
              </label>
              <label className="flex items-start gap-3 rounded-lg border border-gray-200 p-3">
                <Checkbox
                  checked={notificationSettings.deadlineReminders}
                  onCheckedChange={(checked) =>
                    setNotificationSettings((prev) => ({
                      ...prev,
                      deadlineReminders: checked === true,
                    }))
                  }
                />
                <span className="text-sm text-gray-700">Application deadline reminders</span>
              </label>
              <label className="flex items-start gap-3 rounded-lg border border-gray-200 p-3">
                <Checkbox
                  checked={notificationSettings.approvalUpdates}
                  onCheckedChange={(checked) =>
                    setNotificationSettings((prev) => ({
                      ...prev,
                      approvalUpdates: checked === true,
                    }))
                  }
                />
                <span className="text-sm text-gray-700">Approval/rejection updates</span>
              </label>
              <label className="flex items-start gap-3 rounded-lg border border-gray-200 p-3">
                <Checkbox
                  checked={notificationSettings.newAnnouncements}
                  onCheckedChange={(checked) =>
                    setNotificationSettings((prev) => ({
                      ...prev,
                      newAnnouncements: checked === true,
                    }))
                  }
                />
                <span className="text-sm text-gray-700">New scholarship announcements</span>
              </label>
              <label className="flex items-start gap-3 rounded-lg border border-gray-200 p-3">
                <Checkbox
                  checked={notificationSettings.promotionalEmails}
                  onCheckedChange={(checked) =>
                    setNotificationSettings((prev) => ({
                      ...prev,
                      promotionalEmails: checked === true,
                    }))
                  }
                />
                <span className="text-sm text-gray-700">Promotional/marketing emails</span>
              </label>
            </div>
            <DialogFooter>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={privacyOpen} onOpenChange={setPrivacyOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Privacy Settings</DialogTitle>
            <DialogDescription>
              Control how much of your profile is visible.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={savePrivacySettings} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="profileVisibility">Profile Visibility</Label>
              <Select
                value={privacySettings.profileVisibility}
                onValueChange={(value) =>
                  setPrivacySettings((prev) => ({
                    ...prev,
                    profileVisibility: value as VisibilityOption,
                  }))
                }
              >
                <SelectTrigger id="profileVisibility">
                  <SelectValue placeholder="Choose visibility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="providers-only">Scholarship Providers Only</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <label className="flex items-start gap-3 rounded-lg border border-gray-200 p-3">
                <Checkbox
                  checked={privacySettings.showAcademicAchievements}
                  onCheckedChange={(checked) =>
                    setPrivacySettings((prev) => ({
                      ...prev,
                      showAcademicAchievements: checked === true,
                    }))
                  }
                />
                <span className="text-sm text-gray-700">Show academic achievements</span>
              </label>
              <label className="flex items-start gap-3 rounded-lg border border-gray-200 p-3">
                <Checkbox
                  checked={privacySettings.showFinancialInformation}
                  onCheckedChange={(checked) =>
                    setPrivacySettings((prev) => ({
                      ...prev,
                      showFinancialInformation: checked === true,
                    }))
                  }
                />
                <span className="text-sm text-gray-700">Show financial information</span>
              </label>
              <label className="flex items-start gap-3 rounded-lg border border-gray-200 p-3">
                <Checkbox
                  checked={privacySettings.showContactInformation}
                  onCheckedChange={(checked) =>
                    setPrivacySettings((prev) => ({
                      ...prev,
                      showContactInformation: checked === true,
                    }))
                  }
                />
                <span className="text-sm text-gray-700">Show contact information</span>
              </label>
            </div>
            <DialogFooter>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Update Password</DialogTitle>
            <DialogDescription>
              Enter your current password and choose a new one.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={savePassword} className="space-y-4">
            <PasswordField
              id="currentPassword"
              label="Current Password"
              value={passwordForm.currentPassword}
              onChange={(value) => setPasswordForm((prev) => ({ ...prev, currentPassword: value }))}
              visible={showCurrentPassword}
              onToggle={() => setShowCurrentPassword((value) => !value)}
              placeholder="Enter current password"
            />
            <PasswordField
              id="newPassword"
              label="New Password"
              value={passwordForm.newPassword}
              onChange={(value) => setPasswordForm((prev) => ({ ...prev, newPassword: value }))}
              visible={showNewPassword}
              onToggle={() => setShowNewPassword((value) => !value)}
              placeholder="Enter new password"
            />
            <div className="space-y-2">
              <PasswordField
                id="confirmNewPassword"
                label="Confirm New Password"
                value={passwordForm.confirmNewPassword}
                onChange={(value) =>
                  setPasswordForm((prev) => ({ ...prev, confirmNewPassword: value }))
                }
                visible={showConfirmPassword}
                onToggle={() => setShowConfirmPassword((value) => !value)}
                placeholder="Confirm new password"
              />
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span>Password strength</span>
                  <span>{passwordStrength.label}</span>
                </div>
                <div className="h-2 rounded-full bg-gray-200">
                  <div
                    className={`h-full rounded-full ${passwordStrength.color} ${passwordStrength.widthClass}`}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">Update Password</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
