/**
 * pending-redirect.ts
 *
 * Centralizes all sessionStorage interaction for the Pending_Redirect.
 * No component should directly call sessionStorage.getItem/setItem/removeItem
 * for this key.
 *
 * Feature: apply-now-redirect-after-auth
 * Requirements: 1.1, 1.3, 1.4, 1.6, 3.7, 4.1, 6.1, 6.2, 6.3, 6.6, 6.7
 */

export const PENDING_REDIRECT_KEY = "pendingScholarshipRedirect";

export interface PendingRedirect {
  scholarshipId: string;   // non-empty, max 24 chars
  scholarshipName: string; // non-empty, max 255 chars
}

/**
 * Validates that a string is a MongoDB ObjectId (24-char hex string).
 * Returns true iff the value is exactly 24 hexadecimal characters [0-9a-fA-F].
 *
 * Validates: Requirements 6.3
 */
export function isValidObjectId(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{24}$/i.test(value);
}

/**
 * Validates a PendingRedirect object's fields according to the spec constraints:
 * - scholarshipId: non-empty string, maximum 24 characters
 * - scholarshipName: non-empty string, maximum 255 characters
 */
function isValidPendingRedirect(value: unknown): value is PendingRedirect {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  const { scholarshipId, scholarshipName } = obj;

  if (
    typeof scholarshipId !== "string" ||
    scholarshipId.length === 0 ||
    scholarshipId.length > 24
  ) {
    return false;
  }

  if (
    typeof scholarshipName !== "string" ||
    scholarshipName.length === 0 ||
    scholarshipName.length > 255
  ) {
    return false;
  }

  return true;
}

/**
 * Writes a PendingRedirect to sessionStorage.
 * Always overwrites any existing record.
 * Returns true on success, false if validation fails or sessionStorage is unavailable.
 *
 * Validates: Requirements 1.1, 1.3, 1.4, 1.6, 6.1, 6.2, 6.6, 6.7
 */
export function writePendingRedirect(redirect: PendingRedirect): boolean {
  // Validate fields before writing
  if (!isValidPendingRedirect(redirect)) {
    return false;
  }

  // Serialize only the two permitted fields — no URLs, tokens, or PII
  const payload = JSON.stringify({
    scholarshipId: redirect.scholarshipId,
    scholarshipName: redirect.scholarshipName,
  });

  try {
    sessionStorage.setItem(PENDING_REDIRECT_KEY, payload);
    return true;
  } catch {
    return false;
  }
}

/**
 * Reads and parses the PendingRedirect without deleting it.
 * Returns null if absent, malformed, or sessionStorage is unavailable.
 *
 * Validates: Requirements 4.1, 6.7
 */
export function readPendingRedirect(): PendingRedirect | null {
  try {
    const raw = sessionStorage.getItem(PENDING_REDIRECT_KEY);
    if (raw === null) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!isValidPendingRedirect(parsed)) return null;

    return parsed;
  } catch {
    return null;
  }
}

/**
 * Atomically reads, validates, and deletes the PendingRedirect.
 * Returns the parsed value on success, null otherwise.
 * This is the only call site that should delete the record.
 *
 * Validates: Requirements 4.1, 6.7
 */
export function consumePendingRedirect(): PendingRedirect | null {
  try {
    const raw = sessionStorage.getItem(PENDING_REDIRECT_KEY);
    if (raw === null) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!isValidPendingRedirect(parsed)) {
      // Remove malformed record so it doesn't linger
      try {
        sessionStorage.removeItem(PENDING_REDIRECT_KEY);
      } catch {
        // ignore removal failure
      }
      return null;
    }

    sessionStorage.removeItem(PENDING_REDIRECT_KEY);
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Deletes the key without returning the value.
 *
 * Validates: Requirements 6.7
 */
export function clearPendingRedirect(): void {
  try {
    sessionStorage.removeItem(PENDING_REDIRECT_KEY);
  } catch {
    // Silently ignore sessionStorage unavailability
  }
}
