export type ProfileDocument = {
  fileName?: string;
  fileSize?: number;
  uploadedAt?: string;
  status?: "pending" | "verified" | "rejected";
  rejectionReason?: string;
};

export type UserProfileDocuments = {
  gradesTranscript?: ProfileDocument;
  enrollmentProof?: ProfileDocument;
  qCitizenId?: ProfileDocument;
  uploadedAt?: string;
  lastUpdatedAt?: string;
};

export type UserProfile = {
  _id?: string;
  id?: string;
  userId?: string;
  fullName?: string;
  userName?: string;
  name?: string;
  email?: string;
  password?: string;
  phone?: string;
  userType?: string;
  role?: string;
  headline?: string;
  location?: string;
  dateOfBirth?: string;
  gwa?: string; // Preferred field
  gpa?: string; // Legacy - use gwa instead
  gpaScale?: string;
  educationLevel?: string;
  yearLevel?: string;
  fieldOfStudy?: string;
  graduationYear?: string;
  netWorth?: string;
  currency?: string;
  incomeCategory?: string;
  financialNeed?: number[];
  householdIncome?: number;
  financialSupportSource?: string;
  economicDependency?: number;
  schoolName?: string;
  schoolCampus?: string;
  schoolType?: string;
  schoolLocation?: string;
  organizationName?: string;
  position?: string;
  enrolledInQCSchool?: boolean;
  
  // Profile Document Vault
  profileDocuments?: UserProfileDocuments;
  
  // Special categories for scholarship eligibility
  isAthlete?: boolean;
  isArtist?: boolean;
  isSKOfficial?: boolean;
  isStudentLeader?: boolean;
  isIndigent?: boolean;
  isPWD?: boolean;
  isSoloParent?: boolean;
  hasAcademicHonors?: boolean;
  academic_honors?: boolean;
  academic_rank?: number;
  
  profileImage?: string;
  profilePicture?: string;
  coverPhoto?: string;
  joinDate?: string;
  about?: string;
  skills?: string[];
  notificationSettings?: {
    scholarshipRecommendations: boolean;
    deadlineReminders: boolean;
    approvalUpdates: boolean;
    newAnnouncements: boolean;
    promotionalEmails: boolean;
  };
  privacySettings?: {
    profileVisibility: string;
    showAcademicAchievements: boolean;
    showFinancialInformation: boolean;
    showContactInformation: boolean;
  };
  preferences?: {
    language?: string;
    theme?: string;
  };
};

const USER_STORAGE_KEY = "scholarship-portal-users";
const ACTIVE_USER_KEY = "scholarship-portal-active-email";
const AUTH_TOKEN_KEY = "scholarship-portal-auth-token";
const THEME_STORAGE_PREFIX = "scholarship-portal-theme";

function normalizeEmail(email?: string | null): string {
  return String(email ?? "").trim().toLowerCase();
}

function normalizeRole(role?: string | null): string {
  return String(role ?? "student").trim().toLowerCase() || "student";
}

function getUserThemeIdentity(user: UserProfile): string {
  return String(user._id ?? user.id ?? user.userId ?? normalizeEmail(user.email) ?? "anonymous").trim().toLowerCase();
}

function getThemeStorageKey(user: UserProfile): string {
  return `${THEME_STORAGE_PREFIX}_${normalizeRole(user.userType ?? user.role)}_${getUserThemeIdentity(user)}`;
}

export function applyTheme(theme?: string | null): void {
  if (typeof document === "undefined") return;

  const normalizedTheme = String(theme ?? "Light").trim().toLowerCase();
  const useDark = normalizedTheme === "dark" ||
    (normalizedTheme === "system default" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", useDark);
  document.documentElement.removeAttribute("data-theme");
}

export function resetTheme(): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.remove("dark");
  document.documentElement.removeAttribute("data-theme");
}

function readUserTheme(user: UserProfile): string {
  if (typeof window === "undefined") return user.preferences?.theme ?? "Light";
  return user.preferences?.theme ?? window.localStorage.getItem(getThemeStorageKey(user)) ?? "Light";
}

export function syncThemeForUser(user?: UserProfile | null): void {
  if (!user?.email && !user?._id && !user?.id && !user?.userId) {
    resetTheme();
    return;
  }
  applyTheme(readUserTheme(user));
}

function readUserMap(): Record<string, UserProfile> {
  if (typeof window === "undefined") return {};

  const raw = window.localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as Record<string, UserProfile>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeUserMap(map: Record<string, UserProfile>): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(map));
}

export function getActiveUserEmail(): string {
  if (typeof window === "undefined") return "";
  return normalizeEmail(window.localStorage.getItem(ACTIVE_USER_KEY));
}

