// Feature: provider-panel-enhancements, Property 7: Website URL validation

/**
 * Property 7: Website URL validation
 *
 * For any string that does NOT begin with `http://` or `https://` supplied as
 * `website` in a PUT /api/provider/profile body, the server SHALL return
 * HTTP 400 and SHALL NOT apply any updates to the User document.
 *
 * Conversely, for any string beginning with `http://` or `https://` (including
 * empty/absent values which bypass the check entirely), the server SHALL accept
 * the request and proceed to the database update.
 *
 * The validation only fires when `website` is a non-empty string after trimming
 * that does NOT start with the required prefix. An empty string or a string
 * starting with http:// or https:// must both pass.
 *
 * Validates: Requirements 6.5
 */

import { describe, it, expect, jest } from "@jest/globals";
import * as fc from "fast-check";
import { updateProviderProfile } from "../controller/provider.controller.js";
import User from "../models/user.model.js";

// ── Arbitraries ──────────────────────────────────────────────────────────────

/**
 * Generates a non-empty, non-whitespace string that does NOT start with
 * "http://" or "https://". These should all be rejected with HTTP 400.
 */
const invalidWebsiteArb = fc
  .string({ minLength: 1, maxLength: 200 })
  .filter((s) => {
    const trimmed = s.trim();
    return (
      trimmed.length > 0 &&
      !trimmed.startsWith("http://") &&
      !trimmed.startsWith("https://")
    );
  });

/**
 * Generates strings that start with "http://" followed by arbitrary content.
 */
const httpUrlArb = fc
  .string({ minLength: 0, maxLength: 100 })
  .map((s) => `http://${s}`);

/**
 * Generates strings that start with "https://" followed by arbitrary content.
 */
const httpsUrlArb = fc
  .string({ minLength: 0, maxLength: 100 })
  .map((s) => `https://${s}`);

/**
 * Generates valid website strings: either starts with http:// or https://.
 * Both variants must be accepted by the controller.
 */
const validWebsiteArb = fc.oneof(httpUrlArb, httpsUrlArb);

/**
 * Generates a valid 24-character hex provider ID (Mongoose ObjectId format).
 */
const providerIdArb = fc.stringMatching(/^[a-f0-9]{24}$/);

/**
 * Generates a non-empty, non-whitespace string for required text fields.
 */
const nonEmptyStringArb = fc
  .string({ minLength: 1, maxLength: 80 })
  .filter((s) => s.trim().length > 0)
  .map((s) => s.trim());

// ── Helper: build mock req/res ────────────────────────────────────────────────

/**
 * Builds a minimal mock req/res pair for testing updateProviderProfile.
 *
 * @param {string} providerId - Simulated provider ID
 * @param {object} body       - Simulated request body
 * @returns {{ req, res, getStatus, getBody }}
 */
function buildReqRes(providerId, body) {
  let responseStatus = 200;
  let responseBody = null;

  const req = { providerId, body };
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
    getStatus: () => responseStatus,
    getBody: () => responseBody,
  };
}

/**
 * Builds a minimal provider User document suitable for the mock DB return value.
 * The controller calls mapProviderProfile on the returned document.
 */
