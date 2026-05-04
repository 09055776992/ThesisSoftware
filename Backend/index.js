import "dotenv/config";
import cors from "cors";
import express from "express";
import crypto from "crypto";
import { getDb } from "./db.js";
import { rankScholarships } from "./matching-algorithms.js";

const app = express();
app.use(cors());
app.use(express.json());

// Seed demo account on startup (only if DEMO_EMAIL and DEMO_PASSWORD are set)
async function seedDemoAccount() {
  try {
    const demoEmail = String(process.env.DEMO_EMAIL || "").trim();
    const demoPassword = String(process.env.DEMO_PASSWORD || "").trim();

    if (!demoEmail || !demoPassword) {
      console.log("Skipping demo account seeding (no DEMO_EMAIL/DEMO_PASSWORD set).");
      return;
    }

    const db = await getDb();
    const usersCollection = db.collection("users");
    const existing = await usersCollection.findOne({ email: demoEmail });
    if (!existing) {
      await usersCollection.insertOne({
        fullName: "Demo User",
        email: demoEmail,
        password: demoPassword,
        phone: "",
        userType: "student",
        avatar: "",
        createdAt: new Date(),
      });
      console.log(`✓ Demo account created: ${demoEmail}`);
    } else {
      console.log("✓ Demo account already exists");
    }
  } catch (error) {
    console.error("Error seeding demo account:", error);
  }
}

// Initialize demo account when app starts (will run after server is listening)

app.get("/health", (_, res) => {
  res.json({ ok: true });
});

app.get("/api/scholarships", async (_, res) => {
  try {
    const db = await getDb();
    const scholarships = await db.collection("scholarships").find({}).toArray();
    res.json({ data: scholarships });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch scholarships." });
  }
});

app.get("/api/scholarships/recommendations", async (req, res) => {
  try {
    const db = await getDb();
    const scholarships = await db.collection("scholarships").find({}).toArray();
    const studentId = String(req.query.studentId || "current-student");
    const ranked = rankScholarships(scholarships, {}, studentId);
    res.json({ data: ranked });
  } catch (error) {
    res.status(500).json({ error: "Failed to rank scholarships." });
  }
});

app.post("/api/scholarships/recommendations", async (req, res) => {
  try {
    const db = await getDb();
    const scholarships = await db.collection("scholarships").find({}).toArray();
    const payload = req.body ?? {};
    const profile = payload.profile ?? payload;
    const studentId = String(payload.studentId || profile.email || "current-student");
    const ranked = rankScholarships(scholarships, profile, studentId);
    res.json({ data: ranked });
  } catch (error) {
    res.status(500).json({ error: "Failed to rank scholarships." });
  }
});

app.post("/api/scholarships", async (req, res) => {
  try {
    const db = await getDb();
    const payload = req.body ?? {};
    const result = await db.collection("scholarships").insertOne(payload);
    res.status(201).json({ insertedId: result.insertedId });
  } catch (error) {
    res.status(500).json({ error: "Failed to create scholarship." });
  }
});

app.post("/api/auth/signup", async (req, res) => {
  try {
    const db = await getDb();
    const payload = req.body ?? {};
    const email = String(payload.email || "").trim().toLowerCase();
    const password = String(payload.password || "");

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const existing = await db.collection("users").findOne({ email });
    if (existing) {
      return res.status(409).json({ error: "Email is already registered." });
    }

    const userType = String(payload.userType || "student");
    const user = {
      fullName: String(payload.fullName || ""),
      email,
      password,
      phone: String(payload.phone || ""),
      userType,
      avatar: "",
      createdAt: new Date(),
    };

    await db.collection("users").insertOne(user);

    // create a simple session token so clients can auto-login after signup
    const token = crypto.randomBytes(24).toString("hex");
    await db.collection("sessions").insertOne({ token, email, createdAt: new Date() });

    return res.status(201).json({
      user: {
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        userType: user.userType,
        avatar: user.avatar,
      },
      token,
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to create user." });
  }
});

app.post("/api/auth/signin", async (req, res) => {
  try {
    const db = await getDb();
    const payload = req.body ?? {};
    const email = String(payload.email || "").trim().toLowerCase();
    const password = String(payload.password || "");

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const user = await db.collection("users").findOne({ email });
    if (!user || user.password !== password) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    // create a simple session token for the client
    const token = crypto.randomBytes(24).toString("hex");
    await db.collection("sessions").insertOne({ token, email, createdAt: new Date() });

    return res.json({
      user: {
        fullName: user.fullName || "",
        email: user.email,
        phone: user.phone || "",
        userType: user.userType || "student",
        avatar: user.avatar || "",
      },
      token,
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to sign in." });
  }
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`API listening on ${port}`);
  // Seed demo account after server is listening so failures don't prevent server from starting
  seedDemoAccount().catch(err => {
    console.error('Seed demo account failed (non-fatal):', err);
  });
});