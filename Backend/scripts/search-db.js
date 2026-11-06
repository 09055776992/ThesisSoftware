import "dotenv/config";
import mongoose from "mongoose";

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const cols = await db.listCollections().toArray();
  for (const c of cols) {
    const found = await db.collection(c.name).find({
      $or: [
        { email: /alenxjl25/i },
        { studentEmail: /alenxjl25/i },
        { userName: /Mamamo/i },
        { name: /Mamamo/i }
      ]
    }).toArray();
    if (found.length > 0) {
      console.log('FOUND IN', c.name, ':', JSON.stringify(found, null, 2));
    }
  }
  console.log('Done searching all collections.');
  process.exit(0);
}
run();
