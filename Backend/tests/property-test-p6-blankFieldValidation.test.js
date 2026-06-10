// Feature: provider-panel-enhancements, Property 6: Profile field validation rejects blank required fields

/**
 * Property 6: Profile field validation rejects blank required fields
 *
 * For any string composed entirely of whitespace characters (or the empty
 * string) supplied as `name` or `organizationName` in a PUT /api/provider/profile
 * body, the server SHALL return HTTP 400 and SHALL NOT apply any updates to
 * the User document (i.e., User.findByIdAndUpdate MUST NOT be called).
 *
 * Validates: Requirements 6.4
 */

import { describe, it, expect, jest } from "@jest/globals";
import * as fc from "fast-check";
import { updateProviderProfile } from "../controller/provider.controller.js";
import User from "../models/user.model.js";

// ── Arbitraries ──────────────────────────────────────────────────────────────

/**
 * Generates strings composed entirely of whitespace characters (' ', '\t', '\n'),
 * including the empty string (minLength: 0).
 * These represent invalid values for the required `name` and `organizationName` fields.
 *
 * Note: fc.stringOf was removed in fast-check v4; we use fc.array + map instead.
 */
const blankStringArb = fc
  .array(fc.constantFrom(" ", "\t", "\n"), { minLength: 0, maxLength: 30 })
  .map((chars) => chars.join(""));

/**
 * Generates a valid 24-character hex provider ID (simulates a MongoDB ObjectId).
 */
const providerIdArb = fc.stringMatching(/^[a-f0-9]{24}$/);

/**
 * Generates a non-empty, non-whitespace string for optional fields that should
 * not trigger validation failures on their own.
 */
const validStringArb = fc
  .string({ minLength: 1, maxLength: 80 })
  .filter((s) => s.trim().length > 0)
  .map((s) => s.trim());

/**
 * Generates a valid URL string (starts with https://) for the `website` field.
 */
const validUrlArb = validStringArb.map(
  (s) => `https://${s.replace(/[^a-zA-Z0-9.-]/g, "a")}.com`
);

// ── Helper: build mock req/res ────────────────────────────────────────────────

/**
 * Builds a minimal mock req/res pair for the updateProviderProfile handler.
 * Captures the HTTP status code and response body from res.status/res.json calls.
 */
