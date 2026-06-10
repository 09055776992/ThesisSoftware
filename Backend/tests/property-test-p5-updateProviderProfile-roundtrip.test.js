// Feature: provider-panel-enhancements, Property 5: PUT /api/provider/profile round-trip

/**
 * Property 5: PUT /api/provider/profile round-trip
 *
 * For any valid profile update body, after a successful PUT /api/provider/profile,
 * a subsequent GET /api/provider/profile SHALL return a response where every field
 * supplied in the PUT body is present with the updated value.
 *
 * The round-trip is simulated in-process:
 *   1. A base provider User document is created.
 *   2. `updateProviderProfile` is called with the partial body.
 *      A mock DB intercepts the $set, applies it to the base document,
 *      and returns the merged ("persisted") document.
 *   3. `getProviderProfileHandler` is called with that merged document as req.provider.
 *   4. The GET response is compared against the values in the PUT body.
 *
 * Validates: Requirements 6.3
 */

import { describe, it, expect, jest } from "@jest/globals";
import * as fc from "fast-check";
import { updateProviderProfile, getProviderProfileHandler } from "../controller/provider.controller.js";
import User from "../models/user.model.js";

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
 * Maps each body field name to its dot-notation $set key used by
 * updateProviderProfile, and the path used to read the value back from
 * the user document in getProviderProfileHandler.
 */
const FIELD_META = {
  name:             { setKey: "userName",                           getPath: (u) => u.userName || u.fullName || null },
  organizationName: { setKey: "providerDetails.organizationName",   getPath: (u) => u.providerDetails?.organizationName || null },
  position:         { setKey: "providerDetails.position",           getPath: (u) => u.providerDetails?.position || null },
  phone:            { setKey: "providerDetails.phone",              getPath: (u) => u.providerDetails?.phone || null },
  officeAddress:    { setKey: "providerDetails.officeAddress",      getPath: (u) => u.providerDetails?.officeAddress || null },
  description:      { setKey: "providerDetails.description",        getPath: (u) => u.providerDetails?.description || null },
  website:          { setKey: "providerDetails.website",            getPath: (u) => u.providerDetails?.website || null },
};

/**
 * Maps a body field name to the corresponding key in the GET response data.
 * For most fields this is identity; "name" stays "name" in the response.
 */
const BODY_TO_RESPONSE_KEY = {
  name:             "name",
  organizationName: "organizationName",
  position:         "position",
  phone:            "phone",
  officeAddress:    "officeAddress",
  description:      "description",
  website:          "website",
};

// ── Arbitraries ──────────────────────────────────────────────────────────────

/**
 * Generates a valid non-empty, non-whitespace string.
 * Trimmed to avoid triggering the blank-field HTTP 400 validation.
 */
const nonEmptyStringArb = fc
  .string({ minLength: 1, maxLength: 80 })
  .filter((s) => s.trim().length > 0)
  .map((s) => s.trim());

/**
 * Generates a valid website URL that starts with http:// or https://.
 */
const validUrlArb = fc
  .string({ minLength: 1, maxLength: 40 })
  .filter((s) => /^[a-zA-Z0-9.-]+$/.test(s) && s.length > 0)
  .map((s) => `https://${s}.com`);

/**
 * Returns an arbitrary that generates a valid value for a given body field.
 */
function validValueArbForField(fieldName) {
  if (fieldName === "website") return validUrlArb;
  return nonEmptyStringArb;
}

/**
 * Generates a non-empty subset of ALLOWED_BODY_FIELDS (the fields to include
 * in the PUT body). At least one field, at most all seven.
 */
const selectedFieldsArb = fc.subarray(ALLOWED_BODY_FIELDS, {
  minLength: 1,
  maxLength: ALLOWED_BODY_FIELDS.length,
});

/**
 * Generates a complete partial body from a set of selected field names, each
 * with a valid value.
 */
function buildBodyArb(fields) {
  const shape = {};
  for (const f of fields) {
    shape[f] = validValueArbForField(f);
  }
  return fc.record(shape);
}

/**
 * Generates a pair { selectedFields, body } where body contains exactly the
 * selected fields, each with a valid value.
 */
const partialBodyArb = selectedFieldsArb.chain((fields) =>
  buildBodyArb(fields).map((body) => ({ selectedFields: fields, body }))
);

/**
 * Generates a minimal base provider User document. This represents the state
 * of the document in the DB before the PUT is applied.
 */
const baseUserArb = fc.record({
  _id: fc.constant("6000000000000000000000ab"),
  userName: nonEmptyStringArb,
  email: fc
    .tuple(
      fc.stringMatching(/^[a-z0-9]{1,15}$/),
      fc.stringMatching(/^[a-z]{2,8}$/)
    )
    .map(([local, domain]) => `${local}@${domain}.com`),
  providerDetails: fc.record({
    organizationName: nonEmptyStringArb,
    position:         nonEmptyStringArb,
    phone:            nonEmptyStringArb,
    officeAddress:    nonEmptyStringArb,
    description:      nonEmptyStringArb,
    website:          validUrlArb,
  }),
  profilePicture: fc.constant(null),
});

