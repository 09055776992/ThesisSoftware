import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import { Progress } from "../components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Checkbox } from "../components/ui/checkbox";
import { MapPin, Mail, Calendar, Award, BookOpen, Wallet, Pencil, Loader2, Lock, FileText, CheckCircle, Trash2, Upload, Camera } from "lucide-react";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { getDisplayName, getInitials, getStoredUser, saveStoredUser, getActiveUserEmail } from "../lib/user-storage";
import type { UserProfile } from "../lib/user-storage";
import {
  resolvePublicAssetUrl,
  pickProfileImageUrl,
  patchPersonalProfile,
  patchAcademicProfile,
  patchAchievementsProfile,
  uploadUserAvatar,
  uploadUserCoverPhoto,
  fetchProfileDocuments,
  uploadProfileDocument,
  deleteProfileDocument,
  fetchUserProfile,
  type ProfileDocumentResponse,
} from "../lib/api-client";
import { useNavigate } from "react-router";
import { toast } from "sonner";

const DEFAULT_COVER_PHOTO =
  "https://images.unsplash.com/photo-1707640590939-3953ab4c0a8b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBvZmZpY2UlMjBiYWNrZ3JvdW5kJTIwYmFubmVyfGVufDF8fHx8MTc3NjM2MTEyMHww&ixlib=rb-4.1.0&q=80&w=1080";

