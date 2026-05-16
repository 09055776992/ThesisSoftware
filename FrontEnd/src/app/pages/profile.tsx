import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import { Progress } from "../components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { MapPin, Mail, Calendar, Award, BookOpen, DollarSign } from "lucide-react";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { getDisplayName, getInitials, getStoredUser } from "../lib/user-storage";
import { resolvePublicAssetUrl, pickProfileImageUrl } from "../lib/api-client";
import { useNavigate } from "react-router";

function titleCase(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((segment) => segment[0].toUpperCase() + segment.slice(1))
    .join(" ");
}

export function Profile() {
  const navigate = useNavigate();
  const user = getStoredUser();
  const educationSummary =
    user?.educationLevel || user?.fieldOfStudy || user?.graduationYear || user?.gpa || user?.schoolName
      ? [
          {
            institution: user?.schoolName 
              ? `${user.schoolName}${user?.schoolCampus ? ` (${user.schoolCampus})` : ""}`
              : (user?.educationLevel ? titleCase(user.educationLevel) : "Current Education"),
            degree: user?.fieldOfStudy || "No field of study provided",
            dates: user?.graduationYear ? `Expected graduation ${user.graduationYear}` : "Graduation year not provided",
            gpa:
              user?.gpa && user?.gpaScale
                ? `${user.gpa}/${user.gpaScale}`
                : user?.gpa
                  ? String(user.gpa)
                  : "Not provided",
            schoolType: user?.schoolType || null,
            schoolLocation: user?.schoolLocation || null,
            honors: user?.headline ? [user.headline] : [],
          },
        ]
      : [];

  const achievements = [];
  const eligibilityBadges = [
    user?.schoolName ? `${user.schoolName}${user?.schoolCampus ? ` (${user.schoolCampus})` : ""}` : null,
    user?.fieldOfStudy ? `${user.fieldOfStudy}` : null,
    user?.educationLevel ? titleCase(user.educationLevel) : null,
    user?.gpa ? `GPA ${user.gpa}` : null,
    (user?.financialNeed?.[0] ?? 0) >= 4 ? "Need-Based Support" : null,
    // Special category badges
    user?.isAthlete ? "🏃 Athlete" : null,
    user?.isArtist ? "🎨 Artist" : null,
    user?.isSKOfficial ? "🌟 SK Official" : null,
    user?.isStudentLeader ? "📢 Student Leader" : null,
    user?.isIndigent ? "💚 Indigent/Low-income" : null,
    user?.isPWD ? "♿ PWD" : null,
    user?.isSoloParent ? "👨‍👩‍👧 Solo Parent" : null,
  ].filter(Boolean) as string[];

  const profileData = {
    name: getDisplayName(user),
    headline: user?.headline || "Add a headline in profile setup",
    location: user?.location || "Location not provided",
    email: user?.email || "Email not provided",
    joinDate: user?.joinDate || "Join date not provided",
    bio: user?.about || user?.headline || "No bio added yet.",
    education: educationSummary,
    skills: user?.skills && user.skills.length > 0 ? user.skills : [],
    achievements,
  };

  return (
    <div className="pb-8">
      {/* Cover Photo */}
      <div className="h-64 bg-gradient-to-r from-primary to-secondary relative">
        <ImageWithFallback
          src="https://images.unsplash.com/photo-1707640590939-3953ab4c0a8b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBvZmZpY2UlMjBiYWNrZ3JvdW5kJTIwYmFubmVyfGVufDF8fHx8MTc3NjM2MTEyMHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
          alt="Cover"
          className="w-full h-64 object-cover"
        />
      </div>

      <div className="max-w-6xl mx-auto px-4 -mt-20">
        {/* Profile Header */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Avatar */}
              <div className="flex-shrink-0">
                <Avatar className="h-40 w-40 border-4 border-card">
                  <AvatarImage
                    src={resolvePublicAssetUrl(
                      pickProfileImageUrl(user as Record<string, unknown>) || user?.profileImage,
                    )}
                  />
                  <AvatarFallback>
                    {getInitials(user)}
                  </AvatarFallback>
                </Avatar>
              </div>

              {/* Profile Info */}
              <div className="flex-1">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div>
                    <h1 className="text-3xl font-bold mb-2">{profileData.name}</h1>
                    <p className="text-muted-foreground mb-3">{profileData.headline}</p>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {profileData.location}
                      </div>
                      <div className="flex items-center gap-1">
                        <Mail className="h-4 w-4" />
                        {profileData.email}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        Joined {profileData.joinDate}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => navigate("/dashboard/settings")}>Edit Profile</Button>
                    <Button variant="outline">Message</Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-4">
                  {eligibilityBadges.length > 0 ? (
                    eligibilityBadges.map((badge) => (
                      <Badge key={badge} className="bg-accent">
                        {badge}
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="outline">Complete your profile to see scholarship matches</Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profile Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <Tabs defaultValue="about">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="about">About</TabsTrigger>
                <TabsTrigger value="education">Education</TabsTrigger>
                <TabsTrigger value="achievements">Achievements</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
              </TabsList>

              <TabsContent value="about">
                <Card>
                  <CardHeader>
                    <CardTitle>About</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground leading-relaxed">{profileData.bio}</p>
                  </CardContent>
                </Card>

                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle>Skills</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {profileData.skills.map((skill, index) => (
                        <Badge key={index} variant="secondary">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="education">
                <div className="space-y-4">
                  {profileData.education.length > 0 ? profileData.education.map((edu, index) => (
                    <Card key={index}>
                      <CardContent className="pt-6">
                        <div className="flex gap-4">
                          <div className="flex-shrink-0">
                            <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
                              <BookOpen className="h-6 w-6 text-primary" />
                            </div>
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold mb-1">{edu.institution}</h3>
                            <p className="text-muted-foreground mb-1">{edu.degree}</p>
                            <p className="text-sm text-muted-foreground mb-2">{edu.dates}</p>
                            <p className="text-sm font-semibold mb-2">GPA: {edu.gpa}</p>
                            <div className="flex flex-wrap gap-2">
                              {edu.schoolType && (
                                <Badge className="bg-blue-100 text-blue-800">
                                  {edu.schoolType}
                                </Badge>
                              )}
                              {edu.schoolLocation && (
                                <Badge className={edu.schoolLocation === "Quezon City" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                                  {edu.schoolLocation === "Quezon City" ? "Quezon City ✓" : edu.schoolLocation}
                                </Badge>
                              )}
                              {edu.honors.map((honor, idx) => (
                                <Badge key={idx} variant="outline">
                                  {honor}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )) : (
                    <Card>
                      <CardContent className="pt-6 text-muted-foreground">
                        Add your education level, field of study, and graduation year in profile setup to see your academic summary here.
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="achievements">
                <div className="space-y-4">
                  {profileData.achievements.length > 0 ? profileData.achievements.map((achievement, index) => (
                    <Card key={index}>
                      <CardContent className="pt-6">
                        <div className="flex gap-4">
                          <div className="flex-shrink-0">
                            <div className="h-12 w-12 bg-accent/10 rounded-lg flex items-center justify-center">
                              <Award className="h-6 w-6 text-accent" />
                            </div>
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold mb-1">{achievement.title}</h3>
                            <p className="text-sm text-muted-foreground mb-2">{achievement.date}</p>
                            <p className="text-muted-foreground">{achievement.description}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )) : (
                    <Card>
                      <CardContent className="pt-6 text-muted-foreground">
                        Add achievements or projects to your profile to personalize this section.
                      </CardContent>
                    </Card>
                  )}
                </div>
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
                  <BookOpen className="h-5 w-5" />
                  Academic Profile
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Current GPA</p>
                  <p className="text-2xl font-semibold font-mono">{user?.gpa || "Not provided"}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground">Education Level</p>
                  <p className="font-semibold">{user?.educationLevel ? titleCase(user.educationLevel) : "Not provided"}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground">Field of Study</p>
                  <p className="font-semibold">{user?.fieldOfStudy || "Not provided"}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground">Graduation Year</p>
                  <p className="font-semibold">{user?.graduationYear || "Not provided"}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Scholarship Eligibility
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {eligibilityBadges.length > 0 ? (
                    eligibilityBadges.map((badge) => (
                      <Badge key={badge} className="w-full justify-center bg-accent">
                        {badge}
                      </Badge>
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
                  <DollarSign className="h-5 w-5" />
                  Financial Profile
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-2">
                  Financial Need ({user?.currency || "PHP"})
                </p>
                <div className="flex items-center gap-2">
                  <Progress value={Math.min(100, Math.max(0, ((user?.financialNeed?.[0] ?? 0) / 5) * 100))} className="flex-1 h-2" />
                  <span className="text-sm font-semibold">
                    {user?.financialNeed?.[0] ?? "N/A"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Net Worth: {user?.netWorth || "Not provided"} | Income: {user?.incomeCategory || "Not provided"}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
