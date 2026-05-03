import "dotenv/config";
import { getDb } from "../mongo.js";

const email = String(process.env.USER_EMAIL || process.argv[2] || "").trim().toLowerCase();
if (!email) {
  console.error("Usage: USER_EMAIL=alice@example.com node scripts/remove-user.js OR node scripts/remove-user.js alice@example.com");
  process.exit(1);
}

try {
  const db = await getDb();
  const users = db.collection("users");
  const sessions = db.collection("sessions");

  const userDel = await users.deleteMany({ email });
  const sessionDel = await sessions.deleteMany({ email });

  console.log(`Deleted ${userDel.deletedCount} user(s) with email: ${email}`);
  console.log(`Deleted ${sessionDel.deletedCount} session(s) for email: ${email}`);
  process.exit(0);
} catch (err) {
  console.error("Failed to remove user:", err);
  process.exit(2);
}