function resolveCoverPhotoSrc(coverPhoto?: string | null): string {
  const raw = String(coverPhoto ?? "").trim();
  if (!raw || raw.startsWith("data:")) return DEFAULT_COVER_PHOTO;
  if (raw.startsWith("blob:") || /^https?:\/\//i.test(raw)) return raw;
  return resolvePublicAssetUrl(raw, true) || DEFAULT_COVER_PHOTO;
}

function titleCase(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((segment) => segment[0].toUpperCase() + segment.slice(1))
    .join(" ");
}

// ─── Dropdown option constants ────────────────────────────────────────────────

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

const schoolTypeOptions = [
  "Public University / State University (SUC)",
  "Private University / College",
  "Public Senior High School",
  "Private Senior High School",
  "Public Junior High School",
  "Private Junior High School",
  "TESDA-accredited Institution",
  "Vocational School",
  "Graduate School",
];

const schoolLocationOptions = [
  { value: "Quezon City", label: "Quezon City ✓ (Auto-verified)" },
  { value: "Outside Quezon City (Metro Manila)", label: "Outside Quezon City (Metro Manila)" },
  { value: "Outside Metro Manila", label: "Outside Metro Manila" },
];

const incomeCategoryOptions = [
  "Under ₱25,000",
  "₱25,000 – ₱50,000",
  "₱50,000 – ₱100,000",
  "₱100,000+",
];

const classRankOptions = [
  "Rank 1", "Rank 2", "Rank 3", "Rank 4", "Rank 5",
  "Rank 6", "Rank 7", "Rank 8", "Rank 9", "Rank 10",
];

function getGwaLabel(gwa: string | undefined, educationLevel?: string): string {
  if (!gwa) return "";
  const n = parseFloat(gwa);
  if (!isFinite(n)) return "";
  
  // For SHS (percentage scale 70-100), higher is better
  if (educationLevel === "Senior High School") {
    if (n >= 95) return "Excellent";
    if (n >= 90) return "Very Good";
    if (n >= 85) return "Good";
    if (n >= 80) return "Satisfactory";
    return "Needs Improvement";
  }
  
  // For College (GWA scale 1.00-5.00), lower is better
  if (n <= 1.5) return "Excellent";
  if (n <= 2.0) return "Very Good";
  if (n <= 2.5) return "Good";
  if (n <= 3.0) return "Satisfactory";
  return "Needs Improvement";
}

// ─── AboutTab ─────────────────────────────────────────────────────────────────

interface AboutTabProps {
  user: UserProfile | null;
  editMode: boolean;
  onEditToggle: () => void;
  onSaveSuccess: (updatedFields: Partial<UserProfile>) => void;
}

function AboutTab({ user, editMode, onEditToggle, onSaveSuccess }: AboutTabProps) {
  if (editMode) {
    return <AboutEditForm user={user} onEditToggle={onEditToggle} onSaveSuccess={onSaveSuccess} />;
  }
  return <AboutView user={user} onEditToggle={onEditToggle} />;
}

interface AboutViewProps {
  user: UserProfile | null;
  onEditToggle: () => void;
}

function AboutView({ user, onEditToggle }: AboutViewProps) {
  const financialNeedVal = Array.isArray(user?.financialNeed)
    ? user.financialNeed[0]
    : user?.financialNeed;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">About</CardTitle>
            <Button variant="outline" size="sm" onClick={onEditToggle}>
              <Pencil className="size-4 mr-1" /> Edit Profile
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {user?.about ? (
            <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed">{user.about}</p>
          ) : (
            <p className="text-sm text-gray-400 dark:text-slate-500 italic">No profile info</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Skills</CardTitle>
        </CardHeader>
        <CardContent>
          {user?.skills && user.skills.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {user.skills.map((skill) => (
                <Badge key={skill} className="bg-slate-100 text-slate-800 hover:bg-slate-100 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-700">{skill}</Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 dark:text-slate-500 italic">No skills added yet.</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Financial Information <Lock className="inline size-3 text-gray-400" /> <span className="text-xs font-normal text-gray-400">(Private)</span></CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1 text-sm text-gray-600 dark:text-slate-400">
            <p>Income Category: {user?.incomeCategory || "Not provided"}</p>
            <p>Financial Need: {financialNeedVal ? `${financialNeedVal}/5` : "Not provided"}</p>
            <p>Household Income: {user?.householdIncome ? `₱${user.householdIncome.toLocaleString()}/mo` : "Not provided"}</p>
            <p>Financial Support Source: {user?.financialSupportSource || "Not provided"}</p>
            <p>Economic Dependency: {user?.economicDependency ? `${user.economicDependency} dependent(s)` : "Not provided"}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface AboutEditFormProps {
  user: UserProfile | null;
  onEditToggle: () => void;
  onSaveSuccess: (updatedFields: Partial<UserProfile>) => void;
}

function AboutEditForm({ user, onEditToggle, onSaveSuccess }: AboutEditFormProps) {
  const navigate = useNavigate();
  const [draftFullName, setDraftFullName] = useState(
    user?.fullName || (user as any)?.name || (user as any)?.userName || ""
  );
  const [draftPhone, setDraftPhone] = useState(user?.phone ?? "");
  const [draftLocation, setDraftLocation] = useState(user?.location ?? "Quezon City");
  const [draftDob, setDraftDob] = useState(user?.dateOfBirth ?? "");
  const [draftBio, setDraftBio] = useState(user?.about ?? "");
  const [draftSkills, setDraftSkills] = useState(user?.skills?.join(", ") ?? "");
  const [draftAvatarFile, setDraftAvatarFile] = useState<File | null>(null);
  const [draftAvatarPreview, setDraftAvatarPreview] = useState<string>(
    pickProfileImageUrl(user as Record<string, unknown>) || user?.profileImage || ""
  );
  const [avatarError, setAvatarError] = useState("");
  const [saving, setSaving] = useState(false);
  const [fullNameError, setFullNameError] = useState("");
  const [locationError, setLocationError] = useState("");
  const rawFinancialNeed = Array.isArray(user?.financialNeed) ? user.financialNeed[0] : user?.financialNeed;
  const [draftFinancialNeed, setDraftFinancialNeed] = useState(rawFinancialNeed ? String(rawFinancialNeed) : "");
  const [draftNetWorth, setDraftNetWorth] = useState(user?.netWorth ?? "");
  const [draftCurrency, setDraftCurrency] = useState(user?.currency ?? "PHP");
  const [draftIncomeCategory, setDraftIncomeCategory] = useState(user?.incomeCategory ?? "");
  const [draftHouseholdIncome, setDraftHouseholdIncome] = useState(user?.householdIncome ? String(user.householdIncome) : "");
  const [draftFinancialSupportSource, setDraftFinancialSupportSource] = useState(user?.financialSupportSource ?? "");
  const [draftEconomicDependency, setDraftEconomicDependency] = useState(user?.economicDependency ? String(user.economicDependency) : "");
  const [financialNeedError, setFinancialNeedError] = useState("");

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setAvatarError("Only PNG, JPEG, JPG, or WebP images are allowed.");
      e.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError("Image must be 5 MB or smaller.");
      e.target.value = "";
      return;
    }
    setAvatarError("");
    setDraftAvatarFile(file);
    setDraftAvatarPreview(URL.createObjectURL(file));
  };

  const handleCancel = () => {
    setDraftFullName(user?.fullName ?? "");
    setDraftPhone(user?.phone ?? "");
    setDraftLocation(user?.location ?? "Quezon City");
    setDraftDob(user?.dateOfBirth ?? "");
    setDraftBio(user?.about ?? "");
    setDraftSkills(user?.skills?.join(", ") ?? "");
    setDraftAvatarFile(null);
    setDraftAvatarPreview(pickProfileImageUrl(user as Record<string, unknown>) || user?.profileImage || "");
    setAvatarError("");
    setFullNameError("");
    setLocationError("");
    const rawFinancialNeed = Array.isArray(user?.financialNeed) ? user.financialNeed[0] : user?.financialNeed;
    setDraftFinancialNeed(rawFinancialNeed ? String(rawFinancialNeed) : "");
    setDraftNetWorth(user?.netWorth ?? "");
    setDraftCurrency(user?.currency ?? "PHP");
    setDraftIncomeCategory(user?.incomeCategory ?? "");
    setDraftHouseholdIncome(user?.householdIncome ? String(user.householdIncome) : "");
    setDraftFinancialSupportSource(user?.financialSupportSource ?? "");
    setDraftEconomicDependency(user?.economicDependency ? String(user.economicDependency) : "");
    setFinancialNeedError("");
    onEditToggle();
  };

  const handleSave = async () => {
    let valid = true;
    setFinancialNeedError("");
    if (draftFinancialNeed) {
      const financialNeed = Number(draftFinancialNeed);
      if (!Number.isInteger(financialNeed) || financialNeed < 1 || financialNeed > 5) {
        setFinancialNeedError("Financial need must be a whole number between 1 and 5.");
        valid = false;
      }
    }
    if (!draftFullName.trim()) {
      setFullNameError("Full name is required.");
      valid = false;
    } else {
      setFullNameError("");
    }
    if (!draftLocation.trim()) {
      setLocationError("Location is required.");
      valid = false;
    } else {
      setLocationError("");
    }
    if (!valid) return;

    setSaving(true);
    try {
      let avatarUrl: string | undefined;
      if (draftAvatarFile) {
        console.log("[Avatar] Uploading avatar for:", user?.email);
        avatarUrl = await uploadUserAvatar(draftAvatarFile, user?.email ?? "");
        console.log("[Avatar] Upload successful, URL:", avatarUrl);
      }

      const skillList = draftSkills.split(",").flatMap((s) => { const result = s.trim(); return result ? [result] : []; });

      await patchPersonalProfile({
        email: user?.email ?? "",
        fullName: draftFullName.trim(),
        phone: draftPhone.trim(),
        location: draftLocation.trim(),
        dateOfBirth: draftDob,
        about: draftBio.trim(),
        headline: draftBio.trim(),
        skills: skillList,
      });
      await patchAchievementsProfile({
        email: user?.email ?? "",
        financialNeed: draftFinancialNeed ? Number(draftFinancialNeed) : undefined,
        netWorth: draftNetWorth.trim() || undefined,
        currency: draftCurrency || undefined,
        incomeCategory: draftIncomeCategory || undefined,
        householdIncome: draftHouseholdIncome ? Number(draftHouseholdIncome) : undefined,
        financialSupportSource: draftFinancialSupportSource || undefined,
        economicDependency: draftEconomicDependency ? Number(draftEconomicDependency) : undefined,
      });

      const savedFields: Partial<UserProfile> = {
        fullName: draftFullName.trim(),
        phone: draftPhone.trim(),
        location: draftLocation.trim(),
        dateOfBirth: draftDob,
        about: draftBio.trim(),
        headline: draftBio.trim(),
        skills: skillList,
        financialNeed: draftFinancialNeed ? [Number(draftFinancialNeed)] : user?.financialNeed,
        netWorth: draftNetWorth.trim(),
        currency: draftCurrency,
        incomeCategory: draftIncomeCategory,
        householdIncome: draftHouseholdIncome ? Number(draftHouseholdIncome) : undefined,
        financialSupportSource: draftFinancialSupportSource || undefined,
        economicDependency: draftEconomicDependency ? Number(draftEconomicDependency) : undefined,
      };
      if (avatarUrl) {
        savedFields.profileImage = avatarUrl;
        savedFields.profilePicture = avatarUrl;
        console.log("[Avatar] Saving avatar to profile:", avatarUrl);
      }

      onSaveSuccess(savedFields);
      onEditToggle();
      toast.success("Personal info saved.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Avatar] Error saving profile:", err);
      if (msg.includes("404") || msg.toLowerCase().includes("not found")) {
        toast.error("Session expired. Please sign in again.");
        navigate("/auth/signin");
      } else {
        toast.error("Failed to save. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  const avatarSrc = draftAvatarPreview
    ? (draftAvatarPreview.startsWith("blob:") || draftAvatarPreview.startsWith("data:")
        ? draftAvatarPreview
        : resolvePublicAssetUrl(draftAvatarPreview))
    : "";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Edit Personal Info</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Profile Picture */}
        <div className="space-y-2">
          <Label>Profile Picture</Label>
          <div className="flex items-center gap-4">
            <Avatar className="size-16">
              <AvatarImage src={avatarSrc} />
              <AvatarFallback>{getInitials(user)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <Input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={handleAvatarChange}
              />
              {avatarError && <p className="text-sm text-red-500 mt-1">{avatarError}</p>}
            </div>
          </div>
        </div>

        {/* Full Name */}
        <div className="space-y-1">
          <Label htmlFor="edit-fullName">Full Name <span className="text-red-500">*</span></Label>
          <Input
            id="edit-fullName"
            value={draftFullName}
            onChange={(e) => setDraftFullName(e.target.value)}
            placeholder="Your full name"
          />
          {fullNameError && <p className="text-sm text-red-500">{fullNameError}</p>}
        </div>

        {/* Phone */}
        <div className="space-y-1">
          <Label htmlFor="edit-phone">Phone</Label>
          <Input
            id="edit-phone"
            value={draftPhone}
            onChange={(e) => setDraftPhone(e.target.value)}
            placeholder="Optional"
          />
        </div>

        {/* Location */}
        <div className="space-y-1">
          <Label htmlFor="edit-location">Location <span className="text-red-500">*</span></Label>
          <Input
            id="edit-location"
            value={draftLocation}
            onChange={(e) => setDraftLocation(e.target.value)}
            placeholder="Quezon City"
          />
          {locationError && <p className="text-sm text-red-500">{locationError}</p>}
        </div>

        {/* Date of Birth */}
        <div className="space-y-1">
          <Label htmlFor="edit-dob">Date of Birth</Label>
          <Input
            id="edit-dob"
            type="date"
            value={draftDob}
            onChange={(e) => setDraftDob(e.target.value)}
          />
        </div>

        {/* Bio */}
        <div className="space-y-1">
          <Label htmlFor="edit-bio">Bio</Label>
          <Textarea
            id="edit-bio"
            value={draftBio}
            onChange={(e) => setDraftBio(e.target.value)}
            placeholder="Tell others about your background and goals"
            rows={4}
          />
        </div>

        {/* Skills */}
        <div className="space-y-1">
          <Label htmlFor="edit-skills">Skills</Label>
          <Input
            id="edit-skills"
            value={draftSkills}
            onChange={(e) => setDraftSkills(e.target.value)}
            placeholder="Python, React, Data Analysis"
          />
          <p className="text-xs text-gray-500 dark:text-slate-400">Separate skills with commas.</p>
        </div>

        <div className="border-t pt-4 space-y-4">
          <p className="text-sm font-semibold">Financial Information</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="about-fn">Financial Need (1–5) <span className="text-red-500">*</span></Label>
              <Input id="about-fn" type="number" min="1" max="5" value={draftFinancialNeed} onChange={(e) => setDraftFinancialNeed(e.target.value)} placeholder="e.g. 4" />
              {financialNeedError && <p className="text-sm text-red-500">{financialNeedError}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="about-nw">Net Worth (Optional)</Label>
              <div className="relative"><span className="absolute inset-y-0 left-3 flex items-center text-sm text-gray-500">₱</span><Input id="about-nw" className="pl-7" value={draftNetWorth} onChange={(e) => setDraftNetWorth(e.target.value)} placeholder="50000" /></div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Currency</Label>
              <Select value={draftCurrency} onValueChange={setDraftCurrency}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PHP">PHP (₱)</SelectItem></SelectContent></Select>
            </div>
            <div className="space-y-1">
              <Label>Income Category</Label>
              <Select value={draftIncomeCategory} onValueChange={setDraftIncomeCategory}><SelectTrigger><SelectValue placeholder="Select bracket" /></SelectTrigger><SelectContent>{incomeCategoryOptions.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="about-hi">Household Income (Monthly ₱)</Label>
              <div className="relative"><span className="absolute inset-y-0 left-3 flex items-center text-sm text-gray-500">₱</span><Input id="about-hi" className="pl-7" type="number" min="0" value={draftHouseholdIncome} onChange={(e) => setDraftHouseholdIncome(e.target.value)} placeholder="e.g. 25000" /></div>
            </div>
            <div className="space-y-1">
              <Label>Financial Support Source</Label>
              <Select value={draftFinancialSupportSource} onValueChange={setDraftFinancialSupportSource}><SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger><SelectContent>
                <SelectItem value="Parents">Parents</SelectItem><SelectItem value="Self-supporting / Working Student">Self-supporting / Working Student</SelectItem><SelectItem value="Government Aid">Government Aid</SelectItem><SelectItem value="Relative / Guardian">Relative / Guardian</SelectItem><SelectItem value="Scholarship / Grant">Scholarship / Grant</SelectItem>
              </SelectContent></Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="about-ed">Economic Dependency (No. of Household Dependents)</Label>
            <Input id="about-ed" type="number" min="0" max="20" value={draftEconomicDependency} onChange={(e) => setDraftEconomicDependency(e.target.value)} placeholder="e.g. 4" />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 className="size-4 mr-2 animate-spin" />Saving…</> : "Save Personal & Financial Info"}
          </Button>
          <Button variant="outline" onClick={handleCancel} disabled={saving}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── EducationTab ─────────────────────────────────────────────────────────────

interface EducationTabProps {
  user: UserProfile | null;
  editMode: boolean;
  onEditToggle: () => void;
  onSaveSuccess: (updatedFields: Partial<UserProfile>) => void;
}

function EducationTab({ user, editMode, onEditToggle, onSaveSuccess }: EducationTabProps) {
  if (editMode) {
    return <EducationEditForm user={user} onEditToggle={onEditToggle} onSaveSuccess={onSaveSuccess} />;
  }
  return <EducationView user={user} onEditToggle={onEditToggle} />;
}

interface EducationViewProps {
  user: UserProfile | null;
  onEditToggle: () => void;
}

function EducationView({ user, onEditToggle }: EducationViewProps) {
  const hasData = user?.educationLevel || user?.fieldOfStudy || user?.graduationYear || user?.gwa || user?.gpa || user?.schoolName;
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Education</CardTitle>
          <Button variant="outline" size="sm" onClick={onEditToggle}>
            <Pencil className="size-4 mr-1" /> Edit
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="text-sm text-gray-400 italic">Add your education details to see your academic summary here.</p>
        ) : (
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="size-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <BookOpen className="size-6 text-primary" />
              </div>
            </div>
            <div className="flex-1 space-y-1">
              {user?.schoolName && (
                <h3 className="font-semibold">
                  {user.schoolName}{user?.schoolCampus ? ` (${user.schoolCampus})` : ""}
                </h3>
              )}
              {user?.fieldOfStudy && <p className="text-sm text-gray-600 dark:text-slate-400">{user.fieldOfStudy}</p>}
              {(user?.educationLevel || user?.yearLevel) && (
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  {user?.educationLevel ? titleCase(user.educationLevel) : ""}
                  {user?.yearLevel ? ` — ${user.yearLevel}` : ""}
                </p>
              )}
              {user?.graduationYear && (
                <p className="text-sm text-gray-500 dark:text-slate-400">Expected graduation {user.graduationYear}</p>
              )}
              {(user?.gwa || user?.gpa) && (
                <p className="text-sm font-semibold">
                  GWA: {user?.gwa || user?.gpa}
                  {getGwaLabel(user?.gwa || user?.gpa, user?.educationLevel) ? <span className="ml-1 text-gray-500 dark:text-slate-400 font-normal">({getGwaLabel(user?.gwa || user?.gpa, user?.educationLevel)})</span> : null}
                </p>
              )}
              <div className="flex flex-wrap gap-2 mt-2">
                {user?.schoolType && (
                  <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-950/50">{user.schoolType}</Badge>
                )}
                {user?.schoolLocation && (
                  <Badge className={user.schoolLocation === "Quezon City" ? "bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-950/50 dark:text-green-300 dark:hover:bg-green-950/50" : "bg-yellow-100 text-yellow-800 hover:bg-yellow-100 dark:bg-yellow-950/50 dark:text-yellow-300 dark:hover:bg-yellow-950/50"}>
                    {user.schoolLocation === "Quezon City" ? "Quezon City ✓" : user.schoolLocation}
                  </Badge>
                )}
                {user?.hasAcademicHonors && (
                  <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 dark:bg-purple-950/50 dark:text-purple-300 dark:hover:bg-purple-950/50">Academic Honors</Badge>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface EducationEditFormProps {
  user: UserProfile | null;
  onEditToggle: () => void;
  onSaveSuccess: (updatedFields: Partial<UserProfile>) => void;
}

function EducationEditForm({ user, onEditToggle, onSaveSuccess }: EducationEditFormProps) {
  const [draftGwa, setDraftGwa] = useState(user?.gwa ?? user?.gpa ?? "");
  const [draftEducationLevel, setDraftEducationLevel] = useState(user?.educationLevel ?? "");
  const [draftYearLevel, setDraftYearLevel] = useState(user?.yearLevel ?? "");
  const [draftFieldOfStudy, setDraftFieldOfStudy] = useState(user?.fieldOfStudy ?? "");
  const [draftGraduationYear, setDraftGraduationYear] = useState(user?.graduationYear ?? "");
  const [draftSchoolName, setDraftSchoolName] = useState(user?.schoolName ?? "");
  const [draftSchoolCampus, setDraftSchoolCampus] = useState(user?.schoolCampus ?? "");
  const [draftSchoolType, setDraftSchoolType] = useState(user?.schoolType ?? "");
  const [draftSchoolLocation, setDraftSchoolLocation] = useState(user?.schoolLocation ?? "");
  const [draftHasHonors, setDraftHasHonors] = useState(user?.hasAcademicHonors === true);
  const [draftAcademicRank, setDraftAcademicRank] = useState(user?.academic_rank ? String(user.academic_rank) : "");
  const [gwaError, setGwaError] = useState("");
  const [saving, setSaving] = useState(false);

  // Dynamic GWA validation based on education level
  const isSeniorHighSchool = draftEducationLevel === "Senior High School";
  
  // SHS: 70-100 scale (percentage), College: 1.00-5.00 scale (GWA)
  const gwaMin = isSeniorHighSchool ? 70 : 1.00;
  const gwaMax = isSeniorHighSchool ? 100 : 5.00;
  const gwaStep = isSeniorHighSchool ? 0.01 : 0.01;
  const gwaPlaceholder = isSeniorHighSchool ? "e.g., 92" : "e.g., 1.75";
  const gwaHelperText = isSeniorHighSchool 
    ? "SHS Percentage scale: 70-100 (70 = Passing, 100 = Highest)"
    : "Philippine GWA scale: 1.00 = Highest (Excellent), 3.00 = Passing, 5.00 = Failing.";

  // Real-time GWA validation
  const validateGwa = (value: string): string => {
    if (!value) return "";
    const n = parseFloat(value);
    if (!isFinite(n)) return "Enter a valid number.";
    
    if (isSeniorHighSchool) {
      // SHS: 70-100 scale
      if (n < 70) return "SHS grade must be at least 70 (passing).";
      if (n > 100) return "SHS grade cannot exceed 100.";
    } else {
      // College: 1.00-5.00 scale
      if (n < 1) return "GWA must be at least 1.00.";
      if (n > 5) return "GWA cannot exceed 5.00.";
    }
    return "";
  };

  const handleGwaBlur = () => {
    const error = validateGwa(draftGwa);
    setGwaError(error);
    if (error || !draftGwa) return;
    
    const n = parseFloat(draftGwa);
    
    // Clamp to valid range based on education level
    let clamped: number;
    if (isSeniorHighSchool) {
      // SHS: clamp between 70-100
      clamped = Math.min(100, Math.max(70, n));
    } else {
      // College: clamp between 1-5
      clamped = Math.min(5, Math.max(1, n));
    }
    
    // Format: 2 decimal places for college, 0 or 2 for SHS
    setDraftGwa(isSeniorHighSchool ? clamped.toFixed(0) : clamped.toFixed(2));
  };

  // Validate on education level change
  useEffect(() => {
    if (draftGwa) {
      const error = validateGwa(draftGwa);
      setGwaError(error);
    }
  }, [draftEducationLevel, draftGwa]);

  const handleCancel = () => {
    setDraftGwa(user?.gwa ?? user?.gpa ?? "");
    setDraftEducationLevel(user?.educationLevel ?? "");
    setDraftYearLevel(user?.yearLevel ?? "");
    setDraftFieldOfStudy(user?.fieldOfStudy ?? "");
    setDraftGraduationYear(user?.graduationYear ?? "");
    setDraftSchoolName(user?.schoolName ?? "");
    setDraftSchoolCampus(user?.schoolCampus ?? "");
    setDraftSchoolType(user?.schoolType ?? "");
    setDraftSchoolLocation(user?.schoolLocation ?? "");
    setDraftHasHonors(user?.hasAcademicHonors === true);
    setDraftAcademicRank(user?.academic_rank ? String(user.academic_rank) : "");
    setGwaError("");
    onEditToggle();
  };

  const handleSave = async () => {
    setSaving(true);
    setGwaError("");
    try {
      await patchAcademicProfile({
        email: user?.email ?? "",
        gwa: draftGwa.trim() || undefined,
        educationLevel: draftEducationLevel || undefined,
        yearLevel: draftYearLevel || undefined,
        fieldOfStudy: draftFieldOfStudy.trim() || undefined,
        graduationYear: draftGraduationYear.trim() || undefined,
        schoolName: draftSchoolName.trim() || undefined,
        schoolCampus: draftSchoolCampus.trim() || undefined,
        schoolType: draftSchoolType || undefined,
        schoolLocation: draftSchoolLocation || undefined,
        hasAcademicHonors: draftHasHonors,
        academic_rank: draftAcademicRank || null,
      });
      const savedFields: Partial<UserProfile> = {
        gwa: draftGwa.trim(),
        educationLevel: draftEducationLevel,
        yearLevel: draftYearLevel,
        fieldOfStudy: draftFieldOfStudy.trim(),
        graduationYear: draftGraduationYear.trim(),
        schoolName: draftSchoolName.trim(),
        schoolCampus: draftSchoolCampus.trim(),
        schoolType: draftSchoolType,
        schoolLocation: draftSchoolLocation,
        hasAcademicHonors: draftHasHonors,
        academic_rank: draftAcademicRank ? Number(draftAcademicRank) : undefined,
      };
      onSaveSuccess(savedFields);
      onEditToggle();
      toast.success("Academic info saved.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes("gwa") || msg.toLowerCase().includes("gpa")) {
        setGwaError(msg);
      } else {
        toast.error("Failed to save. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Edit Academic Info</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="edu-gwa">GWA (General Weighted Average) <span className="text-red-500">*</span></Label>
          <Input 
            id="edu-gwa" 
            type="number" 
            min={gwaMin} 
            max={gwaMax} 
            step={gwaStep} 
            value={draftGwa}
            onChange={(e) => {
              setDraftGwa(e.target.value);
              // Real-time validation
              const error = validateGwa(e.target.value);
              setGwaError(error);
            }} 
            onBlur={handleGwaBlur} 
            placeholder={gwaPlaceholder}
            className={gwaError ? "border-red-500 focus-visible:ring-red-500" : ""}
          />
          <p className="text-xs text-gray-500 dark:text-slate-400">{gwaHelperText}</p>
          {gwaError && (
            <div className="flex items-center gap-1.5 text-sm text-red-500">
              <span className="inline-flex items-center justify-center size-4 rounded-full bg-red-100 text-red-500 text-xs">!</span>
              {gwaError}
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Education Level</Label>
            <Select value={draftEducationLevel} onValueChange={(v) => { setDraftEducationLevel(v); setDraftYearLevel(""); }}>
              <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
              <SelectContent>
                {educationLevelOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Year Level</Label>
            <Select value={draftYearLevel} onValueChange={setDraftYearLevel} disabled={!draftEducationLevel}>
              <SelectTrigger><SelectValue placeholder={draftEducationLevel ? "Select year" : "Select level first"} /></SelectTrigger>
              <SelectContent>
                {(yearLevelOptions[draftEducationLevel] ?? []).map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="edu-fos">Field of Study</Label>
            <Input id="edu-fos" value={draftFieldOfStudy} onChange={(e) => setDraftFieldOfStudy(e.target.value)} placeholder="Computer Science" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="edu-grad">Graduation Year</Label>
            <Input id="edu-grad" value={draftGraduationYear} onChange={(e) => setDraftGraduationYear(e.target.value)} placeholder="2026" />
          </div>
        </div>
        <div className="border-t pt-4">
          <p className="text-xs font-semibold text-blue-700 bg-blue-50 dark:bg-blue-950/50 dark:text-blue-300 px-2 py-1 rounded inline-block mb-3">REQUIRED FOR ELIGIBILITY</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="edu-school">School / Institution Name <span className="text-red-500">*</span></Label>
              <Input id="edu-school" value={draftSchoolName} onChange={(e) => setDraftSchoolName(e.target.value)} placeholder="e.g. Our Lady of Fatima University" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edu-campus">Campus / Branch</Label>
              <Input id="edu-campus" value={draftSchoolCampus} onChange={(e) => setDraftSchoolCampus(e.target.value)} placeholder="e.g. Quezon City Campus" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div className="space-y-1">
              <Label>School Type</Label>
              <Select value={draftSchoolType} onValueChange={setDraftSchoolType}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {schoolTypeOptions.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>School Location</Label>
              <Select value={draftSchoolLocation} onValueChange={setDraftSchoolLocation}>
                <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                <SelectContent>
                  {schoolLocationOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <div className="border-t pt-4 space-y-3">
          <Label className="text-sm font-semibold">Academic Honors</Label>
          <div className="flex items-center gap-2">
            <Checkbox id="edu-honors" checked={draftHasHonors} onCheckedChange={(v) => { setDraftHasHonors(v === true); if (!v) setDraftAcademicRank(""); }} />
            <label htmlFor="edu-honors" className="text-sm cursor-pointer">Graduated with academic honors</label>
          </div>
          {draftHasHonors && (
            <div className="space-y-1">
              <Label>Class Rank (optional)</Label>
              <Select value={draftAcademicRank || "none"} onValueChange={(v) => setDraftAcademicRank(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select rank" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not applicable</SelectItem>
                  {classRankOptions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <div className="flex gap-2 pt-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 className="size-4 mr-2 animate-spin" />Saving…</> : "Save Academic Info"}
          </Button>
          <Button variant="outline" onClick={handleCancel} disabled={saving}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── AchievementsTab ──────────────────────────────────────────────────────────

interface AchievementsTabProps {
  user: UserProfile | null;
  editMode: boolean;
  onEditToggle: () => void;
  onSaveSuccess: (updatedFields: Partial<UserProfile>) => void;
}

function AchievementsTab({ user, editMode, onEditToggle, onSaveSuccess }: AchievementsTabProps) {
  if (editMode) {
    return <AchievementsEditForm user={user} onEditToggle={onEditToggle} onSaveSuccess={onSaveSuccess} />;
  }
  return <AchievementsView user={user} onEditToggle={onEditToggle} />;
}

interface AchievementsViewProps {
  user: UserProfile | null;
  onEditToggle: () => void;
}

function AchievementsView({ user, onEditToggle }: AchievementsViewProps) {
  const specialCategories = [
    user?.isAthlete ? "Athlete" : null,
    user?.isArtist ? "Artist" : null,
    user?.isSKOfficial ? "SK Official / Youth Leader" : null,
    user?.isStudentLeader ? "Student Council / Government Leader" : null,
    user?.isIndigent ? "Indigent/Low-income" : null,
    user?.isPWD ? "Person with Disability (PWD)" : null,
    user?.isSoloParent ? "Solo Parent" : null,
  ].filter(Boolean) as string[];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Achievements & Eligibility</CardTitle>
          <Button variant="outline" size="sm" onClick={onEditToggle}>
            <Pencil className="size-4 mr-1" /> Edit
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">Special Categories</p>
          {specialCategories.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {specialCategories.map((cat) => (
                <Badge key={cat} className="bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-950/50 dark:text-green-300 dark:hover:bg-green-950/50">{cat}</Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">No special categories set.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface AchievementsEditFormProps {
  user: UserProfile | null;
  onEditToggle: () => void;
  onSaveSuccess: (updatedFields: Partial<UserProfile>) => void;
}

function AchievementsEditForm({ user, onEditToggle, onSaveSuccess }: AchievementsEditFormProps) {
  const [draftIsAthlete, setDraftIsAthlete] = useState(user?.isAthlete === true);
  const [draftIsArtist, setDraftIsArtist] = useState(user?.isArtist === true);
  const [draftIsSKOfficial, setDraftIsSKOfficial] = useState(user?.isSKOfficial === true);
  const [draftIsStudentLeader, setDraftIsStudentLeader] = useState(user?.isStudentLeader === true);
  const [draftIsIndigent, setDraftIsIndigent] = useState(user?.isIndigent === true);
  const [draftIsPWD, setDraftIsPWD] = useState(user?.isPWD === true);
  const [draftIsSoloParent, setDraftIsSoloParent] = useState(user?.isSoloParent === true);
  const [saving, setSaving] = useState(false);

  const handleCancel = () => {
    setDraftIsAthlete(user?.isAthlete === true);
    setDraftIsArtist(user?.isArtist === true);
    setDraftIsSKOfficial(user?.isSKOfficial === true);
    setDraftIsStudentLeader(user?.isStudentLeader === true);
    setDraftIsIndigent(user?.isIndigent === true);
    setDraftIsPWD(user?.isPWD === true);
    setDraftIsSoloParent(user?.isSoloParent === true);
    onEditToggle();
  };

  const handleSave = async () => {
    // Guard: email must be available
    if (!user?.email) {
      toast.error("Session expired. Please sign in again.");
      return;
    }

    setSaving(true);
    try {
      await patchAchievementsProfile({
        email: user.email,
        isAthlete: draftIsAthlete,
        isArtist: draftIsArtist,
        isSKOfficial: draftIsSKOfficial,
        isStudentLeader: draftIsStudentLeader,
        isIndigent: draftIsIndigent,
        isPWD: draftIsPWD,
        isSoloParent: draftIsSoloParent,
      });
      const savedFields: Partial<UserProfile> = {
        isAthlete: draftIsAthlete,
        isArtist: draftIsArtist,
        isSKOfficial: draftIsSKOfficial,
        isStudentLeader: draftIsStudentLeader,
        isIndigent: draftIsIndigent,
        isPWD: draftIsPWD,
        isSoloParent: draftIsSoloParent,
      };
      onSaveSuccess(savedFields);
      onEditToggle();
      toast.success("Achievements saved.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[AchievementsEdit] Save failed:", msg);
      toast.error(msg && msg !== "Request failed" ? msg : "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Edit Achievements</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs font-semibold text-purple-700 bg-purple-50 dark:bg-purple-950/50 dark:text-purple-300 px-2 py-1 rounded inline-block mb-3">SCHOLARSHIP ELIGIBILITY</p>
          <p className="text-sm font-semibold mb-2">Special Categories (Check all that apply)</p>
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">These categories determine eligibility for specific scholarships.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              {([
                { id: "ach-athlete", label: "Athlete (for Athletic Scholarships)", val: draftIsAthlete, set: setDraftIsAthlete },
                { id: "ach-sk", label: "SK Official / Youth Leader", val: draftIsSKOfficial, set: setDraftIsSKOfficial },
                { id: "ach-indigent", label: "From Indigent / Low-income Family", val: draftIsIndigent, set: setDraftIsIndigent },
                { id: "ach-solo", label: "Solo Parent", val: draftIsSoloParent, set: setDraftIsSoloParent },
              ] as const).map((item) => (
                <div key={item.id} className="flex items-center gap-2">
                  <Checkbox id={item.id} checked={item.val} onCheckedChange={(v) => item.set(v === true)} />
                  <label htmlFor={item.id} className="text-sm cursor-pointer">{item.label}</label>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {([
                { id: "ach-artist", label: "Artist (for Arts & Culture Scholarships)", val: draftIsArtist, set: setDraftIsArtist },
                { id: "ach-leader", label: "Student Council / Government Leader", val: draftIsStudentLeader, set: setDraftIsStudentLeader },
                { id: "ach-pwd", label: "Person with Disability (PWD)", val: draftIsPWD, set: setDraftIsPWD },
              ] as const).map((item) => (
                <div key={item.id} className="flex items-center gap-2">
                  <Checkbox id={item.id} checked={item.val} onCheckedChange={(v) => item.set(v === true)} />
                  <label htmlFor={item.id} className="text-sm cursor-pointer">{item.label}</label>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 className="size-4 mr-2 animate-spin" />Saving…</> : "Save Achievements"}
          </Button>
          <Button variant="outline" onClick={handleCancel} disabled={saving}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── DocumentVaultTab ─────────────────────────────────────────────────────────

interface DocumentVaultTabProps {
  user: UserProfile | null;
}

const documentConfig = [
  {
    key: "gradesTranscript" as const,
    label: "Copy of Grades / Transcript of Records / Form 137 or 138",
    description: "Upload your most recent grades, transcript, or school records",
  },
  {
    key: "enrollmentProof" as const,
    label: "Proof of school enrollment/registration/acceptance",
    description: "Certificate of enrollment or registration from your school",
  },
  {
    key: "qCitizenId" as const,
    label: "Valid QCitizen ID",
    description: "Your valid Quezon City resident ID or proof of residency",
  },
];

function DocumentVaultTab({ user }: DocumentVaultTabProps) {
  const [documents, setDocuments] = useState<ProfileDocumentResponse[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    loadDocuments();
  }, [user?.email]);

  const loadDocuments = async () => {
    if (!user?.email) {
      setLoading(false);
      return;
    }
    try {
      const result = await fetchProfileDocuments(user.email);
      setDocuments(result.documents);
      setIsComplete(result.isComplete);
    } catch (err) {
      toast.error("Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (docType: "gradesTranscript" | "enrollmentProof" | "qCitizenId", file: File) => {
    if (!user?.email) return;
    
    // Validate file
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Only PDF, JPG, JPEG, and PNG files are allowed");
      return;
    }

    setUploading(docType);
    try {
      await uploadProfileDocument(user.email, docType, file);
      toast.success("Document uploaded successfully");
      await loadDocuments();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast.error(msg);
    } finally {
      setUploading(null);
    }
  };

  const handleDelete = async (docType: "gradesTranscript" | "enrollmentProof" | "qCitizenId") => {
    if (!user?.email) return;
    if (!confirm("Are you sure you want to delete this document?")) return;

    try {
      await deleteProfileDocument(user.email, docType);
      toast.success("Document deleted");
      await loadDocuments();
    } catch (err) {
      toast.error("Failed to delete document");
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Loading documents...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="size-5" />
                Document Vault
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Upload your general documents once. These will be automatically linked to all your scholarship applications.
              </p>
            </div>
            {isComplete && (
              <Badge className="bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300">
                <CheckCircle className="size-3 mr-1" />
                Complete
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status Banner */}
          <div className={`p-4 rounded-lg border ${isComplete ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800' : 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800'}`}>
            <div className="flex items-start gap-3">
              {isComplete ? (
                <>
                  <CheckCircle className="size-5 text-green-600 dark:text-green-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-800 dark:text-green-300">All documents uploaded!</p>
                    <p className="text-sm text-green-700 dark:text-green-400">
                      Your general documents are ready. When you apply for scholarships, these will be automatically linked.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="size-5 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center mt-0.5">
                    <span className="text-amber-600 dark:text-amber-400 text-xs">!</span>
                  </div>
                  <div>
                    <p className="font-medium text-amber-800 dark:text-amber-300">Complete your document vault</p>
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      Please upload all 3 required documents to enable quick scholarship applications.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Document Upload Cards */}
          <div className="space-y-4">
            {documentConfig.map((config) => {
              const doc = documents.find((d) => d.type === config.key);
              const hasFile = doc?.fileName;

              return (
                <div
                  key={config.key}
                  className={`border border-gray-200 dark:border-slate-800 rounded-lg p-4 ${hasFile ? 'bg-gray-50 dark:bg-slate-800/50' : 'bg-white dark:bg-slate-900'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-start gap-2">
                        <h4 className="font-medium text-sm leading-snug">{config.label}</h4>
                        {hasFile ? (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300 text-xs shrink-0">
                            <CheckCircle className="size-3 mr-1" />
                            Uploaded
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 shrink-0">
                            Required
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{config.description}</p>

                      {hasFile && doc && (
                        <div className="mt-3 p-3 bg-white dark:bg-slate-900 rounded border border-gray-200 dark:border-slate-700">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <FileText className="size-4 text-gray-500" />
                              <span className="text-sm font-medium">{doc.fileName}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {formatFileSize(doc.fileSize)} • {formatDate(doc.uploadedAt)}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(config.key)}
                                className="text-red-500 hover:text-red-600"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </div>
                          {doc.status === "rejected" && doc.rejectionReason && (
                            <p className="text-xs text-red-600 mt-2">
                              Rejected: {doc.rejectionReason}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {!hasFile && (
                      <div className="relative">
                        <input
                          type="file"
                          id={`file-${config.key}`}
                          accept=".pdf,.jpg,.jpeg,.png"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(config.key, file);
                            e.target.value = "";
                          }}
                          disabled={uploading === config.key}
                        />
                        <label
                          htmlFor={`file-${config.key}`}
                          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 cursor-pointer"
                        >
                          {uploading === config.key ? (
                            <>
                              <Loader2 className="size-4 mr-2 animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Upload className="size-4 mr-2" />
                              Upload
                            </>
                          )}
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Profile Component ───────────────────────────────────────────────────

export function Profile() {
  const navigate = useNavigate();
  const [localUser, setLocalUser] = useState(getStoredUser());
  const [activeTab, setActiveTab] = useState("about");
  const [aboutEditMode, setAboutEditMode] = useState(false);
  const [educationEditMode, setEducationEditMode] = useState(false);
  const [achievementsEditMode, setAchievementsEditMode] = useState(false);
  const [coverPhoto, setCoverPhoto] = useState(
    () => getStoredUser()?.coverPhoto || ""
  );
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Fetch full user profile from MongoDB on mount to guarantee fresh name and fields
  useEffect(() => {
    const activeEmail = localUser?.email || getActiveUserEmail() || getStoredUser()?.email;
    if (!activeEmail) return;

    fetchUserProfile(activeEmail)
      .then((res) => {
        if (res?.user) {
          // saveStoredUser merges with existing data and preserves a known
          // display name when the server payload has empty name fields.
          saveStoredUser(res.user as UserProfile);
          const nextUser = getStoredUser();
          setLocalUser(nextUser);
          setCoverPhoto(String(res.user.coverPhoto || nextUser?.coverPhoto || "").trim());
        }
      })
      .catch((err) => {
        console.warn("[Profile] Failed to fetch user profile from server:", err);
      });
  }, []);

  // Listen for local user storage updates dispatched across tabs/components
  useEffect(() => {
    const handleStorageUpdate = () => {
      const nextUser = getStoredUser();
      setLocalUser(nextUser);
      setCoverPhoto(String(nextUser?.coverPhoto || "").trim());
    };
    window.addEventListener("scholarship-portal-user-updated", handleStorageUpdate);
    window.addEventListener("storage", handleStorageUpdate);
    return () => {
      window.removeEventListener("scholarship-portal-user-updated", handleStorageUpdate);
      window.removeEventListener("storage", handleStorageUpdate);
    };
  }, []);

  const handleEditProfile = () => {
    setActiveTab("about");
    setAboutEditMode(true);
  };

  const handleCoverPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Only PNG, JPEG, JPG, or WebP images are allowed.");
      e.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Cover photo must be 5 MB or smaller.");
      e.target.value = "";
      return;
    }

    const email = localUser?.email || getActiveUserEmail() || "";
    if (!email) {
      toast.error("Session expired. Please sign in again.");
      e.target.value = "";
      return;
    }

    const previousCover = coverPhoto;
    const localPreview = URL.createObjectURL(file);
    setCoverPhoto(localPreview);
    setUploadingCover(true);

    try {
      const coverPhotoUrl = await uploadUserCoverPhoto(file, email);
      setCoverPhoto(coverPhotoUrl);
      const merged = { ...localUser, coverPhoto: coverPhotoUrl } as UserProfile;
      setLocalUser(merged);
      saveStoredUser(merged);
      toast.success("Cover photo updated.");
    } catch (err) {
      setCoverPhoto(previousCover);
      const msg = err instanceof Error ? err.message : "Failed to upload cover photo.";
      toast.error(msg);
    } finally {
      URL.revokeObjectURL(localPreview);
      setUploadingCover(false);
      e.target.value = "";
    }
  };

  const handleSaveSuccess = (updatedFields: Partial<UserProfile>) => {
    const merged = { ...localUser, ...updatedFields } as UserProfile;
    setLocalUser(merged);
    saveStoredUser(merged);
  };

  const financialNeedVal = Array.isArray(localUser?.financialNeed)
    ? localUser.financialNeed[0]
    : localUser?.financialNeed;

  const eligibilityBadges = [
    localUser?.schoolName ? `${localUser.schoolName}${localUser?.schoolCampus ? ` (${localUser.schoolCampus})` : ""}` : null,
    localUser?.fieldOfStudy ?? null,
    localUser?.educationLevel ? titleCase(localUser.educationLevel) : null,
    (localUser?.gwa || localUser?.gpa) ? `GWA ${localUser?.gwa || localUser?.gpa}${localUser?.educationLevel === "Senior High School" ? "%" : ""}` : null,
    (financialNeedVal ?? 0) >= 4 ? "Need-Based Support" : null,
    localUser?.isAthlete ? "🏃 Athlete" : null,
    localUser?.isArtist ? "🎨 Artist" : null,
    localUser?.isSKOfficial ? "🌟 SK Official" : null,
    localUser?.isStudentLeader ? "📢 Student Leader" : null,
    localUser?.isIndigent ? "Indigent/Low-income" : null,
    localUser?.isPWD ? "♿ PWD" : null,
    localUser?.isSoloParent ? "👨‍👩‍👧 Solo Parent" : null,
  ].filter(Boolean) as string[];

  return (
    <div className="pb-8">
      {/* ── Profile Header Card (Facebook-style) ── */}
      <div className="max-w-6xl mx-auto px-4">
        <Card className="mb-6 overflow-hidden">

          {/* Cover Photo */}
          <div className="h-56 md:h-64 bg-gradient-to-r from-primary to-secondary relative group">
            <ImageWithFallback
              key={coverPhoto || "default-cover"}
              src={resolveCoverPhotoSrc(coverPhoto)}
              alt="Cover"
              className="w-full h-full object-cover"
            />
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleCoverPhotoChange}
              disabled={uploadingCover}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="absolute top-3 right-3 bg-white/90 hover:bg-white dark:bg-slate-900/90 dark:hover:bg-slate-900 shadow-sm backdrop-blur-sm"
              onClick={() => coverInputRef.current?.click()}
              disabled={uploadingCover}
            >
              {uploadingCover ? (
                <>
                  <Loader2 className="size-4 mr-1 animate-spin" /> Uploading...
                </>
              ) : (
                <>
                  <Camera className="size-4 mr-1" /> Change Cover Photo
                </>
              )}
            </Button>
          </div>

          {/* Avatar + Name row — avatar overlaps the cover photo */}
          <CardContent className="px-6 pb-6">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">

              {/* Left: overlapping avatar + name block */}
              <div className="flex flex-col md:flex-row md:items-end gap-4">
                {/* Avatar — pulled up by half its height to overlap the cover */}
                <div className="flex-shrink-0 -mt-16 md:-mt-20">
                  <Avatar className="size-32 md:size-40 border-4 border-card shadow-md">
                    <AvatarImage
                      key={pickProfileImageUrl(localUser as Record<string, unknown>) || localUser?.profileImage}
                      src={resolvePublicAssetUrl(pickProfileImageUrl(localUser as Record<string, unknown>) || localUser?.profileImage, true)}
                    />
                    <AvatarFallback className="text-3xl font-bold">{getInitials(localUser)}</AvatarFallback>
                  </Avatar>
                </div>

                {/* Name + meta */}
                <div className="pb-1">
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
                    {localUser?.fullName?.trim() ||
                     (localUser as any)?.name?.trim() ||
                     getDisplayName(localUser)}
                  </h1>
                  {localUser?.headline && (
                    <p className="text-muted-foreground text-sm mt-0.5">{localUser.headline}</p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mt-2">
                    {localUser?.location && (
                      <div className="flex items-center gap-1"><MapPin className="size-3.5" />{localUser.location}</div>
                    )}
                    {localUser?.email && (
                      <div className="flex items-center gap-1"><Mail className="size-3.5" />{localUser.email}</div>
                    )}
                    <div className="flex items-center gap-1">
                      <Calendar className="size-3.5" />{localUser?.joinDate ? `Joined ${localUser.joinDate}` : "Join date not available"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: action buttons */}
              <div className="flex gap-2 md:mb-1 flex-shrink-0">
                <Button variant="outline" onClick={handleEditProfile}>
                  <Pencil className="size-4 mr-1" /> Edit Profile
                </Button>
                <Button variant="outline">Message</Button>
              </div>
            </div>

            {/* Badges row */}
            {eligibilityBadges.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border">
                {eligibilityBadges.map((badge) => (
                  <Badge key={badge} className="bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-100 dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 dark:hover:bg-slate-700">{badge}</Badge>
                ))}
              </div>
            )}
            {eligibilityBadges.length === 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <Badge variant="outline">Complete your profile to see scholarship matches</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Profile Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full justify-start">
                <TabsTrigger value="about">About</TabsTrigger>
                <TabsTrigger value="education">Education</TabsTrigger>
                <TabsTrigger value="achievements">Achievements</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
              </TabsList>

              <TabsContent value="about">
                <AboutTab
                  user={localUser}
                  editMode={aboutEditMode}
                  onEditToggle={() => setAboutEditMode((v) => !v)}
                  onSaveSuccess={handleSaveSuccess}
                />
              </TabsContent>

              <TabsContent value="education">
                <EducationTab
                  user={localUser}
                  editMode={educationEditMode}
                  onEditToggle={() => setEducationEditMode((v) => !v)}
                  onSaveSuccess={handleSaveSuccess}
                />
              </TabsContent>

              <TabsContent value="achievements">
                <AchievementsTab
                  user={localUser}
                  editMode={achievementsEditMode}
                  onEditToggle={() => setAchievementsEditMode((v) => !v)}
                  onSaveSuccess={handleSaveSuccess}
                />
              </TabsContent>

              <TabsContent value="documents">
                <DocumentVaultTab user={localUser} />
              </TabsContent>

              <TabsContent value="activity">
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-center text-muted-foreground py-8">
                      No recent activity to display
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="size-5" />
                  Academic Profile
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Current GWA</p>
                  <p className="text-2xl font-semibold font-mono">
                    {localUser?.gwa || localUser?.gpa 
                      ? (localUser.gwa || localUser.gpa) + (localUser.educationLevel === "Senior High School" ? "%" : "")
                      : "Not provided"}
                  </p>
                  {(localUser?.gwa || localUser?.gpa) && (
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                      {localUser.educationLevel === "Senior High School" 
                        ? "SHS Percentage Scale (70-100)"
                        : "College GWA Scale (1.00-5.00)"}
                    </p>
                  )}
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground">Education Level</p>
                  <p className="font-semibold">{localUser?.educationLevel ? titleCase(localUser.educationLevel) : "Not provided"}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground">Field of Study</p>
                  <p className="font-semibold">{localUser?.fieldOfStudy || "Not provided"}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground">Graduation Year</p>
                  <p className="font-semibold">{localUser?.graduationYear || "Not provided"}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="size-5" />
                  Scholarship Eligibility
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {eligibilityBadges.length > 0 ? (
                    eligibilityBadges.map((badge) => (
                      <Badge key={badge} className="w-full justify-center bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-100 dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 dark:hover:bg-slate-700">{badge}</Badge>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Add profile details to calculate scholarship eligibility.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="size-5" />
                  Financial Profile
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-2">
                  Financial Need ({localUser?.currency || "PHP"})
                </p>
                <div className="flex items-center gap-2">
                  <Progress value={Math.min(100, Math.max(0, ((financialNeedVal ?? 0) / 5) * 100))} className="flex-1 h-2" />
                  <span className="text-sm font-semibold">{financialNeedVal ?? "N/A"}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Net Worth: {localUser?.netWorth || "Not provided"} | Income: {localUser?.incomeCategory || "Not provided"}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
