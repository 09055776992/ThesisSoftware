import type { UserProfile } from "./user-storage";
import { getAuthToken } from "./user-storage";
import API_BASE_URL from "../../config/api";
import { countUnreadMessages } from "./unread-messages";

export const API_URL = API_BASE_URL.replace(/\/$/, "");

export type FeedScholarship = {
  _id: string;
  name: string;
  provider?: string;
  providerName?: string;
  organization?: string;
  amount: number;
  deadline: string;
  status: string;
  type: string;
  description?: string;
  fieldOfStudy?: string;
  location?: string;
  createdAt?: string;
  feedType: "scholarship";
};

export type ProviderFeedPost = {
  _id: string;
  providerName: string;
  type: "announcement" | "update";
  title: string;
  content: string;
  createdAt: string;
  isEdited?: boolean;
  editedAt?: string;
  feedType: "post";
};

export type StudentFeedItem = FeedScholarship | ProviderFeedPost;

export type StudentPostAttachment = {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  kind: "photo" | "document";
  url: string;
};

export type StudentPost = {
  _id: string;
  authorName: string;
  authorHeadline: string;
  content: string;
  category: "academic" | "achievements" | "updates" | "appreciation";
  attachments: StudentPostAttachment[];
  moderationStatus: "pending" | "approved" | "removed";
  warningReason?: string;
  createdAt: string;
  feedType: "student-post";
};

export function fetchStudentHomePosts() {
  return request<{ success: boolean; data: StudentPost[] }>("/api/student/posts");
}

export async function createStudentPost(payload: {
  content: string;
  category: StudentPost["category"];
  attachments: File[];
}) {
  const formData = new FormData();
  formData.append("content", payload.content);
  formData.append("category", payload.category);
  payload.attachments.forEach((file) => formData.append("attachments", file));

  const token = getAuthToken();
  const response = await fetch(`${API_URL}/api/student/posts`, {
    method: "POST",
    headers: token ? { Authorization: "Bearer " + token } : {},
    body: formData,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.message || result.error || "Failed to submit your post.");
  }
  return result as { success: boolean; message: string; data: StudentPost };
}

export function fetchProviderStudentPosts() {
  return request<{ success: boolean; data: StudentPost[] }>("/api/provider/student-posts");
}

export function fetchAdminStudentPosts(status: "pending" | "approved" = "pending") {
  return request<{ success: boolean; data: StudentPost[] }>(`/api/admin/student-posts?status=${status}`);
}

export function moderateStudentPost(id: string, action: "approve" | "remove" | "warn", reason = "") {
  return request<{ success: boolean; message: string }>(`/api/admin/student-posts/${encodeURIComponent(id)}/moderation`, {
    method: "PATCH",
    body: JSON.stringify({ action, reason }),
  });
}

export async function fetchStudentPostAttachment(postId: string, attachmentId: string) {
  const token = getAuthToken();
  const response = await fetch(
    `${API_URL}/api/posts/${encodeURIComponent(postId)}/attachments/${encodeURIComponent(attachmentId)}`,
    { headers: token ? { Authorization: "Bearer " + token } : {} },
  );
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.message || "Failed to load post attachment.");
  }
  return response.blob();
}

export function fetchStudentFeed() {
  return request<{ success: boolean; data: StudentFeedItem[] }>(`/api/student/feed?t=${Date.now()}`, {
    cache: "no-store",
  });
}

export function fetchProviderTimeline() {
  return request<{ success: boolean; data: Array<FeedScholarship | ProviderFeedPost> }>("/api/provider/timeline");
}

