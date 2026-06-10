// Feature: provider-panel-enhancements, Property 4: PUT /api/provider/profile is a partial update

/**
 * Property 4: PUT /api/provider/profile is a partial update
 *
 * For any provider User document and any partial body sent to
 * PUT /api/provider/profile, only the fields present in the body SHALL be
 * updated in the database; all fields absent from the body SHALL remain
 * unchanged after the operation.
 *
 * Specifically: the `$set` argument passed to `User.findByIdAndUpdate` MUST
 * contain ONLY the keys that correspond to the fields present in the request
 * body, and MUST NOT contain keys for fields that were absent from the body.
 *
 * Body → $set key mapping:
 *   name             → userName
 *   organizationName → providerDetails.organizationName
 *   position         → providerDetails.position
 *   phone            → providerDetails.phone
 *   officeAddress    → providerDetails.officeAddress
 *   description      → providerDetails.description
 *   website          → providerDetails.website
 *
 * Validates: Requirements 6.2
 */

import { describe, it, expect, jest } from "@jest/globals";
import * as fc from "fast-check";
import { updateProviderProfile } from "../controller/provider.controller.js";

// ── Constants ─────────────────────────────────────────────────────────────────

/** All allowed body fields for PUT /api/provider/profile */
const ALLOWED_BODY_FIELDS = [
  "name",
  "organizationName",
  "position",
  "phone",
  "officeAddress",
  "description",
  "website",
];

/**
 * Maps each body field name to its corresponding $set key used in
 * User.findByIdAndUpdate by the updateProviderProfile controller.
 */
const BODY_TO_SET_KEY = {
  name: "userName",
  organizationName: "providerDetails.organizationName",
  position: "providerDetails.position",
  phone: "providerDetails.phone",
  officeAddress: "providerDetails.officeAddress",
  description: "providerDetails.description",
  website: "providerDetails.website",
};

// ── Arbitraries ──────────────────────────────────────────────────────────────

/**
 * Generates a valid non-empty, non-whitespace string suitable for profile
 * fields. Trimmed to avoid triggering HTTP 400 blank validation.
 */
const nonEmptyStringArb = fc
  .string({ minLength: 1, maxLength: 80 })
  .filter((s) => s.trim().length > 0)
  .map((s) => s.trim());

/**
 * Generates a valid URL string that starts with http:// or https://.
 * Avoids triggering the website URL validation.
 */
const validUrlArb = fc
  .string({ minLength: 1, maxLength: 60 })
  .filter((s) => s.trim().length > 0)
  .map((s) => `https://${s.replace(/[^a-zA-Z0-9.-]/g, "a")}.com`);

/**
 * For each allowed body field, provides an arbitrary that generates a valid
 * value (passing all server-side validations). The `website` field uses the
 * valid URL arbitrary; all other fields use a non-empty string.
 */
const validFieldValueArb = (fieldName) => {
  if (fieldName === "website") return validUrlArb;
  return nonEmptyStringArb;
};

/**
 * Generates a non-empty subset of ALLOWED_BODY_FIELDS as an array of field
 * names. At least one field is always included, at most all seven.
 */
const partialFieldSubsetArb = fc
  .subarray(ALLOWED_BODY_FIELDS, { minLength: 1, maxLength: ALLOWED_BODY_FIELDS.length });

/**
 * Given a list of field names, generates a valid partial body object where
 * each of those fields has a valid value.
 */
function buildPartialBodyArb(fields) {
  const recordShape = {};
  for (const field of fields) {
    recordShape[field] = validFieldValueArb(field);
  }
  return fc.record(recordShape);
}

/**
 * Generates a pair of:
 *   - selectedFields: a non-empty subset of allowed field names
 *   - body: a partial request body containing exactly those fields with valid values
 */
const partialBodyArb = partialFieldSubsetArb.chain((fields) =>
  buildPartialBodyArb(fields).map((body) => ({ selectedFields: fields, body }))
);

/**
 * Generates a minimal provider user document. The actual shape matters less
 * here since we focus on the $set passed to findByIdAndUpdate — but we need
 * a valid providerId.
 * Uses base64String mapped to a 24-char hex-like string.
 */
const providerIdArb = fc
  .stringMatching(/^[a-f0-9]{24}$/);

// ── Mock helpers ──────────────────────────────────────────────────────────────

/**
 * Builds a mock req/res pair for the updateProviderProfile handler.
 *
 * @param {string} providerId - Simulated provider ID
 * @param {object} body       - Simulated request body (partial profile fields)
 * @param {object} updatedDoc - The "updated" document returned by the mock DB
 * @returns {{ req, res, getResponseBody, getCapturedUpdate }}
 */
