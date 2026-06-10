// Feature: provider-panel-enhancements, Property 17: GET /api/provider/me identity mapping

/**
 * Property 17: GET /api/provider/me identity mapping
 *
 * For any provider User document, GET /api/provider/me SHALL always return a
 * response that:
 *   1. Has success: true
 *   2. Contains exactly the four identity fields: name, email, organizationName,
 *      profilePicture
 *   3. Sets `name` to user.userName if present, else user.fullName if present,
 *      else null — never undefined
 *   4. Sets `organizationName` to user.providerDetails.organizationName if
 *      present, else null
 *   5. Sets `profilePicture` to user.profilePicture if present, else null
 *   6. Sets `email` to user.email
 *
 * Validates: Requirements 4.1, 4.2
 */

import { describe, it, expect, jest } from "@jest/globals";
import * as fc from "fast-check";
import { getProviderMe } from "../../controller/provider.controller.js";

// ── Arbitraries ──────────────────────────────────────────────────────────────

/**
 * Generates a non-empty, non-whitespace string (a "present" field value).
 * Trims leading/trailing whitespace so we get clean names.
 */
const nonEmptyStringArb = fc
  .string({ minLength: 1, maxLength: 80 })
  .filter((s) => s.trim().length > 0)
  .map((s) => s.trim());

/**
 * Generates an email-like string.
 */
const emailArb = fc
  .tuple(
    fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-z0-9]+$/i.test(s)),
    fc.string({ minLength: 1, maxLength: 10 }).filter((s) => /^[a-z]+$/i.test(s))
  )
  .map(([local, domain]) => `${local}@${domain}.com`);

/**
 * Generates a URL-like profile picture path (or null/undefined to simulate
 * an absent field).
 */
const profilePictureArb = fc.oneof(
  fc.constant(null),
  fc.constant(undefined),
  fc.string({ minLength: 5, maxLength: 100 }).map((s) => `/uploads/providers/${s}`)
);

/**
 * Generates a providerDetails sub-document with an optional organizationName.
 * Also allows the entire providerDetails to be absent (null/undefined).
 */
const providerDetailsArb = fc.oneof(
  fc.constant(null),
  fc.constant(undefined),
  fc.record({
    organizationName: fc.oneof(
      fc.constant(null),
      fc.constant(undefined),
      nonEmptyStringArb
    ),
  })
);

/**
 * Generates a full provider user document with any combination of populated
 * or absent userName, fullName, providerDetails.organizationName, and
 * profilePicture fields.
 *
 * This covers:
 *  - Both name fields present (userName takes priority)
 *  - Only userName present
 *  - Only fullName present
 *  - Neither name field present (name must fall back to null, not undefined)
 *  - organizationName present/absent
 *  - profilePicture present/absent
 */
const providerUserArb = fc.record({
  userName: fc.oneof(
    fc.constant(null),
    fc.constant(undefined),
    fc.constant(""),
    nonEmptyStringArb
  ),
  fullName: fc.oneof(
    fc.constant(null),
    fc.constant(undefined),
    fc.constant(""),
    nonEmptyStringArb
  ),
  email: emailArb,
  providerDetails: providerDetailsArb,
  profilePicture: profilePictureArb,
});

// ── Helper: derive expected values ───────────────────────────────────────────

/**
 * Derives the expected `name` using the same logic as the controller:
 *   user.userName || user.fullName || null
 */
function expectedName(user) {
  return user.userName || user.fullName || null;
}

/**
 * Derives the expected `organizationName`:
 *   user.providerDetails?.organizationName || null
 */
function expectedOrganizationName(user) {
  return user.providerDetails?.organizationName || null;
}

/**
 * Derives the expected `profilePicture`:
 *   user.profilePicture || null
 */
