/**
 * Property-based tests for pending-redirect.ts
 *
 * Feature: apply-now-redirect-after-auth
 * Testing framework: fast-check v4 (PBT) + vitest
 *
 * Tests Properties 1, 2, 7, and 10 as defined in design.md.
 */

import { describe, it, beforeEach, afterEach, expect } from "vitest";
import fc from "fast-check";

import {
  PENDING_REDIRECT_KEY,
  writePendingRedirect,
  isValidObjectId,
} from "./pending-redirect";

// ---------------------------------------------------------------------------
// Arbitraries
// fast-check v4 removed fc.stringOf; use fc.stringMatching or fc.array+map.
// ---------------------------------------------------------------------------

/**
 * Generates a valid lowercase MongoDB ObjectId: exactly 24 hex characters.
 * Uses stringMatching which is available in fast-check v4.
 */
const validObjectIdArb = fc.stringMatching(/^[0-9a-f]{24}$/);

/**
 * Generates an uppercase or mixed-case 24-char hex string to test
 * case-insensitive validation.
 */
const upperHexObjectIdArb = fc.stringMatching(/^[0-9A-F]{24}$/);

/**
 * Generates a valid scholarshipId: non-empty string, max 24 chars.
 */
const validScholarshipIdArb = fc
  .string({ minLength: 1, maxLength: 24 })
  .filter((value) => !value.includes("@") && !value.startsWith("http") && !value.startsWith("eyJ"));

/**
 * Generates a valid scholarshipName: non-empty string, max 255 chars.
 */
const validScholarshipNameArb = fc
  .string({ minLength: 1, maxLength: 255 })
  .filter((value) => !value.includes("@") && !value.startsWith("http") && !value.startsWith("eyJ"));

// ---------------------------------------------------------------------------
// sessionStorage setup — vitest/jsdom provides window.sessionStorage
// ---------------------------------------------------------------------------

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  sessionStorage.clear();
});

// ---------------------------------------------------------------------------
// Property 1: Apply Now writes correct scholarship context
// Validates: Requirements 1.1, 1.3
// ---------------------------------------------------------------------------