export function setActiveUserEmail(email?: string | null): void {
  if (typeof window === "undefined") return;

  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    window.localStorage.removeItem(ACTIVE_USER_KEY);
    return;
  }

  window.localStorage.setItem(ACTIVE_USER_KEY, normalizedEmail);
}

export function getStoredUser(): UserProfile | null {
  if (typeof window === "undefined") return null;

  const activeEmail = getActiveUserEmail();
  const userMap = readUserMap();

  if (activeEmail && userMap[activeEmail]) {
    return userMap[activeEmail];
  }

  const legacyRaw = window.localStorage.getItem("scholarship-portal-user");
  if (!legacyRaw) return null;

  try {
    return JSON.parse(legacyRaw) as UserProfile;
  } catch {
    return null;
  }
}

type NameFields = { name?: string; userName?: string };

function pickName(...values: unknown[]): string {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

/**
 * Server payloads (e.g. /api/users/profile) can carry empty name fields.
 * Never let them wipe a display name we already know locally.
 */
function preserveKnownName(
  target: UserProfile,
  incoming: UserProfile,
  current: UserProfile,
): void {
  // Only treat fullName and name as real names — never promote userName (a handle) to fullName
  const best = pickName(
    incoming.fullName,
    (incoming as NameFields).name,
    current.fullName,
    (current as NameFields).name,
  );
  if (best) target.fullName = best;
}

export function saveStoredUser(user: UserProfile): void {
  if (typeof window === "undefined") return;

  const email = normalizeEmail(user.email || getStoredUser()?.email || getActiveUserEmail());

  // Deep-merge nested objects that should never be fully replaced by a partial save
  function mergeNested(current: UserProfile, incoming: UserProfile): UserProfile {
    const merged = { ...current, ...incoming } as UserProfile;
    // Merge preferences so saving only language doesn't wipe theme and vice versa
    if (incoming.preferences !== undefined) {
      merged.preferences = { ...(current.preferences ?? {}), ...incoming.preferences };
    }
    return merged;
  }

  if (!email) {
    const current = getStoredUser() ?? ({} as UserProfile);
    const updated = mergeNested(current, user);
    preserveKnownName(updated, user, current);
    if (user.about !== undefined) updated.about = user.about;
    if (user.headline !== undefined) updated.headline = user.headline;
    window.localStorage.setItem("scholarship-portal-user", JSON.stringify(updated));
    if (updated.preferences?.theme) {
      window.localStorage.setItem(getThemeStorageKey(updated), updated.preferences.theme);
    }
    syncThemeForUser(updated);
    window.dispatchEvent(new CustomEvent("scholarship-portal-user-updated", { detail: updated }));
    return;
  }

  const userMap = readUserMap();
  const current = (userMap[email] ?? {}) as UserProfile;
  const updated = { ...mergeNested(current, user), email } as UserProfile;
  preserveKnownName(updated, user, current);
  if (user.about !== undefined) updated.about = user.about;
  if (user.headline !== undefined) updated.headline = user.headline;
  userMap[email] = updated;
  writeUserMap(userMap);
  setActiveUserEmail(email);
  if (updated.preferences?.theme) {
    window.localStorage.setItem(getThemeStorageKey(updated), updated.preferences.theme);
  }
  syncThemeForUser(updated);
  window.dispatchEvent(new CustomEvent("scholarship-portal-user-updated", { detail: updated }));
}

export function getDisplayName(user?: UserProfile | null): string {
  // Prefer fullName first — it's always the user's real name
  const fullName = (user?.fullName && String(user.fullName).trim()) || "";
  if (fullName) return fullName;

  // Fall back to name field (some legacy payloads use this)
  const name = ((user as any)?.name && String((user as any).name).trim()) || "";
  if (name) return name;

  // Only use email-derived name as last resort — never expose a raw username handle
  if (user?.email) return buildNameFromEmail(user.email);
  return "Student User";
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
  window.localStorage.removeItem(ACTIVE_USER_KEY);
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  // Remove the legacy unscoped session record, but retain the keyed user map
  // so each user's preferences survive logout and can be restored on login.
  window.localStorage.removeItem("scholarship-portal-user");
  resetTheme();
}

/** Set JWT and admin/provider session profile without clearing the token in between. */
export function saveRoleSession(
  token: string | null | undefined,
  user: Pick<UserProfile, "email" | "fullName" | "userType"> & Partial<UserProfile>,
): void {
  if (typeof window === "undefined") return;
  saveAuthToken(token ?? null);
  saveStoredUser(user);
}

export function saveAuthToken(token?: string | null): void {
  if (typeof window === "undefined") return;

  if (!token) {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
    return;
  }

  window.localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function getAuthToken(): string {
  if (typeof window === "undefined") return "";
  return String(window.localStorage.getItem(AUTH_TOKEN_KEY) ?? "");
}
