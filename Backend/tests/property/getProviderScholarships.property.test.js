// Feature: provider-panel-enhancements, Property 1: All scholarships returned without ownership filter

/**
 * Property 1: All scholarships returned without ownership filter
 *
 * For any collection of scholarship documents (regardless of whether they
 * have a `createdBy` field), GET /api/provider/scholarships SHALL return
 * all of them, sorted by `createdAt` descending, each with an
 * `applicationsCount` field equal to the count of application documents
 * referencing that scholarship.
 *
 * Validates: Requirements 1.1
 */

import { describe, it, expect, jest } from "@jest/globals";
import * as fc from "fast-check";
import { getProviderScholarships } from "../../controller/provider.controller.js";
import ScholarshipModel from "../../models/scholarship.model.js";
import ApplicationModel from "../../models/application.model.js";

// ── Arbitraries ──────────────────────────────────────────────────────────────

/**
 * Generates a Date within a wide range so sort order is deterministic.
 */
const dateArb = fc
  .integer({ min: 0, max: 10_000 })
  .map((offsetDays) => {
    const d = new Date("2020-01-01T00:00:00.000Z");
    d.setDate(d.getDate() + offsetDays);
    return d;
  });

/**
 * Generates a scholarship-like plain object.
 * Uses fc.option for `createdBy` so ~50 % of docs have no `createdBy`
 * (the QCYDO seeded-scholarship scenario).
 */
const scholarshipArb = fc.record({
  _id: fc.uuid().map((id) => ({ toString: () => id })),
  name: fc.string({ minLength: 1, maxLength: 80 }),
  createdAt: dateArb,
  createdBy: fc.option(fc.uuid(), { nil: undefined }),
});

/**
 * Unique (by _id) array of 0–20 scholarship documents.
 */
const scholarshipsArb = fc.uniqueArray(scholarshipArb, {
  minLength: 0,
  maxLength: 20,
  selector: (s) => String(s._id),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Wraps a plain object in a fake Mongoose document that has `.toObject()`.
 */
function makeFakeDoc(plain) {
  return {
    ...plain,
    toObject() {
      return { ...plain };
    },
  };
}

/**
 * Sorts docs by createdAt descending — mirrors what MongoDB returns when
 * Mongoose executes `.sort({ createdAt: -1 })`.
 */
function sortByCreatedAtDesc(docs) {
  return [...docs].sort((a, b) => b.createdAt - a.createdAt);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Property 1 — getProviderScholarships returns ALL scholarships without ownership filter", () => {
  it(
    "returns every document sorted by createdAt descending with correct applicationsCount",
    async () => {
      await fc.assert(
        fc.asyncProperty(scholarshipsArb, async (rawDocs) => {
          // The mock simulates what MongoDB returns: docs pre-sorted descending.
          // The controller calls .sort({ createdAt: -1 }), which the DB handles.
          const sortedFakeDocs = sortByCreatedAtDesc(rawDocs).map(makeFakeDoc);

          // Assign deterministic application counts for each sorted position.
          // counts[i] is returned by the i-th countDocuments() call, which
          // corresponds to sortedFakeDocs[i].
          const counts = sortedFakeDocs.map((_, i) => i % 51); // 0..50

          // Mock Scholarship.find().sort() chain.
          // The sort spy returns the already-sorted docs (simulating DB sort).
          const sortSpy = jest.fn().mockResolvedValue(sortedFakeDocs);
          const findSpy = jest
            .spyOn(ScholarshipModel, "find")
            .mockReturnValue({ sort: sortSpy });

          // Mock Application.countDocuments() — called once per doc in sorted order
          let callIndex = 0;
          const countSpy = jest
            .spyOn(ApplicationModel, "countDocuments")
            .mockImplementation(() => Promise.resolve(counts[callIndex++] ?? 0));

          const req = { providerId: "provider-123" };
          let capturedBody = null;
          const res = {
            json: jest.fn((body) => { capturedBody = body; }),
            status: jest.fn().mockReturnThis(),
          };

          await getProviderScholarships(req, res);

          if (rawDocs.length === 0) {
            // Empty collection → short-circuit empty response
            expect(capturedBody).toEqual({ success: true, data: [], total: 0 });
          } else {
            expect(capturedBody.success).toBe(true);

            const returned = capturedBody.data;

            // 1) Every document is returned — no ownership filter applied
            expect(returned).toHaveLength(rawDocs.length);

            // 2) The controller called .sort({ createdAt: -1 }) (DB-level sort)
            expect(sortSpy).toHaveBeenCalledWith({ createdAt: -1 });

            // 3) The returned order matches what the DB sent (already sorted)
            for (let i = 0; i < returned.length; i++) {
              expect(String(returned[i]._id)).toBe(String(sortedFakeDocs[i]._id));
            }

            // 4) applicationsCount equals the i-th countDocuments() return value.
            for (let i = 0; i < returned.length; i++) {
              expect(returned[i].applicationsCount).toBe(counts[i]);
            }

            // 5) total === data.length
            expect(capturedBody.total).toBe(rawDocs.length);
          }

          findSpy.mockRestore();
          countSpy.mockRestore();
        }),
        { numRuns: 100 }
      );
    },
    60_000
  );

  it(
    "empty scholarship collection returns { success: true, data: [], total: 0 }",
    async () => {
      const sortSpy = jest.fn().mockResolvedValue([]);
      const findSpy = jest
        .spyOn(ScholarshipModel, "find")
        .mockReturnValue({ sort: sortSpy });

      const req = { providerId: "provider-123" };
      let capturedBody = null;
      const res = {
        json: jest.fn((body) => { capturedBody = body; }),
        status: jest.fn().mockReturnThis(),
      };

      await getProviderScholarships(req, res);

      expect(capturedBody).toEqual({ success: true, data: [], total: 0 });

      findSpy.mockRestore();
    }
  );

  it(
    "includes documents that have no createdBy field (seeded QCYDO scholarships)",
    async () => {
      // Scholarship documents without any createdBy field
      const noCbScholarshipArb = fc.record({
        _id: fc.uuid().map((id) => ({ toString: () => id })),
        name: fc.string({ minLength: 1, maxLength: 80 }),
        createdAt: dateArb,
        // deliberately no createdBy key
      });

      const noCbScholarshipsArb = fc.uniqueArray(noCbScholarshipArb, {
        minLength: 1,
        maxLength: 20,
        selector: (s) => String(s._id),
      });

      await fc.assert(
        fc.asyncProperty(noCbScholarshipsArb, async (rawDocs) => {
          const sortedFakeDocs = sortByCreatedAtDesc(rawDocs).map(makeFakeDoc);

          const sortSpy = jest.fn().mockResolvedValue(sortedFakeDocs);
          const findSpy = jest
            .spyOn(ScholarshipModel, "find")
            .mockReturnValue({ sort: sortSpy });

          const countSpy = jest
            .spyOn(ApplicationModel, "countDocuments")
            .mockResolvedValue(0);

          const req = { providerId: "provider-123" };
          let capturedBody = null;
          const res = {
            json: jest.fn((body) => { capturedBody = body; }),
            status: jest.fn().mockReturnThis(),
          };

          await getProviderScholarships(req, res);

          // All documents returned even without createdBy
          expect(capturedBody.success).toBe(true);
          expect(capturedBody.data).toHaveLength(rawDocs.length);

          findSpy.mockRestore();
          countSpy.mockRestore();
        }),
        { numRuns: 100 }
      );
    },
    60_000
  );
});
