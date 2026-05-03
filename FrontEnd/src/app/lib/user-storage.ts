export type UserProfile = {
  fullName?: string;
  email?: string;
  password?: string;
  phone?: string;
  userType?: string;
  headline?: string;
  location?: string;
  dateOfBirth?: string;
  gpa?: string;
  gpaScale?: string;
  educationLevel?: string;
  fieldOfStudy?: string;
  graduationYear?: string;
  netWorth?: string;
  currency?: string;
  incomeCategory?: string;
  financialNeed?: number[];
  profileImage?: string;
  joinDate?: string;
  about?: string;
  skills?: string[];
};

const USER_STORAGE_KEY = "scholarship-portal-user";

export function getStoredUser(): UserProfile | null {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

export function saveStoredUser(user: UserProfile): void {
  if (typeof window === "undefined") return;

  const current = getStoredUser() ?? {};
  
  // If email changed, it's a different user account - clear profile data
  if (user.email && current.email && user.email !== current.email) {
    window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } else {
    window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify({ ...current, ...user }));
  }
}

export function getDisplayName(user?: UserProfile | null): string {
  return user?.fullName?.trim() || user?.email?.split("@")[0] || "Your Name";
}

export function getInitials(user?: UserProfile | null): string {
  const displayName = getDisplayName(user);
  return displayName
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function buildNameFromEmail(email: string): string {
  const localPart = email.split("@")[0] ?? "";
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((segment) => segment[0]?.toUpperCase() + segment.slice(1))
    .join(" ");
}

export function clearStoredUser(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(USER_STORAGE_KEY);
}
