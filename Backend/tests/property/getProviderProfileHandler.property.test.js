// Feature: provider-panel-enhancements, Property 3: GET /api/provider/profile maps all fields correctly (null for missing)

/**
 * Property 3: GET /api/provider/profile maps all fields correctly (null for missing)
 *
 * For any provider User document with any combination of populated and absent
 * profile fields, GET /api/provider/profile SHALL return a JSON object where
 * every required field (name, email, organizationName, position, phone,
 * officeAddress, description, website, profilePicture) is present, and fields
 * with no stored value are represented as null (never undefined).
 *
 * Validates: Requirements 6.1
 */

import { describe, it, expect, jest } from "@jest/globals";
import * as fc from "fast-check";
import { getProviderProfileHandler } from "../../controller/provider.controller.js";

// ── Arbitraries ──────────────────────────────────────────────────────────────

/**
 * Generates a non-empty, non-whitespace string (a "present" field value).
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
    fc
      .string({ minLength: 1, maxLength: 20 })
      .filter((s) => /^[a-z0-9]+$/i.test(s)),
    fc
      .string({ minLength: 1, maxLength: 10 })
      .filter((s) => /^[a-z]+$/i.test(s))
  )
  .map(([local, domain]) => `${local}@${domain}.com`);

/**
 * Generates an optional field value: either absent (null/undefined/"") or a
 * non-empty string. Simulates fields that may or may not be stored in MongoDB.
 */
const optionalStringArb = fc.oneof(
  fc.constant(null),
  fc.constant(undefined),
  fc.constant(""),
  nonEmptyStringArb
);

/**
 * Generates a URL-like profile picture path, or an absent value.
 */
const profilePictureArb = fc.oneof(
  fc.constant(null),
  fc.constant(undefined),
  fc.constant(""),
  fc.string({ minLength: 5, maxLength: 100 }).map((s) => `/uploads/providers/${s}`)
);

/**
 * Generates a providerDetails sub-document with any combination of populated
 * or absent fields. Also allows the entire sub-document to be absent.
 *
 * Covers all 6 providerDetails fields referenced by getProviderProfileHandler:
 *   organizationName, position, phone, officeAddress, description, website
 */
const providerDetailsArb = fc.oneof(
  fc.constant(null),
  fc.constant(undefined),
  fc.record({
    organizationName: optionalStringArb,
    position: optionalStringArb,
    phone: optionalStringArb,
    officeAddress: optionalStringArb,
    description: optionalStringArb,
    website: optionalStringArb,
  }),
  // Partial sub-document — some fields present, some absent
  fc.record({
    organizationName: optionalStringArb,
  }),
  fc.record({
    position: optionalStringArb,
    phone: optionalStringArb,
  }),
  fc.record({
    description: optionalStringArb,
    website: optionalStringArb,
  })
);

/**
 * Generates a full provider user document with any combination of populated
 * or absent profile fields. Matches the structure of a Mongoose User document
 * as seen by getProviderProfileHandler via req.provider.
 */
const providerUserArb = fc.record({
  userName: optionalStringArb,
  fullName: optionalStringArb,
  email: emailArb,
  providerDetails: providerDetailsArb,
  profilePicture: profilePictureArb,
});

// ── Required fields ───────────────────────────────────────────────────────────

const REQUIRED_FIELDS = [
  "name",
  "email",
  "organizationName",
  "position",
  "phone",
  "officeAddress",
  "description",
  "website",
  "profilePicture",
];

// ── Helper: derive expected field values ──────────────────────────────────────

/**
 * Mirrors the controller logic for each field:
 *   user.userName || user.fullName || null
 *   user.email || null
 *   user.providerDetails?.organizationName || null
 *   user.providerDetails?.position || null
 *   user.providerDetails?.phone || null
 *   user.providerDetails?.officeAddress || null
 *   user.providerDetails?.description || null
 *   user.providerDetails?.website || null
 *   user.profilePicture || null
 */
function expectedProfile(user) {
  return {
    name: user.userName || user.fullName || null,
    email: user.email || null,
    organizationName: user.providerDetails?.organizationName || null,
    position: user.providerDetails?.position || null,
    phone: user.providerDetails?.phone || null,
    officeAddress: user.providerDetails?.officeAddress || null,
    description: user.providerDetails?.description || null,
    website: user.providerDetails?.website || null,
    profilePicture: user.profilePicture || null,
  };
}

