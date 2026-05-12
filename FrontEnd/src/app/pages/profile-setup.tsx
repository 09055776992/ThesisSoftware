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
import { Camera, Upload } from "lucide-react";
import { getStoredUser, saveStoredUser } from "../lib/user-storage";

export function ProfileSetup() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const storedUser = getStoredUser();
  const [profileImage, setProfileImage] = useState<string>("");
  
  const [formData, setFormData] = useState({
    // Step 1
    profilePhoto: "",
    headline: storedUser?.headline ?? "",
    location: storedUser?.location ?? "",
    dateOfBirth: storedUser?.dateOfBirth ?? "",
    
    // Step 2
    gpa: storedUser?.gpa ?? "",
    gpaScale: storedUser?.gpaScale ?? "4.0",
    educationLevel: storedUser?.educationLevel ?? "",
    fieldOfStudy: storedUser?.fieldOfStudy ?? "",
    graduationYear: storedUser?.graduationYear ?? "",
    
    // Step 3
    netWorth: storedUser?.netWorth ?? "",
    currency: storedUser?.currency ?? "PHP",
    incomeCategory: storedUser?.incomeCategory ?? "0-25000",
    financialNeed: storedUser?.financialNeed ?? [3],
  });

  const totalSteps = 3;
  const progress = (currentStep / totalSteps) * 100;

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    } else {
      saveStoredUser({
        headline: formData.headline,
        location: formData.location,
        dateOfBirth: formData.dateOfBirth,
        gpa: formData.gpa,
        gpaScale: formData.gpaScale,
        educationLevel: formData.educationLevel,
        fieldOfStudy: formData.fieldOfStudy,
        graduationYear: formData.graduationYear,
        netWorth: formData.netWorth,
        currency: formData.currency,
        incomeCategory: formData.incomeCategory,
        financialNeed: formData.financialNeed,
        profileImage,
      });
      navigate("/dashboard");
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImage(reader.result as string);
      };
      reader.readAsDataURL(file);
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
              {currentStep === 2 && "Share your academic background"}
              {currentStep === 3 && "Financial information (optional but helps with matching)"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Step 1: Personal Information */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="flex flex-col items-center">
                  <div className="relative">
                    <Avatar className="h-32 w-32">
                      <AvatarImage src={profileImage} />
                      <AvatarFallback className="bg-muted">
                        <Camera className="h-12 w-12 text-muted-foreground" />
                      </AvatarFallback>
                    </Avatar>
                    <label
                      htmlFor="photo-upload"
                      className="absolute bottom-0 right-0 bg-primary text-primary-foreground p-2 rounded-full cursor-pointer hover:bg-primary/90"
                    >
                      <Camera className="h-4 w-4" />
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
                  <Label htmlFor="headline">Headline / Bio</Label>
                  <Textarea
                    id="headline"
                    placeholder="e.g., Computer Science student passionate about AI and machine learning"
                    maxLength={280}
                    value={formData.headline}
                    onChange={(e) => setFormData({ ...formData, headline: e.target.value })}
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {formData.headline.length}/280
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      placeholder="City, Country"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dob">Date of Birth</Label>
                    <Input
                      id="dob"
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Academic Performance */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="gpa">GPA</Label>
                    <Input
                      id="gpa"
                      type="number"
                      step="0.01"
                      placeholder="3.75"
                      value={formData.gpa}
                      onChange={(e) => setFormData({ ...formData, gpa: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gpaScale">GPA Scale</Label>
                    <Select
                      value={formData.gpaScale}
                      onValueChange={(value) => setFormData({ ...formData, gpaScale: value })}
                    >
                      <SelectTrigger id="gpaScale">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="4.0">4.0 Scale</SelectItem>
                        <SelectItem value="5.0">5.0 Scale</SelectItem>
                        <SelectItem value="10.0">10.0 Scale</SelectItem>
                        <SelectItem value="100">100% Scale</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="educationLevel">Current Education Level</Label>
                  <Select
                    value={formData.educationLevel}
                    onValueChange={(value) => setFormData({ ...formData, educationLevel: value })}
                  >
                    <SelectTrigger id="educationLevel">
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high-school">High School</SelectItem>
                      <SelectItem value="associate">Associate Degree</SelectItem>
                      <SelectItem value="bachelor">Bachelor's Degree</SelectItem>
                      <SelectItem value="master">Master's Degree</SelectItem>
                      <SelectItem value="doctoral">Doctoral Degree</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fieldOfStudy">Field of Study</Label>
                  <Input
                    id="fieldOfStudy"
                    placeholder="e.g., Computer Science"
                    value={formData.fieldOfStudy}
                    onChange={(e) => setFormData({ ...formData, fieldOfStudy: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="graduationYear">Expected Graduation Year</Label>
                  <Input
                    id="graduationYear"
                    type="number"
                    placeholder="2026"
                    value={formData.graduationYear}
                    onChange={(e) => setFormData({ ...formData, graduationYear: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Academic Documents</Label>
                  <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                    <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-sm text-muted-foreground mb-2">
                      Upload transcripts, certificates, or other documents
                    </p>
                    <p className="text-xs text-muted-foreground mb-4">PDF or DOCX, max 10MB each</p>
                    <Button type="button" variant="outline" size="sm">
                      Choose Files
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Financial Information */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    This information is optional but helps us match you with the most relevant scholarships.
                    Your data is kept private and secure.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-1">
                    <Label htmlFor="currency">Currency</Label>
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
                  </div>

                  <div className="space-y-2 col-span-1">
                    <Label htmlFor="netWorth">Net Worth (Optional)</Label>
                    <Input
                      id="netWorth"
                      type="number"
                      placeholder="50000"
                      value={formData.netWorth}
                      onChange={(e) => setFormData({ ...formData, netWorth: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="incomeCategory">Family Income Bracket</Label>
                  <Select
                    value={formData.incomeCategory}
                    onValueChange={(value) => setFormData({ ...formData, incomeCategory: value })}
                  >
                    <SelectTrigger id="incomeCategory">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0-25000">Under ₱25,000</SelectItem>
                      <SelectItem value="25000-50000">₱25,000 - ₱50,000</SelectItem>
                      <SelectItem value="50000-75000">₱50,000 - ₱75,000</SelectItem>
                      <SelectItem value="75000-100000">₱75,000 - ₱100,000</SelectItem>
                      <SelectItem value="100000+">₱100,000+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-4">
                  <Label>Financial Need Indicator</Label>
                  <div className="px-2">
                    <Slider
                      value={formData.financialNeed}
                      onValueChange={(value) => setFormData({ ...formData, financialNeed: value })}
                      max={5}
                      min={1}
                      step={1}
                      className="mb-2"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Low Need</span>
                      <span>Moderate</span>
                      <span>High Need</span>
                    </div>
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
                <Button type="button" variant="ghost" onClick={() => navigate("/")}>
                  Skip Setup
                </Button>
              )}
              <Button type="button" onClick={handleNext}>
                {currentStep === totalSteps ? "Complete Profile" : "Next"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
