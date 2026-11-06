import type { UserProfile } from "./user-storage";

function hasText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function hasTruthyValue(value: unknown): boolean {
  return Boolean(value) || value === 0;
}

function hasNonEmptyArray(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

export function calculateCompleteness(user?: UserProfile | null): number {
  if (!user) return 0;

  const checks = [
    hasText(user.fullName),
    hasText(user.email),
    hasText(user.phone),
    hasText(user.location),
    hasText(user.dateOfBirth),
    hasText(user.gwa || user.gpa),
    hasText(user.educationLevel),
    hasText(user.yearLevel),
    hasText(user.schoolName),
    hasText(user.schoolType),
    hasText(user.schoolLocation),
    hasText(user.fieldOfStudy),
    hasText(user.graduationYear),
    hasTruthyValue(user.profileImage || user.profilePicture),
    hasTruthyValue(user.currency),
    hasTruthyValue(user.incomeCategory),
    hasTruthyValue(user.financialNeed?.[0]),
    hasNonEmptyArray(user.profileDocuments ? Object.values(user.profileDocuments).filter(Boolean) : []),
  ];

  const completed = checks.filter(Boolean).length;
  return Math.round((completed / checks.length) * 100);
}