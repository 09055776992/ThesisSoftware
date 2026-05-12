import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URL || "mongodb://localhost:27017";
const databaseName = process.env.MONGODB_DB || process.env.MONGO_DB || "thesis_software";

console.log("Connecting to MongoDB...", { uri: mongoUri.replace(/:\/\/[^:]+:[^@]+@/, "://***:***@") });

const client = new MongoClient(mongoUri);

async function fixDeadlines() {
  try {
    await client.connect();
    console.log("Connected successfully!");
    
    const db = client.db(databaseName);
    const scholarships = db.collection("scholarships");
    
    // Count before update
    const beforeCount = await scholarships.countDocuments();
    const expiredCount = await scholarships.countDocuments({ deadline: { $lt: new Date() } });
    
    console.log(`\nFound ${beforeCount} total scholarships`);
    console.log(`Found ${expiredCount} scholarships with expired deadlines`);
    
    // Update all scholarships to December 31, 2026
    const newDeadline = new Date("2026-12-31T23:59:59.000Z");
    
    const result = await scholarships.updateMany(
      {}, // All documents
      { $set: { deadline: newDeadline } }
    );
    
    console.log(`\n=== UPDATE COMPLETE ===`);
    console.log(`Modified: ${result.modifiedCount} scholarships`);
    console.log(`New deadline: December 31, 2026`);
    
    // Verify
    const sample = await scholarships.findOne();
    console.log(`\nSample verification:`);
    console.log(`  Scholarship: ${sample?.name || "N/A"}`);
    console.log(`  Deadline: ${sample?.deadline}`);
    console.log(`  Status: ${sample?.status}`);
    
    // Check remaining expired
    const remainingExpired = await scholarships.countDocuments({ deadline: { $lt: new Date() } });
    
    if (remainingExpired === 0) {
      console.log(`\n✅ SUCCESS: All scholarships now have future deadlines!`);
    } else {
      console.log(`\n⚠️ WARNING: ${remainingExpired} scholarships still have expired deadlines`);
    }
    
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  } finally {
    await client.close();
    console.log("\nDisconnected.");
  }
}

fixDeadlines();
