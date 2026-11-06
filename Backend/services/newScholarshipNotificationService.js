/**
 * newScholarshipNotificationService.js
 *
 * Notifies every registered student when a new scholarship is posted.
 *
 * Runs asynchronously (scheduled with setImmediate) after the scholarship is
 * saved, so the HTTP response is never blocked by SMTP delivery.
 *
 * Safety properties:
 *   - One blast per scholarship: an atomic `notifiedAt` claim prevents a
 *     duplicate trigger (retry, double submit) from emailing everyone twice.
 *   - Per-recipient isolation: one failed address never stops the batch.
 *   - Bounded concurrency: small batches with a pause between them keep Gmail
 *     SMTP from rate-limiting the sender.
 */

import { ObjectId } from "mongodb";
import { getDb } from "../db.js";
import { sendNewScholarshipEmail, maskEmail } from "./emailService.js";

const BATCH_SIZE = 8;
const BATCH_DELAY_MS = 400;
const LOG_PREFIX = "[NewScholarship]";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Insert an in-app notification for a student. */
async function insertStudentNotification(db, { userEmail, userId, type, title, message, scholarshipName, scholarshipId, providerName }) {
  const email = String(userEmail || "").trim().toLowerCase();
  let uid = userId ? String(userId) : null;
  if (!uid && email) {
    const user = await db.collection("users").findOne({ email });
    uid = user?._id ? String(user._id) : null;
  }
  const createdAt = new Date();
  const scholarshipLink = scholarshipId ? `/scholarships/${String(scholarshipId)}` : "/dashboard/feed";
  await db.collection("notifications").insertOne({
    userEmail: email,
    userId: uid,
    recipient_id: uid,
    userRole: "student",
    type,
    title,
    message,
    link: scholarshipLink,
    scholarshipName: scholarshipName || "",
    scholarshipId: scholarshipId ? String(scholarshipId) : "",
    read: false,
    is_read: false,
    createdAt,
    created_at: createdAt,
    providerName: providerName || "",
  });
}

/**
 * Query all active registered students.
 * Covers modern (`userType`/`role`: student) and legacy (`customer`) accounts,
 * skips locked accounts, and requires a usable email address.
 */
export async function findActiveStudents(db) {
  const now = new Date();
  return db
    .collection("users")
    .find(
      {
        $and: [
          {
            $or: [
              { userType: { $in: ["student", "customer"] } },
              { role: { $in: ["student", "customer", "Student"] } },
            ],
          },
          // Skip locked accounts when lockUntil is in the future
          {
            $or: [{ lockUntil: { $exists: false } }, { lockUntil: null }, { lockUntil: { $lte: now } }],
          },
          // Require a usable email address
          { email: { $exists: true, $nin: [null, ""] } },
        ],
      },
      {
        projection: {
          email: 1,
          userName: 1,
          fullName: 1,
          gpa: 1,
          gwa: 1,
          educationLevel: 1,
          financialNeed: 1,
          _id: 1,
        },
      },
    )
    .toArray();
}

/**
 * Notify active students about a provider timeline announcement/update.
 * In-app notifications are written in one bounded bulk operation; email is
 * intentionally not sent for ordinary timeline posts.
 */
