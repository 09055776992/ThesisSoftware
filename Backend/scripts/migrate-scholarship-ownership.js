/**
 * Migration: Scholarship Ownership
 *
 * Run this ONCE before deploying the provider role feature.
 *
 * What it does:
 * - Finds all scholarships that have no `createdBy` field (legacy scholarships)
 * - Sets createdBy: null and providerName: "QCYDO (Legacy)" on all of them
 * - These will appear as "Unassigned" in the admin panel
 * - They can be reassigned to a provider account later via the admin panel
 *
 * Usage:
 *   node scripts/migrate-scholarship-ownership.js
 */

import "dotenv/config";
import { getDb } from "../db.js";

async function migrateScholarshipOwnership() {
  console.log("[Migration] Starting scholarship ownership migration...");

  const db = await getDb();
  const collection = db.collection("scholarships");

  // Find all scholarships missing the createdBy field
  const unownedCount = await collection.countDocuments({
    $or: [
      { createdBy: { $exists: false } },
      { createdBy: null },
    ],
  });

  console.log(`[Migration] Found ${unownedCount} unowned scholarship(s) to migrate.`);

  if (unownedCount === 0) {
    console.log("[Migration] Nothing to migrate. All scholarships already have ownership set.");
    process.exit(0);
  }

  // Set createdBy: null and providerName: "QCYDO (Legacy)" on all unowned scholarships
  const result = await collection.updateMany(
    {
      $or: [
        { createdBy: { $exists: false } },
        { createdBy: null },
      ],
    },
    {
      $set: {
        createdBy: null,
        providerName: "QCYDO (Legacy)",
      },
    }
  );

  console.log(`[Migration] Updated ${result.modifiedCount} scholarship(s).`);
  console.log("[Migration] Done. Legacy scholarships are now marked as 'QCYDO (Legacy)' with no owner.");
  console.log("[Migration] Admin can view these but cannot edit them until reassigned to a provider.");

  process.exit(0);
}

migrateScholarshipOwnership().catch((err) => {
  console.error("[Migration] Failed:", err);
  process.exit(1);
});
