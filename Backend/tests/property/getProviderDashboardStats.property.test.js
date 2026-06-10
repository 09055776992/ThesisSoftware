// Feature: provider-panel-enhancements, Property 2: Dashboard stats count ALL scholarships and ALL pending applications

/**
 * Property 2: Dashboard stats count ALL scholarships and ALL pending applications
 *
 * For any set of scholarship documents and application documents in the
 * database, GET /api/provider/dashboard/stats SHALL return:
 *   - `totalScholarships` equal to the total count of ALL scholarship documents
 *     (no ownership/createdBy filter applied)
 *   - `pendingApplications` equal to the count of applications with
 *     `status: "Pending"` across all scholarships
 *
 * Validates: Requirements 3.1, 3.2
 */

import { describe, it, expect, jest } from "@jest/globals";
import * as fc from "fast-check";
import { getProviderDashboardStats } from "../../controller/provider.controller.js";
import ScholarshipModel from "../../models/scholarship.model.js";
import ApplicationModel from "../../models/application.model.js";

// ── Arbitraries ──────────────────────────────────────────────────────────────

/**
 * The allowed application statuses as used by the system.
 */
const APPLICATION_STATUSES = ["Pending", "Under Review", "Approved", "Rejected", "System Qualified"];

/**
 * Generates a single scholarship-like plain object with a `status` field.
 * Uses fc.option for `createdBy` so some docs have no `createdBy`
 * (matching the seeded QCYDO scholarship scenario).
 */
const scholarshipArb = fc.record({
  _id: fc.uuid().map((id) => ({ toString: () => id })),
  status: fc.constantFrom("Active", "Closed", "Draft"),
  createdBy: fc.option(fc.uuid(), { nil: undefined }),
});

/**
 * Unique (by _id) array of 0–25 scholarship documents.
 */
const scholarshipsArb = fc.uniqueArray(scholarshipArb, {
  minLength: 0,
  maxLength: 25,
  selector: (s) => String(s._id),
});

/**
 * Generates a single application-like plain object with a `status` field.
 */
const applicationArb = fc.record({
  _id: fc.uuid(),
  status: fc.constantFrom(...APPLICATION_STATUSES),
});

/**
 * Array of 0–40 application documents (duplicates allowed — just counts matter).
 */
const applicationsArb = fc.array(applicationArb, { minLength: 0, maxLength: 40 });

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Builds the aggregate result that the real MongoDB $group pipeline produces:
 * [ { _id: "Pending", count: N }, { _id: "Approved", count: M }, ... ]
 * (only statuses that appear in `applications` are included, matching MongoDB behavior)
 */
function buildAggregateResult(applications) {
  const countsByStatus = {};
  for (const app of applications) {
    countsByStatus[app.status] = (countsByStatus[app.status] || 0) + 1;
  }
  return Object.entries(countsByStatus).map(([status, count]) => ({
    _id: status,
    count,
  }));
}

/**
 * Returns the count of applications whose status equals "Pending".
 */
