import type { UserProfile } from "./user-storage";
import { getAuthToken } from "./user-storage";

const API_BASE_URL = (import.meta.env as any).VITE_API_BASE_URL || "http://localhost:5000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
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

export function updateUserProfile(payload: {
  email: string;
  fullName?: string;
  phone?: string;
  location?: string;
  gpa?: string;
  educationLevel?: string;
  yearLevel?: string;
  fieldOfStudy?: string;
  incomeCategory?: string;
  financialNeed?: number[];
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