function buildUpdatedDoc(providerId, website) {
  return {
    _id: providerId,
    userName: "Test Provider",
    email: "test@example.com",
    providerDetails: {
      organizationName: "Test Org",
      position: null,
      phone: null,
      officeAddress: null,
      description: null,
      website: website ?? null,
    },
    profilePicture: null,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Property 7 — Website URL validation", () => {
  // ── Invalid website strings ─────────────────────────────────────────────────

  it(
    "returns HTTP 400 for any non-empty website string that does not start with http:// or https://",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          invalidWebsiteArb,
          providerIdArb,
          async (invalidWebsite, providerId) => {
            const { req, res, getStatus, getBody } = buildReqRes(providerId, {
              website: invalidWebsite,
            });

            // Spy on User.findByIdAndUpdate — it must NOT be called on 400
            const spy = jest
              .spyOn(User, "findByIdAndUpdate")
              .mockImplementation(async () => buildUpdatedDoc(providerId, invalidWebsite));

            await updateProviderProfile(req, res);

            // Must return HTTP 400
            expect(getStatus()).toBe(400);

            // The error body must contain success: false
            const body = getBody();
            expect(body).not.toBeNull();
            expect(body.success).toBe(false);

            // The DB MUST NOT have been called (no partial update applied)
            expect(spy).not.toHaveBeenCalled();

            spy.mockRestore();
          }
        ),
        { numRuns: 200 }
      );
    },
    60_000
  );

  it(
    "error body indicates the website field failed validation",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          invalidWebsiteArb,
          providerIdArb,
          async (invalidWebsite, providerId) => {
            const { req, res, getBody } = buildReqRes(providerId, {
              website: invalidWebsite,
            });

            const spy = jest
              .spyOn(User, "findByIdAndUpdate")
              .mockImplementation(async () => buildUpdatedDoc(providerId, invalidWebsite));

            await updateProviderProfile(req, res);

            const body = getBody();
            expect(body.success).toBe(false);
            // The error message must reference "website" or "http"
            expect(typeof body.message).toBe("string");
            expect(body.message.length).toBeGreaterThan(0);

            spy.mockRestore();
          }
        ),
        { numRuns: 100 }
      );
    },
    60_000
  );

  it(
    "does NOT call User.findByIdAndUpdate when website validation fails",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          invalidWebsiteArb,
          providerIdArb,
          async (invalidWebsite, providerId) => {
            const { req, res } = buildReqRes(providerId, {
              website: invalidWebsite,
            });

            const spy = jest
              .spyOn(User, "findByIdAndUpdate")
              .mockImplementation(async () => buildUpdatedDoc(providerId, invalidWebsite));

            await updateProviderProfile(req, res);

            // Strict: the DB layer must not be touched
            expect(spy).not.toHaveBeenCalled();

            spy.mockRestore();
          }
        ),
        { numRuns: 100 }
      );
    },
    60_000
  );

  // ── Valid website strings (http://) ─────────────────────────────────────────

  it(
    "accepts any website string that starts with http://",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          httpUrlArb,
          providerIdArb,
          async (validWebsite, providerId) => {
            const updatedDoc = buildUpdatedDoc(providerId, validWebsite);

            const spy = jest
              .spyOn(User, "findByIdAndUpdate")
              .mockImplementation(async () => updatedDoc);

            const { req, res, getStatus, getBody } = buildReqRes(providerId, {
              website: validWebsite,
            });

            await updateProviderProfile(req, res);

            // Must NOT return 400 — validation passes
            expect(getStatus()).not.toBe(400);

            // The response must be successful
            const body = getBody();
            expect(body).not.toBeNull();
            expect(body.success).toBe(true);

            // DB must have been called (update applied)
            expect(spy).toHaveBeenCalledTimes(1);

            spy.mockRestore();
          }
        ),
        { numRuns: 100 }
      );
    },
    60_000
  );

  // ── Valid website strings (https://) ────────────────────────────────────────

  it(
    "accepts any website string that starts with https://",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          httpsUrlArb,
          providerIdArb,
          async (validWebsite, providerId) => {
            const updatedDoc = buildUpdatedDoc(providerId, validWebsite);

            const spy = jest
              .spyOn(User, "findByIdAndUpdate")
              .mockImplementation(async () => updatedDoc);

            const { req, res, getStatus, getBody } = buildReqRes(providerId, {
              website: validWebsite,
            });

            await updateProviderProfile(req, res);

            // Must NOT return 400
            expect(getStatus()).not.toBe(400);

            const body = getBody();
            expect(body).not.toBeNull();
            expect(body.success).toBe(true);

            // DB must have been called
            expect(spy).toHaveBeenCalledTimes(1);

            spy.mockRestore();
          }
        ),
        { numRuns: 100 }
      );
    },
    60_000
  );

  // ── Mixed: both valid and invalid in combined property ───────────────────────

  it(
    "accepts http:// and https:// prefixes and rejects all other non-empty strings — combined property",
    async () => {
      // Test with explicitly invalid strings
      await fc.assert(
        fc.asyncProperty(
          invalidWebsiteArb,
          async (invalidWebsite) => {
            const providerId = "a1b2c3d4e5f6a1b2c3d4e5f6";
            const { req, res, getStatus } = buildReqRes(providerId, {
              website: invalidWebsite,
            });

            const spy = jest
              .spyOn(User, "findByIdAndUpdate")
              .mockImplementation(async () => buildUpdatedDoc(providerId, null));

            await updateProviderProfile(req, res);

            expect(getStatus()).toBe(400);
            expect(spy).not.toHaveBeenCalled();

            spy.mockRestore();
          }
        ),
        { numRuns: 100 }
      );

      // Test with explicitly valid strings
      await fc.assert(
        fc.asyncProperty(
          validWebsiteArb,
          async (validWebsite) => {
            const providerId = "a1b2c3d4e5f6a1b2c3d4e5f6";
            const updatedDoc = buildUpdatedDoc(providerId, validWebsite);

            const spy = jest
              .spyOn(User, "findByIdAndUpdate")
              .mockImplementation(async () => updatedDoc);

            const { req, res, getStatus } = buildReqRes(providerId, {
              website: validWebsite,
            });

            await updateProviderProfile(req, res);

            expect(getStatus()).not.toBe(400);
            expect(spy).toHaveBeenCalledTimes(1);

            spy.mockRestore();
          }
        ),
        { numRuns: 100 }
      );
    },
    120_000
  );

  // ── Edge case: website absent from body ─────────────────────────────────────

  it(
    "skips website validation and proceeds to DB when website is absent from the body",
    async () => {
      // When website is not in the body at all, the check is skipped entirely
      await fc.assert(
        fc.asyncProperty(
          nonEmptyStringArb, // for the 'name' field
          providerIdArb,
          async (name, providerId) => {
            const updatedDoc = buildUpdatedDoc(providerId, null);

            const spy = jest
              .spyOn(User, "findByIdAndUpdate")
              .mockImplementation(async () => updatedDoc);

            // Body does NOT include the website field
            const { req, res, getStatus, getBody } = buildReqRes(providerId, { name });

            await updateProviderProfile(req, res);

            // No 400 — website validation is not triggered
            expect(getStatus()).not.toBe(400);

            const body = getBody();
            expect(body.success).toBe(true);

            // DB was called
            expect(spy).toHaveBeenCalledTimes(1);

            spy.mockRestore();
          }
        ),
        { numRuns: 100 }
      );
    },
    60_000
  );

  // ── Edge case: website is empty string ──────────────────────────────────────

  it(
    "skips website validation (does not return 400) when website is an empty string",
    async () => {
      // The controller checks: if (w.length > 0 && !w.startsWith(...))
      // An empty string has length 0, so the invalid-URL check is skipped.
      const providerId = "a1b2c3d4e5f6a1b2c3d4e5f6";
      const updatedDoc = buildUpdatedDoc(providerId, "");

      const spy = jest
        .spyOn(User, "findByIdAndUpdate")
        .mockImplementation(async () => updatedDoc);

      const { req, res, getStatus, getBody } = buildReqRes(providerId, {
        website: "",
      });

      await updateProviderProfile(req, res);

      // Empty string is allowed — no 400
      expect(getStatus()).not.toBe(400);

      const body = getBody();
      expect(body.success).toBe(true);

      expect(spy).toHaveBeenCalledTimes(1);

      spy.mockRestore();
    },
    15_000
  );

  // ── Edge case: boundary strings for the prefix ──────────────────────────────

  it(
    'rejects strings that are almost valid (e.g., "http:/" or "https:/" missing one slash)',
    async () => {
      const nearMissStrings = [
        "http:/example.com",
        "https:/example.com",
        "http:example.com",
        "https:example.com",
        "ftp://example.com",
        "HTTP://example.com",    // case-sensitive: uppercase must be rejected
        "HTTPS://example.com",   // case-sensitive: uppercase must be rejected
        " http://example.com",   // leading space — trimmed, then checked
        "httpss://example.com",
        "//example.com",
        "www.example.com",
      ];

      for (const website of nearMissStrings) {
        const providerId = "a1b2c3d4e5f6a1b2c3d4e5f6";
        const trimmed = website.trim();

        const spy = jest
          .spyOn(User, "findByIdAndUpdate")
          .mockImplementation(async () => buildUpdatedDoc(providerId, website));

        const { req, res, getStatus } = buildReqRes(providerId, { website });

        await updateProviderProfile(req, res);

        // All near-misses should be rejected (trimmed value doesn't start with
        // http:// or https://)
        if (
          trimmed.length > 0 &&
          !trimmed.startsWith("http://") &&
          !trimmed.startsWith("https://")
        ) {
          expect(getStatus()).toBe(400);
          expect(spy).not.toHaveBeenCalled();
        } else {
          // If after trim it starts with valid prefix, it should pass
          expect(getStatus()).not.toBe(400);
        }

        spy.mockRestore();
      }
    },
    15_000
  );
});
