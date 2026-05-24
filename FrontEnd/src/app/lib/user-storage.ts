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
  enrolledInQCSchool?: boolean;
  
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

function normalizeEmail(email?: string | null): string {
  return String(email ?? "").trim().toLowerCase();
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

export function saveStoredUser(user: UserProfile): void {
  if (typeof window === "undefined") return;

  const email = normalizeEmail(user.email || getStoredUser()?.email || getActiveUserEmail());
  if (!email) {
    const current = getStoredUser() ?? {};
    window.localStorage.setItem("scholarship-portal-user", JSON.stringify({ ...current, ...user }));
    return;
  }

  const userMap = readUserMap();
  const current = userMap[email] ?? {};
  userMap[email] = { ...current, ...user, email };
  writeUserMap(userMap);
  setActiveUserEmail(email);
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
  window.localStorage.removeItem(ACTIVE_USER_KEY);
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
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
