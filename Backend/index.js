import "dotenv/config";
import cors from "cors";
import express from "express";
import crypto from "crypto";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { getDb } from "./db.js";
import { rankScholarships } from "./matching-algorithms.js";
import { seedQCSPPScholarships } from "./seed-qcsp-scholarships.js";
import * as eligibilityMatching from "./eligibility-matching.js";
import { sendOTPEmail, sendWelcomeEmail, maskEmail } from "./services/emailService.js";
import { generateOTP, getOTPExpiry } from "./utils/otpUtils.js";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const { studentEmail, scholarshipId } = req.body;
    const uploadDir = path.join(__dirname, "uploads", "applications", 
      studentEmail ? studentEmail.replace(/[^a-zA-Z0-9]/g, "_") : "unknown", 
      scholarshipId || "unknown"
    );
    
    // Create directory if it doesn't exist
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.]/g, "_");
    cb(null, `${timestamp}_${sanitizedFilename}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, JPG, JPEG, and PNG files are allowed'), false);
    }
  }
});

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Always return JSON for /api routes
app.use('/api', (req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

// Avatar upload configuration
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "uploads", "avatars");
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const email = (req.body.email || "unknown").replace(/[^a-zA-Z0-9]/g, "_");
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${email}${ext}`);
  }
});

const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed'), false);
    }
  }
});

// POST /api/user/upload-avatar - Upload profile picture
app.post("/api/user/upload-avatar", uploadAvatar.single("avatar"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }
    const db = await getDb();
    const email = req.body.email?.toLowerCase();
    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    
    // Store avatar path in user document (URL string, not base64)
    await db.collection("users").updateOne(
      { email },
      { $set: { profileImage: avatarUrl, profilePicture: avatarUrl } }
    );

    console.log(`[Avatar Upload] Updated profile image for ${email}: ${avatarUrl}`);
    res.json({ avatarUrl, message: "Profile picture updated successfully." });
  } catch (error) {
    console.error("[Avatar Upload] Error:", error);
    res.status(500).json({ error: "Failed to upload profile picture." });
  }
});

/** Student-scoped notification (userEmail + optional userId). Module scope so all routes can call it. */
async function insertStudentNotification(db, { userEmail, userId, type, title, message, scholarshipName }) {
  const email = String(userEmail || "").trim().toLowerCase();
  let uid = userId ? String(userId) : null;
  if (!uid && email) {
    const u = await db.collection("users").findOne({ email });
    uid = u?._id ? String(u._id) : null;
  }
  await db.collection("notifications").insertOne({
    userEmail: email,
    userId: uid,
    type,
    title,
    message,
    scholarshipName: scholarshipName || "",
    read: false,
    createdAt: new Date(),
  });
}

// Serve uploads folder as static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

function createAuthToken({ userId, email, userType }) {
  return jwt.sign(
    {
      userId: String(userId || ""),
      email: String(email || "").toLowerCase(),
      userType: String(userType || "student"),
    },
    process.env.JWT_SECRET || "your-secret-key",
    { expiresIn: "7d" },
  );
}

app.get("/health", (_, res) => {
  res.json({ ok: true });
});

// Helper: remove duplicate scholarships by name (keep first occurrence)
function dedupeScholarshipsByName(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const result = [];
  for (const item of list) {
    const name = String(item?.name || "").trim();
    if (!name) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    result.push(item);
  }
  return result;
}

app.get("/api/scholarships", async (req, res) => {
  try {
    console.log('[API] /api/scholarships called, attempting to getDb()');
    const db = await getDb();
    const scholarships = dedupeScholarshipsByName(
      await db.collection("scholarships").find({ status: "Active" }).toArray(),
    );
    
    // Get student email from query parameter for eligibility filtering
    const studentEmail = req.query.studentEmail || req.query.email;
    
    if (studentEmail) {
      // Fetch student profile for eligibility matching
      const student = await db.collection("users").findOne({ email: studentEmail.toLowerCase() });
      
      if (student) {
        // Apply eligibility filtering
        const eligibleScholarships = eligibilityMatching.filterScholarshipsByEligibility(scholarships, student);
        res.json({ 
          data: eligibleScholarships,
          studentProfile: {
            email: student.email,
            educationLevel: student.educationLevel || student.education_level,
            gwa: student.gwa || student.GWA,
            is_qc_resident: student.is_qc_resident
          }
        });
        return;
      }
    }
    
    // No student profile provided or not found - return all active scholarships
    res.json({ data: scholarships });
  } catch (error) {
    console.error('[API] Error in /api/scholarships:', error);
    res.status(500).json({ error: "Failed to fetch scholarships." });
  }
});

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

async function getUserStateByEmail(db, email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;
  return db.collection("user_state").findOne({ email: normalizedEmail });
}

function mergeById(existingItems, incomingItems) {
  const merged = new Map();

  for (const item of Array.isArray(existingItems) ? existingItems : []) {
    if (item && typeof item === "object" && item.id != null) {
      merged.set(String(item.id), item);
    }
  }

  for (const item of Array.isArray(incomingItems) ? incomingItems : []) {
    if (item && typeof item === "object" && item.id != null) {
      merged.set(String(item.id), item);
    }
  }

  return Array.from(merged.values());
}

async function getDisplayNameByEmail(db, email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return "";

  const user = await db.collection("users").findOne({ email: normalizedEmail });
  return String(user?.fullName || user?.email || normalizedEmail.split("@")[0] || normalizedEmail);
}

async function saveConversationsForEmail(db, email, incomingConversations) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return;

  const previous = (await getUserStateByEmail(db, normalizedEmail)) ?? {};
  const nextConversations = mergeById(previous.conversations, incomingConversations);

  await db.collection("user_state").replaceOne(
    { email: normalizedEmail },
    {
      ...previous,
      email: normalizedEmail,
      conversations: nextConversations,
      updatedAt: new Date().toISOString(),
    },
    { upsert: true },
  );
}

app.get("/api/users/:email/saved-scholarships", async (req, res) => {
  try {
    const db = await getDb();
    const email = normalizeEmail(req.params.email);
    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }

    const state = await getUserStateByEmail(db, email);
    const ids = Array.isArray(state?.savedScholarshipIds)
      ? state.savedScholarshipIds.map((v) => Number(v)).filter(Number.isFinite)
      : [];

    return res.json({ data: ids });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch saved scholarships." });
  }
});

app.put("/api/users/:email/saved-scholarships", async (req, res) => {
  try {
    const db = await getDb();
    const email = normalizeEmail(req.params.email);
    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }

    const payload = req.body ?? {};
    const ids = Array.isArray(payload.ids)
      ? payload.ids.map((v) => Number(v)).filter(Number.isFinite)
      : [];

    const previous = (await getUserStateByEmail(db, email)) ?? {};
    await db.collection("user_state").replaceOne(
      { email },
      {
        ...previous,
        email,
        savedScholarshipIds: ids,
        updatedAt: new Date().toISOString(),
      },
      { upsert: true },
    );

    return res.json({ data: ids });
  } catch (error) {
    return res.status(500).json({ error: "Failed to save scholarships." });
  }
});

app.get("/api/users/:email/conversations", async (req, res) => {
  try {
    const db = await getDb();
    const email = normalizeEmail(req.params.email);
    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }

    const state = await getUserStateByEmail(db, email);
    const conversations = Array.isArray(state?.conversations) ? state.conversations : [];
    return res.json({ data: conversations });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch conversations." });
  }
});

app.put("/api/users/:email/conversations", async (req, res) => {
  try {
    const db = await getDb();
    const email = normalizeEmail(req.params.email);
    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }

    const payload = req.body ?? {};
    const conversations = Array.isArray(payload.conversations) ? payload.conversations : [];

    await saveConversationsForEmail(db, email, conversations);

    const senderName = await getDisplayNameByEmail(db, email);
    const mirroredByRecipient = new Map();

    for (const conversation of conversations) {
      const participantEmail = normalizeEmail(conversation?.participantId);
      if (!participantEmail || participantEmail === email || !participantEmail.includes("@")) {
        continue;
      }

      const mirroredConversation = {
        ...conversation,
        participantId: email,
        name: senderName || conversation?.name || email,
      };

      const existing = mirroredByRecipient.get(participantEmail) ?? [];
      existing.push(mirroredConversation);
      mirroredByRecipient.set(participantEmail, existing);
    }

    for (const [recipientEmail, recipientConversations] of mirroredByRecipient.entries()) {
      await saveConversationsForEmail(db, recipientEmail, recipientConversations);
    }

    return res.json({ data: conversations });
  } catch (error) {
    return res.status(500).json({ error: "Failed to save conversations." });
  }
});

// GET /api/users/:email/screening-appointments
// Student views their scheduled screening appointments
app.get("/api/users/:email/screening-appointments", async (req, res) => {
  try {
    const db = await getDb();
    const email = normalizeEmail(req.params.email);

    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }

    // Find all applications for this student with scheduled screenings
    const applications = await db
      .collection("applications")
      .find({
        studentEmail: email,
        "screeningSchedule.isScheduled": true,
      })
      .sort({ "screeningSchedule.scheduledDate": 1 })
      .toArray();

    const screeningAppointments = applications.map((app) => ({
      applicationId: app._id.toString(),
      scholarshipName: app.scholarshipName,
      status: app.status,
      submittedAt: app.submittedAt,
      screening: {
        scheduledDate: app.screeningSchedule?.scheduledDate,
        scheduledTime: app.screeningSchedule?.scheduledTime,
        venue: app.screeningSchedule?.venue,
        notes: app.screeningSchedule?.notes,
        scheduledAt: app.screeningSchedule?.scheduledAt,
      },
    }));

    res.json({
      data: screeningAppointments,
      count: screeningAppointments.length,
      message:
        screeningAppointments.length > 0
          ? "Screening appointments retrieved successfully."
          : "No screening appointments scheduled.",
    });
  } catch (error) {
    console.error("Error fetching screening appointments:", error);
    res.status(500).json({ error: "Failed to fetch screening appointments." });
  }
});

app.get("/api/scholarships/recommendations", async (req, res) => {
  try {
    const db = await getDb();
    const scholarships = dedupeScholarshipsByName(
      await db.collection("scholarships").find({ status: "Active" }).toArray(),
    );
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
    const scholarships = dedupeScholarshipsByName(
      await db.collection("scholarships").find({ status: "Active" }).toArray(),
    );
    const payload = req.body ?? {};
    const profile = payload.profile ?? payload;
    const studentId = String(payload.studentId || profile.email || "current-student");
    const ranked = rankScholarships(scholarships, profile, studentId);
    res.json({ data: ranked });
  } catch (error) {
    res.status(500).json({ error: "Failed to rank scholarships." });
  }
});

/** Single scholarship by MongoDB id (for deep links / modal refresh). */
/** NOTE: This must stay AFTER all specific /api/scholarships/* named routes to avoid /:id swallowing them. */
app.get("/api/scholarships/:id", async (req, res) => {
  try {
    const db = await getDb();
    const { ObjectId } = await import("mongodb");
    const rawId = String(req.params.id || "").trim();
    let scholarship = null;
    if (ObjectId.isValid(rawId)) {
      scholarship = await db.collection("scholarships").findOne({ _id: new ObjectId(rawId) });
    }
    if (!scholarship) {
      scholarship = await db.collection("scholarships").findOne({ _id: rawId });
    }
    if (!scholarship) {
      return res.status(404).json({ error: "Scholarship not found." });
    }
    res.json({ data: scholarship });
  } catch (error) {
    console.error("[API] GET /api/scholarships/:id", error);
    res.status(500).json({ error: "Failed to fetch scholarship." });
  }
});

