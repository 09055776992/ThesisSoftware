import "dotenv/config";
import { getDb } from "../db.js";

const API_BASE = "http://localhost:5000";

async function test() {
  try {
    const db = await getDb();
    
    // Create a test scholarship
    const testSchol = {
      name: "Test Scholarship",
      amount: 50000,
      deadline: new Date(Date.now() + 90*24*60*60*1000).toISOString(),
      status: "Active"
    };
    
    const insertResult = await db.collection("scholarships").insertOne(testSchol);
    const scholId = insertResult.insertedId.toString();
    console.log("Created scholarship:", scholId);
    
    // Verify it exists
    const foundSchol = await db.collection("scholarships").findOne({ _id: insertResult.insertedId });
    console.log("Found scholarship in DB:", foundSchol ? "✅" : "❌");
    
    // Try updating directly in database first
    const directUpdateResult = await db.collection("scholarships").updateOne(
      { _id: insertResult.insertedId },
      { $set: { name: "Direct Update Test" } }
    );
    console.log("Direct DB Update matched:", directUpdateResult.matchedCount, "modified:", directUpdateResult.modifiedCount);
    
    // Now try to update it via API
    const adminToken = await getAdminToken();
    console.log("Admin token:", adminToken ? "✅" : "❌");
    
    const updateRes = await fetch(`${API_BASE}/api/admin/scholarships/${scholId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: "Updated Test Scholarship",
        amount: 75000
      })
    });
    
    const updateData = await updateRes.json();
    console.log("Update Status:", updateRes.status);
    console.log("Update Response:", JSON.stringify(updateData, null, 2));
    process.exit(0);
    
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

async function getAdminToken() {
  const signinRes = await fetch(`${API_BASE}/api/auth/admin/signin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@qcsp.gov.ph",
      password: "admin123"
    })
  });
  
  const data = await signinRes.json();
  return data.token;
}

test();
