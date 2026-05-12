import { MongoClient } from "mongodb";
import dotenv from "dotenv";
dotenv.config();

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URL || process.env.DATABASE_URL;
const databaseName = process.env.MONGODB_DB || process.env.MONGO_DB || "thesis_software";

if (!mongoUri) {
  console.error("Missing MongoDB connection string. Set MONGODB_URI or MONGO_URL.");
  process.exit(1);
}

const client = new MongoClient(mongoUri);

async function cleanup() {
  try {
    await client.connect();
    const db = client.db(databaseName);
    console.log(`Connected to database: ${databaseName}`);

    // 1. Delete test/sample users
    const testEmails = [
      "maria.santos@email.com",
      "juan.cruz@email.com",
      "ana.reyes@email.com",
      "carlos.mendoza@email.com",
      "sofia.garcia@email.com",
      "nonqc@email.com",
      "demo@example.com",
    ];

    const usersCollection = db.collection("users");

    const usersByEmail = await usersCollection.deleteMany({
      email: { $in: testEmails },
    });
    console.log(`Deleted ${usersByEmail.deletedCount} test users by email.`);

    const usersByName = await usersCollection.deleteMany({
      fullName: "Demo User",
    });
    console.log(`Deleted ${usersByName.deletedCount} users with fullName "Demo User".`);

    // 2. Delete test scholarships
    const scholarshipsCollection = db.collection("scholarships");

    const testScholarshipNames = [
      "Closed Test Scholarship",
      "Test Excellence Scholarship",
    ];

    const testScholarships = await scholarshipsCollection.deleteMany({
      name: { $in: testScholarshipNames },
    });
    console.log(`Deleted ${testScholarships.deletedCount} test scholarships.`);

    // Also remove any hardcoded test scholarships by provider
    const testByProvider = await scholarshipsCollection.deleteMany({
      provider: "Test University",
    });
    console.log(`Deleted ${testByProvider.deletedCount} scholarships from "Test University".`);

    // Summary
    const totalUsers = await usersCollection.countDocuments();
    const totalScholarships = await scholarshipsCollection.countDocuments();
    console.log(`\nRemaining users: ${totalUsers}`);
    console.log(`Remaining scholarships: ${totalScholarships}`);

    console.log("\nCleanup complete.");
  } catch (error) {
    console.error("Cleanup failed:", error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

cleanup();