// ── Helper: build mock req/res ────────────────────────────────────────────────

function buildReqRes(user) {
  let capturedBody = null;
  const req = { provider: user };
  const res = {
    json: jest.fn((body) => {
      capturedBody = body;
      return res;
    }),
    status: jest.fn().mockReturnThis(),
  };
  return { req, res, getBody: () => capturedBody };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Property 3 — getProviderProfileHandler maps all fields correctly (null for missing)", () => {
  it(
    "always returns success:true with all 9 required fields present in data",
    async () => {
      await fc.assert(
        fc.asyncProperty(providerUserArb, async (user) => {
          const { req, res, getBody } = buildReqRes(user);

          getProviderProfileHandler(req, res);

          const body = getBody();
          expect(body).not.toBeNull();
          expect(body.success).toBe(true);
          expect(body.data).toBeDefined();

          // All 9 required fields must be present (not missing from the object)
          for (const field of REQUIRED_FIELDS) {
            expect(body.data).toHaveProperty(field);
          }
        }),
        { numRuns: 100 }
      );
    },
    60_000
  );

  it(
    "missing field values are null, never undefined",
    async () => {
      // Generate users where all optional fields are absent
      const allAbsentArb = fc.record({
        userName: fc.oneof(fc.constant(null), fc.constant(undefined), fc.constant("")),
        fullName: fc.oneof(fc.constant(null), fc.constant(undefined), fc.constant("")),
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
            position: fc.oneof(
              fc.constant(null),
              fc.constant(undefined),
              fc.constant("")
            ),
            phone: fc.oneof(
              fc.constant(null),
              fc.constant(undefined),
              fc.constant("")
            ),
            officeAddress: fc.oneof(
              fc.constant(null),
              fc.constant(undefined),
              fc.constant("")
            ),
            description: fc.oneof(
              fc.constant(null),
              fc.constant(undefined),
              fc.constant("")
            ),
            website: fc.oneof(
              fc.constant(null),
              fc.constant(undefined),
              fc.constant("")
            ),
          })
        ),
        profilePicture: fc.oneof(
          fc.constant(null),
          fc.constant(undefined),
          fc.constant("")
        ),
      });

      await fc.assert(
        fc.asyncProperty(allAbsentArb, async (user) => {
          const { req, res, getBody } = buildReqRes(user);

          getProviderProfileHandler(req, res);

          const body = getBody();
          const data = body.data;

          // Every field must be null, not undefined
          for (const field of REQUIRED_FIELDS) {
            expect(data[field]).not.toBeUndefined();
            // For optional fields, the value should be null when not set
            if (field !== "email") {
              expect(data[field]).toBeNull();
            }
          }
        }),
        { numRuns: 100 }
      );
    },
    60_000
  );

  it(
    "all 9 fields map to their correct values for any combination of populated/absent fields",
    async () => {
      await fc.assert(
        fc.asyncProperty(providerUserArb, async (user) => {
          const { req, res, getBody } = buildReqRes(user);

          getProviderProfileHandler(req, res);

          const body = getBody();
          const data = body.data;
          const expected = expectedProfile(user);

          // Each field must match the expected mapping logic
          expect(data.name).toBe(expected.name);
          expect(data.email).toBe(expected.email);
          expect(data.organizationName).toBe(expected.organizationName);
          expect(data.position).toBe(expected.position);
          expect(data.phone).toBe(expected.phone);
          expect(data.officeAddress).toBe(expected.officeAddress);
          expect(data.description).toBe(expected.description);
          expect(data.website).toBe(expected.website);
          expect(data.profilePicture).toBe(expected.profilePicture);

          // None of the fields may be undefined
          for (const field of REQUIRED_FIELDS) {
            expect(data[field]).not.toBeUndefined();
          }
        }),
        { numRuns: 100 }
      );
    },
    60_000
  );

  it(
    "name falls back to null when both userName and fullName are absent",
    async () => {
      const noNameArb = fc.record({
        userName: fc.oneof(fc.constant(null), fc.constant(undefined), fc.constant("")),
        fullName: fc.oneof(fc.constant(null), fc.constant(undefined), fc.constant("")),
        email: emailArb,
        providerDetails: providerDetailsArb,
        profilePicture: profilePictureArb,
      });

      await fc.assert(
        fc.asyncProperty(noNameArb, async (user) => {
          const { req, res, getBody } = buildReqRes(user);

          getProviderProfileHandler(req, res);

          const data = getBody().data;
          expect(data.name).toBeNull();
          expect(data.name).not.toBeUndefined();
        }),
        { numRuns: 100 }
      );
    },
    60_000
  );

  it(
    "name uses userName when userName is a non-empty string",
    async () => {
      const withUserNameArb = fc.record({
        userName: nonEmptyStringArb,
        fullName: optionalStringArb,
        email: emailArb,
        providerDetails: providerDetailsArb,
        profilePicture: profilePictureArb,
      });

      await fc.assert(
        fc.asyncProperty(withUserNameArb, async (user) => {
          const { req, res, getBody } = buildReqRes(user);

          getProviderProfileHandler(req, res);

          const data = getBody().data;
          // userName is truthy → name must equal userName
          expect(data.name).toBe(user.userName);
        }),
        { numRuns: 100 }
      );
    },
    60_000
  );

  it(
    "all providerDetails sub-fields are null when providerDetails is absent",
    async () => {
      const noDetailsArb = fc.record({
        userName: optionalStringArb,
        fullName: optionalStringArb,
        email: emailArb,
        providerDetails: fc.oneof(fc.constant(null), fc.constant(undefined)),
        profilePicture: profilePictureArb,
      });

      await fc.assert(
        fc.asyncProperty(noDetailsArb, async (user) => {
          const { req, res, getBody } = buildReqRes(user);

          getProviderProfileHandler(req, res);

          const data = getBody().data;

          expect(data.organizationName).toBeNull();
          expect(data.position).toBeNull();
          expect(data.phone).toBeNull();
          expect(data.officeAddress).toBeNull();
          expect(data.description).toBeNull();
          expect(data.website).toBeNull();
        }),
        { numRuns: 100 }
      );
    },
    60_000
  );

  it(
    "providerDetails sub-fields are returned correctly when providerDetails is fully populated",
    async () => {
      const allPresentArb = fc.record({
        userName: nonEmptyStringArb,
        fullName: nonEmptyStringArb,
        email: emailArb,
        providerDetails: fc.record({
          organizationName: nonEmptyStringArb,
          position: nonEmptyStringArb,
          phone: nonEmptyStringArb,
          officeAddress: nonEmptyStringArb,
          description: nonEmptyStringArb,
          website: nonEmptyStringArb,
        }),
        profilePicture: fc
          .string({ minLength: 5, maxLength: 100 })
          .map((s) => `/uploads/providers/${s}`),
      });

      await fc.assert(
        fc.asyncProperty(allPresentArb, async (user) => {
          const { req, res, getBody } = buildReqRes(user);

          getProviderProfileHandler(req, res);

          const data = getBody().data;
          const pd = user.providerDetails;

          expect(data.organizationName).toBe(pd.organizationName);
          expect(data.position).toBe(pd.position);
          expect(data.phone).toBe(pd.phone);
          expect(data.officeAddress).toBe(pd.officeAddress);
          expect(data.description).toBe(pd.description);
          expect(data.website).toBe(pd.website);
          expect(data.profilePicture).toBe(user.profilePicture);
        }),
        { numRuns: 100 }
      );
    },
    60_000
  );

  it(
    "profilePicture is null when the field is absent or empty",
    async () => {
      const noPicArb = fc.record({
        userName: optionalStringArb,
        fullName: optionalStringArb,
        email: emailArb,
        providerDetails: providerDetailsArb,
        profilePicture: fc.oneof(
          fc.constant(null),
          fc.constant(undefined),
          fc.constant("")
        ),
      });

      await fc.assert(
        fc.asyncProperty(noPicArb, async (user) => {
          const { req, res, getBody } = buildReqRes(user);

          getProviderProfileHandler(req, res);

          const data = getBody().data;
          expect(data.profilePicture).toBeNull();
          expect(data.profilePicture).not.toBeUndefined();
        }),
        { numRuns: 100 }
      );
    },
    60_000
  );
});