function buildReqRes(providerId, body, updatedDoc) {
  let responseBody = null;
  let responseStatus = 200;
  let capturedId = null;
  let capturedUpdate = null;
  let capturedOptions = null;

  // Mock User.findByIdAndUpdate at the module level via jest.mock is tricky
  // with ES modules. Instead we inject via the module's imported User.
  // We return a helper that captures what was passed.
  const mockFindByIdAndUpdate = jest.fn(async (id, update, options) => {
    capturedId = id;
    capturedUpdate = update;
    capturedOptions = options;
    return updatedDoc;
  });

  const req = {
    providerId,
    body,
    provider: updatedDoc,
  };

  const res = {
    status: jest.fn(function (code) {
      responseStatus = code;
      return this;
    }),
    json: jest.fn(function (data) {
      responseBody = data;
      return this;
    }),
  };

  return {
    req,
    res,
    mockFindByIdAndUpdate,
    getResponseBody: () => responseBody,
    getResponseStatus: () => responseStatus,
    getCapturedUpdate: () => capturedUpdate,
    getCapturedId: () => capturedId,
  };
}

// ── Module-level mock for User.findByIdAndUpdate ──────────────────────────────

// We use jest.unstable_mockModule or manual module spy. Since the controller
// imports User directly, we need to intercept via jest's module system.
// For ES module mocking without babel, we spy on the imported User prototype
// after importing it.

