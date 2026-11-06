import { useEffect, useState } from "react";
import { CalendarDays, Mail, MapPin, Phone, ShieldCheck, UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { fetchAdminProfile, type AdminProfile } from "../../lib/api-client";
import { getInitials } from "../../lib/user-storage";

export function AdminProfilePage() {
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetchAdminProfile()
      .then((response) => {
        if (active) setProfile(response.data);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load your profile.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading your profile...</div>;
  }

  if (error || !profile) {
    return (
      <div className="mx-auto max-w-3xl p-4 md:p-8">
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error || "Profile information is unavailable."}
        </p>
      </div>
    );
  }

  const displayName = profile.fullName.trim() || "Administrator";
  const joinedDate = profile.createdAt ? new Date(profile.createdAt) : null;
  const joinedLabel = joinedDate && !Number.isNaN(joinedDate.getTime())
    ? joinedDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : "Not available";

  return (
    <main className="mx-auto w-full max-w-5xl p-4 md:p-8">
      <section className="overflow-hidden rounded-xl border bg-card">
        <div
          className="h-40 bg-gradient-to-r from-[#1E3A5F] via-[#315b83] to-[#8ba6bf] md:h-52"
          style={profile.coverPhoto ? { backgroundImage: `url("${profile.coverPhoto}")`, backgroundPosition: "center", backgroundSize: "cover" } : undefined}
          aria-hidden="true"
        />
        <div className="px-5 pb-6 md:px-8">
          <div className="-mt-12 flex flex-col gap-4 sm:-mt-14 sm:flex-row sm:items-end">
            <Avatar className="size-24 border-4 border-card shadow-md sm:size-28">
              <AvatarImage src={profile.profilePicture || undefined} alt={displayName} />
              <AvatarFallback className="bg-blue-100 text-2xl font-semibold text-blue-800">
                {getInitials({ fullName: displayName })}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 pb-1">
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{displayName}</h1>
              <p className="mt-1 text-muted-foreground">{profile.position || "Administrator"}</p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                {profile.address && (
                  <span className="inline-flex items-center gap-1.5"><MapPin className="size-4" />{profile.address}</span>
                )}
                {profile.email && (
                  <span className="inline-flex items-center gap-1.5"><Mail className="size-4" />{profile.email}</span>
                )}
                <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-4" />Joined {joinedLabel}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-5 grid gap-5 md:grid-cols-[minmax(0,1.5fr)_minmax(260px,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">About</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm text-muted-foreground">
              Administrator account for managing the SCHOLAR platform.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <ProfileDetail icon={Mail} label="Email address" value={profile.email} />
              <ProfileDetail icon={Phone} label="Phone number" value={profile.phone} />
              <ProfileDetail icon={MapPin} label="Location" value={profile.address} />
              <ProfileDetail icon={UserRound} label="Position" value={profile.position || "Administrator"} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="size-5 text-blue-700" />
              Account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Account type</p>
              <p className="mt-1 font-medium">Administrator</p>
            </div>
            <div className="border-t pt-4">
              <p className="text-sm text-muted-foreground">Member since</p>
              <p className="mt-1 font-medium">{joinedLabel}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function ProfileDetail({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="break-words text-sm font-medium">{value || "Not provided"}</p>
      </div>
    </div>
  );
}
