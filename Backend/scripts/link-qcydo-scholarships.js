/**
 * link-qcydo-scholarships.js
 *
 * One-time migration: finds the approved QCYDO provider account and sets
 * `createdBy` on every scholarship whose `provider` or `organization`
 * contains "QCYDO" or "Quezon City Youth Development Office" and currently
 * has no `createdBy` set.
 *
 * Run once after the multi-tenancy fix:
 *   node --experimental-vm-modules scripts/link-qcydo-scholarships.js
 */

import "dotenv/config";
import mongoose from "mongoose";
import { getDb } from "../db.js";

const mongoUri =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  process.env.MONGO_URL ||
  process.env.DATABASE_URL;

const mongooseDbName =
  process.env.MONGODB_DB || process.env.MONGO_DB || "thesis_software";

async function run() {
  // Connect both raw driver (for bulk update) and Mongoose
  await mongoose.connect(mongoUri, { dbName: mongooseDbName });
  console.log("[Migration] Connected to MongoDB");

  const db = await getDb();

  // ── Step 1: Find the QCYDO provider ──────────────────────────────────────
  // Look for an approved provider whose organizationName contains QCYDO
  const qcydoProvider = await db.collection("users").findOne({
    role: "provider",
    $or: [
      { "providerDetails.organizationName": { $regex: "QCYDO", $options: "i" } },
      { "providerDetails.organizationName": { $regex: "Quezon City Youth Development Office", $options: "i" } },
    ],
  });

  if (!qcydoProvider) {
    console.error("[Migration] ❌ No QCYDO provider account found.");
    console.log("  Make sure a provider account with organizationName containing 'QCYDO' exists.");
    process.exit(1);
  }

  console.log(`[Migration] ✅ Found QCYDO provider: ${qcydoProvider.userName || qcydoProvider.email} (${qcydoProvider._id})`);

  // ── Step 2: Find scholarships that belong to QCYDO but have no createdBy ─
  const { ObjectId } = await import("mongodb");
  const providerId = new ObjectId(String(qcydoProvider._id));

  const unlinkedFilter = {
    createdBy: { $in: [null, undefined] },
    $or: [
      { provider: { $regex: "QCYDO", $options: "i" } },
      { provider: { $regex: "Quezon City Youth Development Office", $options: "i" } },
      { organization: { $regex: "QCYDO", $options: "i" } },
      { organization: { $regex: "Quezon City Youth Development Office", $options: "i" } },
      { providerName: { $regex: "QCYDO", $options: "i" } },
    ],
  };

  const unlinked = await db.collection("scholarships").find(unlinkedFilter).toArray();
  console.log(`[Migration] Found ${unlinked.length} unlinked QCYDO scholarship(s)`);

  if (unlinked.length === 0) {
    console.log("[Migration] Nothing to update — all QCYDO scholarships already have createdBy set.");
    process.exit(0);
  }

  // ── Step 3: Set createdBy and providerName ────────────────────────────────
  const result = await db.collection("scholarships").updateMany(
    unlinkedFilter,
    {
      $set: {
        createdBy: providerId,
        providerName: qcydoProvider.providerDetails?.organizationName ||
          qcydoProvider.userName ||
          "Quezon City Youth Development Office (QCYDO)",
      },
    }
  );

  console.log(`[Migration] ✅ Updated ${result.modifiedCount} scholarship(s) with createdBy = ${providerId}`);

  // ── Step 4: Verify ────────────────────────────────────────────────────────
  const linked = await db.collection("scholarships")
    .find({ createdBy: providerId })
    .project({ name: 1 })
    .toArray();

  console.log(`[Migration] QCYDO now owns ${linked.length} scholarship(s):`);
  linked.forEach((s, i) => console.log(`  ${i + 1}. ${s.name}`));

  await mongoose.disconnect();
  console.log("[Migration] Done.");
  process.exit(0);
}

run().catch((err) => {
  console.error("[Migration] Fatal error:", err);
  process.exit(1);
});
