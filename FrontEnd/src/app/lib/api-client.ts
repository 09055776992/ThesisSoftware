import type { UserProfile } from "./user-storage";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
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

export function fetchScholarships() {
  return request<{ data: Array<Record<string, unknown>> }>("/api/scholarships");
}

export function fetchRecommendedScholarships(profile: ScholarshipRecommendationProfile = null) {
  const studentId = String(profile?.email || "current-student");
  return request<{ data: Array<Record<string, unknown>> }>("/api/scholarships/recommendations", {
    method: "POST",
    body: JSON.stringify({ studentId, profile }),
  });
}
