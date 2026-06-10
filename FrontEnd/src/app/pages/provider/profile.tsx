import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Separator } from "../../components/ui/separator";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  Globe,
  Pencil,
  Save,
  X,
  Upload,
  Loader2,
  Camera,
  Users,
  Award,
} from "lucide-react";
import {
  fetchProviderProfile,
  updateProviderProfile,
  uploadProviderLogo,
  resolvePublicAssetUrl,
  type ProviderProfile,
} from "../../lib/api-client";
import { getStoredUser, saveStoredUser, getInitials } from "../../lib/user-storage";
import { toast } from "sonner";

export function ProviderProfilePage() {
  const [profile, setProfile] = useState<ProviderProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [formData, setFormData] = useState<Partial<ProviderProfile>>({});

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setIsLoading(true);
      const res = await fetchProviderProfile();
      if (res.success) {
        setProfile(res.data);
        setFormData(res.data);
      }
    } catch (error) {
      console.error("Failed to load profile:", error);
      toast.error("Failed to load profile information");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setFormData(profile || {});
    setIsEditing(false);
  };

  const handleSave = async () => {
    try {
      // Basic validation
      if (!formData.name?.trim()) {
        toast.error("Contact person name is required");
        return;
      }
      if (!formData.organizationName?.trim()) {
        toast.error("Organization name is required");
        return;
      }

      setIsSaving(true);
      const res = await updateProviderProfile(formData);
      if (res.success) {
        setProfile(res.data);
        setIsEditing(false);
        toast.success("Profile updated successfully");
        
        // Update local storage user data to keep sidebar in sync
        const currentUser = getStoredUser();
        if (currentUser) {
          saveStoredUser({
            ...currentUser,
            fullName: res.data.name,
            organizationName: res.data.organizationName,
            profilePicture: res.data.profilePicture || currentUser.profilePicture,
          });
        }
      }
    } catch (error: any) {
      console.error("Failed to update profile:", error);
      toast.error(error.message || "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validation
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Only JPG, PNG, and WEBP images are allowed");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Maximum file size is 5MB");
      return;
    }

    try {
      setUploadingLogo(true);
      const avatarUrl = await uploadProviderLogo(file);
      
      setProfile((prev) => prev ? { ...prev, profilePicture: avatarUrl } : null);
      setFormData((prev) => ({ ...prev, profilePicture: avatarUrl }));
      
      // Update local storage
      const currentUser = getStoredUser();
      if (currentUser) {
        saveStoredUser({
          ...currentUser,
          profilePicture: avatarUrl,
        });
      }
      
      toast.success("Logo updated successfully");
    } catch (error: any) {
      console.error("Logo upload failed:", error);
      toast.error(error.message || "Failed to upload logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Profile not found.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      {/* Header Card */}
      <Card className="border-none shadow-sm overflow-hidden">
        <div className="h-32 bg-gradient-to-r from-blue-600 to-indigo-700" />
        <CardContent className="relative pt-0">
          <div className="flex flex-col md:flex-row items-start md:items-end gap-6 -mt-12 px-2">
            <div className="relative group">
              <Avatar className="size-32 border-4 border-white shadow-md bg-white">
                <AvatarImage src={resolvePublicAssetUrl(profile.profilePicture)} alt={profile.organizationName} className="object-cover" />
                <AvatarFallback className="bg-blue-100 text-blue-700 text-3xl font-bold">
                  {profile.organizationName?.slice(0, 2).toUpperCase() || "OP"}
                </AvatarFallback>
              </Avatar>
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingLogo}
                className="absolute inset-0 flex items-center justify-center bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
              >
                {uploadingLogo ? <Loader2 className="size-6 animate-spin" /> : <Camera className="size-6" />}
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleLogoUpload} 
                className="hidden" 
                accept="image/jpeg,image/png,image/webp"
              />
            </div>
            
            <div className="flex-1 space-y-1 mb-2">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">{profile.organizationName}</h1>
                <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">
                  Active Provider
                </Badge>
              </div>
              <p className="text-muted-foreground flex items-center gap-2">
                <Mail className="size-4" />
                {profile.email}
              </p>
            </div>

            <div className="mb-2">
              {isEditing ? (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                    <X className="size-4 mr-2" />
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Save className="size-4 mr-2" />}
                    Save Changes
                  </Button>
                </div>
              ) : (
                <Button onClick={handleEdit}>
                  <Pencil className="size-4 mr-2" />
                  Edit Profile
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column: Organization Details */}
        <div className="md:col-span-2 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="size-5 text-blue-600" />
                Organization Information
              </CardTitle>
              <CardDescription>
                Details about your institution or organization.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="orgName">Organization Name</Label>
                  {isEditing ? (
                    <Input 
                      id="orgName" 
                      value={formData.organizationName || ""} 
                      onChange={(e) => setFormData({ ...formData, organizationName: e.target.value })}
                      placeholder="e.g. Quezon City Government"
                    />
                  ) : (
                    <p className="text-gray-900 font-medium">{profile.organizationName || "Not set"}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Organization Description</Label>
                  {isEditing ? (
                    <Textarea 
                      id="description" 
                      value={formData.description || ""} 
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Tell students about your organization..."
                      className="min-h-[120px]"
                    />
                  ) : (
                    <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {profile.description || "No description provided."}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Organization Address</Label>
                  {isEditing ? (
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 size-4 text-muted-foreground" />
                      <Input 
                        id="address" 
                        className="pl-9"
                        value={formData.officeAddress || ""} 
                        onChange={(e) => setFormData({ ...formData, officeAddress: e.target.value })}
                        placeholder="Complete office address"
                      />
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 text-gray-700">
                      <MapPin className="size-4 mt-1 text-muted-foreground shrink-0" />
                      <span>{profile.officeAddress || "No address provided."}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="website">Website (Optional)</Label>
                  {isEditing ? (
                    <div className="relative">
                      <Globe className="absolute left-3 top-3 size-4 text-muted-foreground" />
                      <Input 
                        id="website" 
                        className="pl-9"
                        value={formData.website || ""} 
                        onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                        placeholder="https://example.com"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-blue-600">
                      <Globe className="size-4 text-muted-foreground" />
                      {profile.website ? (
                        <a href={profile.website} target="_blank" rel="noopener noreferrer" className="hover:underline">
                          {profile.website.replace(/^https?:\/\//, "")}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">No website set</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Contact Details */}
        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="size-5 text-blue-600" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="contactName">Contact Person</Label>
                  {isEditing ? (
                    <Input 
                      id="contactName" 
                      value={formData.name || ""} 
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Full Name"
                    />
                  ) : (
                    <p className="text-gray-900 font-medium">{profile.name || "Not set"}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactPosition">Position/Title</Label>
                  {isEditing ? (
                    <Input 
                      id="contactPosition" 
                      value={formData.position || ""} 
                      onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                      placeholder="e.g. Scholarship Coordinator"
                    />
                  ) : (
                    <p className="text-gray-700">{profile.position || "Not set"}</p>
                  )}
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <div className="flex items-center gap-2 text-gray-700">
                    <Mail className="size-4 text-muted-foreground" />
                    <span>{profile.email}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Email cannot be changed.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Contact Number</Label>
                  {isEditing ? (
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 size-4 text-muted-foreground" />
                      <Input 
                        id="phone" 
                        className="pl-9"
                        value={formData.phone || ""} 
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="09123456789"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-gray-700">
                      <Phone className="size-4 text-muted-foreground" />
                      <span>{profile.phone || "Not set"}</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-blue-50 border-blue-100">
            <CardContent className="p-4 flex items-start gap-3">
              <div className="p-2 bg-blue-100 rounded-full text-blue-600">
                <Award className="size-4" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-blue-900">Verified Organization</p>
                <p className="text-[10px] text-blue-700 leading-tight">
                  Your organization is verified by the QC Government. This build trust with scholarship applicants.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