function buildReqRes(providerId, body) {
  let responseStatus = 200;
  let responseBody = null;

  const req = {
    providerId,
    body,
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
    getStatus: () => responseStatus,
    getBody: () => responseBody,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Property 6 — Profile field validation rejects blank required fields", () => {
  it(
    "blank `name` alone causes HTTP 400 and no DB write",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          blankStringArb,
          providerIdArb,
          async (blankName, providerId) => {
            const body = { name: blankName };
            const { req, res, getStatus, getBody } = buildReqRes(
              providerId,
              body
            );

            const spy = jest
              .spyOn(User, "findByIdAndUpdate")
              .mockImplementationOnce(async () => {
                throw new Error(
                  "findByIdAndUpdate must NOT be called for blank name"
                );
              });

            await updateProviderProfile(req, res);

            // Must return HTTP 400
            expect(getStatus()).toBe(400);

            // Response body must indicate failure
            const responseBody = getBody();
            expect(responseBody).not.toBeNull();
            expect(responseBody.success).toBe(false);
            expect(typeof responseBody.message).toBe("string");
            expect(responseBody.message.length).toBeGreaterThan(0);

            // findByIdAndUpdate must not have been called
            expect(spy).not.toHaveBeenCalled();

            spy.mockRestore();
          }
        ),
        { numRuns: 100 }
      );
    },
    60_000
  );

  it(
    "blank `organizationName` alone causes HTTP 400 and no DB write",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          blankStringArb,
          providerIdArb,
          async (blankOrg, providerId) => {
            const body = { organizationName: blankOrg };
            const { req, res, getStatus, getBody } = buildReqRes(
              providerId,
              body
            );

            const spy = jest
              .spyOn(User, "findByIdAndUpdate")
              .mockImplementationOnce(async () => {
                throw new Error(
                  "findByIdAndUpdate must NOT be called for blank organizationName"
                );
              });

            await updateProviderProfile(req, res);

            // Must return HTTP 400
            expect(getStatus()).toBe(400);

            // Response body must indicate failure
            const responseBody = getBody();
            expect(responseBody).not.toBeNull();
            expect(responseBody.success).toBe(false);
            expect(typeof responseBody.message).toBe("string");
            expect(responseBody.message.length).toBeGreaterThan(0);

            // findByIdAndUpdate must not have been called
            expect(spy).not.toHaveBeenCalled();

            spy.mockRestore();
          }
        ),
        { numRuns: 100 }
      );
    },
    60_000
  );

  it(
    "blank `name` with other valid optional fields still causes HTTP 400 and no DB write",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          blankStringArb,
          providerIdArb,
          fc.record({
            position: fc.option(validStringArb, { nil: undefined }),
            phone: fc.option(validStringArb, { nil: undefined }),
            officeAddress: fc.option(validStringArb, { nil: undefined }),
            description: fc.option(validStringArb, { nil: undefined }),
            website: fc.option(validUrlArb, { nil: undefined }),
          }),
          async (blankName, providerId, extras) => {
            // Remove undefined keys from extras to simulate absent body fields
            const body = { name: blankName };
            for (const [k, v] of Object.entries(extras)) {
              if (v !== undefined) body[k] = v;
            }

            const { req, res, getStatus, getBody } = buildReqRes(
              providerId,
              body
            );

            const spy = jest
              .spyOn(User, "findByIdAndUpdate")
              .mockImplementationOnce(async () => {
                throw new Error(
                  "findByIdAndUpdate must NOT be called when name is blank"
                );
              });

            await updateProviderProfile(req, res);

            // Blank name must still short-circuit with HTTP 400
            expect(getStatus()).toBe(400);

            const responseBody = getBody();
            expect(responseBody).not.toBeNull();
            expect(responseBody.success).toBe(false);

            // No DB write permitted
            expect(spy).not.toHaveBeenCalled();

            spy.mockRestore();
          }
        ),
        { numRuns: 100 }
      );
    },
    60_000
  );

  it(
    "blank `organizationName` with other valid optional fields still causes HTTP 400 and no DB write",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          blankStringArb,
          providerIdArb,
          fc.record({
            position: fc.option(validStringArb, { nil: undefined }),
            phone: fc.option(validStringArb, { nil: undefined }),
            officeAddress: fc.option(validStringArb, { nil: undefined }),
            description: fc.option(validStringArb, { nil: undefined }),
            website: fc.option(validUrlArb, { nil: undefined }),
          }),
          async (blankOrg, providerId, extras) => {
            const body = { organizationName: blankOrg };
            for (const [k, v] of Object.entries(extras)) {
              if (v !== undefined) body[k] = v;
            }

            const { req, res, getStatus, getBody } = buildReqRes(
              providerId,
              body
            );

            const spy = jest
              .spyOn(User, "findByIdAndUpdate")
              .mockImplementationOnce(async () => {
                throw new Error(
                  "findByIdAndUpdate must NOT be called when organizationName is blank"
                );
              });

            await updateProviderProfile(req, res);

            expect(getStatus()).toBe(400);

            const responseBody = getBody();
            expect(responseBody).not.toBeNull();
            expect(responseBody.success).toBe(false);

            expect(spy).not.toHaveBeenCalled();

            spy.mockRestore();
          }
        ),
        { numRuns: 100 }
      );
    },
    60_000
  );

  it(
    "both `name` and `organizationName` blank in same body causes HTTP 400 and no DB write",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          blankStringArb,
          blankStringArb,
          providerIdArb,
          async (blankName, blankOrg, providerId) => {
            const body = { name: blankName, organizationName: blankOrg };
            const { req, res, getStatus, getBody } = buildReqRes(
              providerId,
              body
            );

            const spy = jest
              .spyOn(User, "findByIdAndUpdate")
              .mockImplementationOnce(async () => {
                throw new Error(
                  "findByIdAndUpdate must NOT be called when both required fields are blank"
                );
              });

            await updateProviderProfile(req, res);

            // At least one blank field — must return HTTP 400
            expect(getStatus()).toBe(400);

            const responseBody = getBody();
            expect(responseBody).not.toBeNull();
            expect(responseBody.success).toBe(false);

            // No DB write permitted
            expect(spy).not.toHaveBeenCalled();

            spy.mockRestore();
          }
        ),
        { numRuns: 100 }
      );
    },
    60_000
  );

  it(
    "empty string specifically for `name` causes HTTP 400 and no DB write",
    async () => {
      const { req, res, getStatus, getBody } = buildReqRes(
        "a1b2c3d4e5f6a1b2c3d4e5f6",
        { name: "" }
      );

      const spy = jest
        .spyOn(User, "findByIdAndUpdate")
        .mockImplementationOnce(async () => {
          throw new Error("findByIdAndUpdate must NOT be called for empty name");
        });

      await updateProviderProfile(req, res);

      expect(getStatus()).toBe(400);
      expect(getBody().success).toBe(false);
      expect(spy).not.toHaveBeenCalled();

      spy.mockRestore();
    }
  );

  it(
    "empty string specifically for `organizationName` causes HTTP 400 and no DB write",
    async () => {
      const { req, res, getStatus, getBody } = buildReqRes(
        "a1b2c3d4e5f6a1b2c3d4e5f6",
        { organizationName: "" }
      );

      const spy = jest
        .spyOn(User, "findByIdAndUpdate")
        .mockImplementationOnce(async () => {
          throw new Error(
            "findByIdAndUpdate must NOT be called for empty organizationName"
          );
        });

      await updateProviderProfile(req, res);

      expect(getStatus()).toBe(400);
      expect(getBody().success).toBe(false);
      expect(spy).not.toHaveBeenCalled();

      spy.mockRestore();
    }
  );
});