import User from "../models/user.model.js";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Property 4 — PUT /api/provider/profile is a partial update", () => {
  it(
    "$set contains exactly the keys that correspond to fields present in the body",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          partialBodyArb,
          providerIdArb,
          async ({ selectedFields, body }, providerId) => {
            // Build the expected set of $set keys based on which body fields
            // were selected. The controller maps each body field to a $set key
            // per BODY_TO_SET_KEY.
            const expectedSetKeys = new Set(
              selectedFields.map((f) => BODY_TO_SET_KEY[f])
            );

            // Build a minimal updatedDoc that satisfies mapProviderProfile
            // (the function the controller calls on the returned user document).
            const updatedDoc = {
              _id: providerId,
              userName: body.name ?? "Provider",
              email: "test@example.com",
              providerDetails: {
                organizationName: body.organizationName ?? null,
                position: body.position ?? null,
                phone: body.phone ?? null,
                officeAddress: body.officeAddress ?? null,
                description: body.description ?? null,
                website: body.website ?? null,
              },
              profilePicture: null,
            };

            // Spy on User.findByIdAndUpdate for this invocation
            let capturedSetArg = null;
            const spy = jest
              .spyOn(User, "findByIdAndUpdate")
              .mockImplementationOnce(async (_id, update, _opts) => {
                capturedSetArg = update.$set;
                return updatedDoc;
              });

            const req = {
              providerId,
              body,
            };

            let responseBody = null;
            let responseStatus = 200;
            const res = {
              status: jest.fn(function (code) {
                responseStatus = code;
                return this;
              }),
              json: jest.fn(function (data) {
                responseBody = data;
                return this;
              }),
            };

            await updateProviderProfile(req, res);

            // The handler must have called findByIdAndUpdate (success path)
            // or returned 400 (validation path). For valid bodies we should
            // reach findByIdAndUpdate.
            //
            // Verify we reached the DB call:
            expect(capturedSetArg).not.toBeNull();

            // The $set must have exactly the expected keys — no more, no less.
            const actualSetKeys = new Set(Object.keys(capturedSetArg));

            // 1. Every expected key must be in $set
            for (const key of expectedSetKeys) {
              expect(actualSetKeys).toContain(key);
            }

            // 2. No extra keys (keys for absent body fields) may be in $set
            const absentBodyFields = ALLOWED_BODY_FIELDS.filter(
              (f) => !selectedFields.includes(f)
            );
            const forbiddenSetKeys = absentBodyFields.map(
              (f) => BODY_TO_SET_KEY[f]
            );
            for (const key of forbiddenSetKeys) {
              expect(actualSetKeys).not.toContain(key);
            }

            // 3. The total number of keys in $set must equal the number of
            //    selected fields (one-to-one mapping, no duplicates)
            expect(actualSetKeys.size).toBe(expectedSetKeys.size);

            spy.mockRestore();
          }
        ),
        { numRuns: 100 }
      );
    },
    60_000
  );

  it(
    "$set values match the values provided in the request body",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          partialBodyArb,
          providerIdArb,
          async ({ selectedFields, body }, providerId) => {
            const updatedDoc = {
              _id: providerId,
              userName: body.name ?? "Provider",
              email: "test@example.com",
              providerDetails: {
                organizationName: body.organizationName ?? null,
                position: body.position ?? null,
                phone: body.phone ?? null,
                officeAddress: body.officeAddress ?? null,
                description: body.description ?? null,
                website: body.website ?? null,
              },
              profilePicture: null,
            };

            let capturedSetArg = null;
            const spy = jest
              .spyOn(User, "findByIdAndUpdate")
              .mockImplementationOnce(async (_id, update, _opts) => {
                capturedSetArg = update.$set;
                return updatedDoc;
              });

            const req = { providerId, body };
            let responseBody = null;
            let responseStatus = 200;
            const res = {
              status: jest.fn(function (code) {
                responseStatus = code;
                return this;
              }),
              json: jest.fn(function (data) {
                responseBody = data;
                return this;
              }),
            };

            await updateProviderProfile(req, res);

            expect(capturedSetArg).not.toBeNull();

            // For each field present in the body, the corresponding $set key
            // must hold a value derived from that body field.
            for (const field of selectedFields) {
              const setKey = BODY_TO_SET_KEY[field];
              // The controller trims name; for other fields values are used as-is.
              if (field === "name") {
                expect(capturedSetArg["userName"]).toBe(
                  String(body.name).trim()
                );
              } else if (field === "organizationName") {
                expect(capturedSetArg["providerDetails.organizationName"]).toBe(
                  String(body.organizationName).trim()
                );
              } else {
                // position, phone, officeAddress, description, website are
                // stored as-is (controller does not trim these)
                expect(capturedSetArg[setKey]).toBe(body[field]);
              }
            }

            spy.mockRestore();
          }
        ),
        { numRuns: 100 }
      );
    },
    60_000
  );

  it(
    "a body containing all 7 allowed fields produces a $set with all 7 mapped keys",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc
            .record({
              name: nonEmptyStringArb,
              organizationName: nonEmptyStringArb,
              position: nonEmptyStringArb,
              phone: nonEmptyStringArb,
              officeAddress: nonEmptyStringArb,
              description: nonEmptyStringArb,
              website: validUrlArb,
            }),
          providerIdArb,
          async (body, providerId) => {
            const updatedDoc = {
              _id: providerId,
              userName: body.name,
              email: "test@example.com",
              providerDetails: {
                organizationName: body.organizationName,
                position: body.position,
                phone: body.phone,
                officeAddress: body.officeAddress,
                description: body.description,
                website: body.website,
              },
              profilePicture: null,
            };

            let capturedSetArg = null;
            const spy = jest
              .spyOn(User, "findByIdAndUpdate")
              .mockImplementationOnce(async (_id, update, _opts) => {
                capturedSetArg = update.$set;
                return updatedDoc;
              });

            const req = { providerId, body };
            const res = {
              status: jest.fn(function (code) { return this; }),
              json: jest.fn(function (data) { return this; }),
            };

            await updateProviderProfile(req, res);

            expect(capturedSetArg).not.toBeNull();

            // All 7 $set keys must be present
            const allSetKeys = Object.values(BODY_TO_SET_KEY);
            for (const key of allSetKeys) {
              expect(Object.keys(capturedSetArg)).toContain(key);
            }
            expect(Object.keys(capturedSetArg).length).toBe(7);

            spy.mockRestore();
          }
        ),
        { numRuns: 100 }
      );
    },
    60_000
  );

  it(
    "a body with only one field produces a $set with exactly one key",
    async () => {
      // Test each single-field case individually with property-based values
      const singleFieldBodies = ALLOWED_BODY_FIELDS.map((field) => ({
        field,
        arb:
          field === "website"
            ? validUrlArb.map((v) => ({ [field]: v }))
            : nonEmptyStringArb.map((v) => ({ [field]: v })),
      }));

      for (const { field, arb } of singleFieldBodies) {
        await fc.assert(
          fc.asyncProperty(arb, providerIdArb, async (body, providerId) => {
            const updatedDoc = {
              _id: providerId,
              userName: body.name ?? "Provider",
              email: "test@example.com",
              providerDetails: {
                organizationName: body.organizationName ?? null,
                position: body.position ?? null,
                phone: body.phone ?? null,
                officeAddress: body.officeAddress ?? null,
                description: body.description ?? null,
                website: body.website ?? null,
              },
              profilePicture: null,
            };

            let capturedSetArg = null;
            const spy = jest
              .spyOn(User, "findByIdAndUpdate")
              .mockImplementationOnce(async (_id, update, _opts) => {
                capturedSetArg = update.$set;
                return updatedDoc;
              });

            const req = { providerId, body };
            const res = {
              status: jest.fn(function (code) { return this; }),
              json: jest.fn(function (data) { return this; }),
            };

            await updateProviderProfile(req, res);

            expect(capturedSetArg).not.toBeNull();

            // Exactly one key in $set
            expect(Object.keys(capturedSetArg).length).toBe(1);

            // That key must be the mapped key for this field
            const expectedKey = BODY_TO_SET_KEY[field];
            expect(Object.keys(capturedSetArg)[0]).toBe(expectedKey);

            // All other mapped keys must NOT be present
            for (const [otherField, otherKey] of Object.entries(BODY_TO_SET_KEY)) {
              if (otherField !== field) {
                expect(Object.keys(capturedSetArg)).not.toContain(otherKey);
              }
            }

            spy.mockRestore();
          }),
          { numRuns: 30 } // 30 runs × 7 fields = 210 total iterations
        );
      }
    },
    120_000
  );
});
