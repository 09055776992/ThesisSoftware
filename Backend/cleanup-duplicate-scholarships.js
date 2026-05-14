import "dotenv/config";
import { getDb } from "./db.js";

function pickNewest(records) {
  return [...records].sort((a, b) => {
    const aTime = new Date(a.createdAt || a.updatedAt || 0).getTime();
    const bTime = new Date(b.createdAt || b.updatedAt || 0).getTime();
    return bTime - aTime;
  })[0];
}

async function main() {
  const db = await getDb();
  const scholarships = await db.collection("scholarships").find({}).toArray();
  const groups = new Map();

  for (const scholarship of scholarships) {
    const key = String(scholarship.name || "").trim().toLowerCase();
    if (!key) continue;
    const current = groups.get(key) || [];
    current.push(scholarship);
    groups.set(key, current);
  }

  let deleted = 0;
  for (const [name, records] of groups.entries()) {
    if (records.length <= 1) continue;
    const keep = pickNewest(records);
    const removeIds = records
      .filter((record) => String(record._id) !== String(keep._id))
      .map((record) => record._id);

    if (removeIds.length) {
      const result = await db.collection("scholarships").deleteMany({ _id: { $in: removeIds } });
      deleted += result.deletedCount || 0;
      console.log(`Removed ${result.deletedCount || 0} duplicate(s) for ${name}`);
    }
  }

  console.log(`Done. Deleted ${deleted} duplicate scholarship record(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