export async function notifyUsersOfProviderPost(post) {
  const summary = { post: "", recipients: 0, inserted: 0, skipped: 0 };
  let claimedPostId = null;

  try {
    if (!post?._id || !post.title) return summary;
    summary.post = String(post.title);
    const db = await getDb();
    const postId = toObjectId(post._id);
    if (!postId) return summary;

    const claim = await db.collection("feedPosts").updateOne(
      {
        _id: postId,
        $or: [{ notifiedAt: { $exists: false } }, { notifiedAt: null }],
      },
      { $set: { notifiedAt: new Date() } },
    );
    if (claim.modifiedCount !== 1) {
      summary.skipped = 1;
      return summary;
    }
    claimedPostId = postId;

    const students = await findActiveStudents(db);
    const seenEmails = new Set();
    const notifications = [];
    const createdAt = new Date();
    const providerName = String(post.providerName || "Provider").trim();
    const content = String(post.content || "").trim();
    const message = (content && content !== post.title
      ? `${post.title}: ${content}`
      : String(post.title)).slice(0, 500);

    for (const student of students) {
      const email = String(student.email || "").trim().toLowerCase();
      if (!email || seenEmails.has(email)) continue;
      seenEmails.add(email);
      const userId = student._id ? String(student._id) : null;
      notifications.push({
        userEmail: email,
        userId,
        recipient_id: userId,
        userRole: "student",
        type: post.type === "announcement" ? "timeline_announcement" : "provider_update",
        title: `New Announcement from ${providerName}`,
        message,
        link: "/dashboard/feed",
        postId: String(post._id),
        providerName,
        read: false,
        is_read: false,
        createdAt,
        created_at: createdAt,
      });
    }

    if (notifications.length > 0) {
      const result = await db.collection("notifications").insertMany(notifications);
      summary.inserted = result.insertedCount || 0;
    }
    summary.recipients = notifications.length;
    console.log(`${LOG_PREFIX} Created ${summary.inserted} in-app notification(s) for provider post "${summary.post}"`);
    return summary;
  } catch (error) {
    console.error(`${LOG_PREFIX} Provider post notification failed:`, error.message);
    if (claimedPostId) {
      try {
        const db = await getDb();
        await db.collection("feedPosts").updateOne(
          { _id: claimedPostId },
          { $unset: { notifiedAt: "" } },
        );
      } catch (releaseError) {
        console.error(`${LOG_PREFIX} Could not release provider post notification claim:`, releaseError.message);
      }
    }
    return summary;
  }
}

/** Normalise the scholarship id so it can be queried against MongoDB. */
function toObjectId(value) {
  if (!value) return null;
  if (value instanceof ObjectId) return value;
  const text = String(value);
  return ObjectId.isValid(text) ? new ObjectId(text) : null;
}

/**
 * Atomically claim the scholarship for notification.
 * Returns true when this call won the claim, false when a blast already started.
 * If the id cannot be resolved we proceed (cannot dedupe, better to notify).
 */
async function claimForNotification(db, scholarshipId) {
  const objectId = toObjectId(scholarshipId);
  if (!objectId) return true;

  const claimed = await db
    .collection("scholarships")
    .findOneAndUpdate(
      { _id: objectId, notifiedAt: null },
      { $set: { notifiedAt: new Date() } },
    );

  return Boolean(claimed);
}

/** Release the claim so the blast can be retried (used only when nothing was sent). */
async function releaseClaim(db, scholarshipId) {
  const objectId = toObjectId(scholarshipId);
  if (!objectId) return;
  try {
    await db
      .collection("scholarships")
      .updateOne({ _id: objectId }, { $unset: { notifiedAt: "" } });
  } catch (err) {
    console.warn(`${LOG_PREFIX} Could not release notification claim:`, err.message);
  }
}

function formatAmount(amount) {
  return `₱${Number(amount || 0).toLocaleString("en-PH")}`;
}

