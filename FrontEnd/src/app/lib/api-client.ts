import type { UserProfile } from "./user-storage";
import { getAuthToken } from "./user-storage";
import API_BASE_URL from "../../config/api";

export const API_URL = API_BASE_URL.replace(/\/$/, "");

/** Absolute URL for uploaded assets served by the API (avatar, documents). */
export function resolvePublicAssetUrl(src: string | undefined | null): string {
  const s = String(src ?? "").trim();
  if (!s || s.startsWith("data:")) return "";
  if (/^https?:\/\//i.test(s)) return s;
  const path = s.startsWith("/") ? s : `/${s}`;
  return `${API_URL}${path}`;
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
    throw new Error(payload.error || "Request failed");
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
  return request<{ user: Record<string, unknown> }>("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function signIn(payload: Pick<AuthPayload, "email" | "password">) {
  return request<{ user: Record<string, unknown> }>("/api/auth/signin", {
    method: "POST",
    body: JSON.stringify(payload),
  });
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
  gpa?: string;
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
  return request<{ data: number[] }>(`/api/users/${encodeURIComponent(normalizedEmail)}/saved-scholarships`);
}

export function saveSavedScholarships(email: string, ids: number[]) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  return request<{ data: number[] }>(`/api/users/${encodeURIComponent(normalizedEmail)}/saved-scholarships`, {
    method: "PUT",
    body: JSON.stringify({ ids }),
  });
}

export type ConversationPayload = {
  id: string;
  name: string;
  participantId: string;
  messages: Array<{ id: string; sender: string; text: string; ts: number }>;
};

export function fetchConversations(email: string) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  return request<{ data: ConversationPayload[] }>(`/api/users/${encodeURIComponent(normalizedEmail)}/conversations`);
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
    scheduledDate: string;
    scheduledTime: string;
    meetingPlatform: string;
    meetingLink: string;
    notes?: string;
  }
) {
  return request<{ message: string; data: Record<string, unknown> }>(
    `/api/admin/applications/${applicationId}/qualify`,
    { method: "PATCH", body: JSON.stringify(screeningData) }
  );
}

export function rejectApplicationWithReason(applicationId: string, reason: string) {
  return request<{ message: string }>(`/api/admin/applications/${applicationId}/reject`, {
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
  window.open(`${API_BASE_URL}/api/admin/applications/scholarship/${scholarshipId}/export`, "_blank");
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

export function fetchMyApplications(email: string) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  return request<{ data: Array<Record<string, unknown>> }>(
    `/api/applications/my-applications?email=${encodeURIComponent(normalizedEmail)}`
  );
}