function expectedProfilePicture(user) {
  return user.profilePicture || null;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Property 17 — getProviderMe identity mapping", () => {
  it(
    "always returns success:true with all four identity fields present",
    async () => {
      await fc.assert(
        fc.asyncProperty(providerUserArb, async (user) => {
          const req = { provider: user };
          let capturedBody = null;
          const res = {
            json: jest.fn((body) => {
              capturedBody = body;
              return res;
            }),
            status: jest.fn().mockReturnThis(),
          };

          getProviderMe(req, res);

          // success flag
          expect(capturedBody).not.toBeNull();
          expect(capturedBody.success).toBe(true);

          // All four fields must exist in the response data
          expect(capturedBody.data).toHaveProperty("name");
          expect(capturedBody.data).toHaveProperty("email");
          expect(capturedBody.data).toHaveProperty("organizationName");
          expect(capturedBody.data).toHaveProperty("profilePicture");
        }),
        { numRuns: 100 }
      );
    },
    60_000
  );

  it(
    "name falls back to null (never undefined) when both userName and fullName are absent",
    async () => {
      // Generate users where both name fields are absent/empty/null
      const noNameUserArb = fc.record({
        userName: fc.oneof(
          fc.constant(null),
          fc.constant(undefined),
          fc.constant("")
        ),
        fullName: fc.oneof(
          fc.constant(null),
          fc.constant(undefined),
          fc.constant("")
        ),
        email: emailArb,
        providerDetails: providerDetailsArb,
        profilePicture: profilePictureArb,
      });

      await fc.assert(
        fc.asyncProperty(noNameUserArb, async (user) => {
          const req = { provider: user };
          let capturedBody = null;
          const res = {
            json: jest.fn((body) => {
              capturedBody = body;
              return res;
            }),
            status: jest.fn().mockReturnThis(),
          };

          getProviderMe(req, res);

          // When both name fields are absent, name must be null — not undefined
          expect(capturedBody.data.name).toBeNull();
          expect(capturedBody.data.name).not.toBeUndefined();
        }),
        { numRuns: 100 }
      );
    },
    60_000
  );

  it(
    "name uses userName when userName is non-empty (even when fullName is also set)",
    async () => {
      // Generate users that always have a non-empty userName
      const userWithUserNameArb = fc.record({
        userName: nonEmptyStringArb,
        fullName: fc.oneof(
          fc.constant(null),
          fc.constant(undefined),
          nonEmptyStringArb
        ),
        email: emailArb,
        providerDetails: providerDetailsArb,
        profilePicture: profilePictureArb,
      });

      await fc.assert(
        fc.asyncProperty(userWithUserNameArb, async (user) => {
          const req = { provider: user };
          let capturedBody = null;
          const res = {
            json: jest.fn((body) => {
              capturedBody = body;
              return res;
            }),
            status: jest.fn().mockReturnThis(),
          };

          getProviderMe(req, res);

          // userName is truthy → name must equal userName
          expect(capturedBody.data.name).toBe(user.userName);
        }),
        { numRuns: 100 }
      );
    },
    60_000
  );

  it(
    "name uses fullName when userName is absent but fullName is present",
    async () => {
      // userName absent, fullName present
      const userWithOnlyFullNameArb = fc.record({
        userName: fc.oneof(
          fc.constant(null),
          fc.constant(undefined),
          fc.constant("")
        ),
        fullName: nonEmptyStringArb,
        email: emailArb,
        providerDetails: providerDetailsArb,
        profilePicture: profilePictureArb,
      });

      await fc.assert(
        fc.asyncProperty(userWithOnlyFullNameArb, async (user) => {
          const req = { provider: user };
          let capturedBody = null;
          const res = {
            json: jest.fn((body) => {
              capturedBody = body;
              return res;
            }),
            status: jest.fn().mockReturnThis(),
          };

          getProviderMe(req, res);

          // userName is falsy, fullName is truthy → name must equal fullName
          expect(capturedBody.data.name).toBe(user.fullName);
        }),
        { numRuns: 100 }
      );
    },
    60_000
  );

  it(
    "organizationName is null (never undefined) when providerDetails or organizationName is absent",
    async () => {
      // Users with no organizationName
      const noOrgNameUserArb = fc.record({
        userName: fc.oneof(fc.constant(null), nonEmptyStringArb),
        fullName: fc.oneof(fc.constant(null), nonEmptyStringArb),
        email: emailArb,
        providerDetails: fc.oneof(
          fc.constant(null),
          fc.constant(undefined),
          fc.record({
            organizationName: fc.oneof(
              fc.constant(null),
              fc.constant(undefined),
              fc.constant("")
            ),
          })
        ),
        profilePicture: profilePictureArb,
      });

      await fc.assert(
        fc.asyncProperty(noOrgNameUserArb, async (user) => {
          const req = { provider: user };
          let capturedBody = null;
          const res = {
            json: jest.fn((body) => {
              capturedBody = body;
              return res;
            }),
            status: jest.fn().mockReturnThis(),
          };

          getProviderMe(req, res);

          // organizationName must be null, not undefined
          expect(capturedBody.data.organizationName).toBeNull();
          expect(capturedBody.data.organizationName).not.toBeUndefined();
        }),
        { numRuns: 100 }
      );
    },
    60_000
  );

  it(
    "organizationName is returned correctly when providerDetails.organizationName is set",
    async () => {
      const userWithOrgArb = fc.record({
        userName: fc.oneof(fc.constant(null), nonEmptyStringArb),
        fullName: fc.oneof(fc.constant(null), nonEmptyStringArb),
        email: emailArb,
        providerDetails: fc.record({
          organizationName: nonEmptyStringArb,
        }),
        profilePicture: profilePictureArb,
      });

      await fc.assert(
        fc.asyncProperty(userWithOrgArb, async (user) => {
          const req = { provider: user };
          let capturedBody = null;
          const res = {
            json: jest.fn((body) => {
              capturedBody = body;
              return res;
            }),
            status: jest.fn().mockReturnThis(),
          };

          getProviderMe(req, res);

          expect(capturedBody.data.organizationName).toBe(
            user.providerDetails.organizationName
          );
        }),
        { numRuns: 100 }
      );
    },
    60_000
  );

  it(
    "profilePicture is null (never undefined) when the field is absent",
    async () => {
      const noPicUserArb = fc.record({
        userName: fc.oneof(fc.constant(null), nonEmptyStringArb),
        fullName: fc.oneof(fc.constant(null), nonEmptyStringArb),
        email: emailArb,
        providerDetails: providerDetailsArb,
        profilePicture: fc.oneof(
          fc.constant(null),
          fc.constant(undefined),
          fc.constant("")
        ),
      });

      await fc.assert(
        fc.asyncProperty(noPicUserArb, async (user) => {
          const req = { provider: user };
          let capturedBody = null;
          const res = {
            json: jest.fn((body) => {
              capturedBody = body;
              return res;
            }),
            status: jest.fn().mockReturnThis(),
          };

          getProviderMe(req, res);

          // profilePicture must be null, not undefined
          expect(capturedBody.data.profilePicture).toBeNull();
          expect(capturedBody.data.profilePicture).not.toBeUndefined();
        }),
        { numRuns: 100 }
      );
    },
    60_000
  );

  it(
    "profilePicture is returned as-is when the field is present",
    async () => {
      const withPicUserArb = fc.record({
        userName: fc.oneof(fc.constant(null), nonEmptyStringArb),
        fullName: fc.oneof(fc.constant(null), nonEmptyStringArb),
        email: emailArb,
        providerDetails: providerDetailsArb,
        profilePicture: fc.string({ minLength: 5, maxLength: 100 }).map(
          (s) => `/uploads/providers/${s}`
        ),
      });

      await fc.assert(
        fc.asyncProperty(withPicUserArb, async (user) => {
          const req = { provider: user };
          let capturedBody = null;
          const res = {
            json: jest.fn((body) => {
              capturedBody = body;
              return res;
            }),
            status: jest.fn().mockReturnThis(),
          };

          getProviderMe(req, res);

          expect(capturedBody.data.profilePicture).toBe(user.profilePicture);
        }),
        { numRuns: 100 }
      );
    },
    60_000
  );

  it(
    "all four fields map correctly for any combination of populated/absent fields",
    async () => {
      await fc.assert(
        fc.asyncProperty(providerUserArb, async (user) => {
          const req = { provider: user };
          let capturedBody = null;
          const res = {
            json: jest.fn((body) => {
              capturedBody = body;
              return res;
            }),
            status: jest.fn().mockReturnThis(),
          };

          getProviderMe(req, res);

          const data = capturedBody.data;

          // name: userName || fullName || null — never undefined
          expect(data.name).toBe(expectedName(user));
          expect(data.name).not.toBeUndefined();

          // email: user.email
          expect(data.email).toBe(user.email || null);

          // organizationName: providerDetails.organizationName || null — never undefined
          expect(data.organizationName).toBe(expectedOrganizationName(user));
          expect(data.organizationName).not.toBeUndefined();

          // profilePicture: user.profilePicture || null — never undefined
          expect(data.profilePicture).toBe(expectedProfilePicture(user));
          expect(data.profilePicture).not.toBeUndefined();
        }),
        { numRuns: 100 }
      );
    },
    60_000
  );
});