/** Per-student eligibility for modal / Apply flow (authoritative canApply + deadline). */
/** NOTE: This must stay AFTER all specific /api/scholarships/* named routes. */
app.get("/api/scholarships/:id/check-eligibility", async (req, res) => {
  try {
    const db = await getDb();
    const { ObjectId } = await import("mongodb");
    const rawId = String(req.params.id || "").trim();
    const studentEmail = normalizeEmail(req.query.studentEmail);
    if (!studentEmail) {
      return res.status(400).json({ error: "Query parameter studentEmail is required." });
    }

    let scholarship = null;
    if (ObjectId.isValid(rawId)) {
      scholarship = await db.collection("scholarships").findOne({ _id: new ObjectId(rawId) });
    }
    if (!scholarship) {
      scholarship = await db.collection("scholarships").findOne({ _id: rawId });
    }
    if (!scholarship) {
      return res.status(404).json({ error: "Scholarship not found." });
    }

    const student = await db.collection("users").findOne({ email: studentEmail });
    if (!student) {
      return res.status(404).json({ error: "Student not found." });
    }

    const eligibility = eligibilityMatching.checkEligibility(student, scholarship);
    const deadline = new Date(scholarship.deadline);
    const openingDate = scholarship.openingDate ? new Date(scholarship.openingDate) : null;
    const now = new Date();

    let deadlineStatus = "open";
    if (deadline < now) {
      deadlineStatus = "closed";
    } else if (openingDate && openingDate > now) {
      deadlineStatus = "not-yet-open";
    } else {
      const daysUntil = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
      if (daysUntil <= 7) {
        deadlineStatus = "closing-soon";
      }
    }

    const deadlineAllowsApply =
      deadlineStatus === "open" || deadlineStatus === "closing-soon";
    const eligibleToApply = eligibility.isEligible || eligibility.mayBeEligible;
    const canApply = Boolean(eligibleToApply && deadlineAllowsApply);

    const daysUntilDeadline = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    res.json({
      eligible: eligibility.isEligible,
      mayBeEligible: eligibility.mayBeEligible,
      unmetCriteria: eligibility.unmetCriteria || [],
      metCriteria: eligibility.reasons || [],
      canApply,
      deadline: scholarship.deadline,
      daysUntilDeadline,
      isClosingSoon: deadlineStatus === "closing-soon",
      preScreenedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[API] GET /api/scholarships/:id/check-eligibility", error);
    res.status(500).json({ error: "Failed to check eligibility." });
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

app.get("/api/admin/scholarships", async (_, res) => {
  try {
    const db = await getDb();
    const scholarships = dedupeScholarshipsByName(
      await db.collection("scholarships").find({}).sort({ createdAt: -1 }).toArray(),
    );
    res.json({ data: scholarships });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch scholarships." });
  }
});

app.post("/api/admin/scholarships", async (req, res) => {
  try {
    const db = await getDb();
    const payload = req.body ?? {};
    const scholarship = {
      name: String(payload.name || "").trim(),
      provider: String(payload.provider || payload.organization || "").trim(),
      organization: String(payload.organization || payload.provider || "").trim(),
      amount: Number(payload.amount || 0),
      deadline: payload.deadline ? new Date(payload.deadline) : new Date(),
      status: String(payload.status || "Active"),
      type: String(payload.type || "Other"),
      fieldOfStudy: String(payload.fieldOfStudy || "").trim(),
      location: String(payload.location || "").trim(),
      description: String(payload.description || "").trim(),
      eligibilityCriteria: payload.eligibilityCriteria || {},
      applicationsCount: Number(payload.applicationsCount || 0),
      createdAt: new Date(),
    };

    const result = await db.collection("scholarships").insertOne(scholarship);
    res.status(201).json({ data: { ...scholarship, _id: result.insertedId } });
  } catch (error) {
    res.status(500).json({ error: "Failed to create scholarship." });
  }
});

app.put("/api/admin/scholarships/:id", async (req, res) => {
  try {
    const db = await getDb();
    const { ObjectId } = await import("mongodb");
    const payload = req.body ?? {};
    
    console.log("[PUT Scholarship] ID param:", req.params.id);
    
    // Validate ObjectId format
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid scholarship ID format." });
    }
    
    const objectId = new ObjectId(req.params.id);
    console.log("[PUT Scholarship] Converted ObjectId:", objectId.toString());
    
    const updates = {
      ...payload,
      provider: payload.provider ?? payload.organization,
      organization: payload.organization ?? payload.provider,
    };

    if (updates.amount !== undefined) updates.amount = Number(updates.amount);
    if (updates.deadline) updates.deadline = new Date(updates.deadline);

    Object.keys(updates).forEach((key) => updates[key] === undefined && delete updates[key]);

    console.log("[PUT Scholarship] Updates:", Object.keys(updates));
    
    // First verify scholarship exists
    const exists = await db.collection("scholarships").findOne({ _id: objectId });
    console.log("[PUT Scholarship] Scholarship exists:", !!exists);

    // Use updateOne and fetch separately to ensure compatibility
    const updateResult = await db.collection("scholarships").updateOne(
      { _id: objectId },
      { $set: updates }
    );

    console.log("[PUT Scholarship] Update result - matched:", updateResult.matchedCount, "modified:", updateResult.modifiedCount);

    if (!updateResult.matchedCount) {
      return res.status(404).json({ error: "Scholarship not found." });
    }

    // Fetch the updated document
    const updatedScholarship = await db.collection("scholarships").findOne({ _id: objectId });

    res.json({ data: updatedScholarship });
  } catch (error) {
    console.error("Error updating scholarship:", error);
    res.status(500).json({ error: "Failed to update scholarship.", details: error.message });
  }
});

app.delete("/api/admin/scholarships/:id", async (req, res) => {
  try {
    const db = await getDb();
    const { ObjectId } = await import("mongodb");
    const result = await db.collection("scholarships").deleteOne({ _id: new ObjectId(req.params.id) });

    if (!result.deletedCount) {
      return res.status(404).json({ error: "Scholarship not found." });
    }

    res.json({ message: "Scholarship deleted successfully." });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete scholarship." });
  }
});

// QCSP Scholarship Seeding Endpoint
app.post("/api/admin/seed-qcsp", async (req, res) => {
  try {
    console.log("🌱 Starting QCSP scholarship seeding...");
    const result = await seedQCSPPScholarships();
    
    if (result.success) {
      res.json({
        success: true,
        message: `Successfully seeded ${result.seeded} new QCSP scholarships. Total QCSP scholarships: ${result.total}`,
        seeded: result.seeded,
        total: result.total
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error("Error seeding QCSP scholarships:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to seed QCSP scholarships" 
    });
  }
});

// NOTE: GET /api/admin/applications, PATCH approve/reject are defined further below
// with the full status-flow implementation. These early stubs have been removed
// to avoid duplicate route registration (Express uses the first match).

// TEST ENDPOINT - verify new code is loaded
app.get("/api/test-screening", (req, res) => {
  res.json({ message: "Screening endpoints are loaded!" });
});

// PATCH /api/admin/applications/:id/schedule-screening
// Admin schedules final screening appointment for eligible student
app.patch("/api/admin/applications/:id/schedule-screening", async (req, res) => {
  console.log("[SCREENING-ENDPOINT] Received request for:", req.params.id);
  try {
    const db = await getDb();
    const { ObjectId } = await import("mongodb");
    const { scheduledDate, scheduledTime, venue, notes } = req.body;

    // Validate required fields
    if (!scheduledDate || !scheduledTime || !venue) {
      return res.status(400).json({
        error: "scheduledDate, scheduledTime, and venue are required.",
      });
    }

    // Validate date format (YYYY-MM-DD)
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(scheduledDate)) {
      return res.status(400).json({
        error: "Invalid date format. Use YYYY-MM-DD.",
      });
    }

    // Validate time format (HH:MM in 24-hour format)
    const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!timePattern.test(scheduledTime)) {
      return res.status(400).json({
        error: "Invalid time format. Use HH:MM (24-hour format).",
      });
    }

    // Ensure scheduled date is in the future
    const screeningDateTime = new Date(`${scheduledDate}T${scheduledTime}:00Z`);
    if (screeningDateTime < new Date()) {
      return res.status(400).json({
        error: "Screening date and time must be in the future.",
      });
    }

    // Update application with screening schedule
    const idParam = String(req.params.id || "").trim();
    const query = ObjectId.isValid(idParam)
      ? { $or: [{ _id: new ObjectId(idParam) }, { _id: idParam }] }
      : { _id: idParam };
    console.log('[SCREENING-ENDPOINT] idParam:', idParam, 'isValidObjectId:', ObjectId.isValid(idParam));
    try {
      console.log('[SCREENING-ENDPOINT] Query for update:', JSON.stringify(query));
    } catch (e) {
      console.log('[SCREENING-ENDPOINT] Query for update (non-serializable)');
    }

    const result = await db.collection("applications").findOneAndUpdate(
      query,
      {
        $set: {
          screeningSchedule: {
            scheduledDate: screeningDateTime,
            scheduledTime,
            venue,
            scheduledBy: req.user?.id || null,
            scheduledAt: new Date(),
            notes: notes || null,
            isScheduled: true,
          },
        },
      },
      { returnDocument: "after" },
    );
    if (!result) {
      return res.status(404).json({ error: "Application not found." });
    }

    res.json({
      data: result,
      message: "Screening appointment scheduled successfully.",
      screening: result.screeningSchedule,
    });
  } catch (error) {
    console.error("Error scheduling screening:", error);
    res.status(500).json({ error: "Failed to schedule screening appointment." });
  }
});

// GET /api/admin/applications/:id/screening
// Get screening details for a specific application
app.get("/api/admin/applications/:id/screening", async (req, res) => {
  try {
    const db = await getDb();
    const { ObjectId } = await import("mongodb");

    const idParam = String(req.params.id || "").trim();
    const query = ObjectId.isValid(idParam)
      ? { $or: [{ _id: new ObjectId(idParam) }, { _id: idParam }] }
      : { _id: idParam };

    const application = await db.collection("applications").findOne(query);

    if (!application) {
      return res.status(404).json({ error: "Application not found." });
    }

    res.json({
      data: {
        applicationId: String(application._id),
        studentName: application.studentName,
        studentEmail: application.studentEmail,
        scholarshipName: application.scholarshipName,
        status: application.status,
        screeningSchedule: application.screeningSchedule,
      },
    });
  } catch (error) {
    console.error("Error fetching screening details:", error);
    res.status(500).json({ error: "Failed to fetch screening details." });
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
      location: String(payload.location || ""),
      userType,
      avatar: "",
      createdAt: new Date(),
    };

    const result = await db.collection("users").insertOne(user);

    const token = createAuthToken({ userId: result.insertedId, email, userType });
    await db.collection("sessions").insertOne({ token, email, createdAt: new Date() });

    // Send welcome email (non-blocking — don't fail signup if email fails)
    sendWelcomeEmail(email, user.fullName).catch((err) =>
      console.error("[Email] Welcome email failed:", err.message)
    );

    return res.status(201).json({
      user: {
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        location: user.location,
        userType: user.userType,
        avatar: user.avatar,
      },
      token,
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to create user." });
  }
});

// ---------------------------------------------------------------------------
// STEP 1 of 2FA login: verify email+password, send OTP
// ---------------------------------------------------------------------------
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

    // Password correct — generate OTP and send email
    const otpCode = generateOTP();
    const otpExpiry = getOTPExpiry();

    // Remove any existing OTP for this user
    await db.collection("otps").deleteMany({ userId: user._id });

    // Store new OTP
    await db.collection("otps").insertOne({
      userId: user._id,
      email: user.email,
      otp: otpCode,
      otpExpiry,
      isUsed: false,
      attempts: 0,
      createdAt: new Date(),
    });

    // Send OTP email
    await sendOTPEmail(user.email, otpCode, user.fullName || user.email);

    return res.json({
      success: true,
      requiresOTP: true,
      userId: String(user._id),
      maskedEmail: maskEmail(user.email),
      message: "Verification code sent to your email.",
    });
  } catch (error) {
    console.error("[Signin] Error:", error);
    return res.status(500).json({ error: "Failed to sign in." });
  }
});

// ---------------------------------------------------------------------------
// STEP 2 of 2FA login: verify OTP, return JWT
// ---------------------------------------------------------------------------
app.post("/api/auth/verify-otp", async (req, res) => {
  try {
    const db = await getDb();
    const { ObjectId } = await import("mongodb");
    const { userId, otp } = req.body ?? {};

    if (!userId || !otp) {
      return res.status(400).json({ error: "userId and otp are required." });
    }

    let userObjectId;
    try {
      userObjectId = new ObjectId(String(userId));
    } catch {
      return res.status(400).json({ error: "Invalid userId." });
    }

    const otpRecord = await db.collection("otps").findOne({
      userId: userObjectId,
      isUsed: false,
    });

    if (!otpRecord) {
      return res.status(400).json({ error: "OTP expired or not found. Please login again." });
    }

    // Max 5 attempts
    if (otpRecord.attempts >= 5) {
      await db.collection("otps").deleteOne({ _id: otpRecord._id });
      return res.status(400).json({ error: "Too many incorrect attempts. Please login again." });
    }

    // Check expiry
    if (new Date() > new Date(otpRecord.otpExpiry)) {
      await db.collection("otps").deleteOne({ _id: otpRecord._id });
      return res.status(400).json({ error: "OTP has expired. Please login again." });
    }

    // Check OTP value
    if (String(otp) !== String(otpRecord.otp)) {
      await db.collection("otps").updateOne(
        { _id: otpRecord._id },
        { $inc: { attempts: 1 } }
      );
      const remaining = 5 - (otpRecord.attempts + 1);
      return res.status(400).json({ error: `Incorrect code. ${remaining} attempt(s) remaining.` });
    }

    // OTP correct — mark as used
    await db.collection("otps").updateOne({ _id: otpRecord._id }, { $set: { isUsed: true } });

    // Fetch user
    const user = await db.collection("users").findOne({ _id: userObjectId });
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const token = createAuthToken({ userId: user._id, email: user.email, userType: user.userType || "student" });
    await db.collection("sessions").insertOne({ token, email: user.email, createdAt: new Date() });

    const profileImage = user.profileImage || user.profilePicture || user.avatar || "";

    return res.json({
      success: true,
      token,
      user: {
        fullName: user.fullName || "",
        email: user.email,
        phone: user.phone || "",
        location: user.location || "",
        userType: user.userType || "student",
        avatar: profileImage,
        profileImage,
        profilePicture: profileImage,
      },
    });
  } catch (error) {
    console.error("[Verify OTP] Error:", error);
    return res.status(500).json({ error: "Verification failed. Please try again." });
  }
});

// ---------------------------------------------------------------------------
// Resend OTP (rate-limited: 60 seconds between requests)
// ---------------------------------------------------------------------------
app.post("/api/auth/resend-otp", async (req, res) => {
  try {
    const db = await getDb();
    const { ObjectId } = await import("mongodb");
    const { userId } = req.body ?? {};

    if (!userId) {
      return res.status(400).json({ error: "userId is required." });
    }

    let userObjectId;
    try {
      userObjectId = new ObjectId(String(userId));
    } catch {
      return res.status(400).json({ error: "Invalid userId." });
    }

    const user = await db.collection("users").findOne({ _id: userObjectId });
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Rate limit: only allow resend after 60 seconds
    const recentOTP = await db.collection("otps").findOne({
      userId: userObjectId,
      createdAt: { $gt: new Date(Date.now() - 60 * 1000) },
    });

    if (recentOTP) {
      return res.status(429).json({ error: "Please wait 60 seconds before requesting a new code." });
    }

    const otpCode = generateOTP();
    await db.collection("otps").deleteMany({ userId: userObjectId });
    await db.collection("otps").insertOne({
      userId: userObjectId,
      email: user.email,
      otp: otpCode,
      otpExpiry: getOTPExpiry(),
      isUsed: false,
      attempts: 0,
      createdAt: new Date(),
    });

    await sendOTPEmail(user.email, otpCode, user.fullName || user.email);

    return res.json({
      success: true,
      message: "New verification code sent.",
      maskedEmail: maskEmail(user.email),
    });
  } catch (error) {
    console.error("[Resend OTP] Error:", error);
    return res.status(500).json({ error: "Failed to resend code." });
  }
});

// Admin authentication endpoints
app.post("/api/auth/admin/signin", async (req, res) => {
  try {
    const db = await getDb();
    const payload = req.body ?? {};
    const email = String(payload.email || "").trim().toLowerCase();
    const password = String(payload.password || "");

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const admin = await db.collection("admins").findOne({ email });
    if (!admin) {
      return res.status(401).json({ error: "Invalid admin credentials." });
    }

    // Use bcrypt to compare passwords securely
    const passwordMatch = await bcryptjs.compare(password, admin.passwordHash || admin.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid admin credentials." });
    }

    // Password correct — generate OTP and send email
    const otpCode = generateOTP();
    const otpExpiry = getOTPExpiry();

    await db.collection("otps").deleteMany({ userId: admin._id });
    await db.collection("otps").insertOne({
      userId: admin._id,
      email: admin.email,
      otp: otpCode,
      otpExpiry,
      isUsed: false,
      attempts: 0,
      userType: "admin",
      createdAt: new Date(),
    });

    await sendOTPEmail(admin.email, otpCode, admin.fullName || admin.email);

    return res.json({
      success: true,
      requiresOTP: true,
      userId: String(admin._id),
      maskedEmail: maskEmail(admin.email),
      message: "Verification code sent to your email.",
    });
  } catch (error) {
    console.error("[Admin Signin] Error:", error);
    return res.status(500).json({ error: "Failed to sign in as admin." });
  }
});

// ---------------------------------------------------------------------------
// Admin OTP verification
// ---------------------------------------------------------------------------
app.post("/api/auth/admin/verify-otp", async (req, res) => {
  try {
    const db = await getDb();
    const { ObjectId } = await import("mongodb");
    const { userId, otp } = req.body ?? {};

    if (!userId || !otp) {
      return res.status(400).json({ error: "userId and otp are required." });
    }

    let adminObjectId;
    try {
      adminObjectId = new ObjectId(String(userId));
    } catch {
      return res.status(400).json({ error: "Invalid userId." });
    }

    const otpRecord = await db.collection("otps").findOne({
      userId: adminObjectId,
      isUsed: false,
    });

    if (!otpRecord) {
      return res.status(400).json({ error: "OTP expired or not found. Please login again." });
    }

    if (otpRecord.attempts >= 5) {
      await db.collection("otps").deleteOne({ _id: otpRecord._id });
      return res.status(400).json({ error: "Too many incorrect attempts. Please login again." });
    }

    if (new Date() > new Date(otpRecord.otpExpiry)) {
      await db.collection("otps").deleteOne({ _id: otpRecord._id });
      return res.status(400).json({ error: "OTP has expired. Please login again." });
    }

    if (String(otp) !== String(otpRecord.otp)) {
      await db.collection("otps").updateOne(
        { _id: otpRecord._id },
        { $inc: { attempts: 1 } }
      );
      const remaining = 5 - (otpRecord.attempts + 1);
      return res.status(400).json({ error: `Incorrect code. ${remaining} attempt(s) remaining.` });
    }

    await db.collection("otps").updateOne({ _id: otpRecord._id }, { $set: { isUsed: true } });

    const admin = await db.collection("admins").findOne({ _id: adminObjectId });
    if (!admin) {
      return res.status(404).json({ error: "Admin not found." });
    }

    const token = createAuthToken({ userId: admin._id, email: admin.email, userType: "admin" });
    await db.collection("sessions").insertOne({ token, email: admin.email, role: "admin", createdAt: new Date() });

    return res.json({
      success: true,
      token,
      user: {
        fullName: admin.fullName || "",
        email: admin.email,
        userType: "admin",
      },
    });
  } catch (error) {
    console.error("[Admin Verify OTP] Error:", error);
    return res.status(500).json({ error: "Verification failed. Please try again." });
  }
});

// ---------------------------------------------------------------------------
// Admin resend OTP
// ---------------------------------------------------------------------------
app.post("/api/auth/admin/resend-otp", async (req, res) => {
  try {
    const db = await getDb();
    const { ObjectId } = await import("mongodb");
    const { userId } = req.body ?? {};

    if (!userId) {
      return res.status(400).json({ error: "userId is required." });
    }

    let adminObjectId;
    try {
      adminObjectId = new ObjectId(String(userId));
    } catch {
      return res.status(400).json({ error: "Invalid userId." });
    }

    const admin = await db.collection("admins").findOne({ _id: adminObjectId });
    if (!admin) {
      return res.status(404).json({ error: "Admin not found." });
    }

    const recentOTP = await db.collection("otps").findOne({
      userId: adminObjectId,
      createdAt: { $gt: new Date(Date.now() - 60 * 1000) },
    });

    if (recentOTP) {
      return res.status(429).json({ error: "Please wait 60 seconds before requesting a new code." });
    }

    const otpCode = generateOTP();
    await db.collection("otps").deleteMany({ userId: adminObjectId });
    await db.collection("otps").insertOne({
      userId: adminObjectId,
      email: admin.email,
      otp: otpCode,
      otpExpiry: getOTPExpiry(),
      isUsed: false,
      attempts: 0,
      userType: "admin",
      createdAt: new Date(),
    });

    await sendOTPEmail(admin.email, otpCode, admin.fullName || admin.email);

    return res.json({
      success: true,
      message: "New verification code sent.",
      maskedEmail: maskEmail(admin.email),
    });
  } catch (error) {
    console.error("[Admin Resend OTP] Error:", error);
    return res.status(500).json({ error: "Failed to resend code." });
  }
});

app.post("/api/auth/admin/signup", async (req, res) => {
  try {
    const db = await getDb();
    const payload = req.body ?? {};
    const email = String(payload.email || "").trim().toLowerCase();
    const password = String(payload.password || "");
    const fullName = String(payload.fullName || "");

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const existing = await db.collection("admins").findOne({ email });
    if (existing) {
      return res.status(409).json({ error: "Admin account already exists." });
    }

    // Hash password using bcrypt
    const passwordHash = await bcryptjs.hash(password, 10);

    const admin = {
      fullName,
      email,
      passwordHash,
      userType: "admin",
      createdAt: new Date(),
    };

    const adminResult = await db.collection("admins").insertOne(admin);

    const token = createAuthToken({ userId: adminResult.insertedId, email, userType: "admin" });
    await db.collection("sessions").insertOne({ token, email, role: "admin", createdAt: new Date() });

    return res.status(201).json({
      user: {
        fullName: admin.fullName,
        email: admin.email,
        userType: "admin",
      },
      token,
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to create admin account." });
  }
});

// Provider authentication endpoints
app.post("/api/auth/provider/signin", async (req, res) => {
  try {
    const db = await getDb();
    const payload = req.body ?? {};
    const email = String(payload.email || "").trim().toLowerCase();
    const password = String(payload.password || "");

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const provider = await db.collection("providers").findOne({ email });
    if (!provider || provider.password !== password) {
      return res.status(401).json({ error: "Invalid provider credentials." });
    }

    const token = createAuthToken({ userId: provider._id, email, userType: "provider" });
    await db.collection("sessions").insertOne({ token, email, role: "provider", createdAt: new Date() });

    return res.json({
      user: {
        fullName: provider.fullName || "",
        email: provider.email,
        userType: "provider",
      },
      token,
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to sign in as provider." });
  }
});

app.post("/api/auth/provider/signup", async (req, res) => {
  try {
    const db = await getDb();
    const payload = req.body ?? {};
    const email = String(payload.email || "").trim().toLowerCase();
    const password = String(payload.password || "");
    const fullName = String(payload.fullName || "");
    const phone = String(payload.phone || "");
    const contactPerson = String(payload.contactPerson || "");

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const existing = await db.collection("providers").findOne({ email });
    if (existing) {
      return res.status(409).json({ error: "Provider account already exists." });
    }

    const provider = {
      fullName,
      email,
      password,
      phone,
      contactPerson,
      userType: "provider",
      createdAt: new Date(),
    };

    const providerResult = await db.collection("providers").insertOne(provider);

    const token = createAuthToken({ userId: providerResult.insertedId, email, userType: "provider" });
    await db.collection("sessions").insertOne({ token, email, role: "provider", createdAt: new Date() });

    return res.status(201).json({
      user: {
        fullName: provider.fullName,
        email: provider.email,
        userType: "provider",
      },
      token,
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to create provider account." });
  }
});

app.get("/api/provider/scholarships", async (req, res) => {
  try {
    const db = await getDb();
    const providerEmail = req.query.email ? String(req.query.email).trim().toLowerCase() : null;
    
    if (!providerEmail) {
      return res.status(400).json({ error: "Provider email is required." });
    }

    const scholarships = await db
      .collection("scholarships")
      .find({ provider: providerEmail })
      .toArray();
    
    res.json({ data: scholarships });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch provider scholarships." });
  }
});

app.get("/api/provider/applications", async (req, res) => {
  try {
    const db = await getDb();
    const providerEmail = req.query.email ? String(req.query.email).trim().toLowerCase() : null;
    
    if (!providerEmail) {
      return res.status(400).json({ error: "Provider email is required." });
    }

    // This assumes applications have a provider field linking to the scholarship provider
    const applications = await db
      .collection("applications")
      .find({ providerEmail })
      .toArray();
    
    res.json({ data: applications });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch provider applications." });
  }
});

app.post("/api/provider/scholarships", async (req, res) => {
  try {
    const db = await getDb();
    const payload = req.body ?? {};
    const providerEmail = String(payload.providerEmail || "").trim().toLowerCase();

    if (!providerEmail) {
      return res.status(400).json({ error: "Provider email is required." });
    }

    const scholarship = {
      ...payload,
      provider: providerEmail,
      createdAt: new Date(),
    };

    const result = await db.collection("scholarships").insertOne(scholarship);
    res.status(201).json({ insertedId: result.insertedId });
  } catch (error) {
    res.status(500).json({ error: "Failed to create scholarship." });
  }
});

// PUT/POST /api/users/profile - Update user profile (location, gpa, education, etc.)
const handleUserProfileUpdate = async (req, res) => {
  try {
    const db = await getDb();
    const {
      email,
      fullName,
      phone,
      location,
      gpa,
      gwa,
      educationLevel,
      yearLevel,
      fieldOfStudy,
      incomeCategory,
      financialNeed,
      school,
      schoolName,
      schoolCampus,
      schoolType,
      schoolLocation,
      enrolledInQCSchool,
      isAthlete,
      isArtist,
      isSKOfficial,
      isStudentLeader,
      isIndigent,
      isPWD,
      isSoloParent,
      graduationYear,
      dateOfBirth,
      netWorth,
      currency,
      specialCategories,
      about,
      headline,
      skills,
      profileImage,
      profilePicture,
      hasAcademicHonors,
      academic_rank,
      academicRank,
    } = req.body;

    console.log("[Profile Update] Request body:", req.body);

    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // First check if user exists
    const existingUser = await db.collection("users").findOne({ email: normalizedEmail });
    console.log("[Profile Update] Found user:", existingUser ? "YES" : "NO", "for email:", normalizedEmail);

    if (!existingUser) {
      return res.status(404).json({ error: "User not found." });
    }

    // Build updated user object merging existing with new fields
    const updatedUser = { ...existingUser };
    if (fullName !== undefined) updatedUser.fullName = String(fullName);
    if (phone !== undefined) updatedUser.phone = String(phone);
    if (location !== undefined) updatedUser.location = String(location);
    if (gpa !== undefined) updatedUser.gpa = String(gpa);
    if (gwa !== undefined) updatedUser.gwa = String(gwa);
    if (educationLevel !== undefined) updatedUser.educationLevel = String(educationLevel);
    if (yearLevel !== undefined) updatedUser.yearLevel = String(yearLevel);
    if (fieldOfStudy !== undefined) updatedUser.fieldOfStudy = String(fieldOfStudy);
    if (incomeCategory !== undefined) updatedUser.incomeCategory = String(incomeCategory);
    if (financialNeed !== undefined) updatedUser.financialNeed = financialNeed;
    if (school !== undefined) updatedUser.school = String(school);
    if (schoolName !== undefined) updatedUser.schoolName = String(schoolName);
    if (schoolCampus !== undefined) updatedUser.schoolCampus = String(schoolCampus);
    if (schoolType !== undefined) updatedUser.schoolType = String(schoolType);
    if (schoolLocation !== undefined) updatedUser.schoolLocation = String(schoolLocation);
    if (enrolledInQCSchool !== undefined) updatedUser.enrolledInQCSchool = enrolledInQCSchool === true || enrolledInQCSchool === "true";
    if (graduationYear !== undefined) updatedUser.graduationYear = String(graduationYear);
    if (dateOfBirth !== undefined) updatedUser.dateOfBirth = String(dateOfBirth);
    if (netWorth !== undefined) updatedUser.netWorth = String(netWorth);
    if (currency !== undefined) updatedUser.currency = String(currency);
    if (about !== undefined) updatedUser.about = String(about);
    if (headline !== undefined) updatedUser.headline = String(headline);
    if (skills !== undefined) {
      updatedUser.skills = Array.isArray(skills)
        ? skills.map((s) => String(s).trim()).filter(Boolean)
        : String(skills || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
    }

    const avatarCandidate = profilePicture ?? profileImage;
    if (avatarCandidate !== undefined) {
      const avatarStr = String(avatarCandidate || "").trim();
      if (avatarStr.startsWith("data:")) {
        return res.status(400).json({
          error: "Profile pictures must be uploaded as files, not embedded base64.",
        });
      }
      if (avatarStr) {
        updatedUser.profileImage = avatarStr;
        updatedUser.profilePicture = avatarStr;
      }
    }
    
    // Special category fields for scholarship eligibility
    const existingSpecialCategories = existingUser.specialCategories || {};
    const updatedSpecialCategories = {
      isAthlete: existingSpecialCategories.isAthlete === true,
      isArtist: existingSpecialCategories.isArtist === true,
      isSKOfficial: existingSpecialCategories.isSKOfficial === true,
      isStudentLeader: existingSpecialCategories.isStudentLeader === true,
      isIndigent: existingSpecialCategories.isIndigent === true,
      isPWD: existingSpecialCategories.isPWD === true,
      isSoloParent: existingSpecialCategories.isSoloParent === true,
    };

    if (isAthlete !== undefined) updatedSpecialCategories.isAthlete = isAthlete === true || isAthlete === "true";
    if (isArtist !== undefined) updatedSpecialCategories.isArtist = isArtist === true || isArtist === "true";
    if (isSKOfficial !== undefined) updatedSpecialCategories.isSKOfficial = isSKOfficial === true || isSKOfficial === "true";
    if (isStudentLeader !== undefined) updatedSpecialCategories.isStudentLeader = isStudentLeader === true || isStudentLeader === "true";
    if (isIndigent !== undefined) updatedSpecialCategories.isIndigent = isIndigent === true || isIndigent === "true";
    if (isPWD !== undefined) updatedSpecialCategories.isPWD = isPWD === true || isPWD === "true";
    if (isSoloParent !== undefined) updatedSpecialCategories.isSoloParent = isSoloParent === true || isSoloParent === "true";

    if (specialCategories && typeof specialCategories === "object") {
      const nested = specialCategories;
      if (nested.isFromIndigenousFamily === true || nested.isFromIndigenousFamily === "true") {
        updatedSpecialCategories.isIndigent = true;
      }
    }

    updatedUser.specialCategories = updatedSpecialCategories;
    updatedUser.isAthlete = updatedSpecialCategories.isAthlete;
    updatedUser.isArtist = updatedSpecialCategories.isArtist;
    updatedUser.isSKOfficial = updatedSpecialCategories.isSKOfficial;
    updatedUser.isStudentLeader = updatedSpecialCategories.isStudentLeader;
    updatedUser.isIndigent = updatedSpecialCategories.isIndigent;
    updatedUser.isPWD = updatedSpecialCategories.isPWD;
    updatedUser.isSoloParent = updatedSpecialCategories.isSoloParent;

    const honorsFlag = hasAcademicHonors;
    const rankRaw = academic_rank ?? academicRank;
    if (honorsFlag !== undefined) {
      const honors =
        honorsFlag === true || honorsFlag === "true" || honorsFlag === 1 || honorsFlag === "1";
      updatedUser.hasAcademicHonors = honors;
      updatedUser.academic_honors = honors;
    }
    if (rankRaw !== undefined && rankRaw !== null && String(rankRaw).trim() !== "") {
      const rank = Number.parseInt(String(rankRaw), 10);
      if (Number.isFinite(rank) && rank >= 1 && rank <= 10) {
        updatedUser.academic_rank = rank;
        updatedUser.hasAcademicHonors = true;
        updatedUser.academic_honors = true;
      }
    } else if (rankRaw === "" || rankRaw === null) {
      delete updatedUser.academic_rank;
    }

    console.log("[Profile Update] Updating fields:", Object.keys(updatedUser).filter(k => k !== '_id' && k !== 'password'));

    // Use replaceOne since updateOne is not available in the wrapper
    await db.collection("users").replaceOne(
      { email: normalizedEmail },
      updatedUser
    );

    console.log("[Profile Update] Profile updated successfully");

    return res.json({
      message: "Profile updated successfully.",
      user: {
        fullName: updatedUser.fullName || "",
        email: updatedUser.email,
        phone: updatedUser.phone || "",
        location: updatedUser.location || "",
        gpa: updatedUser.gpa || "",
        gwa: updatedUser.gwa || "",
        educationLevel: updatedUser.educationLevel || "",
        yearLevel: updatedUser.yearLevel || "",
        fieldOfStudy: updatedUser.fieldOfStudy || "",
        graduationYear: updatedUser.graduationYear || "",
        incomeCategory: updatedUser.incomeCategory || "",
        financialNeed: updatedUser.financialNeed || [],
        netWorth: updatedUser.netWorth || "",
        currency: updatedUser.currency || "",
        about: updatedUser.about || "",
        headline: updatedUser.headline || "",
        skills: updatedUser.skills || [],
        school: updatedUser.school || "",
        schoolName: updatedUser.schoolName || "",
        schoolCampus: updatedUser.schoolCampus || "",
        schoolType: updatedUser.schoolType || "",
        schoolLocation: updatedUser.schoolLocation || "",
        enrolledInQCSchool: updatedUser.enrolledInQCSchool || false,
        isAthlete: updatedUser.isAthlete || false,
        isArtist: updatedUser.isArtist || false,
        isSKOfficial: updatedUser.isSKOfficial || false,
        isStudentLeader: updatedUser.isStudentLeader || false,
        isIndigent: updatedUser.isIndigent || false,
        isPWD: updatedUser.isPWD || false,
        isSoloParent: updatedUser.isSoloParent || false,
        specialCategories: updatedUser.specialCategories,
        profileImage: updatedUser.profileImage || updatedUser.profilePicture || "",
        profilePicture: updatedUser.profilePicture || updatedUser.profileImage || "",
        hasAcademicHonors: updatedUser.hasAcademicHonors === true || updatedUser.academic_honors === true,
        academic_rank: updatedUser.academic_rank ?? null,
      },
    });
  } catch (error) {
    console.error("[Profile Update] Error:", error);
    return res.status(500).json({ error: "Failed to update profile: " + error.message });
  }
};

// GET /api/users/profile?email= — load full profile for client sync after sign-in
app.get("/api/users/profile", async (req, res) => {
  try {
    const db = await getDb();
    const email = String(req.query.email || "").trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }

    const user = await db.collection("users").findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const { password, ...safeUser } = user;
    return res.json({
      user: {
        fullName: safeUser.fullName || "",
        email: safeUser.email,
        phone: safeUser.phone || "",
        location: safeUser.location || "",
        dateOfBirth: safeUser.dateOfBirth || "",
        gpa: safeUser.gpa || "",
        gwa: safeUser.gwa || "",
        educationLevel: safeUser.educationLevel || "",
        yearLevel: safeUser.yearLevel || "",
        fieldOfStudy: safeUser.fieldOfStudy || "",
        graduationYear: safeUser.graduationYear || "",
        incomeCategory: safeUser.incomeCategory || "",
        financialNeed: safeUser.financialNeed || [],
        netWorth: safeUser.netWorth || "",
        currency: safeUser.currency || "",
        schoolName: safeUser.schoolName || "",
        schoolCampus: safeUser.schoolCampus || "",
        schoolType: safeUser.schoolType || "",
        schoolLocation: safeUser.schoolLocation || "",
        enrolledInQCSchool: safeUser.enrolledInQCSchool || false,
        isAthlete: safeUser.isAthlete || false,
        isArtist: safeUser.isArtist || false,
        isSKOfficial: safeUser.isSKOfficial || false,
        isStudentLeader: safeUser.isStudentLeader || false,
        isIndigent: safeUser.isIndigent || false,
        isPWD: safeUser.isPWD || false,
        isSoloParent: safeUser.isSoloParent || false,
        specialCategories: safeUser.specialCategories || {},
        userType: safeUser.userType || "student",
        profileImage: safeUser.profileImage || safeUser.avatar || "",
        profilePicture: safeUser.profilePicture || safeUser.profileImage || safeUser.avatar || "",
        about: safeUser.about || "",
        headline: safeUser.headline || "",
        skills: safeUser.skills || [],
        hasAcademicHonors:
          safeUser.hasAcademicHonors === true || safeUser.academic_honors === true,
        academic_rank: safeUser.academic_rank ?? null,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch profile: " + error.message });
  }
});

app.put("/api/users/profile", handleUserProfileUpdate);
app.post("/api/users/profile", handleUserProfileUpdate);

// PATCH /api/users/profile/personal — update personal info fields only
app.patch("/api/users/profile/personal", async (req, res) => {
  try {
    const db = await getDb();
    const { email, fullName, phone, location, dateOfBirth, about, headline, skills } = req.body;

    if (!email) {
      return res.status(400).json({ error: "email is required." });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const existingUser = await db.collection("users").findOne({ email: normalizedEmail });
    if (!existingUser) {
      return res.status(404).json({ error: "User not found." });
    }

    // Build $set object with only the fields present in the request body
    const personalFields = {};
    if (fullName !== undefined) personalFields.fullName = String(fullName);
    if (phone !== undefined) personalFields.phone = String(phone);
    if (location !== undefined) personalFields.location = String(location);
    if (dateOfBirth !== undefined) personalFields.dateOfBirth = String(dateOfBirth);
    if (about !== undefined) personalFields.about = String(about);
    if (headline !== undefined) personalFields.headline = String(headline);
    if (skills !== undefined) {
      personalFields.skills = Array.isArray(skills)
        ? skills.map((s) => String(s).trim()).filter(Boolean)
        : String(skills || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
    }

    await db.collection("users").updateOne(
      { email: normalizedEmail },
      { $set: personalFields }
    );

    return res.status(200).json({
      user: { email: normalizedEmail, ...personalFields },
      message: "Personal info updated.",
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to update personal info: " + error.message });
  }
});

// PATCH /api/users/profile/academic — update academic info fields only
app.patch("/api/users/profile/academic", async (req, res) => {
  try {
    const db = await getDb();

    const rawEmail = req.body.email;
    if (!rawEmail || String(rawEmail).trim() === "") {
      return res.status(400).json({ error: "email is required." });
    }
    const normalizedEmail = String(rawEmail).trim().toLowerCase();

    const existingUser = await db.collection("users").findOne({ email: normalizedEmail });
    if (!existingUser) {
      return res.status(404).json({ error: "User not found." });
    }

    const {
      gpa,
      educationLevel,
      yearLevel,
      fieldOfStudy,
      graduationYear,
      schoolName,
      schoolCampus,
      schoolType,
      schoolLocation,
      hasAcademicHonors,
      academic_rank,
    } = req.body;

    // Validate GPA when provided: must be numeric and 1.00 <= value <= 5.00
    if (gpa !== undefined) {
      const gpaNum = Number(gpa);
      if (isNaN(gpaNum) || gpaNum < 1.0 || gpaNum > 5.0) {
        return res.status(400).json({ error: "GPA must be between 1.00 and 5.00." });
      }
    }

    // Build $set object — only include fields present in the request body
    const academicFields = {};

    if (gpa !== undefined) academicFields.gpa = String(gpa);
    if (educationLevel !== undefined) academicFields.educationLevel = String(educationLevel);
    if (yearLevel !== undefined) academicFields.yearLevel = String(yearLevel);
    if (fieldOfStudy !== undefined) academicFields.fieldOfStudy = String(fieldOfStudy);
    if (graduationYear !== undefined) academicFields.graduationYear = String(graduationYear);
    if (schoolName !== undefined) academicFields.schoolName = String(schoolName);
    if (schoolCampus !== undefined) academicFields.schoolCampus = String(schoolCampus);
    if (schoolType !== undefined) academicFields.schoolType = String(schoolType);
    if (schoolLocation !== undefined) {
      academicFields.schoolLocation = String(schoolLocation);
      // Derive enrolledInQCSchool server-side — ignore any client-supplied value
      academicFields.enrolledInQCSchool = String(schoolLocation) === "Quezon City";
    }
    if (hasAcademicHonors !== undefined) {
      const honors =
        hasAcademicHonors === true ||
        hasAcademicHonors === "true" ||
        hasAcademicHonors === 1 ||
        hasAcademicHonors === "1";
      academicFields.hasAcademicHonors = honors;
      academicFields.academic_honors = honors;
    }
    if (academic_rank !== undefined) {
      if (academic_rank === null || String(academic_rank).trim() === "") {
        academicFields.academic_rank = null;
      } else {
        const rank = parseInt(String(academic_rank), 10);
        if (Number.isFinite(rank) && rank >= 1 && rank <= 10) {
          academicFields.academic_rank = rank;
        }
      }
    }

    await db.collection("users").updateOne(
      { email: normalizedEmail },
      { $set: academicFields }
    );

    return res.status(200).json({
      user: { ...academicFields },
      message: "Academic info updated.",
    });
  } catch (error) {
    console.error("[Academic Profile Update] Error:", error);
    return res.status(500).json({ error: "Failed to update academic info: " + error.message });
  }
});

// PATCH /api/users/profile/achievements — update achievements and financial fields only
app.patch("/api/users/profile/achievements", async (req, res) => {
  try {
    const db = await getDb();

    const {
      email,
      isAthlete,
      isArtist,
      isSKOfficial,
      isStudentLeader,
      isIndigent,
      isPWD,
      isSoloParent,
      financialNeed,
      netWorth,
      currency,
      incomeCategory,
      householdIncome,
      financialSupportSource,
      economicDependency,
    } = req.body;

    // Validate email
    if (!email) {
      return res.status(400).json({ error: "email is required." });
    }
    const normalizedEmail = String(email).trim().toLowerCase();

    // Check user exists
    const existingUser = await db.collection("users").findOne({ email: normalizedEmail });
    if (!existingUser) {
      return res.status(404).json({ error: "User not found." });
    }

    // Validate financialNeed when provided: must be an integer 1–5
    if (financialNeed !== undefined) {
      const fn = Number(financialNeed);
      if (!Number.isInteger(fn) || fn < 1 || fn > 5) {
        return res.status(400).json({ error: "financialNeed must be between 1 and 5." });
      }
    }

    // Build $set object with only the fields present in the request body
    const achievementsFields = {};

    const booleanFieldMap = {
      isAthlete,
      isArtist,
      isSKOfficial,
      isStudentLeader,
      isIndigent,
      isPWD,
      isSoloParent,
    };

    for (const [field, value] of Object.entries(booleanFieldMap)) {
      if (value !== undefined) {
        achievementsFields[field] = value === true || value === "true";
      }
    }

    if (financialNeed !== undefined) {
      achievementsFields.financialNeed = Number(financialNeed);
    }
    if (netWorth !== undefined) {
      achievementsFields.netWorth = String(netWorth);
    }
    if (currency !== undefined) {
      achievementsFields.currency = String(currency);
    }
    if (incomeCategory !== undefined) {
      achievementsFields.incomeCategory = String(incomeCategory);
    }
    if (householdIncome !== undefined) {
      achievementsFields.householdIncome = Number(householdIncome);
    }
    if (financialSupportSource !== undefined) {
      achievementsFields.financialSupportSource = String(financialSupportSource);
    }
    if (economicDependency !== undefined) {
      achievementsFields.economicDependency = Number(economicDependency);
    }

    // Persist using updateOne + $set (never replaceOne)
    await db.collection("users").updateOne(
      { email: normalizedEmail },
      { $set: achievementsFields }
    );

    return res.status(200).json({
      user: { ...achievementsFields },
      message: "Achievements updated.",
    });
  } catch (error) {
    console.error("[Achievements Update] Error:", error);
    return res.status(500).json({ error: "Failed to update achievements: " + error.message });
  }
});

  // ===== ADMIN DASHBOARD ROUTES =====

  function normalizeUserRole(user) {
    return String(user?.userType || user?.role || "").trim().toLowerCase();
  }

  function calculateProfileCompleteness(user) {
    const checks = [
      { key: "fullName", fallback: "userName" },
      { key: "email" },
      { key: "phone" },
      { key: "location", fallback: "address" },
      { key: "about" },
      { key: "profileImage", fallback: "avatar" },
      { key: "skills", isArray: true },
      { key: "gpa", fallback: "gwa" },
      { key: "fieldOfStudy", fallback: "course" },
      { key: "incomeCategory", fallback: "netWorth" },
      { key: "schoolName", fallback: "school" }, // NEW: School information required for QC scholarships
    ];

    let filled = 0;
    for (const check of checks) {
      const value = user?.[check.key] ?? user?.[check.fallback];
      if (check.isArray) {
        if (Array.isArray(value) && value.length > 0) filled++;
      } else if (String(value ?? "").trim() !== "") {
        filled++;
      }
    }

    return Math.round((filled / checks.length) * 100);
  }

  function mapRoleToType(role) {
    const normalized = String(role || "").trim().toLowerCase();
    if (normalized === "customer" || normalized === "student") return "Student";
    if (normalized === "provider") return "Provider";
    if (normalized === "mentor") return "Mentor";
    if (normalized === "admin") return "Admin";
    return "Unknown";
  }

  // GET /api/admin/users - Fetch all users
  app.get("/api/admin/users", async (req, res) => {
    try {
      const db = await getDb();
      const users = await db.collection("users").find({}).sort({ createdAt: -1 }).toArray();

      const transformedUsers = users.map((user) => {
        const uploaded = String(user.profileImage || user.profilePicture || "").trim();
        let avatarPath = "";
        if (uploaded.startsWith("http")) {
          avatarPath = uploaded;
        } else if (uploaded.startsWith("data:")) {
          avatarPath = "";
        } else if (uploaded.startsWith("/")) {
          avatarPath = uploaded;
        } else if (uploaded) {
          avatarPath = `/${uploaded.replace(/^\/+/, "")}`;
        }
        return {
          id: user._id?.toString() || "",
          name: user.fullName || user.userName || "",
          email: user.email || "",
          role: mapRoleToType(normalizeUserRole(user)),
          type: mapRoleToType(normalizeUserRole(user)),
          status: String(user.status || "Active"),
          createdAt: user.createdAt || null,
          joinedDate: user.createdAt
            ? new Date(user.createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })
            : "Unknown",
          profileCompleteness: calculateProfileCompleteness(user),
          avatar:
            avatarPath ||
            `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.email || "")}`,
        };
      });

      res.json(transformedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // GET /api/admin/stats - Fetch user statistics
  app.get("/api/admin/stats", async (req, res) => {
    try {
      const db = await getDb();
      const usersCollection = db.collection("users");
      const scholarshipsCollection = db.collection("scholarships");

      const [
        totalUsers,
        totalStudents,
        totalMentors,
        activeScholarships,
        newUsersThisMonth,
        userGrowthByMonth,
      ] = await Promise.all([
        usersCollection.countDocuments({}),
        usersCollection.countDocuments({
          $or: [
            { userType: { $in: ["student", "customer"] } },
            { role: { $in: ["Student", "student", "customer"] } },
          ],
        }),
        usersCollection.countDocuments({
          $or: [{ userType: "mentor" }, { role: "Mentor" }, { role: "mentor" }],
        }),
        scholarshipsCollection.countDocuments({
          $or: [{ status: { $regex: /^active$/i } }, { status: { $exists: false } }],
        }),
        usersCollection.countDocuments({
          createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        }),
        usersCollection
          .aggregate([
            {
              $addFields: {
                createdAtDate: {
                  $convert: {
                    input: "$createdAt",
                    to: "date",
                    onError: null,
                    onNull: null,
                  },
                },
              },
            },
            { $match: { createdAtDate: { $ne: null } } },
            {
              $group: {
                _id: { year: { $year: "$createdAtDate" }, month: { $month: "$createdAtDate" } },
                users: { $sum: 1 },
              },
            },
            { $sort: { "_id.year": 1, "_id.month": 1 } },
          ])
          .toArray(),
      ]);

      const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const userGrowth = userGrowthByMonth.map((entry) => ({
        month: `${monthLabels[entry._id.month - 1]} ${entry._id.year}`,
        users: entry.users,
      }));

      res.json({
        totalUsers,
        totalStudents,
        totalMentors,
        activeScholarships,
        newThisMonth: newUsersThisMonth,
        userGrowthByMonth: userGrowth,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ error: "Failed to fetch statistics" });
    }
  });

  // Backwards-compatible alias for the older dashboard route
  app.get("/api/admin/users/stats", async (req, res) => {
    try {
      const db = await getDb();
      const usersCollection = db.collection("users");
      const scholarshipsCollection = db.collection("scholarships");

      const [
        totalUsers,
        totalStudents,
        totalMentors,
        activeScholarships,
        newUsersThisMonth,
        userGrowthByMonth,
      ] = await Promise.all([
        usersCollection.countDocuments({}),
        usersCollection.countDocuments({
          $or: [
            { userType: { $in: ["student", "customer"] } },
            { role: { $in: ["Student", "student", "customer"] } },
          ],
        }),
        usersCollection.countDocuments({
          $or: [{ userType: "mentor" }, { role: "Mentor" }, { role: "mentor" }],
        }),
        scholarshipsCollection.countDocuments({
          $or: [{ status: { $regex: /^active$/i } }, { status: { $exists: false } }],
        }),
        usersCollection.countDocuments({
          createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        }),
        usersCollection
          .aggregate([
            {
              $addFields: {
                createdAtDate: {
                  $convert: {
                    input: "$createdAt",
                    to: "date",
                    onError: null,
                    onNull: null,
                  },
                },
              },
            },
            { $match: { createdAtDate: { $ne: null } } },
            {
              $group: {
                _id: { year: { $year: "$createdAtDate" }, month: { $month: "$createdAtDate" } },
                users: { $sum: 1 },
              },
            },
            { $sort: { "_id.year": 1, "_id.month": 1 } },
          ])
          .toArray(),
      ]);

      const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const userGrowth = userGrowthByMonth.map((entry) => ({
        month: `${monthLabels[entry._id.month - 1]} ${entry._id.year}`,
        users: entry.users,
      }));

      res.json({
        totalUsers,
        totalStudents,
        totalMentors,
        activeScholarships,
        newThisMonth: newUsersThisMonth,
        userGrowthByMonth: userGrowth,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ error: "Failed to fetch statistics" });
    }
  });

  // GET /api/admin/users/:id - Fetch a specific user
  app.get("/api/admin/users/:id", async (req, res) => {
    try {
      const db = await getDb();
      const { id } = req.params;
      const { ObjectId } = await import("mongodb");

      let user;
      try {
        user = await db.collection("users").findOne({ _id: new ObjectId(id) });
      } catch {
        // If not a valid ObjectId, try finding by email
        user = await db.collection("users").findOne({ email: id });
      }

      if (!user) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const roleMap = {
        customer: "Student",
        student: "Student",
        provider: "Provider",
        mentor: "Mentor",
        admin: "Admin",
      };

      const transformedUser = {
        id: user._id?.toString() || "",
        name: user.fullName || user.userName || "",
        email: user.email || "",
        type: roleMap[user.userType?.toLowerCase() || user.role?.toLowerCase()] || "Unknown",
        phone: user.phone || "",
        address: user.address || "",
        joinedDate: user.createdAt
          ? new Date(user.createdAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })
          : "Unknown",
        profileCompleteness: calculateProfileCompleteness(user),
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.email || "")}`,
      };

      res.json({ success: true, data: transformedUser });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ success: false, error: "Failed to fetch user" });
    }
  });

  // GET /api/admin/analytics - Comprehensive analytics data
  app.get("/api/admin/analytics", async (req, res) => {
    try {
      const db = await getDb();
      const usersCollection = db.collection("users");
      const scholarshipsCollection = db.collection("scholarships");
      const applicationsCollection = db.collection("applications");

      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

      // 1. User Growth (this month vs last month)
      const [thisMonthUsers, lastMonthUsers] = await Promise.all([
        usersCollection.countDocuments({ createdAt: { $gte: thisMonthStart } }),
        usersCollection.countDocuments({
          createdAt: { $gte: lastMonthStart, $lt: thisMonthStart },
        }),
      ]);

      const userGrowthPercent =
        lastMonthUsers === 0
          ? thisMonthUsers > 0
            ? 100
            : 0
          : ((thisMonthUsers - lastMonthUsers) / lastMonthUsers) * 100;

      // 2. Applications this month
      const applicationsThisMonth = await applicationsCollection.countDocuments({
        submittedAt: { $gte: thisMonthStart },
      });

      // 3. Success Rate (approved / (approved + rejected))
      const [approvedCount, rejectedCount] = await Promise.all([
        applicationsCollection.countDocuments({ status: "Approved" }),
        applicationsCollection.countDocuments({ status: "Rejected" }),
      ]);

      const totalFinalApplications = approvedCount + rejectedCount;
      const successRate =
        totalFinalApplications === 0 ? 0 : (approvedCount / totalFinalApplications) * 100;

      // 4. Applications over time (last 6 months)
      const applicationsByMonth = await applicationsCollection
        .aggregate([
          {
            $match: {
              submittedAt: { $gte: sixMonthsAgo },
            },
          },
          {
            $group: {
              _id: { year: { $year: "$submittedAt" }, month: { $month: "$submittedAt" } },
              count: { $sum: 1 },
            },
          },
          { $sort: { "_id.year": 1, "_id.month": 1 } },
        ])
        .toArray();

      const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const applicationsOverTime = applicationsByMonth.map((entry) => ({
        month: monthLabels[entry._id.month - 1],
        count: entry.count,
      }));

      // 5. Scholarship distribution by type
      const scholarshipTypes = await scholarshipsCollection
        .aggregate([
          { $match: { status: "Active" } },
          {
            $group: {
              _id: "$type",
              count: { $sum: 1 },
            },
          },
        ])
        .toArray();

      const scholarshipDistribution = scholarshipTypes.map((s) => ({
        name: s._id || "Other",
        value: s.count,
      }));

      // 6. Top 5 scholarships by applications
      const topScholarships = await scholarshipsCollection
        .find({ status: "Active" })
        .sort({ applicationsCount: -1 })
        .limit(5)
        .project({ name: 1, applicationsCount: 1 })
        .toArray();

      const topScholarshipsByApplications = topScholarships.map((s) => ({
        name: s.name,
        count: s.applicationsCount || 0,
      }));

      // 7. User registration trend (last 6 months)
      const usersByMonth = await usersCollection
        .aggregate([
          {
            $match: {
              createdAt: { $gte: sixMonthsAgo },
            },
          },
          {
            $group: {
              _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
              count: { $sum: 1 },
            },
          },
          { $sort: { "_id.year": 1, "_id.month": 1 } },
        ])
        .toArray();

      const userRegistrationTrend = usersByMonth.map((entry) => ({
        month: monthLabels[entry._id.month - 1],
        count: entry.count,
      }));

      // 8. Quick Stats
      const [totalScholars, pendingApplications, activeScholarships] = await Promise.all([
        usersCollection.countDocuments({
          $or: [
            { role: { $in: ["student", "customer"] } },
            { userType: { $in: ["student", "customer"] } },
          ],
        }),
        applicationsCollection.countDocuments({ status: "Pending" }),
        scholarshipsCollection.countDocuments({ status: "Active" }),
      ]);

      // 9. Applications by status for breakdown
      const applicationsByStatus = await applicationsCollection
        .aggregate([
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 },
            },
          },
        ])
        .toArray();

      res.json({
        stats: {
          userGrowth: {
            value: thisMonthUsers,
            percentChange: Math.round(userGrowthPercent * 10) / 10,
            isPositive: userGrowthPercent >= 0,
          },
          applications: {
            value: applicationsThisMonth,
            label: "this month",
          },
          successRate: {
            value: Math.round(successRate * 10) / 10,
            label: "approval rate",
          },
        },
        charts: {
          applicationsOverTime,
          scholarshipDistribution,
          topScholarshipsByApplications,
          userRegistrationTrend,
        },
        quickStats: {
          totalScholars,
          pendingApplications,
          activeScholarships,
        },
        breakdown: {
          applicationsByStatus: applicationsByStatus.reduce((acc, curr) => {
            acc[curr._id || "Unknown"] = curr.count;
            return acc;
          }, {}),
          totalUsers: await usersCollection.countDocuments(),
          totalApplications: await applicationsCollection.countDocuments(),
          totalScholarships: await scholarshipsCollection.countDocuments(),
        },
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  // POST /api/admin/reports/export - Generate CSV report
  app.post("/api/admin/reports/export", async (req, res) => {
    try {
      const db = await getDb();
      const { from, to } = req.body;

      const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const toDate = to ? new Date(to) : new Date();

      const usersCollection = db.collection("users");
      const scholarshipsCollection = db.collection("scholarships");
      const applicationsCollection = db.collection("applications");

      // Gather data
      const [totalUsers, totalStudents, totalScholarships, applications, scholarships] = await Promise.all([
        usersCollection.countDocuments(),
        usersCollection.countDocuments({
          $or: [{ role: { $in: ["student", "customer"] } }, { userType: { $in: ["student", "customer"] } }],
        }),
        scholarshipsCollection.countDocuments(),
        applicationsCollection.find({ submittedAt: { $gte: fromDate, $lte: toDate } }).toArray(),
        scholarshipsCollection.find().sort({ applicationsCount: -1 }).toArray(),
      ]);

      // Applications by status breakdown
      const applicationsByStatus = applications.reduce((acc, app) => {
        const status = app.status || "Unknown";
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});

      // Generate CSV
      let csv = "# Scholarship Portal Report\n";
      csv += `# Generated: ${new Date().toLocaleString()}\n`;
      csv += `# Date Range: ${fromDate.toLocaleDateString()} - ${toDate.toLocaleDateString()}\n\n`;

      // Summary section
      csv += "## SUMMARY\n";
      csv += `Total Users,${totalUsers}\n`;
      csv += `Total Students,${totalStudents}\n`;
      csv += `Total Scholarships,${totalScholarships}\n`;
      csv += `Applications in Period,${applications.length}\n\n`;

      // Applications by status
      csv += "## APPLICATIONS BY STATUS\n";
      csv += "Status,Count\n";
      Object.entries(applicationsByStatus).forEach(([status, count]) => {
        csv += `${status},${count}\n`;
      });
      csv += "\n";

      // Scholarships with application counts
      csv += "## SCHOLARSHIPS (sorted by application count)\n";
      csv += "Name,Provider,Type,Status,Applications,Amount\n";
      scholarships.forEach((s) => {
        csv += `"${s.name || ""}","${s.provider || ""}","${s.type || ""}","${s.status || ""}",${s.applicationsCount || 0},${s.amount || 0}\n`;
      });

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="scholarship-report-${new Date().toISOString().split("T")[0]}.csv"`);
      res.send(csv);
    } catch (error) {
      console.error("Error generating report:", error);
      res.status(500).json({ error: "Failed to generate report" });
    }
  });

  // POST /api/applications - Submit new application with eligibility check
  app.post("/api/applications", async (req, res) => {
    try {
      console.log("[DEBUG] /api/applications body:", req.body);
      const db = await getDb();
      const { ObjectId } = await import("mongodb");
      const {
        studentId,
        studentName,
        studentEmail,
        scholarshipId,
        scholarshipName,
        documents,
      } = req.body;

      if (!studentId || !scholarshipId) {
        return res.status(400).json({ error: "Student ID and Scholarship ID are required." });
      }

      // Get scholarship details
      const scholarship = await db.collection("scholarships").findOne({
        _id: new ObjectId(scholarshipId),
      });

      if (!scholarship) {
        return res.status(404).json({ error: "Scholarship not found." });
      }

      // Check if scholarship is still open
      const now = new Date();
      const deadline = new Date(scholarship.deadline);
      const openingDate = scholarship.openingDate ? new Date(scholarship.openingDate) : null;

      if (deadline < now) {
        return res.status(400).json({ error: "Application period has ended for this scholarship." });
      }

      if (openingDate && openingDate > now) {
        return res.status(400).json({ error: "Applications have not opened yet for this scholarship." });
      }

      // Get student profile
      const student = await db.collection("users").findOne({
        _id: new ObjectId(studentId),
      });

      if (!student) {
        return res.status(404).json({ error: "Student not found." });
      }

      // Check if student already applied
      const existingApplication = await db.collection("applications").findOne({
        studentId: new ObjectId(studentId),
        scholarshipId: new ObjectId(scholarshipId),
      });

      if (existingApplication) {
        return res.status(409).json({ error: "You have already applied for this scholarship." });
      }

      // Perform eligibility check
      const eligibility = eligibilityMatching.checkEligibility(student, scholarship);

      // Only allow submission if student is either fully eligible or may still qualify pending staff review
      if (!eligibility.isEligible && !eligibility.mayBeEligible) {
        return res.status(403).json({
          error: "You do not meet the eligibility criteria for this scholarship.",
          unmetCriteria: eligibility.unmetCriteria,
        });
      }

      // Create application with pre-screening info
      const application = {
        studentId: new ObjectId(studentId),
        studentName: studentName || student.fullName || "",
        studentEmail: studentEmail || student.email || "",
        scholarshipId: new ObjectId(scholarshipId),
        scholarshipName: scholarshipName || scholarship.name || "",
        submittedAt: new Date(),
        status: eligibility.isEligible && !eligibility.mayBeEligible ? "System Qualified" : "Pending",
        matchScore: eligibility.isEligible ? 95 : (eligibility.mayBeEligible ? 75 : 0),
        documents: documents || [],
        notes: "",
        eligibilityCheck: {
          passed: eligibility.isEligible,
          checkedAt: new Date(),
          unmetCriteria: eligibility.unmetCriteria || [],
          metCriteria: eligibility.reasons || [],
        },
        finalReview: {
          reviewedBy: null,
          reviewedAt: null,
          notes: "",
        },
      };

      const result = await db.collection("applications").insertOne(application);

      // Increment scholarship applications count
      await db.collection("scholarships").updateOne(
        { _id: new ObjectId(scholarshipId) },
        { $inc: { applicationsCount: 1 } }
      );

      res.status(201).json({
        data: { ...application, _id: result.insertedId.toString() },
        message: eligibility.isEligible && !eligibility.mayBeEligible
          ? "Application submitted successfully. You have been pre-qualified by the system."
          : "Application submitted. Your eligibility requires staff verification.",
      });
    } catch (error) {
      console.error("Error submitting application:", error);
      res.status(500).json({ error: "Failed to submit application." });
    }
  });

  // PATCH /api/admin/applications/:id/review - Move to Under Review (staff review)
  app.patch("/api/admin/applications/:id/review", async (req, res) => {
    try {
      const db = await getDb();
      const { ObjectId } = await import("mongodb");
      const { reviewerId, notes } = req.body;

      const result = await db.collection("applications").findOneAndUpdate(
        { _id: new ObjectId(req.params.id) },
        {
          $set: {
            status: "Under Review",
            "finalReview.reviewedBy": reviewerId ? new ObjectId(reviewerId) : null,
            "finalReview.reviewedAt": new Date(),
            "finalReview.notes": notes || "",
          },
        },
        { returnDocument: "after" }
      );

      if (!result) {
        return res.status(404).json({ error: "Application not found." });
      }

      res.json({ data: result, message: "Application moved to Under Review." });
    } catch (error) {
      console.error("Error reviewing application:", error);
      res.status(500).json({ error: "Failed to review application." });
    }
  });

  // GET /api/admin/applications - Updated with new status flow
  app.get("/api/admin/applications", async (req, res) => {
    try {
      const db = await getDb();
      const { status, filter } = req.query;

      // Build query based on status filter
      let query = {};
      if (status && status !== "all") {
        query.status = status;
      }

      // Special filter for "Needs Review" (System Qualified waiting for staff)
      if (filter === "needs-review") {
        query.status = "System Qualified";
      }

      const applications = await db.collection("applications")
        .find(query)
        .sort({ submittedAt: -1 })
        .toArray();

      // Get counts for each status
      const stats = await db.collection("applications").aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]).toArray();

      const statsMap = stats.reduce((acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {});

      res.json({
        data: applications,
        stats: {
          pending: statsMap["Pending"] || 0,
          systemQualified: statsMap["System Qualified"] || 0,
          needsReview: statsMap["System Qualified"] || 0,
          underReview: statsMap["Under Review"] || 0,
          approved: statsMap["Approved"] || 0,
          rejected: statsMap["Rejected"] || 0,
        },
      });
    } catch (error) {
      console.error("Error fetching applications:", error);
      res.status(500).json({ error: "Failed to fetch applications." });
    }
  });

  // PATCH /api/admin/applications/:id/approve - Updated with final review info
  app.patch("/api/admin/applications/:id/approve", async (req, res) => {
    try {
      const db = await getDb();
      const { ObjectId } = await import("mongodb");
      const { reviewerId, notes } = req.body;

      const result = await db.collection("applications").findOneAndUpdate(
        { _id: new ObjectId(req.params.id) },
        {
          $set: {
            status: "Approved",
            "finalReview.reviewedBy": reviewerId ? new ObjectId(reviewerId) : null,
            "finalReview.reviewedAt": new Date(),
            "finalReview.notes": notes || "",
          },
        },
        { returnDocument: "after" }
      );

      if (!result) {
        return res.status(404).json({ error: "Application not found." });
      }

      res.json({ data: result, message: "Application approved successfully." });
    } catch (error) {
      console.error("Error approving application:", error);
      res.status(500).json({ error: "Failed to approve application." });
    }
  });

  // PATCH /api/admin/applications/:id/reject - Updated with final review info
  app.patch("/api/admin/applications/:id/reject", async (req, res) => {
    try {
      const db = await getDb();
      const { ObjectId } = await import("mongodb");
      const { reviewerId, notes } = req.body;

      const result = await db.collection("applications").findOneAndUpdate(
        { _id: new ObjectId(req.params.id) },
        {
          $set: {
            status: "Rejected",
            "finalReview.reviewedBy": reviewerId ? new ObjectId(reviewerId) : null,
            "finalReview.reviewedAt": new Date(),
            "finalReview.notes": notes || "",
          },
        },
        { returnDocument: "after" }
      );

      if (!result) {
        return res.status(404).json({ error: "Application not found." });
      }

      res.json({ data: result, message: "Application rejected successfully." });
    } catch (error) {
      console.error("Error rejecting application:", error);
      res.status(500).json({ error: "Failed to reject application." });
    }
  });

  // GET /api/scholarships-with-eligibility - Get scholarships with eligibility check
  app.get("/api/scholarships-with-eligibility", async (req, res) => {
    try {
      const db = await getDb();
      const { 
        studentEmail, 
        type, 
        fieldOfStudy, 
        location, 
        minGPA, 
        amountMin, 
        amountMax 
      } = req.query;

      console.log('[scholarships-with-eligibility] Active filters received:', {
        studentEmail, type, fieldOfStudy, location, minGPA, amountMin, amountMax
      });

      // Build filter for scholarships
      const filter = { status: "Active" };

      // Type filter - null/empty means "open to all types"
      if (type && type !== 'all') {
        filter.$or = [
          { type: { $regex: type, $options: 'i' } },
          { type: null },
          { type: '' },
          { type: 'All Types' },
          { type: { $exists: false } }
        ];
      }

      // Field of Study filter - null/empty means "open to all fields"
      if (fieldOfStudy && fieldOfStudy !== 'all') {
        const normalizedField = fieldOfStudy.toLowerCase().replace(/-/g, ' ');
        console.log(`[scholarships-with-eligibility] Filtering for field of study: "${normalizedField}"`);
        
        filter.$or = filter.$or || [];
        filter.$or.push(
          { fieldOfStudy: { $regex: normalizedField, $options: 'i' } },
          { fieldOfStudy: null },
          { fieldOfStudy: '' },
          { fieldOfStudy: 'All Fields' },
          { fieldOfStudy: { $exists: false } }
        );
      }

      // Location filter - null/empty means "open to all locations"
      if (location && location !== 'all') {
        filter.$or = filter.$or || [];
        filter.$or.push(
          { location: { $regex: location, $options: 'i' } },
          { location: null },
          { location: '' },
          { location: 'All Locations' },
          { location: { $exists: false } }
        );
      }

      // GPA filter - only filter if scholarship has a minimumGPA requirement
      if (minGPA && minGPA !== 'all') {
        const gpaThreshold = Number(minGPA);
        if (!isNaN(gpaThreshold)) {
          filter.$and = filter.$and || [];
          filter.$and.push({
            $or: [
              { minimumGpa: { $lte: gpaThreshold } },
              { minimumGPA: { $lte: gpaThreshold } },
              { minimumGpa: { $exists: false } },
              { minimumGPA: { $exists: false } },
              { minimumGpa: null },
              { minimumGPA: null }
            ]
          });
        }
      }

      // Amount range filter
      if (amountMin || amountMax) {
        const min = Number(amountMin) || 0;
        const max = Number(amountMax) || 100000;
        filter.$and = filter.$and || [];
        filter.$and.push({
          amount: { $gte: min, $lte: max }
        });
      }

      console.log('[scholarships-with-eligibility] Final MongoDB filter:', JSON.stringify(filter, null, 2));

      // Get filtered scholarships
      const scholarships = dedupeScholarshipsByName(
        await db.collection("scholarships").find(filter).toArray(),
      );

      // Log fieldOfStudy values for debugging
      scholarships.forEach(s => {
        console.log(`[scholarships-with-eligibility] Scholarship "${s.name}": fieldOfStudy = "${s.fieldOfStudy}", type = "${s.type}", location = "${s.location}"`);
      });

      if (!studentEmail) {
        // Return scholarships without eligibility check
        return res.json({ data: scholarships.map(s => ({ ...s, eligibilityStatus: "unknown" })) });
      }

      // Get student profile
      const normalizedEmail = String(studentEmail).trim().toLowerCase();
      console.log("[scholarships-with-eligibility] Looking up user with email:", normalizedEmail);
      
      const student = await db.collection("users").findOne({ email: normalizedEmail });

      if (!student) {
        console.log("[scholarships-with-eligibility] User not found for email:", normalizedEmail);
        // Fall back to returning scholarships without eligibility when the student profile
        // cannot be found. The UI expects a list of scholarships even if the student
        // profile is missing (avoids showing zero results when profile is incomplete).
        return res.json({ data: scholarships.map(s => ({ ...s, eligibilityStatus: "unknown" })) });
      }

      // Debug logging - log FULL user object for debugging
      console.log("[scholarships-with-eligibility] FULL Student object from DB:", JSON.stringify(student, null, 2));
      console.log("[scholarships-with-eligibility] Student profile fields:", {
        email: student?.email,
        educationLevel: student?.educationLevel || student?.education_level,
        location: student?.location,
        address: student?.address,
        city: student?.city,
        gwa: student?.gwa || student?.GWA,
        fieldOfStudy: student?.fieldOfStudy || student?.field_of_study || student?.course,
        is_qc_resident: student?.is_qc_resident,
      });

      const now = new Date();

      // Check eligibility for each scholarship
      const scholarshipsWithEligibility = scholarships.map(scholarship => {
        const deadline = new Date(scholarship.deadline);
        const openingDate = scholarship.openingDate ? new Date(scholarship.openingDate) : null;

        // Check deadline status
        let deadlineStatus = "open";
        if (deadline < now) {
          deadlineStatus = "closed";
        } else if (openingDate && openingDate > now) {
          deadlineStatus = "not-yet-open";
        } else {
          const daysUntil = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
          if (daysUntil <= 7) {
            deadlineStatus = "closing-soon";
          }
        }

        // Check eligibility + match score (single source of truth on server)
        const eligibility = eligibilityMatching.checkEligibility(student, scholarship);
        const matchScore = eligibilityMatching.calculateMatchScore(
          student,
          scholarship,
          eligibility,
        );

        const deadlineAllowsApply =
          deadlineStatus === "open" || deadlineStatus === "closing-soon";
        const eligibleToApply = eligibility.isEligible || eligibility.mayBeEligible;

        return {
          ...scholarship,
          eligibilityStatus: eligibility.isEligible ? "eligible" : (eligibility.mayBeEligible ? "may-be-eligible" : "not-eligible"),
          eligibility,
          deadlineStatus,
          canApply: eligibleToApply && deadlineAllowsApply,
          matchScore,
        };
      });

      // Sort: eligible first, then may-be-eligible, then not-eligible
      scholarshipsWithEligibility.sort((a, b) => {
        const statusOrder = { eligible: 0, "may-be-eligible": 1, "not-eligible": 2, unknown: 3 };
        const aOrder = statusOrder[a.eligibilityStatus] || 3;
        const bOrder = statusOrder[b.eligibilityStatus] || 3;

        if (aOrder !== bOrder) return aOrder - bOrder;
        return (b.matchScore || 0) - (a.matchScore || 0);
      });

      res.json({ data: scholarshipsWithEligibility });
    } catch (error) {
      console.error("Error fetching scholarships with eligibility:", error);
      res.status(500).json({ error: "Failed to fetch scholarships." });
    }
  });

  // Cron-like endpoint to auto-close expired scholarships (can be called by scheduler)
  app.post("/api/admin/close-expired-scholarships", async (req, res) => {
    try {
      const db = await getDb();
      const now = new Date();

      // Find and update expired scholarships
      const result = await db.collection("scholarships").updateMany(
        {
          status: "Active",
          deadline: { $lt: now },
        },
        {
          $set: { status: "Closed" },
        }
      );

      res.json({
        message: "Expired scholarships closed successfully.",
        closedCount: result.modifiedCount,
      });
    } catch (error) {
      console.error("Error closing expired scholarships:", error);
      res.status(500).json({ error: "Failed to close expired scholarships." });
    }
  });

  // POST /api/admin/update-deadlines - Bulk update scholarship deadlines
  app.post("/api/admin/update-deadlines", async (req, res) => {
    try {
      const db = await getDb();
      const { deadline } = req.body;

      // Default to December 31, 2027 if not specified
      const newDeadline = deadline ? new Date(deadline) : new Date("2027-12-31");

      // Update all scholarships with the new deadline
      const result = await db.collection("scholarships").updateMany(
        {},
        {
          $set: { deadline: newDeadline },
        }
      );

      res.json({
        message: "Scholarship deadlines updated successfully.",
        newDeadline: newDeadline.toISOString(),
        updatedCount: result.modifiedCount,
      });
    } catch (error) {
      console.error("Error updating deadlines:", error);
      res.status(500).json({ error: "Failed to update deadlines." });
    }
  });

  // POST /api/applications/submit - Submit scholarship application with documents
  app.post("/api/applications/submit", upload.fields([
    { name: 'documents', maxCount: 10 }
  ]), async (req, res) => {
    try {
      const db = await getDb();
      const { studentEmail, scholarshipId, declaration } = req.body;
      const files = req.files?.documents || [];
      
      console.log("[Application Submit] Request received:", {
        studentEmail,
        scholarshipId,
        declaration,
        fileCount: files.length,
        documentTypes: req.body.documentTypes
      });

      if (!studentEmail) {
        return res.status(400).json({ error: "Student email is required." });
      }

      if (!scholarshipId) {
        return res.status(400).json({ error: "Scholarship ID is required." });
      }

      if (declaration !== "true") {
        return res.status(400).json({ error: "Declaration must be accepted." });
      }

      // Get student profile
      const student = await db.collection("users").findOne({ email: studentEmail.toLowerCase() });
      if (!student) {
        return res.status(404).json({ error: "Student not found." });
      }

      // Import ObjectId
      const { ObjectId } = await import("mongodb");
      
      // Get scholarship details
      const scholarship = await db.collection("scholarships").findOne({ 
        _id: new ObjectId(scholarshipId) 
      });
      if (!scholarship) {
        return res.status(404).json({ error: "Scholarship not found." });
      }

      // Check if already applied
      const existingApplication = await db.collection("applications").findOne({
        studentId: student._id.toString(),
        scholarshipId: scholarshipId,
      });
      
      if (existingApplication) {
        return res.status(400).json({ error: "You have already applied for this scholarship." });
      }

      // Process uploaded files
      const documentTypes = req.body.documentTypes || [];
      const submittedDocuments = files.map((file, index) => ({
        documentType: Array.isArray(documentTypes) ? documentTypes[index] : documentTypes,
        fileName: file.originalname,
        filePath: file.path,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedAt: new Date(),
        status: "uploaded"
      }));

      // Check eligibility
      const eligibilityResult = eligibilityMatching.checkEligibility(student, scholarship);
      
      // Block submission if not eligible and not may-be-eligible
      if (!eligibilityResult.isEligible && !eligibilityResult.mayBeEligible) {
        // Clean up uploaded files
        if (req.files?.documents) {
          req.files.documents.forEach(file => {
            try { fs.unlinkSync(file.path); } catch (e) {}
          });
        }
        return res.status(403).json({
          error: "You do not meet the eligibility criteria for this scholarship.",
          unmetCriteria: eligibilityResult.unmetCriteria
        });
      }

      // Generate reference number: APP-2026-XXXXX
      const year = new Date().getFullYear();
      const appCount = await db.collection("applications").countDocuments({}) + 1;
      const referenceNumber = `APP-${year}-${String(appCount).padStart(5, "0")}`;

      // Create application
      const application = {
        referenceNumber,
        studentId: student._id.toString(),
        studentEmail: studentEmail.toLowerCase(),
        scholarshipId: scholarshipId,
        scholarshipName: scholarship.name,
        status: eligibilityResult.isEligible ? "System Qualified" : "Needs Review",
        submittedAt: new Date(),
        submittedDocuments,
        eligibilityCheck: {
          isEligible: eligibilityResult.isEligible,
          reasons: eligibilityResult.reasons,
          unmetCriteria: eligibilityResult.unmetCriteria,
          criteriaChecks: eligibilityResult.criteriaChecks
        },
        matchScore: eligibilityResult.isEligible ? 95 : (eligibilityResult.mayBeEligible ? 75 : 0),
        declaration: true,
        finalReview: null,
        updatedAt: new Date()
      };

      const result = await db.collection("applications").insertOne(application);
      
      // Create notification for student
      await insertStudentNotification(db, {
        userEmail: studentEmail.toLowerCase(),
        userId: student._id,
        type: "application_submitted",
        title: "Application Submitted",
        message: `Your application for ${scholarship.name} has been submitted successfully. Reference: ${result.insertedId.toString().slice(-8).toUpperCase()}`,
        scholarshipName: scholarship.name,
      });

      console.log("[Application Submit] Success:", result.insertedId);

      res.status(201).json({
        message: "Application submitted successfully.",
        applicationId: result.insertedId.toString(),
        status: application.status,
        matchScore: application.matchScore
      });
    } catch (error) {
      console.error("[Application Submit] Error:", error);
      
      // Clean up uploaded files on error
      if (req.files) {
        req.files.forEach(file => {
          try {
            fs.unlinkSync(file.path);
          } catch (e) {
            // Ignore cleanup errors
          }
        });
      }
      
      res.status(500).json({ error: "Failed to submit application: " + error.message });
    }
  });

  // PATCH /api/admin/applications/:id/documents - Update document status
  app.patch("/api/admin/applications/:id/documents", async (req, res) => {
    try {
      const db = await getDb();
      const { ObjectId } = await import("mongodb");
      const { documentType, status, rejectionReason } = req.body;
      const applicationId = req.params.id;

      if (!documentType || !status) {
        return res.status(400).json({ error: "documentType and status are required" });
      }

      // Find the application
      const application = await db.collection("applications").findOne({
        _id: new ObjectId(applicationId),
      });

      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      // Update the specific document's status
      const result = await db.collection("applications").updateOne(
        { _id: new ObjectId(applicationId) },
        {
          $set: {
            "submittedDocuments.$[doc].status": status,
            "submittedDocuments.$[doc].rejectionReason": rejectionReason || "",
            updatedAt: new Date(),
          },
        },
        {
          arrayFilters: [{ "doc.documentType": documentType }],
        }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ error: "Document not found in application" });
      }

      // If any document is rejected, update application status to Needs Resubmission
      if (status === "rejected") {
        await db.collection("applications").updateOne(
          { _id: new ObjectId(applicationId) },
          {
            $set: {
              status: "Needs Resubmission",
              updatedAt: new Date(),
            },
          }
        );

        // Create notification for student
        await insertStudentNotification(db, {
          userEmail: application.studentEmail,
          userId: application.studentId,
          type: "document_rejected",
          title: "Document Rejected",
          message: `Your "${documentType}" was rejected. Reason: ${rejectionReason || "No reason provided"}. Please re-upload the correct document.`,
          scholarshipName: application.scholarshipName,
        });
      }

      // If all documents are verified, create notification for student
      if (status === "verified") {
        const updatedApp = await db.collection("applications").findOne({
          _id: new ObjectId(applicationId),
        });

        const allVerified = updatedApp.submittedDocuments?.every(
          (doc) => doc.status === "verified"
        );

        if (allVerified) {
          await insertStudentNotification(db, {
            userEmail: application.studentEmail,
            userId: application.studentId,
            type: "documents_verified",
            title: "Documents Verified",
            message: "All your documents have been verified. Your application is now Under Review.",
            scholarshipName: application.scholarshipName,
          });
        }
      }

      res.json({ message: "Document status updated successfully" });
    } catch (error) {
      console.error("[Update Document Status] Error:", error);
      res.status(500).json({ error: "Failed to update document status: " + error.message });
    }
  });

  // ===== ADVANCED APPLICATION REVIEW SYSTEM =====

  // GET /api/admin/applications/scholarships - Scholarship list with application counts
  app.get("/api/admin/applications/scholarships", async (_, res) => {
    try {
      const db = await getDb();
      const pipeline = [
        {
          $group: {
            _id: "$scholarshipId",
            scholarshipName: { $first: "$scholarshipName" },
            totalApplications: { $sum: 1 },
            pending: { $sum: { $cond: [{ $in: ["$status", ["Pending", "System Qualified"]] }, 1, 0] } },
            qualifiedForScreening: { $sum: { $cond: [{ $eq: ["$status", "Qualified for Final Screening"] }, 1, 0] } },
            approved: { $sum: { $cond: [{ $eq: ["$status", "Approved"] }, 1, 0] } },
            rejected: { $sum: { $cond: [{ $eq: ["$status", "Rejected"] }, 1, 0] } },
          },
        },
        { $sort: { totalApplications: -1 } },
      ];
      const result = await db.collection("applications").aggregate(pipeline).toArray();
      res.json({ data: result });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch scholarship application data." });
    }
  });

  // GET /api/admin/applications/scholarship/:scholarshipId/applicants
  app.get("/api/admin/applications/scholarship/:scholarshipId/applicants", async (req, res) => {
    try {
      const db = await getDb();
      const { scholarshipId } = req.params;
      const { status, search } = req.query;
      const { ObjectId } = await import("mongodb");

      const query = { scholarshipId };
      if (status && status !== "all") query.status = status;
      if (search) {
        query.$or = [
          { studentName: { $regex: search, $options: "i" } },
          { studentEmail: { $regex: search, $options: "i" } },
        ];
      }

      const applicants = await db.collection("applications")
        .find(query)
        .sort({ submittedAt: -1 })
        .toArray();

      // Attach student profiles for avatar/images
      const studentEmails = [...new Set(applicants.map(a => a.studentEmail).filter(Boolean))];
      const students = await db.collection("users").find(
        { email: { $in: studentEmails } },
        { projection: { email: 1, fullName: 1, profileImage: 1, profilePicture: 1 } }
      ).toArray();
      const studentMap = {};
      students.forEach(s => { studentMap[s.email] = s; });
      const enrichedApplicants = applicants.map(a => ({
        ...a,
        studentProfile: studentMap[a.studentEmail] || null,
      }));

      // Get stats for this scholarship
      const stats = await db.collection("applications").aggregate([
        { $match: { scholarshipId } },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]).toArray();

      const statsMap = { all: applicants.length };
      stats.forEach((s) => { statsMap[s._id] = s.count; });

      res.json({ data: enrichedApplicants, stats: statsMap });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch applicants." });
    }
  });

  // GET /api/admin/applications/:applicationId/review
  app.get("/api/admin/applications/:applicationId/review", async (req, res) => {
    try {
      const db = await getDb();
      const { ObjectId } = await import("mongodb");
      const application = await db.collection("applications").findOne({
        _id: new ObjectId(req.params.applicationId),
      });

      if (!application) {
        return res.status(404).json({ error: "Application not found." });
      }

      // Fetch student profile
      const student = await db.collection("users").findOne({ email: application.studentEmail });
      // Fetch scholarship details
      const scholarship = await db.collection("scholarships").findOne({
        _id: new ObjectId(application.scholarshipId),
      });

      res.json({
        data: {
          ...application,
          studentProfile: student || null,
          scholarshipData: scholarship || null,
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch application review data." });
    }
  });

  // GET /api/applications/my-applications - Get student's own applications
  app.get("/api/applications/my-applications", async (req, res) => {
    try {
      const db = await getDb();
      const studentEmail = req.query.email || req.headers.email;
      
      if (!studentEmail) {
        return res.status(400).json({ error: "Student email is required." });
      }

      const normalizedEmail = String(studentEmail).trim().toLowerCase();
      
      // Get all applications for this student
      const applications = await db.collection("applications")
        .find({ studentEmail: normalizedEmail })
        .sort({ submittedAt: -1 })
        .toArray();

      // Get scholarship details for each application
      const { ObjectId } = await import("mongodb");
      const enrichedApplications = await Promise.all(
        applications.map(async (app) => {
          let scholarshipData = null;
          try {
            scholarshipData = await db.collection("scholarships").findOne(
              { _id: new ObjectId(app.scholarshipId) },
              { projection: { name: 1, provider: 1, imageUrl: 1, type: 1, amount: 1 } }
            );
          } catch (e) {
            // Invalid scholarshipId - skip
          }
          return {
            ...app,
            scholarshipData
          };
        })
      );

      res.json({ data: enrichedApplications });
    } catch (error) {
      console.error("Error fetching my applications:", error);
      res.status(500).json({ error: "Failed to fetch applications." });
    }
  });

  // PATCH /api/admin/applications/:applicationId/qualify - Qualify with final screening
  app.patch("/api/admin/applications/:applicationId/qualify", async (req, res) => {
    try {
      const db = await getDb();
      const { ObjectId } = await import("mongodb");
      const { scheduledDate, scheduledTime, meetingPlatform, meetingLink, notes } = req.body;

      if (!scheduledDate || !scheduledTime || !String(meetingLink || "").trim()) {
        return res.status(400).json({
          error: "scheduledDate, scheduledTime, and meetingLink are required for final screening.",
        });
      }

      const link = String(meetingLink).trim();
      if (!/^https?:\/\//i.test(link)) {
        return res.status(400).json({ error: "meetingLink must start with http:// or https://" });
      }

      const application = await db.collection("applications").findOne({
        _id: new ObjectId(req.params.applicationId),
      });
      if (!application) return res.status(404).json({ error: "Application not found." });

      const finalScreening = {
        scheduled: true,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        scheduledTime: scheduledTime || "",
        meetingPlatform: meetingPlatform || "Google Meet",
        meetingLink: link,
        notes: notes || "",
      };

      await db.collection("applications").updateOne(
        { _id: new ObjectId(req.params.applicationId) },
        {
          $set: {
            status: "Qualified for Final Screening",
            finalScreening,
            updatedAt: new Date(),
          },
        }
      );

      // Create notification
      const notifMsg = `🎉 Congratulations! You have qualified for the final screening of ${application.scholarshipName}.\n\nYour final screening details:\n📅 Date: ${scheduledDate ? new Date(scheduledDate).toLocaleDateString() : "TBD"}\n⏰ Time: ${scheduledTime || "TBD"}\n💻 Platform: ${meetingPlatform || "Google Meet"}\n🔗 Meeting Link: ${link}\n\n${notes ? `Notes: ${notes}\n\n` : ""}Please make sure you have your original documents ready for verification during the call. Good luck!`;

      const applicant = await db.collection("users").findOne({ email: String(application.studentEmail || "").toLowerCase() });

      await insertStudentNotification(db, {
        userEmail: application.studentEmail,
        userId: applicant?._id,
        type: "qualified_for_screening",
        title: "Qualified for Final Screening",
        message: notifMsg,
        scholarshipName: application.scholarshipName,
      });

      res.json({ message: "Virtual screening scheduled and student notified.", data: finalScreening });
    } catch (error) {
      res.status(500).json({ error: "Failed to qualify application." });
    }
  });

  // PATCH /api/admin/applications/:applicationId/reject - Reject with reason
  app.patch("/api/admin/applications/:applicationId/reject", async (req, res) => {
    try {
      const db = await getDb();
      const { ObjectId } = await import("mongodb");
      const { reason } = req.body;

      const application = await db.collection("applications").findOne({
        _id: new ObjectId(req.params.applicationId),
      });
      if (!application) return res.status(404).json({ error: "Application not found." });

      await db.collection("applications").updateOne(
        { _id: new ObjectId(req.params.applicationId) },
        {
          $set: {
            status: "Rejected",
            rejectionReason: reason || "",
            updatedAt: new Date(),
          },
        }
      );

      const notifMsg = `We regret to inform you that your application for ${application.scholarshipName} has not been approved.\n\nReason: ${reason || "No specific reason provided."}\n\nYou may apply for other scholarships that match your profile.`;

      const applicant = await db.collection("users").findOne({ email: String(application.studentEmail || "").toLowerCase() });

      await insertStudentNotification(db, {
        userEmail: application.studentEmail,
        userId: applicant?._id,
        type: "application_rejected",
        title: "Application Rejected",
        message: notifMsg,
        scholarshipName: application.scholarshipName,
      });

      res.json({ message: "Application rejected and student notified." });
    } catch (error) {
      res.status(500).json({ error: "Failed to reject application." });
    }
  });

  // PATCH /api/admin/applications/:applicationId/resubmit - Request resubmission
  app.patch("/api/admin/applications/:applicationId/resubmit", async (req, res) => {
    try {
      const db = await getDb();
      const { ObjectId } = await import("mongodb");
      const { rejectedDocuments, reason } = req.body;

      const application = await db.collection("applications").findOne({
        _id: new ObjectId(req.params.applicationId),
      });
      if (!application) return res.status(404).json({ error: "Application not found." });

      await db.collection("applications").updateOne(
        { _id: new ObjectId(req.params.applicationId) },
        {
          $set: {
            status: "Needs Resubmission",
            resubmissionReason: reason || "",
            updatedAt: new Date(),
          },
        }
      );

      // Build document rejection details
      let docDetails = "";
      if (rejectedDocuments && Array.isArray(rejectedDocuments)) {
        rejectedDocuments.forEach((doc) => {
          docDetails += `- ${doc.name}: ${doc.reason}\n`;
          // Update individual document status
          db.collection("applications").updateOne(
            { _id: new ObjectId(req.params.applicationId) },
            {
              $set: {
                [`submittedDocuments.${doc.index}.status`]: "rejected",
                [`submittedDocuments.${doc.index}.rejectionReason`]: doc.reason,
              },
            }
          ).catch(() => {});
        });
      }

      const notifMsg = `Action Required: Your application for ${application.scholarshipName} needs document resubmission.\n\nThe following documents were rejected:\n${docDetails || reason}\n\nPlease resubmit the correct documents as soon as possible.`;

      await insertStudentNotification(db, {
        userEmail: application.studentEmail,
        userId: application.studentId,
        type: "resubmission_required",
        title: "Document Resubmission Required",
        message: notifMsg,
        scholarshipName: application.scholarshipName,
      });

      res.json({ message: "Resubmission requested and student notified." });
    } catch (error) {
      res.status(500).json({ error: "Failed to request resubmission." });
    }
  });

  // PATCH /api/admin/applications/:applicationId/approve - Final approval
  app.patch("/api/admin/applications/:applicationId/approve", async (req, res) => {
    try {
      const db = await getDb();
      const { ObjectId } = await import("mongodb");

      const application = await db.collection("applications").findOne({
        _id: new ObjectId(req.params.applicationId),
      });
      if (!application) return res.status(404).json({ error: "Application not found." });

      await db.collection("applications").updateOne(
        { _id: new ObjectId(req.params.applicationId) },
        {
          $set: {
            status: "Approved",
            reviewedAt: new Date(),
            updatedAt: new Date(),
          },
        }
      );

      const notifMsg = `🏆 Congratulations! Your application for ${application.scholarshipName} has been officially APPROVED!\n\nYou are now a QCYDO Scholar. Further instructions will be provided by the scholarship office.`;

      await insertStudentNotification(db, {
        userEmail: application.studentEmail,
        userId: application.studentId,
        type: "application_approved",
        title: "Application Approved",
        message: notifMsg,
        scholarshipName: application.scholarshipName,
      });

      res.json({ message: "Application approved successfully. Student notified." });
    } catch (error) {
      res.status(500).json({ error: "Failed to approve application." });
    }
  });

  // PATCH /api/admin/applications/:applicationId/documents/:docIndex - Update document status by index
  app.patch("/api/admin/applications/:applicationId/documents/:docIndex", async (req, res) => {
    try {
      const db = await getDb();
      const { ObjectId } = await import("mongodb");
      const { applicationId, docIndex } = req.params;
      const { status, rejectionReason } = req.body;
      const idx = parseInt(docIndex, 10);

      const application = await db.collection("applications").findOne({
        _id: new ObjectId(applicationId),
      });
      if (!application) return res.status(404).json({ error: "Application not found." });

      if (!application.submittedDocuments || idx >= application.submittedDocuments.length) {
        return res.status(404).json({ error: "Document not found." });
      }

      await db.collection("applications").updateOne(
        { _id: new ObjectId(applicationId) },
        {
          $set: {
            [`submittedDocuments.${idx}.status`]: status,
            [`submittedDocuments.${idx}.rejectionReason`]: rejectionReason || "",
            updatedAt: new Date(),
          },
        }
      );

      // If rejected, create notification
      if (status === "rejected") {
        const docName = application.submittedDocuments[idx].documentType;
        await insertStudentNotification(db, {
          userEmail: application.studentEmail,
          userId: application.studentId,
          type: "document_rejected",
          title: "Document Rejected",
          message: `Your "${docName}" was rejected. Reason: ${rejectionReason || "No reason provided"}. Please re-upload the correct document.`,
          scholarshipName: application.scholarshipName,
        });
      }

      // Check if all documents are verified
      if (status === "verified") {
        const updatedApp = await db.collection("applications").findOne({ _id: new ObjectId(applicationId) });
        const allVerified = updatedApp.submittedDocuments?.every((d) => d.status === "verified");
        if (allVerified) {
          await insertStudentNotification(db, {
            userEmail: application.studentEmail,
            userId: application.studentId,
            type: "documents_verified",
            title: "Documents Verified",
            message: "All your documents have been verified. Your application is now Under Review.",
            scholarshipName: application.scholarshipName,
          });
        }
      }

      res.json({ message: "Document status updated successfully." });
    } catch (error) {
      res.status(500).json({ error: "Failed to update document status." });
    }
  });

  // ===== STUDENT NOTIFICATIONS API =====

  // GET /api/notifications/:email - Get all notifications for a student
  app.get("/api/notifications/:email", async (req, res) => {
    try {
      const db = await getDb();
      const email = String(req.params.email || "").trim().toLowerCase();
      if (!email) return res.status(400).json({ error: "Email is required." });

      const notifications = await db.collection("notifications")
        .find({ userEmail: email })
        .sort({ createdAt: -1 })
        .toArray();

      res.json({ data: notifications });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch notifications." });
    }
  });

  // GET /api/notifications/:email/unread-count
  app.get("/api/notifications/:email/unread-count", async (req, res) => {
    try {
      const db = await getDb();
      const email = String(req.params.email || "").trim().toLowerCase();
      if (!email) return res.status(400).json({ error: "Email is required." });

      const count = await db.collection("notifications").countDocuments({
        userEmail: email,
        read: false,
      });

      res.json({ count });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch unread count." });
    }
  });

  // PATCH /api/notifications/:id/read - Mark notification as read (scoped to student email)
  app.patch("/api/notifications/:id/read", async (req, res) => {
    try {
      const db = await getDb();
      const { ObjectId } = await import("mongodb");
      const email = normalizeEmail(req.query.email || req.body?.email);
      if (!email) {
        return res.status(400).json({ error: "Email is required to mark a notification read." });
      }

      const doc = await db.collection("notifications").findOne({ _id: new ObjectId(req.params.id) });
      if (!doc) {
        return res.status(404).json({ error: "Notification not found." });
      }
      if (doc.userEmail !== email) {
        return res.status(403).json({ error: "Forbidden." });
      }

      await db.collection("notifications").updateOne(
        { _id: new ObjectId(req.params.id), userEmail: email },
        { $set: { read: true } }
      );

      res.json({ message: "Notification marked as read." });
    } catch (error) {
      res.status(500).json({ error: "Failed to mark notification as read." });
    }
  });

  // ===== EXCEL EXPORT =====

  // GET /api/admin/applications/scholarship/:scholarshipId/export
  app.get("/api/admin/applications/scholarship/:scholarshipId/export", async (req, res) => {
    try {
      const db = await getDb();
      const { ObjectId } = await import("mongodb");
      const ExcelJS = (await import("exceljs")).default;

      const { scholarshipId } = req.params;
      const scholarship = await db.collection("scholarships").findOne({ _id: new ObjectId(scholarshipId) });
      const scholarshipName = scholarship?.name || "Unknown";

      // Fetch all applicants for this scholarship
      const applicants = await db.collection("applications")
        .find({ scholarshipId })
        .sort({ submittedAt: -1 })
        .toArray();

      const workbook = new ExcelJS.Workbook();
      workbook.creator = "QCYDO Scholarship System";
      workbook.created = new Date();

      // Sheet 1 - Applicant Summary
      const sheet1 = workbook.addWorksheet("Applicant Summary");
      sheet1.columns = [
        { header: "Reference Number", key: "ref", width: 20 },
        { header: "Student Name", key: "name", width: 30 },
        { header: "Email", key: "email", width: 35 },
        { header: "Match Score", key: "score", width: 15 },
        { header: "GPA", key: "gpa", width: 10 },
        { header: "Education Level", key: "education", width: 20 },
        { header: "School", key: "school", width: 25 },
        { header: "Income Category", key: "income", width: 20 },
        { header: "Special Categories", key: "categories", width: 25 },
        { header: "Application Status", key: "status", width: 25 },
        { header: "Submitted Date", key: "submitted", width: 20 },
        { header: "Documents Status", key: "docs", width: 20 },
      ];

      for (const app of applicants) {
        const user = await db.collection("users").findOne({ email: app.studentEmail });
        const docVerified = app.submittedDocuments?.filter((d) => d.status === "verified").length || 0;
        const docTotal = app.submittedDocuments?.length || 0;
        sheet1.addRow({
          ref: app.referenceNumber || "",
          name: app.studentName || user?.fullName || "",
          email: app.studentEmail || "",
          score: app.matchScore || 0,
          gpa: user?.gwa || user?.GWA || "",
          education: user?.educationLevel || "",
          school: user?.schoolName || "",
          income: user?.incomeCategory || "",
          categories: [user?.isPWD ? "PWD" : "", user?.isSoloParent ? "Solo Parent" : "", user?.isIndigent ? "Indigent" : "", user?.isAthlete ? "Athlete" : ""].filter(Boolean).join(", "),
          status: app.status || "",
          submitted: app.submittedAt ? new Date(app.submittedAt).toLocaleDateString() : "",
          docs: `${docVerified}/${docTotal} Verified`,
        });
      }

      // Sheet 2 - Documents List
      const sheet2 = workbook.addWorksheet("Documents List");
      sheet2.columns = [
        { header: "Reference Number", key: "ref", width: 20 },
        { header: "Student Name", key: "name", width: 30 },
        { header: "Document Type", key: "type", width: 25 },
        { header: "File Name", key: "file", width: 30 },
        { header: "Upload Date", key: "uploaded", width: 20 },
        { header: "Verification Status", key: "status", width: 20 },
        { header: "Rejection Reason", key: "reason", width: 30 },
      ];

      for (const app of applicants) {
        const user = await db.collection("users").findOne({ email: app.studentEmail });
        const name = app.studentName || user?.fullName || "";
        if (app.submittedDocuments) {
          for (const doc of app.submittedDocuments) {
            sheet2.addRow({
              ref: app.referenceNumber || "",
              name,
              type: doc.documentType || "",
              file: doc.fileName || "",
              uploaded: doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : "",
              status: doc.status || "",
              reason: doc.rejectionReason || "",
            });
          }
        }
      }

      // Sheet 3 - Virtual Screening Schedule
      const sheet3 = workbook.addWorksheet("Virtual Screening Schedule");
      sheet3.columns = [
        { header: "Reference Number", key: "ref", width: 20 },
        { header: "Student Name", key: "name", width: 30 },
        { header: "Scheduled Date", key: "date", width: 15 },
        { header: "Scheduled Time", key: "time", width: 15 },
        { header: "Meeting Platform", key: "platform", width: 20 },
        { header: "Meeting Link", key: "link", width: 40 },
        { header: "Status", key: "status", width: 20 },
      ];

      for (const app of applicants) {
        if (app.finalScreening?.scheduled) {
          const user = await db.collection("users").findOne({ email: app.studentEmail });
          sheet3.addRow({
            ref: app.referenceNumber || "",
            name: app.studentName || user?.fullName || "",
            date: app.finalScreening.scheduledDate ? new Date(app.finalScreening.scheduledDate).toLocaleDateString() : "",
            time: app.finalScreening.scheduledTime || "",
            platform: app.finalScreening.meetingPlatform || "",
            link: app.finalScreening.meetingLink || "",
            status: app.status || "",
          });
        }
      }

      const safeName = scholarshipName.replace(/[^a-zA-Z0-9]/g, "-");
      const dateStr = new Date().toISOString().split("T")[0];
      const fileName = `${safeName}-Applicants-${dateStr}.xlsx`;

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error("[Export Error]", error);
      res.status(500).json({ error: "Failed to generate export." });
    }
  });

// ============================================================
// AI RANKING ROUTES
// ============================================================

import { rankStudents as aiRankStudents, checkAIHealth } from "./services/aiService.js";

/**
 * POST /api/admin/scholarships/:id/rank
 * Triggers AI scoring + ranking for all qualified applicants of a scholarship.
 * Saves rank, totalScore, scoreBreakdown, shapExplanation back to each Application.
 */
app.post("/api/admin/scholarships/:id/rank", async (req, res) => {
  try {
    const db = await getDb();
    const { ObjectId } = await import("mongodb");
    const scholarshipId = String(req.params.id || "").trim();

    // 1. Check AI service is reachable
    const aiAlive = await checkAIHealth();
    if (!aiAlive) {
      return res.status(503).json({
        error: "AI service is not running. Please start the Python backend on port 8000.",
      });
    }

    // 2. Fetch scholarship
    let scholarship = null;
    if (ObjectId.isValid(scholarshipId)) {
      scholarship = await db.collection("scholarships").findOne({ _id: new ObjectId(scholarshipId) });
    }
    if (!scholarship) {
      return res.status(404).json({ error: "Scholarship not found." });
    }

    // 3. Fetch all applications for this scholarship (all active statuses)
    // Query both ObjectId and string versions of scholarshipId for compatibility
    const idAsObjectId = ObjectId.isValid(scholarshipId) ? new ObjectId(scholarshipId) : null;
    const idQuery = idAsObjectId
      ? { $or: [{ scholarshipId: idAsObjectId }, { scholarshipId: scholarshipId }] }
      : { scholarshipId: scholarshipId };

    const applications = await db
      .collection("applications")
      .find({
        ...idQuery,
        status: { $in: ["System Qualified", "Under Review", "Pending", "Qualified for Final Screening", "Approved"] },
      })
      .toArray();

    console.log(`[AI Rank] Found ${applications.length} applications for scholarship ${scholarshipId}`);

    if (applications.length === 0) {
      return res.json({
        success: true,
        message: "No qualified applicants to rank.",
        rankings: [],
        total_applicants: 0,
      });
    }

    // 4. Fetch student profiles for each application
    const studentEmails = [...new Set(applications.map((a) => String(a.studentEmail || "").toLowerCase()))];
    const studentDocs = await db
      .collection("users")
      .find({ email: { $in: studentEmails } })
      .toArray();

    const studentByEmail = {};
    for (const s of studentDocs) {
      studentByEmail[String(s.email || "").toLowerCase()] = s;
    }

    // 5. Build student + application arrays for the AI service
    const students = applications.map((app) => {
      const email = String(app.studentEmail || "").toLowerCase();
      const student = studentByEmail[email] || {};
      return {
        student_id: String(app._id),
        student_name: app.studentName || student.fullName || email,
        gpa: parseFloat(student.gwa || student.GWA || student.gpa || student.GPA || 5.0) || null,
        income_category: student.incomeCategory || student.income_category || "",
        financial_need: parseInt(student.financialNeed || student.financial_need || 1, 10) || 1,
        special_categories: {
          isFromIndigenousFamily: !!(student.isFromIndigenousFamily || student.specialCategories?.isFromIndigenousFamily),
          isPersonWithDisability: !!(student.isPWD || student.specialCategories?.isPWD),
          isPWD: !!(student.isPWD || student.specialCategories?.isPWD),
          isSoloParent: !!(student.isSoloParent || student.specialCategories?.isSoloParent),
          isIndigent: !!(student.isIndigent || student.specialCategories?.isIndigent),
          isAthlete: !!(student.isAthlete || student.specialCategories?.isAthlete),
          isArtist: !!(student.isArtist || student.specialCategories?.isArtist),
          isSKOfficial: !!(student.isSKOfficial || student.specialCategories?.isSKOfficial),
          isStudentLeader: !!(student.isStudentLeader || student.specialCategories?.isStudentLeader),
          hasAcademicHonors: !!(student.hasAcademicHonors || student.academic_honors),
        },
        education_level: student.educationLevel || student.education_level || "",
        submitted_at: app.submittedAt ? new Date(app.submittedAt).toISOString() : "9999-12-31",
      };
    });

    const appPayloads = applications.map((app) => ({
      submittedDocuments: (app.submittedDocuments || []).map((d) => ({
        documentType: d.documentType || d.type || "",
        status: d.status || "uploaded",
      })),
      authenticityResults: (app.authenticityResults || []),
    }));

    // 6. Call Python AI service
    const aiResult = await aiRankStudents(
      students,
      scholarshipId,
      scholarship,
      appPayloads,
    );

    if (!aiResult || !aiResult.rankings) {
      return res.status(502).json({ error: "AI service returned an invalid response." });
    }

    // 7. Save rankings back to each Application document
    const now = new Date();
    for (const ranked of aiResult.rankings) {
      const appId = ranked.student_id;
      if (!ObjectId.isValid(appId)) continue;

      await db.collection("applications").updateOne(
        { _id: new ObjectId(appId) },
        {
          $set: {
            rank: ranked.rank,
            totalScore: ranked.total_score,
            scoreBreakdown: ranked.score_breakdown,
            shapExplanation: ranked.shap_explanation,
            rankedAt: now,
          },
        },
      );
    }

    return res.json({
      success: true,
      scholarship_id: scholarshipId,
      scholarship_name: scholarship.name,
      total_applicants: aiResult.total_applicants,
      rankings: aiResult.rankings,
      ranked_at: now.toISOString(),
    });
  } catch (error) {
    console.error("[AI Rank] Error:", error);
    return res.status(500).json({ error: "Failed to generate rankings.", details: error.message });
  }
});

/**
 * GET /api/admin/scholarships/:id/rankings
 * Returns saved rankings for a scholarship (no re-computation).
 */
app.get("/api/admin/scholarships/:id/rankings", async (req, res) => {
  try {
    const db = await getDb();
    const { ObjectId } = await import("mongodb");
    const scholarshipId = String(req.params.id || "").trim();

    const query = ObjectId.isValid(scholarshipId)
      ? { scholarshipId: new ObjectId(scholarshipId), rank: { $exists: true } }
      : { scholarshipId, rank: { $exists: true } };

    const ranked = await db
      .collection("applications")
      .find(query)
      .sort({ rank: 1 })
      .toArray();

    return res.json({
      success: true,
      total: ranked.length,
      rankings: ranked.map((a) => ({
        application_id: String(a._id),
        student_id: String(a.studentId || ""),
        student_name: a.studentName || a.studentEmail,
        student_email: a.studentEmail,
        rank: a.rank,
        total_score: a.totalScore,
        score_breakdown: a.scoreBreakdown,
        shap_explanation: a.shapExplanation,
        status: a.status,
        ranked_at: a.rankedAt,
      })),
    });
  } catch (error) {
    console.error("[AI Rankings GET] Error:", error);
    return res.status(500).json({ error: "Failed to fetch rankings." });
  }
});

/**
 * GET /api/applications/:id/my-score
 * Student fetches their own score and rank for one application.
 * Never exposes other students' data.
 */
app.get("/api/applications/:id/my-score", async (req, res) => {
  try {
    const db = await getDb();
    const { ObjectId } = await import("mongodb");
    const appId = String(req.params.id || "").trim();

    if (!ObjectId.isValid(appId)) {
      return res.status(400).json({ error: "Invalid application ID." });
    }

    const application = await db
      .collection("applications")
      .findOne({ _id: new ObjectId(appId) });

    if (!application) {
      return res.status(404).json({ error: "Application not found." });
    }

    // Count total ranked applicants for this scholarship (for "Rank X of Y" display)
    const scholarshipId = application.scholarshipId;
    const totalRanked = await db
      .collection("applications")
      .countDocuments({ scholarshipId, rank: { $exists: true } });

    // Only return this student's own data
    return res.json({
      success: true,
      has_score: application.rank != null,
      rank: application.rank ?? null,
      total_applicants: totalRanked,
      total_score: application.totalScore ?? null,
      score_breakdown: application.scoreBreakdown ?? null,
      shap_explanation: application.shapExplanation ?? null,
      ranked_at: application.rankedAt ?? null,
    });
  } catch (error) {
    console.error("[My Score] Error:", error);
    return res.status(500).json({ error: "Failed to fetch score." });
  }
});

// Handle unknown /api routes
app.use('/api', (req, res) => {
  res.status(404).json({
    error: `Route not found: ${req.method} ${req.path}` 
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: err.message || 'Internal server error'
  });
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`API listening on ${port}`);
});
