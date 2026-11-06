/**
 * renewalNotificationService.js
 *
 * Scans active scholarships for approaching deadlines and sends
 * renewal reminder notifications to the owning provider.
 *
 * Runs once on server startup, then every 24 hours.
 * Thresholds: 30 days and 7 days before deadline.
 */

import User from "../models/user.model.js";
import Scholarship from "../models/scholarship.model.js";
import { getDb } from "../db.js";

const THRESHOLDS_DAYS = [30, 7];

/**
 * Insert an in-app notification for a provider.
 */
async function insertProviderNotification(db, { providerEmail, providerId, type, title, message, scholarshipName, scholarshipId }) {
  await db.collection("notifications").insertOne({
    userEmail: providerEmail,
    userId: providerId,
    userRole: "provider",
    type,
    title,
    message,
    scholarshipName,
    scholarshipId: String(scholarshipId),
    read: false,
    createdAt: new Date(),
  });
}

/**
 * Main check — finds scholarships expiring within threshold windows
 * and creates notifications + emails for each provider.
 */
export async function checkScholarshipRenewals() {
  try {
    const db = await getDb();
    const now = new Date();

    for (const days of THRESHOLDS_DAYS) {
      const windowStart = new Date(now);
      const windowEnd = new Date(now);
      windowEnd.setDate(windowEnd.getDate() + days + 1); // +1 to include boundary
      windowStart.setDate(windowStart.getDate() + days - 1);

      // Find active scholarships whose deadline falls within [windowStart, windowEnd]
      const scholarships = await Scholarship.find({
        status: "Active",
        createdBy: { $ne: null },
        deadline: { $gte: windowStart, $lte: windowEnd },
      }).lean();

      for (const s of scholarships) {
        if (!s.createdBy) continue;

        // Deduplicate: skip if we already sent this exact threshold notification today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const alreadySent = await db.collection("notifications").findOne({
          scholarshipId: String(s._id),
          type: `renewal_${days}d`,
          createdAt: { $gte: today },
        });
        if (alreadySent) continue;

        // Find the provider
        const provider = await User.findById(s.createdBy).lean();
        if (!provider || !provider.email) continue;

        const deadlineFormatted = new Date(s.deadline).toLocaleDateString("en-US", {
          month: "long", day: "numeric", year: "numeric",
        });

        const title = `Scholarship Expiring in ${days} Days`;
        const message = `Your scholarship "${s.name}" is approaching its deadline on ${deadlineFormatted}. Please review and renew it if needed.`;

        // In-app notification
        await insertProviderNotification(db, {
          providerEmail: provider.email,
          providerId: String(provider._id),
          type: `renewal_${days}d`,
          title,
          message,
          scholarshipName: s.name,
          scholarshipId: s._id,
        });

        // Email notification (fire-and-forget)
        try {
          const { sendScholarshipRenewalEmail } = await import("./emailService.js");
          sendScholarshipRenewalEmail({
            to: provider.email,
            providerName: provider.userName || provider.fullName || "Provider",
            scholarshipName: s.name,
            deadline: deadlineFormatted,
            daysLeft: days,
            frontendUrl: process.env.FRONTEND_BASE_URL || "http://localhost:5173",
          }).catch((err) =>
            console.warn(`[Renewal] Email failed for ${s.name}:`, err.message)
          );
        } catch {
          // emailService may not export this yet — skip gracefully
        }

        console.log(`[Renewal] Notified provider ${provider.email} — "${s.name}" expires in ${days} days`);
      }
    }
  } catch (err) {
    console.error("[Renewal Check] Error:", err.message);
  }
}

/**
 * Start the renewal check scheduler.
 * Runs immediately on startup, then every 24 hours.
 */
export function startRenewalScheduler() {
  console.log("[Renewal] Scholarship renewal scheduler started.");
  checkScholarshipRenewals(); // run immediately
  setInterval(checkScholarshipRenewals, 24 * 60 * 60 * 1000); // every 24h
}
