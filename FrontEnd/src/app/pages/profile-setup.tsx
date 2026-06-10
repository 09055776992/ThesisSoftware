import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Slider } from "../components/ui/slider";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Camera } from "lucide-react";
import { Checkbox } from "../components/ui/checkbox";
import { getStoredUser, saveStoredUser } from "../lib/user-storage";
import { uploadUserAvatar, resolvePublicAssetUrl, pickProfileImageUrl } from "../lib/api-client";

// Reusable component for required field label
function RequiredLabel({ children, optional = false }: { children: string; optional?: boolean }) {
  return (
    <Label>
      <span>{children}</span>
      {optional ? (
        <span className="text-muted-foreground ml-1">(Optional)</span>
      ) : (
        <span className="text-red-500 ml-1">*</span>
      )}
    </Label>
  );
}

// Year level options based on education level
const yearLevelOptions: Record<string, string[]> = {
  "junior-high": ["Grade 7", "Grade 8", "Grade 9", "Grade 10"],
  "senior-high": ["Grade 11", "Grade 12"],
  "college": ["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year"],
  "vocational": ["1st Year", "2nd Year", "3rd Year", "4th Year"],
  "postgraduate": ["1st Year", "2nd Year", "3rd Year", "Completion"],
};

/** Profile setup stores slugs; eligibility + DB expect human-readable labels */
const EDUCATION_LEVEL_SLUG_TO_LABEL: Record<string, string> = {
  "junior-high": "Junior High School",
  "senior-high": "Senior High School",
  "college": "College / Undergraduate",
  vocational: "Vocational / TESDA",
  postgraduate: "Postgraduate (Masters / Doctorate)",
};

const SCHOOL_LOCATION_SLUG_TO_LABEL: Record<string, string> = {
  "quezon-city": "Quezon City",
  "outside-qc": "Outside Quezon City (Metro Manila)",
  "outside-mm": "Outside Metro Manila",
};

const INCOME_SLUG_TO_LABEL: Record<string, string> = {
  "under-25000": "Under ₱25,000",
  "25000-50000": "₱25,000 – ₱50,000",
  "50000-100000": "₱50,000 – ₱100,000",
  "100000+": "₱100,000+",
};