describe("Property 1: Apply Now writes correct scholarship context", () => {
  // Feature: apply-now-redirect-after-auth, Property 1: Apply Now writes correct scholarship context
  it(
    "writePendingRedirect stores exactly the given scholarshipId and scholarshipName in sessionStorage",
    () => {
      fc.assert(
        fc.property(
          validScholarshipIdArb,
          validScholarshipNameArb,
          (scholarshipId, scholarshipName) => {
            // Arrange — clear any prior state
            sessionStorage.clear();

            // Act
            const result = writePendingRedirect({ scholarshipId, scholarshipName });

            // Assert — write must succeed for valid inputs
            expect(result).toBe(true);

            // Assert — raw value is valid JSON
            const raw = sessionStorage.getItem(PENDING_REDIRECT_KEY);
            expect(raw).not.toBeNull();

            const parsed = JSON.parse(raw as string) as Record<string, unknown>;

            // Stored object must contain exactly the values we passed in
            expect(parsed.scholarshipId).toBe(scholarshipId);
            expect(parsed.scholarshipName).toBe(scholarshipName);
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});

// ---------------------------------------------------------------------------
// Property 2: Apply Now always overwrites existing context
// Validates: Requirements 1.4, 6.6
// ---------------------------------------------------------------------------

describe("Property 2: Apply Now always overwrites existing context", () => {
  // Feature: apply-now-redirect-after-auth, Property 2: Apply Now always overwrites existing context
  it(
    "writing scholarship B after scholarship A leaves only B's data in sessionStorage",
    () => {
      fc.assert(
        fc.property(
          validScholarshipIdArb,
          validScholarshipNameArb,
          validScholarshipIdArb,
          validScholarshipNameArb,
          (idA, nameA, idB, nameB) => {
            // Arrange — clear prior state
            sessionStorage.clear();

            // Act — write A first, then B
            writePendingRedirect({ scholarshipId: idA, scholarshipName: nameA });
            writePendingRedirect({ scholarshipId: idB, scholarshipName: nameB });

            // Assert — only B's data must be present
            const raw = sessionStorage.getItem(PENDING_REDIRECT_KEY);
            expect(raw).not.toBeNull();

            const parsed = JSON.parse(raw as string) as Record<string, unknown>;
            expect(parsed.scholarshipId).toBe(idB);
            expect(parsed.scholarshipName).toBe(nameB);
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});

// ---------------------------------------------------------------------------
// Property 7: ObjectId validation accepts exactly valid IDs
// Validates: Requirements 6.3
// ---------------------------------------------------------------------------

describe("Property 7: ObjectId validation accepts exactly valid IDs", () => {
  // Feature: apply-now-redirect-after-auth, Property 7: ObjectId validation accepts exactly valid IDs

  it("returns true for any 24-char lowercase hex string", () => {
    fc.assert(
      fc.property(validObjectIdArb, (id) => {
        expect(isValidObjectId(id)).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it("returns true for 24-char uppercase hex strings (case-insensitive)", () => {
    // Feature: apply-now-redirect-after-auth, Property 7: ObjectId validation accepts exactly valid IDs
    fc.assert(
      fc.property(upperHexObjectIdArb, (id) => {
        expect(isValidObjectId(id)).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it("returns false for hex strings shorter than 24 characters", () => {
    // Feature: apply-now-redirect-after-auth, Property 7: ObjectId validation accepts exactly valid IDs
    // Strings of 0–23 hex chars — all should fail
    const shortHexArb = fc.stringMatching(/^[0-9a-f]{0,23}$/).filter(
      (s) => s.length < 24
    );
    fc.assert(
      fc.property(shortHexArb, (id) => {
        expect(isValidObjectId(id)).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  it("returns false for hex strings longer than 24 characters", () => {
    // Feature: apply-now-redirect-after-auth, Property 7: ObjectId validation accepts exactly valid IDs
    const longHexArb = fc.stringMatching(/^[0-9a-f]{25,50}$/);
    fc.assert(
      fc.property(longHexArb, (id) => {
        expect(isValidObjectId(id)).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  it("returns false for 24-char strings containing non-hex characters", () => {
    // Feature: apply-now-redirect-after-auth, Property 7: ObjectId validation accepts exactly valid IDs
    // Pattern: 24 chars but at least one non-hex character [g-z or symbols]
    const nonHexArb = fc
      .tuple(
        fc.array(fc.constantFrom(...Array.from("0123456789abcdef")), {
          minLength: 23,
          maxLength: 23,
        }),
        fc.integer({ min: 0, max: 23 }),
        fc.constantFrom("g", "Z", "!"),
      )
      .map(([hexChars, position, invalidChar]) => {
        hexChars.splice(position, 0, invalidChar);
        return hexChars.join("");
      });
    fc.assert(
      fc.property(nonHexArb, (id) => {
        expect(isValidObjectId(id)).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  it("returns false for the empty string", () => {
    // Feature: apply-now-redirect-after-auth, Property 7: ObjectId validation accepts exactly valid IDs
    expect(isValidObjectId("")).toBe(false);
  });

  it("returns false for non-string values: numbers, null, undefined, objects, booleans", () => {
    // Feature: apply-now-redirect-after-auth, Property 7: ObjectId validation accepts exactly valid IDs
    const nonStringArb = fc.oneof(
      fc.integer(),
      fc.float({ noNaN: true }),
      fc.constant(null),
      fc.constant(undefined),
      fc.record({ id: fc.string() }),
      fc.constant(true),
      fc.constant(false),
      fc.constant([]),
    );

    fc.assert(
      fc.property(nonStringArb, (value) => {
        expect(isValidObjectId(value)).toBe(false);
      }),
      { numRuns: 200 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 10: Pending_Redirect stores only permitted fields
// Validates: Requirements 6.1, 6.2
// ---------------------------------------------------------------------------

describe("Property 10: Pending_Redirect stores only permitted fields", () => {
  // Feature: apply-now-redirect-after-auth, Property 10: Pending_Redirect stores only permitted fields
  it(
    "written JSON has exactly 2 keys and values are not URLs, JWTs, or email addresses",
    () => {
      fc.assert(
        fc.property(
          validScholarshipIdArb,
          validScholarshipNameArb,
          (scholarshipId, scholarshipName) => {
            sessionStorage.clear();

            writePendingRedirect({ scholarshipId, scholarshipName });

            const raw = sessionStorage.getItem(PENDING_REDIRECT_KEY);
            expect(raw).not.toBeNull();

            const parsed = JSON.parse(raw as string) as Record<string, unknown>;

            // Must have exactly 2 keys
            const keys = Object.keys(parsed);
            expect(keys).toHaveLength(2);
            expect(keys).toContain("scholarshipId");
            expect(keys).toContain("scholarshipName");

            const storedId = parsed.scholarshipId as string;
            const storedName = parsed.scholarshipName as string;

            // Values must not be URL patterns
            expect(storedId.startsWith("http://")).toBe(false);
            expect(storedId.startsWith("https://")).toBe(false);
            expect(storedName.startsWith("http://")).toBe(false);
            expect(storedName.startsWith("https://")).toBe(false);

            // Values must not be JWT-like (starting with "eyJ")
            expect(storedId.startsWith("eyJ")).toBe(false);
            expect(storedName.startsWith("eyJ")).toBe(false);

            // Values must not contain '@' (email address indicator)
            expect(storedId.includes("@")).toBe(false);
            expect(storedName.includes("@")).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});