// ── Helper: apply $set to a user document ─────────────────────────────────────

/**
 * Mimics what MongoDB does when you run findByIdAndUpdate with $set.
 * Handles dot-notation keys like "providerDetails.organizationName".
 *
 * Returns a new document (deep-cloned then mutated) so the original is
 * untouched.
 */
function applySetToDocument(doc, setObj) {
  // Deep clone via JSON round-trip (sufficient for plain objects)
  const result = JSON.parse(JSON.stringify(doc));

  for (const [dotKey, value] of Object.entries(setObj)) {
    const parts = dotKey.split(".");
    let target = result;
    for (let i = 0; i < parts.length - 1; i++) {
      if (target[parts[i]] == null) {
        target[parts[i]] = {};
      }
      target = target[parts[i]];
    }
    target[parts[parts.length - 1]] = value;
  }

  return result;
}

// ── Helper: build mock req / res ──────────────────────────────────────────────

function buildMockRes() {
  let capturedBody = null;
  let capturedStatus = 200;
  const res = {
    status: jest.fn(function (code) {
      capturedStatus = code;
      return this;
    }),
    json: jest.fn(function (data) {
      capturedBody = data;
      return this;
    }),
  };
  return {
    res,
    getBody: () => capturedBody,
    getStatus: () => capturedStatus,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Property 5 — PUT /api/provider/profile round-trip", () => {
  it(
    "every field supplied in the PUT body appears with its updated value in the subsequent GET response",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          partialBodyArb,
          baseUserArb,
          async ({ selectedFields, body }, baseUser) => {
            // ── Step 1: Call updateProviderProfile ──────────────────────────
            // Mock User.findByIdAndUpdate so it:
            //   a) captures the $set argument
            //   b) applies $set to baseUser and returns the merged document

            let capturedSetArg = null;
            let mergedDoc = null;

            const spy = jest
              .spyOn(User, "findByIdAndUpdate")
              .mockImplementationOnce(async (_id, update, _opts) => {
                capturedSetArg = update.$set;
                mergedDoc = applySetToDocument(baseUser, capturedSetArg);
                return mergedDoc;
              });

            const putReq = {
              providerId: baseUser._id,
              body,
            };
            const { res: putRes, getBody: getPutBody, getStatus: getPutStatus } = buildMockRes();

            await updateProviderProfile(putReq, putRes);

            spy.mockRestore();

            // The PUT must have succeeded (HTTP 200 / success: true)
            expect(getPutStatus()).toBe(200);
            const putBody = getPutBody();
            expect(putBody).not.toBeNull();
            expect(putBody.success).toBe(true);

            // The DB must have been called (we expect a valid body → DB write)
            expect(capturedSetArg).not.toBeNull();
            expect(mergedDoc).not.toBeNull();

            // ── Step 2: Call getProviderProfileHandler with merged document ─
            const getReq = {
              provider: mergedDoc,
            };
            const { res: getRes, getBody: getGetBody } = buildMockRes();

            getProviderProfileHandler(getReq, getRes);

            const getBody = getGetBody();
            expect(getBody).not.toBeNull();
            expect(getBody.success).toBe(true);
            expect(getBody.data).toBeDefined();

            const data = getBody.data;

            // ── Step 3: Assert every field supplied in body is in GET response
            for (const field of selectedFields) {
              const responseKey = BODY_TO_RESPONSE_KEY[field];

              // The GET response must contain this key
              expect(data).toHaveProperty(responseKey);

              // The value must NOT be undefined
              expect(data[responseKey]).not.toBeUndefined();

              // Derive the expected value:
              // - "name" and "organizationName" are trimmed by the controller
              // - Other fields are stored as-is
              let expectedValue;
              if (field === "name" || field === "organizationName") {
                expectedValue = String(body[field]).trim();
              } else {
                expectedValue = body[field];
              }

              expect(data[responseKey]).toBe(expectedValue);
            }
          }
        ),
        { numRuns: 100 }
      );
    },
    60_000
  );

  it(
    "GET response reflects the latest PUT values even when multiple fields are updated simultaneously",
    async () => {
      // Use the full-body case (all 7 fields) for this sub-test
      const fullBodyArb = fc.record({
        name:             nonEmptyStringArb,
        organizationName: nonEmptyStringArb,
        position:         nonEmptyStringArb,
        phone:            nonEmptyStringArb,
        officeAddress:    nonEmptyStringArb,
        description:      nonEmptyStringArb,
        website:          validUrlArb,
      });

      await fc.assert(
        fc.asyncProperty(
          fullBodyArb,
          baseUserArb,
          async (body, baseUser) => {
            let capturedSetArg = null;
            let mergedDoc = null;

            const spy = jest
              .spyOn(User, "findByIdAndUpdate")
              .mockImplementationOnce(async (_id, update, _opts) => {
                capturedSetArg = update.$set;
                mergedDoc = applySetToDocument(baseUser, capturedSetArg);
                return mergedDoc;
              });

            const putReq = { providerId: baseUser._id, body };
            const { res: putRes, getStatus: getPutStatus } = buildMockRes();

            await updateProviderProfile(putReq, putRes);
            spy.mockRestore();

            expect(getPutStatus()).toBe(200);
            expect(capturedSetArg).not.toBeNull();

            // GET phase
            const getReq = { provider: mergedDoc };
            const { res: getRes, getBody: getGetBody } = buildMockRes();

            getProviderProfileHandler(getReq, getRes);

            const data = getGetBody().data;

            // All 7 fields must match their PUT body values
            expect(data.name).toBe(String(body.name).trim());
            expect(data.organizationName).toBe(String(body.organizationName).trim());
            expect(data.position).toBe(body.position);
            expect(data.phone).toBe(body.phone);
            expect(data.officeAddress).toBe(body.officeAddress);
            expect(data.description).toBe(body.description);
            expect(data.website).toBe(body.website);
          }
        ),
        { numRuns: 100 }
      );
    },
    60_000
  );

  it(
    "fields NOT included in the PUT body retain their original values after the round-trip",
    async () => {
      // Generate a body with only 1–6 fields (not all 7) to test that absent
      // fields are preserved from the base document.
      const partialNotAllArb = selectedFieldsArb
        .filter((fields) => fields.length < ALLOWED_BODY_FIELDS.length)
        .chain((fields) =>
          buildBodyArb(fields).map((body) => ({ selectedFields: fields, body }))
        );

      await fc.assert(
        fc.asyncProperty(
          partialNotAllArb,
          baseUserArb,
          async ({ selectedFields, body }, baseUser) => {
            let capturedSetArg = null;
            let mergedDoc = null;

            const spy = jest
              .spyOn(User, "findByIdAndUpdate")
              .mockImplementationOnce(async (_id, update, _opts) => {
                capturedSetArg = update.$set;
                mergedDoc = applySetToDocument(baseUser, capturedSetArg);
                return mergedDoc;
              });

            const putReq = { providerId: baseUser._id, body };
            const { res: putRes, getStatus: getPutStatus } = buildMockRes();

            await updateProviderProfile(putReq, putRes);
            spy.mockRestore();

            expect(getPutStatus()).toBe(200);
            expect(capturedSetArg).not.toBeNull();

            // GET phase — use merged doc
            const getReq = { provider: mergedDoc };
            const { res: getRes, getBody: getGetBody } = buildMockRes();
            getProviderProfileHandler(getReq, getRes);

            const data = getGetBody().data;

            // Fields that were NOT in the PUT body must still match base doc values
            const absentFields = ALLOWED_BODY_FIELDS.filter(
              (f) => !selectedFields.includes(f)
            );

            for (const field of absentFields) {
              const responseKey = BODY_TO_RESPONSE_KEY[field];
              // The base document's value (via FIELD_META getter) should equal
              // what GET returns — i.e., it was not overwritten.
              const baseValue = FIELD_META[field].getPath(baseUser);
              expect(data[responseKey]).toBe(baseValue);
            }
          }
        ),
        { numRuns: 100 }
      );
    },
    60_000
  );

  it(
    "the PUT response (data field) already reflects the updated values — no separate GET needed",
    async () => {
      // Per Requirement 6.3, the PUT response returns the full updated profile
      // in the same shape as GET. This sub-test verifies that property
      // directly on the PUT response body.
      await fc.assert(
        fc.asyncProperty(
          partialBodyArb,
          baseUserArb,
          async ({ selectedFields, body }, baseUser) => {
            let mergedDoc = null;

            const spy = jest
              .spyOn(User, "findByIdAndUpdate")
              .mockImplementationOnce(async (_id, update, _opts) => {
                mergedDoc = applySetToDocument(baseUser, update.$set);
                return mergedDoc;
              });

            const putReq = { providerId: baseUser._id, body };
            const { res: putRes, getBody: getPutBody, getStatus: getPutStatus } = buildMockRes();

            await updateProviderProfile(putReq, putRes);
            spy.mockRestore();

            expect(getPutStatus()).toBe(200);
            const putBody = getPutBody();
            expect(putBody.success).toBe(true);
            expect(putBody.data).toBeDefined();

            const data = putBody.data;

            for (const field of selectedFields) {
              const responseKey = BODY_TO_RESPONSE_KEY[field];
              expect(data).toHaveProperty(responseKey);

              let expectedValue;
              if (field === "name" || field === "organizationName") {
                expectedValue = String(body[field]).trim();
              } else {
                expectedValue = body[field];
              }

              expect(data[responseKey]).toBe(expectedValue);
            }
          }
        ),
        { numRuns: 100 }
      );
    },
    60_000
  );
});