function formatDeadline(deadline) {
  if (!deadline) return "See details";
  return new Date(deadline).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Notify all registered students about a newly created scholarship.
 *
 * Fire-and-forget safe: never throws to the caller. Returns a summary object
 * for logging/tests.
 *
 * @param {object} scholarship - Saved scholarship document (needs _id, name, ...)
 */
export async function notifyUsersOfNewScholarship(scholarship) {
  const startedAt = Date.now();
  const summary = { scholarship: "", recipients: 0, sent: 0, failed: 0, skipped: 0 };

  try {
    if (!scholarship || !scholarship.name) {
      console.warn(`${LOG_PREFIX} Skipping notification — scholarship payload missing name`);
      return summary;
    }

    summary.scholarship = String(scholarship.name);

    // Only notify for Active scholarships
    const status = String(scholarship.status || "Active");
    if (status.toLowerCase() !== "active") {
      console.log(`${LOG_PREFIX} Skipping "${scholarship.name}" — status is "${status}"`);
      return summary;
    }

    const db = await getDb();
    const scholarshipId = scholarship._id ? String(scholarship._id) : "";

    if (!(await claimForNotification(db, scholarship._id))) {
      console.log(`${LOG_PREFIX} Skipping "${scholarship.name}" — notification already sent`);
      return summary;
    }

    const students = await findActiveStudents(db);

    // One email per address, even if duplicate accounts share an inbox.
    const seenEmails = new Set();
    const recipients = [];
    for (const student of students) {
      const email = String(student.email || "").trim().toLowerCase();
      if (!email || seenEmails.has(email)) continue;
      seenEmails.add(email);
      recipients.push({ email, name: student.fullName || student.userName || "Scholar", id: student._id });
    }

    summary.recipients = recipients.length;
    console.log(`${LOG_PREFIX} Found ${students.length} student account(s), ${recipients.length} unique recipient(s) for "${scholarship.name}"`);

    const deadlineText = formatDeadline(scholarship.deadline);
    const amountText = formatAmount(scholarship.amount);

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (recipient) => {
          try {
            await sendNewScholarshipEmail({
              to: recipient.email,
              studentName: recipient.name,
              scholarshipName: scholarship.name,
              scholarshipId,
              amount: scholarship.amount,
              deadline: scholarship.deadline,
              provider: scholarship.provider || scholarship.organization || scholarship.providerName,
              description: scholarship.description,
              minimumGPA: scholarship.minimumGPA ?? scholarship.minimumGpa,
              requiredEducationLevel: scholarship.requiredEducationLevel,
              specificCriteria: scholarship.specificCriteria,
              eligibilityCriteria: scholarship.eligibilityCriteria,
              type: scholarship.type,
              frontendUrl: process.env.FRONTEND_BASE_URL || process.env.FRONTEND_URL || "http://localhost:5173",
            });
            summary.sent += 1;
          } catch (err) {
            summary.failed += 1;
            console.error(`${LOG_PREFIX} Email failed for ${maskEmail(recipient.email)}:`, err.message);
          }

          // In-app notification is independent of email delivery.
          try {
            await insertStudentNotification(db, {
              userEmail: recipient.email,
              userId: recipient.id,
              type: "new_scholarship",
              title: "New Scholarship Posted",
              message: `${scholarship.provider || scholarship.organization || scholarship.providerName || "A provider"} published "${scholarship.name}".`,
              scholarshipName: scholarship.name,
              scholarshipId,
              providerName: scholarship.provider || scholarship.organization || scholarship.providerName,
            });
            summary.notified = (summary.notified || 0) + 1;
          } catch (err) {
            console.error(`${LOG_PREFIX} In-app notification failed for ${maskEmail(recipient.email)}:`, err.message);
          }
        }),
      );

      if (i + BATCH_SIZE < recipients.length) await sleep(BATCH_DELAY_MS);
    }

    // Nothing got out at all (SMTP down / bad credentials) — release the claim
    // so a later trigger can retry instead of silently losing the blast.
    if (summary.sent === 0 && summary.failed > 0) {
      await releaseClaim(db, scholarship._id);
    } else if (scholarship._id) {
      try {
        await db
          .collection("scholarships")
          .updateOne({ _id: toObjectId(scholarship._id) }, { $set: { notifiedCount: summary.sent } });
      } catch (err) {
        console.warn(`${LOG_PREFIX} Could not persist notifiedCount:`, err.message);
      }
    }

    summary.durationMs = Date.now() - startedAt;
    console.log(
      `${LOG_PREFIX} "${scholarship.name}" dispatched — sent: ${summary.sent}, failed: ${summary.failed}, ` +
        `recipients: ${summary.recipients}, in ${summary.durationMs}ms`,
    );
    return summary;
  } catch (err) {
    // Top-level catch: notification failures must never affect scholarship creation.
    console.error(`${LOG_PREFIX} Background notification hook failed:`, err.message);
    return summary;
  }
}

/**
 * Kick off student notifications without awaiting.
 * Safe to call immediately after a successful scholarship save.
 */
export function notifyUsersOfNewScholarshipAsync(scholarship) {
  // Convert mongoose docs to plain objects for safe serialization.
  const payload =
    scholarship && typeof scholarship.toObject === "function"
      ? scholarship.toObject()
      : scholarship;

  setImmediate(() => {
    notifyUsersOfNewScholarship(payload).catch((err) =>
      console.error(`${LOG_PREFIX} Unhandled hook error:`, err.message),
    );
  });
}