export function ProfileSetup() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const storedUser = getStoredUser();
  const [profileImage, setProfileImage] = useState<string>(
    () => pickProfileImageUrl(storedUser as Record<string, unknown>) || "",
  );
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    // Step 1
    profilePicture: "",
    bio: storedUser?.headline ?? "",
    location: storedUser?.location ?? "",
    dateOfBirth: storedUser?.dateOfBirth ?? "",

    // Step 2
    gpa: storedUser?.gpa ?? "",
    educationLevel: storedUser?.educationLevel ?? "",
    yearLevel: storedUser?.yearLevel ?? "",
    schoolName: storedUser?.schoolName ?? "",
    schoolCampus: storedUser?.schoolCampus ?? "",
    schoolType: storedUser?.schoolType ?? "",
    schoolLocation: storedUser?.schoolLocation ?? "",
    fieldOfStudy: storedUser?.fieldOfStudy ?? "",
    graduationYear: storedUser?.graduationYear ?? "",

    // Step 3
    isAthlete: storedUser?.isAthlete ?? false,
    isArtist: storedUser?.isArtist ?? false,
    isSKOfficial: storedUser?.isSKOfficial ?? false,
    isStudentCouncilLeader: storedUser?.isStudentLeader ?? false,
    isFromIndigenousFamily: storedUser?.isIndigent ?? false,
    isPersonWithDisability: storedUser?.isPWD ?? false,
    isSoloParent: storedUser?.isSoloParent ?? false,
    financialNeed: storedUser?.financialNeed?.[0] ?? 3,
    netWorth: storedUser?.netWorth ?? "",
    currency: storedUser?.currency ?? "PHP",
    incomeCategory: storedUser?.incomeCategory ?? "",
  });

  const totalSteps = 3;
  const progress = (currentStep / totalSteps) * 100;

  // Validation functions
  const validateStep1 = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.location.trim()) {
      newErrors.location = "This field is required";
    }
    if (!formData.dateOfBirth) {
      newErrors.dateOfBirth = "This field is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.gpa) {
      newErrors.gpa = "This field is required";
    } else {
      const gpaNum = parseFloat(formData.gpa);
      if (isNaN(gpaNum) || gpaNum < 1.0 || gpaNum > 5.0) {
        newErrors.gpa = "GPA must be between 1.00 and 5.00";
      }
    }

    if (!formData.educationLevel) {
      newErrors.educationLevel = "This field is required";
    }

    if (!formData.yearLevel) {
      newErrors.yearLevel = "This field is required";
    }

    if (!formData.schoolName.trim()) {
      newErrors.schoolName = "This field is required";
    }

    if (!formData.schoolType) {
      newErrors.schoolType = "This field is required";
    }

    if (!formData.schoolLocation) {
      newErrors.schoolLocation = "This field is required";
    }

    if (!formData.fieldOfStudy.trim()) {
      newErrors.fieldOfStudy = "This field is required";
    }

    if (!formData.graduationYear) {
      newErrors.graduationYear = "This field is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep3 = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.financialNeed) {
      newErrors.financialNeed = "This field is required";
    }

    if (!formData.incomeCategory) {
      newErrors.incomeCategory = "This field is required";
    }

    if (!formData.currency) {
      newErrors.currency = "This field is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = async () => {
    // Validate current step
    let isValid = false;
    if (currentStep === 1) {
      isValid = validateStep1();
    } else if (currentStep === 2) {
      isValid = validateStep2();
    } else if (currentStep === 3) {
      isValid = validateStep3();
    }

    if (!isValid) {
      return;
    }

    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
      setErrors({});
    } else {
      // Save to MongoDB
      await saveToDatabase();
    }
  };

  const saveToDatabase = async () => {
    setIsLoading(true);
    try {
      const active = getStoredUser();
      const userEmail = active?.email?.trim();
      if (!userEmail) {
        setErrors({ submit: "You must be signed in to save your profile. Please log in again." });
        setIsLoading(false);
        return;
      }

      const educationLevelLabel =
        EDUCATION_LEVEL_SLUG_TO_LABEL[formData.educationLevel] || formData.educationLevel;
      const schoolLocationLabel =
        SCHOOL_LOCATION_SLUG_TO_LABEL[formData.schoolLocation] || formData.schoolLocation;
      const incomeCategoryLabel =
        INCOME_SLUG_TO_LABEL[formData.incomeCategory] || formData.incomeCategory;

      const profileData = {
        email: userEmail,
        // Step 1
        bio: formData.bio,
        location: formData.location,
        dateOfBirth: formData.dateOfBirth,

        // Step 2
        gpa: formData.gpa,
        educationLevel: educationLevelLabel,
        yearLevel: formData.yearLevel,
        schoolName: formData.schoolName,
        schoolCampus: formData.schoolCampus,
        schoolType: formData.schoolType,
        schoolLocation: schoolLocationLabel,
        fieldOfStudy: formData.fieldOfStudy,
        graduationYear: formData.graduationYear,

        // Step 3 — flat fields expected by PUT /api/users/profile
        financialNeed: [formData.financialNeed],
        netWorth: formData.netWorth,
        currency: formData.currency,
        incomeCategory: incomeCategoryLabel,
        isAthlete: formData.isAthlete,
        isArtist: formData.isArtist,
        isSKOfficial: formData.isSKOfficial,
        isStudentLeader: formData.isStudentCouncilLeader,
        isIndigent: formData.isFromIndigenousFamily,
        isPWD: formData.isPersonWithDisability,
        isSoloParent: formData.isSoloParent,
      };

      // Save to local storage for immediate access
      saveStoredUser({
        headline: formData.bio,
        location: formData.location,
        dateOfBirth: formData.dateOfBirth,
        gpa: formData.gpa,
        educationLevel: educationLevelLabel,
        yearLevel: formData.yearLevel,
        fieldOfStudy: formData.fieldOfStudy,
        graduationYear: formData.graduationYear,
        netWorth: formData.netWorth,
        currency: formData.currency,
        incomeCategory: incomeCategoryLabel,
        financialNeed: [formData.financialNeed],
        profileImage,
        profilePicture: profileImage,
        schoolName: formData.schoolName,
        schoolCampus: formData.schoolCampus,
        schoolType: formData.schoolType,
        schoolLocation: schoolLocationLabel,
        isAthlete: formData.isAthlete,
        isArtist: formData.isArtist,
        isSKOfficial: formData.isSKOfficial,
        isStudentLeader: formData.isStudentCouncilLeader,
        isIndigent: formData.isFromIndigenousFamily,
        isPWD: formData.isPersonWithDisability,
        isSoloParent: formData.isSoloParent,
      });

      // Save to MongoDB (if backend endpoint available)
      try {
        const token = localStorage.getItem("token");
        const response = await fetch("/api/users/profile", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify(profileData),
        });

        if (!response.ok) {
          throw new Error("Failed to save profile to server");
        }
      } catch (error) {
        console.log("Note: Profile data saved locally. Backend sync optional.", error);
      }

      navigate("/dashboard");
    } catch (error) {
      console.error("Error saving profile:", error);
      setErrors({ submit: "Failed to save profile. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setErrors({});
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const userEmail = getStoredUser()?.email?.trim().toLowerCase();
    if (!userEmail) {
      setErrors({ photo: "Sign in again before uploading a profile picture." });
      return;
    }

    setIsLoading(true);
    try {
      const avatarUrl = await uploadUserAvatar(file, userEmail);
      setProfileImage(avatarUrl);
      saveStoredUser({
        email: userEmail,
        profileImage: avatarUrl,
        profilePicture: avatarUrl,
      });
    } catch (error) {
      console.error("Avatar upload failed:", error);
      setErrors({
        photo: error instanceof Error ? error.message : "Failed to upload profile picture.",
      });
    } finally {
      setIsLoading(false);
      e.target.value = "";
    }
  };

  const handleEducationLevelChange = (value: string) => {
    setFormData({ ...formData, educationLevel: value, yearLevel: "" });
  };

  const handleCheckboxChange = (field: keyof typeof formData, value: boolean) => {
    if (typeof formData[field] === "boolean") {
      setFormData({ ...formData, [field]: value });
    }
  };

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <CardTitle>Complete Your Profile</CardTitle>
                <span className="text-sm text-muted-foreground">
                  Step {currentStep} of {totalSteps}
                </span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
            <CardDescription>
              {currentStep === 1 && "Tell us about yourself"}
              {currentStep === 2 && "Share your academic and school information"}
              {currentStep === 3 && "Tell us about your special categories and financial situation"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {errors.submit && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                {errors.submit}
              </div>
            )}

            {/* Step 1: Personal Information */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="flex flex-col items-center">
                  <div className="relative">
                    <Avatar className="size-32">
                      <AvatarImage
                        key={profileImage}
                        src={resolvePublicAssetUrl(profileImage, true)}
                      />
                      <AvatarFallback className="bg-muted">
                        <Camera className="size-12 text-muted-foreground" />
                      </AvatarFallback>
                    </Avatar>
                    <label
                      htmlFor="photo-upload"
                      className="absolute bottom-0 right-0 bg-primary text-primary-foreground p-2 rounded-full cursor-pointer hover:bg-primary/90"
                    >
                      <Camera className="size-4" />
                    </label>
                    <input
                      id="photo-upload"
                      type="file"
                      accept="image/jpeg,image/png"
                      className="hidden"
                      onChange={handleFileChange}
                      aria-label="Upload profile photo"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    JPG or PNG, max 5MB
                  </p>
                  <Button type="button" variant="link" size="sm">
                    Skip for now
                  </Button>
                </div>

                <div className="space-y-2">
                  <RequiredLabel optional>Headline / Bio</RequiredLabel>
                  <Textarea
                    id="headline"
                    placeholder="e.g., Computer Science student passionate about AI and machine learning"
                    maxLength={280}
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {formData.bio.length}/280
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <RequiredLabel>Location</RequiredLabel>
                    <Input
                      id="location"
                      placeholder="City, Country"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    />
                    {errors.location && (
                      <p className="text-sm text-red-500">{errors.location}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <RequiredLabel>Date of Birth</RequiredLabel>
                    <Input
                      id="dob"
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                    />
                    {errors.dateOfBirth && (
                      <p className="text-sm text-red-500">{errors.dateOfBirth}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Academic & School Information */}
            {currentStep === 2 && (
              <div className="space-y-8">
                {/* Section: Academic Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Academic Information</h3>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <RequiredLabel>GPA</RequiredLabel>
                      <Input
                        id="gpa"
                        type="number"
                        step="0.01"
                        min="1.00"
                        max="5.00"
                        placeholder="e.g., 3.75"
                        value={formData.gpa}
                        onChange={(e) => setFormData({ ...formData, gpa: e.target.value })}
                        className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md bg-white text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-0 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] transition-all"
                      />
                      {errors.gpa && (
                        <p className="text-sm text-red-500">{errors.gpa}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Philippine GPA scale: 1.00 = Highest (Excellent), 3.00 = Minimum Passing, 5.00 = Failing.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <RequiredLabel>Education Level</RequiredLabel>
                      <Select
                        value={formData.educationLevel}
                        onValueChange={handleEducationLevelChange}
                      >
                        <SelectTrigger id="educationLevel" className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md bg-white text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-0 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] transition-all">
                          <SelectValue placeholder="Select level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="junior-high">Junior High School (Grade 7–10)</SelectItem>
                          <SelectItem value="senior-high">Senior High School (Grade 11–12)</SelectItem>
                          <SelectItem value="college">College / Undergraduate</SelectItem>
                          <SelectItem value="vocational">Vocational / TESDA</SelectItem>
                          <SelectItem value="postgraduate">Postgraduate (Masters / Doctorate)</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.educationLevel && (
                        <p className="text-sm text-red-500">{errors.educationLevel}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <RequiredLabel>Year Level</RequiredLabel>
                    <Select
                      value={formData.yearLevel}
                      onValueChange={(value) => setFormData({ ...formData, yearLevel: value })}
                      disabled={!formData.educationLevel}
                    >
                      <SelectTrigger id="yearLevel" className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md bg-white text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed focus:border-blue-500 focus:outline-none focus:ring-0 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] transition-all">
                        <SelectValue placeholder={formData.educationLevel ? "Select year level" : "Select education level first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {formData.educationLevel &&
                          yearLevelOptions[formData.educationLevel]?.map((level) => (
                            <SelectItem key={level} value={level}>
                              {level}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {errors.yearLevel && (
                      <p className="text-sm text-red-500">{errors.yearLevel}</p>
                    )}
                  </div>
                </div>

                {/* Section: School / Institution Information */}
                <div className="space-y-4 border-t pt-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">School / Institution Information</h3>
                    <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-1 rounded">
                      REQUIRED FOR ELIGIBILITY
                    </span>
                  </div>

                  <div className="space-y-2">
                    <RequiredLabel>School / Institution Name</RequiredLabel>
                    <Input
                      id="schoolName"
                      placeholder="e.g. Our Lady of Fatima University"
                      value={formData.schoolName}
                      onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
                    />
                    {errors.schoolName && (
                      <p className="text-sm text-red-500">{errors.schoolName}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Enter the full name of your current school
                    </p>
                  </div>

                  <div className="space-y-2">
                    <RequiredLabel optional>Campus / Branch</RequiredLabel>
                    <Input
                      id="schoolCampus"
                      placeholder="e.g. Diliman, Main Campus"
                      value={formData.schoolCampus}
                      onChange={(e) => setFormData({ ...formData, schoolCampus: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <RequiredLabel>School Type</RequiredLabel>
                    <Select
                      value={formData.schoolType}
                      onValueChange={(value) => setFormData({ ...formData, schoolType: value })}
                    >
                      <SelectTrigger id="schoolType" className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md bg-white text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-0 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] transition-all">
                        <SelectValue placeholder="Select school type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public-university">Public University / State University (SUC)</SelectItem>
                        <SelectItem value="private-university">Private University / College</SelectItem>
                        <SelectItem value="public-senior-high">Public Senior High School</SelectItem>
                        <SelectItem value="private-senior-high">Private Senior High School</SelectItem>
                        <SelectItem value="public-junior-high">Public Junior High School</SelectItem>
                        <SelectItem value="private-junior-high">Private Junior High School</SelectItem>
                        <SelectItem value="tesda">TESDA-accredited Institution</SelectItem>
                        <SelectItem value="vocational">Vocational School</SelectItem>
                        <SelectItem value="graduate-school">Graduate School</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.schoolType && (
                      <p className="text-sm text-red-500">{errors.schoolType}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <RequiredLabel>School Location</RequiredLabel>
                    <Select
                      value={formData.schoolLocation}
                      onValueChange={(value) => setFormData({ ...formData, schoolLocation: value })}
                    >
                      <SelectTrigger id="schoolLocation">
                        <SelectValue placeholder="Select school location" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="quezon-city">Quezon City ✓ (Auto-verified)</SelectItem>
                        <SelectItem value="outside-qc">Outside Quezon City (Metro Manila)</SelectItem>
                        <SelectItem value="outside-mm">Outside Metro Manila</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.schoolLocation && (
                      <p className="text-sm text-red-500">{errors.schoolLocation}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Schools in Quezon City are auto-verified for QC scholarships
                    </p>
                  </div>

                  <div className="space-y-2">
                    <RequiredLabel>Field of Study</RequiredLabel>
                    <Input
                      id="fieldOfStudy"
                      placeholder="e.g., Computer Science"
                      value={formData.fieldOfStudy}
                      onChange={(e) => setFormData({ ...formData, fieldOfStudy: e.target.value })}
                    />
                    {errors.fieldOfStudy && (
                      <p className="text-sm text-red-500">{errors.fieldOfStudy}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <RequiredLabel>Expected Graduation Year</RequiredLabel>
                    <Input
                      id="graduationYear"
                      type="number"
                      placeholder="e.g., 2027"
                      min="2024"
                      max="2050"
                      value={formData.graduationYear}
                      onChange={(e) => setFormData({ ...formData, graduationYear: e.target.value })}
                    />
                    {errors.graduationYear && (
                      <p className="text-sm text-red-500">{errors.graduationYear}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Special Categories & Financial Information */}
            {currentStep === 3 && (
              <div className="space-y-8">
                {/* Section: Scholarship Eligibility */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">Scholarship Eligibility — Special Categories</h3>
                    <span className="bg-purple-100 text-purple-700 text-xs font-semibold px-2 py-1 rounded">
                      SCHOLARSHIP ELIGIBILITY
                    </span>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    These categories are required for specific scholarships (Athletic, Arts, Youth Leadership, etc.)
                  </p>

                  <div className="grid grid-cols-2 gap-6">
                    {/* Left Column */}
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="athlete"
                          checked={formData.isAthlete}
                          onCheckedChange={(checked) => handleCheckboxChange("isAthlete", checked as boolean)}
                        />
                        <Label htmlFor="athlete" className="cursor-pointer">
                          Athlete (for Athletic Scholarships)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="skOfficial"
                          checked={formData.isSKOfficial}
                          onCheckedChange={(checked) => handleCheckboxChange("isSKOfficial", checked as boolean)}
                        />
                        <Label htmlFor="skOfficial" className="cursor-pointer">
                          SK Official / Youth Leader
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="indigent"
                          checked={formData.isFromIndigenousFamily}
                          onCheckedChange={(checked) => handleCheckboxChange("isFromIndigenousFamily", checked as boolean)}
                        />
                        <Label htmlFor="indigent" className="cursor-pointer">
                          From Indigent / Low-income Family
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="soloParent"
                          checked={formData.isSoloParent}
                          onCheckedChange={(checked) => handleCheckboxChange("isSoloParent", checked as boolean)}
                        />
                        <Label htmlFor="soloParent" className="cursor-pointer">
                          Solo Parent
                        </Label>
                      </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="artist"
                          checked={formData.isArtist}
                          onCheckedChange={(checked) => handleCheckboxChange("isArtist", checked as boolean)}
                        />
                        <Label htmlFor="artist" className="cursor-pointer">
                          Artist (for Arts & Culture Scholarships)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="studentCouncil"
                          checked={formData.isStudentCouncilLeader}
                          onCheckedChange={(checked) => handleCheckboxChange("isStudentCouncilLeader", checked as boolean)}
                        />
                        <Label htmlFor="studentCouncil" className="cursor-pointer">
                          Student Council / Government Leader
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="pwd"
                          checked={formData.isPersonWithDisability}
                          onCheckedChange={(checked) => handleCheckboxChange("isPersonWithDisability", checked as boolean)}
                        />
                        <Label htmlFor="pwd" className="cursor-pointer">
                          Person with Disability (PWD)
                        </Label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section: Financial Information */}
                <div className="space-y-4 border-t pt-4">
                  <h3 className="text-lg font-semibold">Financial Information</h3>

                  <div className="space-y-2">
                    <RequiredLabel>Financial Need (1–5)</RequiredLabel>
                    <div className="space-y-3 p-4 bg-muted/50 rounded">
                      <Slider
                        value={[formData.financialNeed]}
                        onValueChange={(value) => setFormData({ ...formData, financialNeed: value[0] })}
                        max={5}
                        min={1}
                        step={1}
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Low Need</span>
                        <span>Moderate</span>
                        <span>High Need</span>
                      </div>
                      <div className="text-center text-sm font-semibold">
                        Current: {formData.financialNeed}
                      </div>
                    </div>
                    {errors.financialNeed && (
                      <p className="text-sm text-red-500">{errors.financialNeed}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <RequiredLabel optional>Net Worth</RequiredLabel>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-muted-foreground">₱</span>
                      <Input
                        id="netWorth"
                        type="number"
                        placeholder="0"
                        className="pl-7"
                        value={formData.netWorth}
                        onChange={(e) => setFormData({ ...formData, netWorth: e.target.value })}
                      />
                    </div>
                    {formData.netWorth && (
                      <p className="text-xs text-muted-foreground">
                        Current value: ₱{parseInt(formData.netWorth).toLocaleString()}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <RequiredLabel>Currency</RequiredLabel>
                    <Select
                      value={formData.currency}
                      onValueChange={(value) => setFormData({ ...formData, currency: value })}
                    >
                      <SelectTrigger id="currency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PHP">PHP (₱)</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.currency && (
                      <p className="text-sm text-red-500">{errors.currency}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <RequiredLabel>Income Category</RequiredLabel>
                    <Select
                      value={formData.incomeCategory}
                      onValueChange={(value) => setFormData({ ...formData, incomeCategory: value })}
                    >
                      <SelectTrigger id="incomeCategory">
                        <SelectValue placeholder="Select income category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="under-25000">Under ₱25,000</SelectItem>
                        <SelectItem value="25000-50000">₱25,000 – ₱50,000</SelectItem>
                        <SelectItem value="50000-100000">₱50,000 – ₱100,000</SelectItem>
                        <SelectItem value="100000+">₱100,000+</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.incomeCategory && (
                      <p className="text-sm text-red-500">{errors.incomeCategory}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between mt-8 pt-6 border-t">
              {currentStep > 1 ? (
                <Button type="button" variant="outline" onClick={handleBack}>
                  Back
                </Button>
              ) : (
                <Button type="button" variant="ghost" onClick={() => navigate("/dashboard")}>
                  Skip Setup
                </Button>
              )}
              <Button type="button" onClick={handleNext} disabled={isLoading}>
                {isLoading ? "Saving..." : currentStep === totalSteps ? "Complete Profile" : "Next"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