export function createProviderFeedPost(payload: { title: string; content: string; type: "announcement" | "update" }) {
  return request<{ success: boolean; data: ProviderFeedPost }>("/api/provider/posts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateProviderFeedPost(id: string, payload: { title: string; content: string; type: "announcement" | "update" }) {
  return request<{ success: boolean; data: ProviderFeedPost }>(`/api/provider/posts/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteProviderFeedPost(id: string) {
  return request<{ success: boolean; message: string }>(`/api/provider/posts/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

/** Absolute URL for uploaded assets served by the API (avatar, documents). */
export function resolvePublicAssetUrl(src: string | undefined | null, bustCache = false): string {
  const s = String(src ?? "").trim();
  if (!s || s.startsWith("data:")) return "";
  if (/^https?:\/\//i.test(s)) return s;
  const path = s.startsWith("/") ? s : `/${s}`;
  const cacheBust = bustCache ? `?t=${Date.now()}` : "";
  return `${API_URL}${path}${cacheBust}`;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
    ...options,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = payload.error || payload.message || "Request failed";
    throw new Error(payload.stage ? `${message} (${payload.stage})` : message);
  }

  return (await response.json()) as T;
}

export type AuthPayload = {
  email: string;
  password: string;
  fullName?: string;
  phone?: string;
  userType?: string;
};

export type ScholarshipRecommendationProfile = UserProfile | null;

export function signUp(payload: AuthPayload) {
  return request<{
    user: Record<string, unknown>;
    token?: string;
    requiresOTP: boolean;
    userId: string;
    maskedEmail: string;
    message: string;
  }>("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Step 1 of 2FA: verify email+password, returns { requiresOTP, userId, maskedEmail } */
export function signIn(payload: Pick<AuthPayload, "email" | "password">) {
  return request<{
    success: boolean;
    requiresOTP: boolean;
    userId: string;
    maskedEmail: string;
    token?: string;
    user?: Record<string, unknown>;
    message: string;
  }>("/api/auth/signin", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Step 2 of 2FA: verify OTP, returns { token, user } */
export function verifyOTP(userId: string, otp: string) {
  return request<{
    success: boolean;
    token: string;
    user: Record<string, unknown>;
  }>("/api/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({ userId, otp }),
  });
}

/** Resend OTP for student login */
export function resendOTP(userId: string) {
  return request<{ success: boolean; message: string; maskedEmail: string }>(
    "/api/auth/resend-otp",
    { method: "POST", body: JSON.stringify({ userId }) }
  );
}

export function providerSignIn(payload: Pick<AuthPayload, "email" | "password">) {
  return request<{
    success: boolean;
    requiresOTP: boolean;
    userId: string;
    maskedEmail: string;
    message: string;
  }>("/api/provider/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function verifyProviderLoginOTP(userId: string, otp: string) {
  return request<{
    success: boolean;
    token: string;
    user: Record<string, unknown> & { id: string; email: string; name: string };
  }>("/api/provider/login/verify-otp", {
    method: "POST",
    body: JSON.stringify({ userId, otp }),
  });
}

export function resendProviderLoginOTP(userId: string) {
  return request<{ success: boolean; message: string; maskedEmail: string }>(
    "/api/provider/login/resend-otp",
    { method: "POST", body: JSON.stringify({ userId }) },
  );
}

/** Step 1 of admin 2FA: verify email+password */
export function adminSignIn(payload: Pick<AuthPayload, "email" | "password">) {
  return request<{
    success: boolean;
    requiresOTP: boolean;
    userId: string;
    maskedEmail: string;
    message: string;
  }>("/api/auth/admin/signin", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Step 2 of admin 2FA: verify OTP */
export function adminVerifyOTP(userId: string, otp: string) {
  return request<{
    success: boolean;
    token: string;
    user: Record<string, unknown>;
  }>("/api/auth/admin/verify-otp", {
    method: "POST",
    body: JSON.stringify({ userId, otp }),
  });
}

/** Resend OTP for admin login */
export function adminResendOTP(userId: string) {
  return request<{ success: boolean; message: string; maskedEmail: string }>(
    "/api/auth/admin/resend-otp",
    { method: "POST", body: JSON.stringify({ userId }) }
  );
}

/** Match % from API, capped when the student is not eligible (safety net for UI). */
export function resolveDisplayMatchScore(
  matchScore: number | undefined | null,
  eligibilityStatus?: string,
): number {
  const raw = Number(matchScore);
  const score = Number.isFinite(raw) ? Math.round(raw) : 0;
  if (eligibilityStatus === "not-eligible") {
    return Math.min(score, 79);
  }
  return Math.min(100, Math.max(0, score));
}

export function pickProfileImageUrl(user: Record<string, unknown> | null | undefined): string {
  const raw = String(user?.profilePicture || user?.profileImage || user?.avatar || "").trim();
  if (!raw || raw.startsWith("data:")) return "";
  return raw;
}

/** Upload profile photo to disk + MongoDB (returns path like /uploads/avatars/...). */
export async function uploadUserAvatar(file: File, email: string): Promise<string> {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error("Email is required to upload a profile picture.");
  }

  const formData = new FormData();
  formData.append("avatar", file);
  formData.append("email", normalizedEmail);

  const response = await fetch(`${API_BASE_URL}/api/user/upload-avatar`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Failed to upload profile picture.");
  }

  const data = (await response.json()) as { avatarUrl?: string };
  const url = String(data.avatarUrl || "").trim();
  if (!url) {
    throw new Error("Server did not return an avatar URL.");
  }
  return url;
}

/** Upload cover/banner photo to disk + MongoDB (returns path like /uploads/covers/...). */
export async function uploadUserCoverPhoto(file: File, email: string): Promise<string> {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error("Email is required to upload a cover photo.");
  }

  // Append email before the file so multer can read it while naming the upload.
  const formData = new FormData();
  formData.append("email", normalizedEmail);
  formData.append("cover", file);

  const response = await fetch(`${API_BASE_URL}/api/user/upload-cover-photo`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Failed to upload cover photo.");
  }

  const data = (await response.json()) as { coverPhotoUrl?: string };
  const url = String(data.coverPhotoUrl || "").trim();
  if (!url) {
    throw new Error("Server did not return a cover photo URL.");
  }
  return url;
}

export function fetchUserProfile(email: string) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  return request<{ user: Record<string, unknown> }>(
    `/api/users/profile?email=${encodeURIComponent(normalizedEmail)}`,
  );
}

export function updateUserProfile(payload: {
  email: string;
  fullName?: string;
  phone?: string;
  location?: string;
  about?: string;
  headline?: string;
  skills?: string[] | string;
  gwa?: string;
  gpa?: string; // Legacy field - prefer gwa
  educationLevel?: string;
  yearLevel?: string;
  fieldOfStudy?: string;
  graduationYear?: string;
  incomeCategory?: string;
  financialNeed?: number[];
  netWorth?: string;
  currency?: string;
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
  academic_rank?: number | string;
  academicRank?: number | string;
}) {
  return request<{ user: Record<string, unknown>; message: string }>("/api/users/profile", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export type UserNotificationSettings = {
  scholarshipRecommendations: boolean;
  deadlineReminders: boolean;
  approvalUpdates: boolean;
  newAnnouncements: boolean;
  promotionalEmails: boolean;
};

export type UserPrivacySettings = {
  profileVisibility: "public" | "providers-only" | "private";
  showAcademicAchievements: boolean;
  showFinancialInformation: boolean;
  showContactInformation: boolean;
};

export type UserPreferences = {
  language: string;
  theme: string;
};

export type UserSettings = {
  notificationSettings: UserNotificationSettings;
  privacySettings: UserPrivacySettings;
  preferences: UserPreferences;
  twoFactorEnabled: boolean;
};

export function fetchUserSettings() {
  return request<{ data: UserSettings }>("/api/users/settings");
}

export function updateUserSettings(settings: Partial<UserSettings>) {
  return request<{ message: string; data: UserSettings }>("/api/users/settings", {
    method: "PUT",
    body: JSON.stringify(settings),
  });
}

export function changeUserPassword(currentPassword: string, newPassword: string) {
  return request<{ message: string }>("/api/users/password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export function updateTwoFactorAuthentication(currentPassword: string, enabled: boolean) {
  return request<{ message: string; enabled: boolean }>("/api/users/2fa", {
    method: "POST",
    body: JSON.stringify({ currentPassword, enabled }),
  });
}

export function fetchScholarships() {
  return request<{ data: Array<Record<string, unknown>> }>("/api/scholarships");
}

export function fetchScholarshipsAdmin() {
  return request<{ data: Array<Record<string, unknown>> }>("/api/admin/scholarships");
}

export function createScholarship(payload: Record<string, unknown>) {
  return request<{ data: Record<string, unknown> }>("/api/admin/scholarships", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateScholarship(id: string, payload: Record<string, unknown>) {
  return request<{ data: Record<string, unknown> }>(`/api/admin/scholarships/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteScholarship(id: string) {
  return request<{ message: string }>(`/api/admin/scholarships/${id}`, {
    method: "DELETE",
  });
}

export function fetchApplicationsAdmin() {
  return request<{ data: Array<Record<string, unknown>>; stats: Record<string, number> }>("/api/admin/applications");
}

export function approveApplication(id: string) {
  return request<{ data: Record<string, unknown> }>(`/api/admin/applications/${id}/approve`, {
    method: "PATCH",
  });
}

export function rejectApplication(id: string) {
  return request<{ data: Record<string, unknown> }>(`/api/admin/applications/${id}/reject`, {
    method: "PATCH",
  });
}

export function reviewApplication(id: string) {
  return request<{ data: Record<string, unknown> }>(`/api/admin/applications/${id}/review`, {
    method: "PATCH",
  });
}

export function fetchRecommendedScholarships(profile: ScholarshipRecommendationProfile = null) {
  const studentId = String(profile?.email || "current-student");
  return request<{ data: Array<Record<string, unknown>> }>("/api/scholarships/recommendations", {
    method: "POST",
    body: JSON.stringify({ studentId, profile }),
  });
}

export function fetchSavedScholarships(email: string) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  return request<{ data: string[] }>(`/api/users/${encodeURIComponent(normalizedEmail)}/saved-scholarships`);
}

export function saveSavedScholarships(email: string, ids: string[]) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  return request<{ data: string[] }>(`/api/users/${encodeURIComponent(normalizedEmail)}/saved-scholarships`, {
    method: "PUT",
    body: JSON.stringify({ ids }),
  });
}

export type ConversationPayload = {
  id: string;
  name: string;
  participantId: string;
  messages: Array<{ id: string; sender: string; text: string; ts: number; readBy?: string[] }>;
};

export function fetchConversations(email: string) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  return request<{ data: ConversationPayload[] }>(`/api/users/${encodeURIComponent(normalizedEmail)}/conversations`);
}

export async function fetchUnreadMessageCount(email: string) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const result = await fetchConversations(normalizedEmail);
  return { count: countUnreadMessages(result.data || [], normalizedEmail) };
}

export function saveConversations(email: string, conversations: ConversationPayload[]) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  return request<{ data: ConversationPayload[] }>(`/api/users/${encodeURIComponent(normalizedEmail)}/conversations`, {
    method: "PUT",
    body: JSON.stringify({ conversations }),
  });
}

// ===== ELIGIBILITY & APPLICATION API =====

export function fetchScholarshipsWithEligibility(studentEmail: string) {
  const normalizedEmail = String(studentEmail || "").trim().toLowerCase();
  return request<{ data: Array<Record<string, unknown>> }>(`/api/scholarships-with-eligibility?studentEmail=${encodeURIComponent(normalizedEmail)}`);
}

export function checkEligibility(scholarshipId: string, studentEmail: string) {
  const normalizedEmail = String(studentEmail || "").trim().toLowerCase();
  return request<{
    eligible: boolean;
    mayBeEligible: boolean;
    unmetCriteria: string[];
    metCriteria: string[];
    canApply: boolean;
    deadline: string;
    daysUntilDeadline: number;
    isClosingSoon: boolean;
    preScreenedAt: string;
  }>(`/api/scholarships/${scholarshipId}/check-eligibility?studentEmail=${encodeURIComponent(normalizedEmail)}`);
}

export function applyForScholarship(payload: {
  studentId: string;
  studentName: string;
  studentEmail: string;
  scholarshipId: string;
  scholarshipName: string;
  documents?: Array<{ name: string; url: string }>;
}) {
  return request<{ data: Record<string, unknown>; message: string }>("/api/applications", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchAdminApplications(filter?: { status?: string; filter?: string }) {
  const params = new URLSearchParams();
  if (filter?.status) params.append("status", filter.status);
  if (filter?.filter) params.append("filter", filter.filter);
  const queryString = params.toString();
  const url = queryString ? `/api/admin/applications?${queryString}` : "/api/admin/applications";
  return request<{ data: Array<Record<string, unknown>>; stats: Record<string, number> }>(url);
}

// Document verification API
export function updateDocumentStatus(
  applicationId: string,
  documentType: string,
  status: string,
  rejectionReason?: string
) {
  return request<{ message: string }>(`/api/admin/applications/${applicationId}/documents`, {
    method: "PATCH",
    body: JSON.stringify({ documentType, status, rejectionReason }),
  });
}

// Document status by index
export function updateDocumentStatusByIndex(
  applicationId: string,
  docIndex: number,
  status: string,
  rejectionReason?: string
) {
  return request<{ message: string }>(`/api/admin/applications/${applicationId}/documents/${docIndex}`, {
    method: "PATCH",
    body: JSON.stringify({ status, rejectionReason }),
  });
}

// ===== ADVANCED APPLICATION REVIEW API =====

export function fetchScholarshipApplicationSummary() {
  return request<{ data: Array<Record<string, unknown>> }>("/api/admin/applications/scholarships");
}

export function fetchScholarshipApplicants(
  scholarshipId: string,
  status?: string,
  search?: string
) {
  const params = new URLSearchParams();
  if (status) params.append("status", status);
  if (search) params.append("search", search);
  const qs = params.toString();
  return request<{ data: Array<Record<string, unknown>>; stats: Record<string, number> }>(
    `/api/admin/applications/scholarship/${scholarshipId}/applicants${qs ? `?${qs}` : ""}`
  );
}

export function fetchApplicationReview(applicationId: string) {
  return request<{ data: Record<string, unknown> }>(`/api/admin/applications/${applicationId}/review`);
}

export function qualifyApplication(
  applicationId: string,
  screeningData: {
    // Legacy fields for backward compatibility
    scheduledDate?: string;
    scheduledTime?: string;
    meetingPlatform?: string;
    meetingLink?: string;
    // New recorded video interview fields
    googleDriveLink: string;
    submissionDeadline: string;
    notes?: string;
  }
) {
  return request<{ message: string; data: Record<string, unknown> }>(
    `/api/admin/applications/${applicationId}/qualify`,
    { method: "PATCH", body: JSON.stringify(screeningData) }
  );
}

export function rejectApplicationWithReason(applicationId: string, reason: string) {
  return request<{ message: string; studentNotified?: boolean }>(`/api/admin/applications/${applicationId}/reject`, {
    method: "PATCH",
    body: JSON.stringify({ reason }),
  });
}

export function requestResubmission(
  applicationId: string,
  rejectedDocuments: Array<{ index: number; name: string; reason: string }>,
  reason: string
) {
  return request<{ message: string }>(`/api/admin/applications/${applicationId}/resubmit`, {
    method: "PATCH",
    body: JSON.stringify({ rejectedDocuments, reason }),
  });
}

export function exportApplicants(scholarshipId: string) {
  return fetch(`${API_URL}/api/admin/applications/scholarship/${scholarshipId}/export`, {
    headers: { Authorization: "Bearer " + getAuthToken() },
  }).then(async (response) => {
    if (!response.ok) throw new Error("Failed to export applicants");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `applicants-${scholarshipId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  });
}

// ===== NOTIFICATIONS API =====

export function fetchNotifications(email: string) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  return request<{ data: Array<Record<string, unknown>> }>(
    `/api/notifications/${encodeURIComponent(normalizedEmail)}`
  );
}

export function fetchUnreadCount(email: string) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  return request<{ count: number }>(
    `/api/notifications/${encodeURIComponent(normalizedEmail)}/unread-count`
  );
}

export function markNotificationRead(notificationId: string, email?: string) {
  const normalized = String(email || "").trim().toLowerCase();
  const qs = normalized ? `?email=${encodeURIComponent(normalized)}` : "";
  return request<{ message: string }>(`/api/notifications/${notificationId}/read${qs}`, {
    method: "PATCH",
    body: JSON.stringify(normalized ? { email: normalized } : {}),
  });
}

export type ProviderNotification = {
  _id: string;
  title?: string;
  message?: string;
  type?: string;
  scholarshipName?: string;
  applicationId?: string;
  read?: boolean;
  is_read?: boolean;
  createdAt?: string;
};

export function fetchProviderNotifications() {
  return request<{ success: boolean; data: ProviderNotification[]; unreadCount: number }>(
    "/api/provider/notifications",
  );
}

export function fetchProviderUnreadNotificationCount() {
  return request<{ success: boolean; count: number }>("/api/provider/notifications/unread-count");
}

export function markProviderNotificationRead(notificationId: string) {
  return request<{ success: boolean; message: string }>(
    `/api/provider/notifications/${encodeURIComponent(notificationId)}/read`,
    { method: "PATCH" },
  );
}

export type AdminNotificationInput = {
  recipientGroup: "all" | "students" | "providers" | "specific";
  specificUserId?: string;
  title: string;
  message: string;
  type: "info" | "system_alert" | "announcement";
  priority: "normal" | "high";
};

export type AdminProfile = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  position: string;
  address: string;
  profilePicture: string;
  coverPhoto: string;
  createdAt: string | null;
};

export function fetchAdminProfile() {
  return request<{ success: boolean; data: AdminProfile }>("/api/admin/profile");
}

export function fetchAdminNotifications() {
  return request<{ data: Array<Record<string, unknown>> }>("/api/admin/notifications");
}

export function createAdminNotification(payload: AdminNotificationInput) {
  return request<{ message: string; count: number; notification: Record<string, unknown> }>(
    "/api/admin/notifications",
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export type AdminSettings = {
  platformName: string;
  tagline: string;
  supportEmail: string;
  description: string;
  welcomeEmail: string;
  approvalEmail: string;
  apiKey: string;
  webhookUrl: string;
  registrationEnabled: boolean;
  applicationsEnabled: boolean;
  socialEnabled: boolean;
  emailNotificationsEnabled: boolean;
  newScholarshipAlertsEnabled: boolean;
  applicationStatusUpdatesEnabled: boolean;
  deadlineRemindersEnabled: boolean;
};

export function fetchAdminSettings() {
  return request<{ data: AdminSettings }>("/api/admin/settings");
}

export function updateAdminSettings(section: "general" | "templates" | "api", settings: Partial<AdminSettings>) {
  return request<{ message: string; data: AdminSettings }>("/api/admin/settings", {
    method: "PUT",
    body: JSON.stringify({ section, settings }),
  });
}

export function regenerateAdminApiKey() {
  return request<{ message: string; apiKey: string }>("/api/admin/settings/api-key/regenerate", {
    method: "POST",
  });
}

export function fetchAdminActivity() {
  return request<{ data: Array<{ actor: string; action: string; subject: string; createdAt?: string }> }>("/api/admin/activity");
}

export type AdminMessage = {
  _id?: string;
  recipientEmail: string;
  recipientUserId?: string | null;
  message: string;
  createdAt?: string;
};

export function fetchAdminMessages() {
  return request<{ data: AdminMessage[] }>("/api/admin/messages");
}

export function fetchAdminConversations() {
  return request<{ data: ConversationPayload[] }>(`/api/admin/conversations?t=${Date.now()}`, {
    cache: "no-store",
  });
}

export function sendAdminConversationMessage(payload: {
  recipientEmail: string;
  conversationId?: string;
  message: string;
}) {
  return request<{ data: ConversationPayload }>("/api/admin/conversations/messages", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function sendAdminMessage(payload: Pick<AdminMessage, "recipientEmail" | "recipientUserId" | "message">) {
  return request<{ data: AdminMessage }>("/api/admin/messages", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchAdminUserActivity(userId: string) {
  return request<{ data: Array<{ action: string; detail: string; createdAt?: string }> }>(`/api/admin/users/${encodeURIComponent(userId)}/activity`);
}

export function fetchAdminUserApplications(userId: string) {
  return request<{ data: Array<Record<string, unknown>> }>(`/api/admin/users/${encodeURIComponent(userId)}/applications`);
}

export function fetchMyApplications(email: string) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  return request<{ data: Array<Record<string, unknown>> }>(
    `/api/applications/my-applications?email=${encodeURIComponent(normalizedEmail)}`
  );
}

export function submitScreeningVideo(applicationId: string, studentEmail: string, videoUrl: string) {
  return request<{
    message: string;
    data: {
      studentVideoUrl?: string;
      videoSubmitted?: boolean;
      videoSubmittedAt?: string;
      googleDriveLink?: string;
      submissionDeadline?: string;
      notes?: string;
    };
  }>(`/api/applications/${encodeURIComponent(applicationId)}/submit-video`, {
    method: "PATCH",
    body: JSON.stringify({
      studentEmail: String(studentEmail || "").trim().toLowerCase(),
      videoUrl: String(videoUrl || "").trim(),
    }),
  });
}

export type ScholarshipRenewal = {
  _id: string;
  originalApplicationId: string;
  scholarshipId: string;
  scholarshipName: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  renewalPeriodNumber: number;
  status: "Pending" | "Approved" | "Rejected";
  reviewNote?: string;
  submittedAt: string;
  reviewedAt?: string | null;
  registrationCard: { fileName: string };
  previousSemesterGrades: { fileName: string };
  registrationCardUrl: string;
  previousSemesterGradesUrl: string;
};

export function fetchStudentScholarshipRenewals() {
  return request<{ success: boolean; data: ScholarshipRenewal[] }>("/api/student/renewals");
}

export function fetchProviderScholarshipRenewals() {
  return request<{ success: boolean; data: ScholarshipRenewal[] }>("/api/provider/renewals");
}

export async function submitScholarshipRenewal(
  applicationId: string,
  registrationCard: File,
  previousSemesterGrades: File,
) {
  const formData = new FormData();
  formData.append("registrationCard", registrationCard);
  formData.append("previousSemesterGrades", previousSemesterGrades);
  const token = getAuthToken();
  const response = await fetch(
    `${API_URL}/api/applications/${encodeURIComponent(applicationId)}/renewals`,
    {
      method: "POST",
      headers: token ? { Authorization: "Bearer " + token } : {},
      body: formData,
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || "Failed to submit scholarship renewal.");
  }
  return payload as { success: boolean; data: ScholarshipRenewal; message: string };
}

export function setScholarshipRenewalPeriod(scholarshipId: string, open: boolean) {
  return request<{ success: boolean; renewalPeriodOpen: boolean; renewalPeriodNumber: number; message: string }>(
    `/api/provider/scholarships/${encodeURIComponent(scholarshipId)}/renewal-period`,
    { method: "PATCH", body: JSON.stringify({ open }) },
  );
}

export function reviewScholarshipRenewal(renewalId: string, status: "Approved" | "Rejected", reviewNote = "") {
  return request<{ success: boolean; data: ScholarshipRenewal; message: string }>(
    `/api/provider/renewals/${encodeURIComponent(renewalId)}/review`,
    { method: "PATCH", body: JSON.stringify({ status, reviewNote }) },
  );
}

// ===== AI RANKING API =====

export type ScoreBreakdown = {
  gpa_score: number;
  financial_score: number;
  document_completeness: number;
  document_authenticity: number;
  special_category_score: number;
};

export type ShapContribution = {
  factor: string;
  shap_value: number;
  raw_score: number;
  weight_percent: number;
  impact: "positive" | "negative";
  level: "high" | "medium" | "low" | "zero";
  explanation: string;
};

export type ShapExplanation = {
  mode: "simple" | "shap";
  contributions: ShapContribution[];
  summary: string;
  top_strength: ShapContribution | null;
  top_weakness: ShapContribution | null;
};

export type AIRanking = {
  student_id: string;
  student_name: string;
  rank: number;
  total_score: number;
  score_breakdown: ScoreBreakdown;
  shap_explanation: ShapExplanation;
  weights_used: Record<string, number>;
};

export type AIRankingResponse = {
  success: boolean;
  scholarship_id: string;
  scholarship_name: string;
  total_applicants: number;
  rankings: AIRanking[];
  ranked_at: string;
};

export type MyScoreResponse = {
  success: boolean;
  has_score: boolean;
  rank: number | null;
  total_applicants: number;
  total_score: number | null;
  score_breakdown: ScoreBreakdown | null;
  shap_explanation: ShapExplanation | null;
  ranked_at: string | null;
};

/** Admin: trigger AI ranking for all applicants of a scholarship */
export function generateAIRankings(scholarshipId: string) {
  return request<AIRankingResponse>(`/api/admin/scholarships/${scholarshipId}/rank`, {
    method: "POST",
  });
}

/** Admin: fetch saved rankings without re-computing */
export function fetchSavedRankings(scholarshipId: string) {
  return request<{ success: boolean; total: number; rankings: AIRanking[] }>(
    `/api/admin/scholarships/${scholarshipId}/rankings`,
  );
}

/** Student: fetch their own score for one application */
export function fetchMyScore(applicationId: string) {
  return request<MyScoreResponse>(`/api/applications/${applicationId}/my-score`);
}

// ===== SECTION-SPECIFIC PROFILE PATCH API =====

export interface PersonalProfilePayload {
  email: string;
  fullName?: string;
  phone?: string;
  location?: string;
  dateOfBirth?: string;
  about?: string;
  headline?: string;
  skills?: string[];
}

export function patchPersonalProfile(payload: PersonalProfilePayload) {
  return request<{ user: Record<string, unknown>; message: string }>(
    "/api/users/profile/personal",
    { method: "PATCH", body: JSON.stringify(payload) }
  );
}

export interface AcademicProfilePayload {
  email: string;
  gwa?: string;
  gpa?: string; // Legacy field - prefer gwa
  educationLevel?: string;
  yearLevel?: string;
  fieldOfStudy?: string;
  graduationYear?: string;
  schoolName?: string;
  schoolCampus?: string;
  schoolType?: string;
  schoolLocation?: string;
  hasAcademicHonors?: boolean;
  academic_rank?: string | number | null;
}

export function patchAcademicProfile(payload: AcademicProfilePayload) {
  return request<{ user: Record<string, unknown>; message: string }>(
    "/api/users/profile/academic",
    { method: "PATCH", body: JSON.stringify(payload) }
  );
}

export interface AchievementsProfilePayload {
  email: string;
  isAthlete?: boolean;
  isArtist?: boolean;
  isSKOfficial?: boolean;
  isStudentLeader?: boolean;
  isIndigent?: boolean;
  isPWD?: boolean;
  isSoloParent?: boolean;
  financialNeed?: number;
  netWorth?: string;
  currency?: string;
  incomeCategory?: string;
  householdIncome?: number;
  financialSupportSource?: string;
  economicDependency?: number;
}

export function patchAchievementsProfile(payload: AchievementsProfilePayload) {
  return request<{ user: Record<string, unknown>; message: string }>(
    "/api/users/profile/achievements",
    { method: "PATCH", body: JSON.stringify(payload) }
  );
}

// ===== PROFILE DOCUMENT VAULT API =====

export type ProfileDocumentResponse = {
  type: string;
  label: string;
  fileName: string | null;
  fileSize: number | null;
  uploadedAt: string | null;
  status: string | null;
  rejectionReason: string | null;
};

export function fetchProfileDocuments(email: string) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  return request<{
    success: boolean;
    documents: ProfileDocumentResponse[];
    isComplete: boolean;
    lastUpdatedAt: string | null;
  }>(`/api/users/profile/documents?email=${encodeURIComponent(normalizedEmail)}`);
}

export async function uploadProfileDocument(
  email: string,
  docType: "gradesTranscript" | "enrollmentProof" | "qCitizenId",
  file: File
) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const formData = new FormData();
  formData.append("email", normalizedEmail);
  formData.append("docType", docType);
  formData.append("document", file);

  const token = getAuthToken();
  const response = await fetch(`${API_URL}/api/users/profile/documents`, {
    method: "POST",
    headers: {
      // Do NOT set Content-Type — browser must set it with the multipart boundary
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Failed to upload document");
  }

  return (await response.json()) as { success: boolean; message: string; document: Record<string, unknown> };
}

export function deleteProfileDocument(
  email: string,
  docType: "gradesTranscript" | "enrollmentProof" | "qCitizenId"
) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  return request<{
    success: boolean;
    message: string;
  }>(
    `/api/users/profile/documents/${docType}?email=${encodeURIComponent(normalizedEmail)}`,
    { method: "DELETE" }
  );
}

// Submit Stage 2 specific documents (post-acceptance)
export async function submitSpecificDocuments(
  applicationId: string,
  studentEmail: string,
  documents: Array<{ type: string; file: File }>
) {
  const formData = new FormData();
  formData.append("studentEmail", studentEmail);
  documents.forEach((doc, index) => {
    formData.append("documents", doc.file);
    formData.append("documentTypes", doc.type);
  });

  const response = await fetch(
    `${API_URL}/api/applications/${applicationId}/specific-documents`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Failed to submit specific documents");
  }

  return (await response.json()) as {
    message: string;
    applicationId: string;
    documentsSubmitted: number;
    stage: string;
  };
}

// ===== PROVIDER PROFILE API =====

export interface ProviderProfile {
  name: string;
  email: string;
  organizationName: string;
  position: string;
  phone: string;
  officeAddress: string;
  description: string;
  website: string;
  profilePicture: string | null;
}

export function fetchProviderProfile() {
  return request<{ success: boolean; data: ProviderProfile }>("/api/provider/profile");
}

export function updateProviderProfile(payload: Partial<ProviderProfile>) {
  return request<{ success: boolean; data: ProviderProfile }>("/api/provider/profile", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function uploadProviderLogo(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("avatar", file);

  const token = getAuthToken();
  const response = await fetch(`${API_URL}/api/provider/upload-avatar`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || "Failed to upload logo");
  }

  const data = (await response.json()) as { success: boolean; avatarUrl: string };
  return data.avatarUrl;
}