function countPending(applications) {
  return applications.filter((a) => a.status === "Pending").length;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Property 2 — getProviderDashboardStats counts ALL scholarships and ALL pending applications", () => {
  it(
    "totalScholarships equals total scholarship count regardless of createdBy field",
    async () => {
      await fc.assert(
        fc.asyncProperty(scholarshipsArb, applicationsArb, async (rawScholarships, rawApplications) => {
          // Scholarship.find().lean() returns plain objects (already lean)
          const leanSpy = jest.fn().mockResolvedValue(rawScholarships);
          const findSpy = jest
            .spyOn(ScholarshipModel, "find")
            .mockReturnValue({ lean: leanSpy });

          // Application.aggregate() returns grouped status counts
          const aggregateResult = buildAggregateResult(rawApplications);
          const aggregateSpy = jest
            .spyOn(ApplicationModel, "aggregate")
            .mockResolvedValue(aggregateResult);

          const req = { providerId: "provider-test-123" };
          let capturedBody = null;
          const res = {
            json: jest.fn((body) => { capturedBody = body; }),
            status: jest.fn().mockReturnThis(),
          };

          await getProviderDashboardStats(req, res);

          // Core assertion: totalScholarships must equal length of all scholarship docs
          expect(capturedBody.success).toBe(true);
          expect(capturedBody.stats.totalScholarships).toBe(rawScholarships.length);

          findSpy.mockRestore();
          aggregateSpy.mockRestore();
        }),
        { numRuns: 100 }
      );
    },
    60_000
  );

  it(
    "pendingApplications equals count of applications with status Pending across all scholarships",
    async () => {
      await fc.assert(
        fc.asyncProperty(scholarshipsArb, applicationsArb, async (rawScholarships, rawApplications) => {
          const leanSpy = jest.fn().mockResolvedValue(rawScholarships);
          const findSpy = jest
            .spyOn(ScholarshipModel, "find")
            .mockReturnValue({ lean: leanSpy });

          const aggregateResult = buildAggregateResult(rawApplications);
          const aggregateSpy = jest
            .spyOn(ApplicationModel, "aggregate")
            .mockResolvedValue(aggregateResult);

          const req = { providerId: "provider-test-123" };
          let capturedBody = null;
          const res = {
            json: jest.fn((body) => { capturedBody = body; }),
            status: jest.fn().mockReturnThis(),
          };

          await getProviderDashboardStats(req, res);

          const expectedPending = countPending(rawApplications);

          expect(capturedBody.success).toBe(true);
          expect(capturedBody.stats.pendingApplications).toBe(expectedPending);

          findSpy.mockRestore();
          aggregateSpy.mockRestore();
        }),
        { numRuns: 100 }
      );
    },
    60_000
  );

  it(
    "both totalScholarships and pendingApplications are correct simultaneously for any input combination",
    async () => {
      await fc.assert(
        fc.asyncProperty(scholarshipsArb, applicationsArb, async (rawScholarships, rawApplications) => {
          const leanSpy = jest.fn().mockResolvedValue(rawScholarships);
          const findSpy = jest
            .spyOn(ScholarshipModel, "find")
            .mockReturnValue({ lean: leanSpy });

          const aggregateResult = buildAggregateResult(rawApplications);
          const aggregateSpy = jest
            .spyOn(ApplicationModel, "aggregate")
            .mockResolvedValue(aggregateResult);

          const req = { providerId: "provider-test-123" };
          let capturedBody = null;
          const res = {
            json: jest.fn((body) => { capturedBody = body; }),
            status: jest.fn().mockReturnThis(),
          };

          await getProviderDashboardStats(req, res);

          const expectedTotal = rawScholarships.length;
          const expectedPending = countPending(rawApplications);

          expect(capturedBody.success).toBe(true);
          expect(capturedBody.stats.totalScholarships).toBe(expectedTotal);
          expect(capturedBody.stats.pendingApplications).toBe(expectedPending);

          // Stats are non-negative integers (Requirement 3.4)
          expect(capturedBody.stats.totalScholarships).toBeGreaterThanOrEqual(0);
          expect(capturedBody.stats.pendingApplications).toBeGreaterThanOrEqual(0);

          findSpy.mockRestore();
          aggregateSpy.mockRestore();
        }),
        { numRuns: 100 }
      );
    },
    60_000
  );

  it(
    "zero scholarships and zero applications returns totalScholarships=0 and pendingApplications=0",
    async () => {
      const leanSpy = jest.fn().mockResolvedValue([]);
      const findSpy = jest
        .spyOn(ScholarshipModel, "find")
        .mockReturnValue({ lean: leanSpy });

      const aggregateSpy = jest
        .spyOn(ApplicationModel, "aggregate")
        .mockResolvedValue([]);

      const req = { providerId: "provider-test-123" };
      let capturedBody = null;
      const res = {
        json: jest.fn((body) => { capturedBody = body; }),
        status: jest.fn().mockReturnThis(),
      };

      await getProviderDashboardStats(req, res);

      expect(capturedBody).toMatchObject({
        success: true,
        stats: {
          totalScholarships: 0,
          pendingApplications: 0,
        },
      });

      findSpy.mockRestore();
      aggregateSpy.mockRestore();
    }
  );

  it(
    "scholarships with no createdBy field are still counted in totalScholarships",
    async () => {
      // All scholarships lack createdBy — the QCYDO seeded-scholarship scenario
      const noCbScholarshipArb = fc.record({
        _id: fc.uuid().map((id) => ({ toString: () => id })),
        status: fc.constantFrom("Active", "Closed"),
        // deliberately no createdBy key
      });

      const noCbScholarshipsArb = fc.uniqueArray(noCbScholarshipArb, {
        minLength: 1,
        maxLength: 20,
        selector: (s) => String(s._id),
      });

      await fc.assert(
        fc.asyncProperty(noCbScholarshipsArb, async (rawScholarships) => {
          const leanSpy = jest.fn().mockResolvedValue(rawScholarships);
          const findSpy = jest
            .spyOn(ScholarshipModel, "find")
            .mockReturnValue({ lean: leanSpy });

          const aggregateSpy = jest
            .spyOn(ApplicationModel, "aggregate")
            .mockResolvedValue([]);

          const req = { providerId: "provider-test-123" };
          let capturedBody = null;
          const res = {
            json: jest.fn((body) => { capturedBody = body; }),
            status: jest.fn().mockReturnThis(),
          };

          await getProviderDashboardStats(req, res);

          expect(capturedBody.success).toBe(true);
          expect(capturedBody.stats.totalScholarships).toBe(rawScholarships.length);

          findSpy.mockRestore();
          aggregateSpy.mockRestore();
        }),
        { numRuns: 100 }
      );
    },
    60_000
  );

  it(
    "Scholarship.find is called without a createdBy ownership filter",
    async () => {
      const leanSpy = jest.fn().mockResolvedValue([]);
      const findSpy = jest
        .spyOn(ScholarshipModel, "find")
        .mockReturnValue({ lean: leanSpy });

      const aggregateSpy = jest
        .spyOn(ApplicationModel, "aggregate")
        .mockResolvedValue([]);

      const req = { providerId: "provider-test-123" };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };

      await getProviderDashboardStats(req, res);

      // The first argument to find() must NOT include a createdBy filter
      const findArgs = findSpy.mock.calls[0];
      const filterArg = findArgs[0];
      expect(filterArg).not.toHaveProperty("createdBy");

      findSpy.mockRestore();
      aggregateSpy.mockRestore();
    }
  );
});
