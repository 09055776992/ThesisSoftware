/**
 * Drop the isolated test database (thesis_software_test by default).
 *
 * Usage:
 *   node scripts/drop-test-database.js --confirm
 *
 * Optional:
 *   MONGODB_DB=thesis_software_test node scripts/drop-test-database.js --confirm
 *
 * Safety: refuses to drop unless the database name ends with "_test".
 */
import "dotenv/config";
import { MongoClient } from "mongodb";

const mongoUri =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  process.env.MONGO_URL ||
  process.env.DATABASE_URL;

const databaseName = process.env.MONGODB_DB || process.env.MONGO_DB || "thesis_software_test";
const confirmed = process.argv.includes("--confirm");

if (!mongoUri) {
  console.error("Missing MONGODB_URI in environment.");
  process.exit(1);
}

if (!confirmed) {
  console.error(
    "Refusing to drop without --confirm.\n" +
      `Would drop database: ${databaseName}\n` +
      "Run: node scripts/drop-test-database.js --confirm",
  );
  process.exit(1);
}

if (!databaseName.endsWith("_test")) {
  console.error(
    `Refusing to drop "${databaseName}" — only databases whose name ends with "_test" can be dropped.`,
  );
  process.exit(1);
}

const client = new MongoClient(mongoUri);

try {
  await client.connect();
  const db = client.db(databaseName);
  const collections = await db.listCollections().toArray();
  const names = collections.map((c) => c.name);

  console.log(`Dropping database "${databaseName}" (${names.length} collections: ${names.join(", ") || "none"})`);
  await db.dropDatabase();
  console.log(`Done. "${databaseName}" has been removed.`);
} catch (err) {
  console.error("Failed to drop test database:", err.message);
  process.exit(1);
} finally {
  await client.close();
}
