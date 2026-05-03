import { useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { getStoredUser, saveStoredUser } from "../lib/user-storage";
import { getInitials } from "../lib/user-storage";

export function Settings() {
  const user = getStoredUser();
  const [profileForm, setProfileForm] = useState({
    fullName: user?.fullName ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    headline: user?.headline ?? "",
    location: user?.location ?? "",
    about: user?.about ?? "",
    skills: (user?.skills ?? []).join(", "),
    gpa: user?.gpa ?? "",
    educationLevel: user?.educationLevel ?? "",
    fieldOfStudy: user?.fieldOfStudy ?? "",
    graduationYear: user?.graduationYear ?? "",
    netWorth: user?.netWorth ?? "",
    currency: user?.currency ?? "USD",
    incomeCategory: user?.incomeCategory ?? "",
    financialNeed: String(user?.financialNeed?.[0] ?? 3),
  });
  const [isSaved, setIsSaved] = useState(false);
  const [profileImage, setProfileImage] = useState(user?.profileImage ?? "");

  const handleProfileImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setProfileImage(String(reader.result ?? ""));
    };
    reader.readAsDataURL(file);
  };

  const handleProfileSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveStoredUser({
      fullName: profileForm.fullName.trim(),
      email: profileForm.email.trim().toLowerCase(),
      phone: profileForm.phone.trim(),
      headline: profileForm.headline.trim(),
      location: profileForm.location.trim(),
      about: profileForm.about.trim(),
      skills: profileForm.skills
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      gpa: profileForm.gpa.trim(),
      educationLevel: profileForm.educationLevel.trim(),
      fieldOfStudy: profileForm.fieldOfStudy.trim(),
      graduationYear: profileForm.graduationYear.trim(),
      netWorth: profileForm.netWorth.trim(),
      currency: profileForm.currency.trim(),
      incomeCategory: profileForm.incomeCategory.trim(),
      financialNeed: [Number(profileForm.financialNeed) || 3],
      profileImage,
    });
    setIsSaved(true);
    window.setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
        <p className="text-gray-600 mb-8">Manage your account preferences</p>
        
        <div className="grid gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Edit Profile</h2>
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
                    value={profileForm.fullName}
                    onChange={(e) =>
                      setProfileForm((prev) => ({ ...prev, fullName: e.target.value }))
                    }
                    placeholder="Your full name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profileForm.email}
                    onChange={(e) =>
                      setProfileForm((prev) => ({ ...prev, email: e.target.value }))
                    }
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
                    value={profileForm.phone}
                    onChange={(e) =>
                      setProfileForm((prev) => ({ ...prev, phone: e.target.value }))
                    }
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={profileForm.location}
                    onChange={(e) =>
                      setProfileForm((prev) => ({ ...prev, location: e.target.value }))
                    }
                    placeholder="City, Country"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="headline">Headline</Label>
                <Textarea
                  id="headline"
                  value={profileForm.headline}
                  onChange={(e) =>
                    setProfileForm((prev) => ({ ...prev, headline: e.target.value }))
                  }
                  placeholder="A short profile summary"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="about">About</Label>
                <Textarea
                  id="about"
                  value={profileForm.about}
                  onChange={(e) =>
                    setProfileForm((prev) => ({ ...prev, about: e.target.value }))
                  }
                  placeholder="Tell others about your background and goals"
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="skills">Skills (comma-separated)</Label>
                <Input
                  id="skills"
                  value={profileForm.skills}
                  onChange={(e) =>
                    setProfileForm((prev) => ({ ...prev, skills: e.target.value }))
                  }
                  placeholder="Python, Data Analysis, Machine Learning"
                />
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h3 className="font-medium text-gray-900 mb-3">Academic Profile</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="gpa">GPA</Label>
                    <Input
                      id="gpa"
                      type="number"
                      step="0.01"
                      value={profileForm.gpa}
                      onChange={(e) =>
                        setProfileForm((prev) => ({ ...prev, gpa: e.target.value }))
                      }
                      placeholder="3.85"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="educationLevel">Education Level</Label>
                    <Input
                      id="educationLevel"
                      value={profileForm.educationLevel}
                      onChange={(e) =>
                        setProfileForm((prev) => ({ ...prev, educationLevel: e.target.value }))
                      }
                      placeholder="Bachelor's Degree"
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="fieldOfStudy">Field of Study</Label>
                    <Input
                      id="fieldOfStudy"
                      value={profileForm.fieldOfStudy}
                      onChange={(e) =>
                        setProfileForm((prev) => ({ ...prev, fieldOfStudy: e.target.value }))
                      }
                      placeholder="Computer Science"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="graduationYear">Graduation Year</Label>
                    <Input
                      id="graduationYear"
                      value={profileForm.graduationYear}
                      onChange={(e) =>
                        setProfileForm((prev) => ({ ...prev, graduationYear: e.target.value }))
                      }
                      placeholder="2026"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h3 className="font-medium text-gray-900 mb-3">Financial Profile</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="netWorth">Net Worth</Label>
                    <Input
                      id="netWorth"
                      type="number"
                      value={profileForm.netWorth}
                      onChange={(e) =>
                        setProfileForm((prev) => ({ ...prev, netWorth: e.target.value }))
                      }
                      placeholder="50000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Input
                      id="currency"
                      value={profileForm.currency}
                      onChange={(e) =>
                        setProfileForm((prev) => ({ ...prev, currency: e.target.value }))
                      }
                      placeholder="USD"
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="incomeCategory">Income Category</Label>
                    <Input
                      id="incomeCategory"
                      value={profileForm.incomeCategory}
                      onChange={(e) =>
                        setProfileForm((prev) => ({ ...prev, incomeCategory: e.target.value }))
                      }
                      placeholder="25000-50000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="financialNeed">Financial Need (1-5)</Label>
                    <Input
                      id="financialNeed"
                      type="number"
                      min="1"
                      max="5"
                      value={profileForm.financialNeed}
                      onChange={(e) =>
                        setProfileForm((prev) => ({ ...prev, financialNeed: e.target.value }))
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button type="submit">Save Profile</Button>
                {isSaved && <p className="text-sm text-green-600">Profile updated</p>}
              </div>
            </form>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Settings</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-gray-200">
                <div>
                  <p className="font-medium text-gray-900">Email Notifications</p>
                  <p className="text-sm text-gray-600">Receive updates about scholarships</p>
                </div>
                <button className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg">
                  Configure
                </button>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-gray-200">
                <div>
                  <p className="font-medium text-gray-900">Privacy Settings</p>
                  <p className="text-sm text-gray-600">Control who can view your profile</p>
                </div>
                <button className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg">
                  Manage
                </button>
              </div>
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium text-gray-900">Password</p>
                  <p className="text-sm text-gray-600">Change your password</p>
                </div>
                <button className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg">
                  Update
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Preferences</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-gray-200">
                <div>
                  <p className="font-medium text-gray-900">Language</p>
                  <p className="text-sm text-gray-600">English</p>
                </div>
                <button className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg">
                  Change
                </button>
              </div>
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium text-gray-900">Theme</p>
                  <p className="text-sm text-gray-600">Light mode</p>
                </div>
                <button className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg">
                  Change
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
