import mongoose from "mongoose";
import fs from "fs";
import Scholarship from "../models/scholarship.model.js";
import Application from "../models/application.model.js";
import User from "../models/user.model.js";
import { notifyUsersOfNewScholarshipAsync } from "../services/newScholarshipNotificationService.js";
import { getDb } from "../db.js";
import { ObjectId } from "mongodb";

function providerNotificationFilter(req, notificationId) {
  const identity = [
    { userId: String(req.providerId) },
    { userEmail: String(req.provider?.email || "").trim().toLowerCase() },
  ];
  return {
    ...(notificationId ? { _id: ObjectId.isValid(notificationId) ? new ObjectId(notificationId) : null } : {}),
    $and: [
      { $or: identity.filter((item) => Object.values(item)[0]) },
      {
        $or: [
          { userRole: "provider" },
          { recipientGroup: { $in: ["providers", "all"] } },
        ],
      },
    ],
  };
}

export const getProviderNotifications = async (req, res) => {
  try {
    const db = await getDb();
    const notifications = await db.collection("notifications")
      .find(providerNotificationFilter(req))
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();
    return res.json({
      success: true,
      data: notifications,
      unreadCount: notifications.filter((item) => item.read !== true && item.is_read !== true).length,
    });
  } catch (error) {
    console.error("[Provider Notifications GET] Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch provider notifications." });
  }
};

export const getProviderUnreadNotificationCount = async (req, res) => {
  try {
    const db = await getDb();
    const count = await db.collection("notifications").countDocuments({
      ...providerNotificationFilter(req),
      read: { $ne: true },
      is_read: { $ne: true },
    });
    return res.json({ success: true, count });
  } catch (error) {
    console.error("[Provider Notifications Count] Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch unread provider notifications." });
  }
};

export const markProviderNotificationRead = async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid notification ID." });
    }

    const db = await getDb();
    const filter = providerNotificationFilter(req, req.params.id);
    const notification = await db.collection("notifications").findOne(filter);
    if (!notification) {
      return res.status(404).json({ success: false, message: "Notification not found." });
    }
    if (notification.read === true && notification.is_read === true) {
      return res.json({ success: true, message: "Notification is already read." });
    }

    await db.collection("notifications").updateOne(filter, {
      $set: { read: true, is_read: true, readAt: new Date() },
    });
    return res.json({ success: true, message: "Notification marked as read." });
  } catch (error) {
    console.error("[Provider Notifications PATCH] Error:", error);
    return res.status(500).json({ success: false, message: "Failed to update provider notification." });
  }
};

// ============================================================
// PROVIDER SCHOLARSHIP MANAGEMENT
// All scholarship operations are scoped to req.providerId
// ============================================================

/**
 * GET /api/provider/scholarships
 * Returns all scholarships sorted by createdAt descending,
 * each with an applicationsCount field.
 */
export const getProviderScholarships = async (req, res) => {
  try {
    const providerId = req.providerId;

    // Strictly scoped: only scholarships this provider created
    const scholarships = await Scholarship.find({ createdBy: new mongoose.Types.ObjectId(providerId) })
      .sort({ createdAt: -1 })
      .lean();

    if (scholarships.length === 0) {
      return res.json({ success: true, data: [], total: 0 });
    }

    // Count applications across both ObjectId and string scholarshipId types
    const allIds = scholarships.map((s) => s._id);
    const allStrings = allIds.map((id) => String(id));

    const appCounts = await Application.collection
      .aggregate([
        {
          $match: {
            $or: [
              { scholarshipId: { $in: allIds } },
              { scholarshipId: { $in: allStrings } },
            ],
          },
        },
        { $group: { _id: "$scholarshipId", count: { $sum: 1 } } },
      ])
      .toArray();

    const countMap = {};
    for (const entry of appCounts) {
      countMap[String(entry._id)] = entry.count;
    }

    const scholarshipsWithCount = scholarships.map((s) => ({
      ...s,
      applicationsCount: countMap[String(s._id)] || 0,
    }));

    res.json({ success: true, data: scholarshipsWithCount, total: scholarshipsWithCount.length });
  } catch (err) {
    console.error("[Provider Scholarships GET] Error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch scholarships" });
  }
};

/**
 * GET /api/provider/scholarships/:id
 * Returns a single scholarship — only if it belongs to this provider.
 */
export const getProviderScholarshipById = async (req, res) => {
  try {
    const { id } = req.params;
    const providerId = req.providerId;

    const scholarship = await Scholarship.findById(id)
      .lean();

    if (!scholarship) {
      return res.status(404).json({ success: false, message: "Scholarship not found" });
    }

    // Ownership check
    if (String(scholarship.createdBy) !== String(providerId)) {
      return res.status(403).json({ success: false, message: "You do not own this scholarship" });
    }

    // Count applications for this scholarship (both ObjectId and string types)
    const applicationsCount = await Application.collection.countDocuments({
      $or: [
        { scholarshipId: scholarship._id },
        { scholarshipId: String(scholarship._id) },
      ],
    });

    res.json({ success: true, data: { ...scholarship, applicationsCount } });
  } catch (err) {
    console.error("[Provider Scholarship GET by ID] Error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch scholarship" });
  }
};

/**
 * POST /api/provider/scholarships
 * Creates a new scholarship owned by this provider.
 */
export const createProviderScholarship = async (req, res) => {
  try {
    const providerId = req.providerId;
    const provider = req.provider;

    const {
      name, amount, deadline, status, type,
      fieldOfStudy, location, description,
      openingDate, minimumGPA, requiredEducationLevel,
      specificCriteria, requiredDocuments, generalDocuments,
      eligibilityCriteria,
    } = req.body;

    if (!name || !amount || !deadline || !type || !description) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: name, amount, deadline, type, description",
      });
    }

    const normalizedName = String(name ?? "").trim();
    const normalizedProvider = provider.providerDetails?.organizationName || provider.fullName || provider.userName;

    // Check for existing scholarship with same name and provider (case-insensitive)
    const existing = await Scholarship.findOne({
      name: { $regex: `^${normalizedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: "i" },
      provider: { $regex: `^${normalizedProvider.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: "i" },
    });

    if (existing) {
      return res.status(409).json({ success: false, error: "A scholarship with this name from this provider already exists." });
    }

    const scholarship = new Scholarship({
      name: normalizedName,
      provider: normalizedProvider,
      organization: normalizedProvider,
      amount: Number(amount),
      deadline: new Date(deadline),
      openingDate: openingDate ? new Date(openingDate) : null,
      status: status || "Active",
      type,
      fieldOfStudy: fieldOfStudy || "",
      location: location || "",
      description: String(description).trim(),
      minimumGPA: minimumGPA ? Number(minimumGPA) : undefined,
      requiredEducationLevel: requiredEducationLevel || [],
      specificCriteria: specificCriteria || [],
      requiredDocuments: requiredDocuments || [],
      generalDocuments: generalDocuments || [],
      eligibilityCriteria: eligibilityCriteria || {},
      applicationsCount: 0,
      // Ownership fields
      createdBy: new mongoose.Types.ObjectId(providerId),
      providerName: normalizedProvider,
    });

    const saved = await scholarship.save();

    // Fan out emails + in-app notifications to every registered student.
    // Scheduled via setImmediate, so the provider's response is not blocked
    // and a delivery failure can never fail the creation request.
    notifyUsersOfNewScholarshipAsync(saved);

    res.status(201).json({ success: true, data: saved });
  } catch (err) {
    console.error("[Provider Scholarship CREATE] Error:", err);
    if (err.code === 11000) {
      return res.status(409).json({ success: false, error: "A scholarship with this name from this provider already exists." });
    }
    res.status(500).json({ success: false, message: "Failed to create scholarship" });
  }
};

/**
 * PUT /api/provider/scholarships/:id
 * Updates a scholarship — only if it belongs to this provider.
 */
export const updateProviderScholarship = async (req, res) => {
  try {
    const { id } = req.params;
    const providerId = req.providerId;

    const scholarship = await Scholarship.findById(id);

    if (!scholarship) {
      return res.status(404).json({ success: false, message: "Scholarship not found" });
    }

    // Ownership check
    if (String(scholarship.createdBy) !== String(providerId)) {
      return res.status(403).json({ success: false, message: "You do not own this scholarship" });
    }

    const updates = { ...req.body };

    // Prevent overwriting ownership fields
    delete updates.createdBy;
    delete updates.providerName;

    if (updates.amount !== undefined) updates.amount = Number(updates.amount);
    if (updates.deadline) updates.deadline = new Date(updates.deadline);
    if (updates.openingDate) updates.openingDate = new Date(updates.openingDate);

    const updated = await Scholarship.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error("[Provider Scholarship UPDATE] Error:", err);
    res.status(500).json({ success: false, message: "Failed to update scholarship" });
  }
};

/**
 * DELETE /api/provider/scholarships/:id
 * Deletes a scholarship — only if it belongs to this provider.
 */
export const deleteProviderScholarship = async (req, res) => {
  try {
    const { id } = req.params;
    const providerId = req.providerId;

    const scholarship = await Scholarship.findById(id);

    if (!scholarship) {
      return res.status(404).json({ success: false, message: "Scholarship not found" });
    }

    // Ownership check
    if (String(scholarship.createdBy) !== String(providerId)) {
      return res.status(403).json({ success: false, message: "You do not own this scholarship" });
    }

    await Scholarship.findByIdAndDelete(id);

    res.json({ success: true, message: "Scholarship deleted successfully" });
  } catch (err) {
    console.error("[Provider Scholarship DELETE] Error:", err);
    res.status(500).json({ success: false, message: "Failed to delete scholarship" });
  }
};

// ============================================================
// PROVIDER APPLICATION MANAGEMENT
// All application operations are scoped to this provider's scholarships
// ============================================================

/**
 * GET /api/provider/applications
 * Returns all applications for all scholarships owned by this provider.
 */
export const getProviderApplications = async (req, res) => {
  try {
    const { status, scholarshipId } = req.query;
    const providerId = req.providerId;

    // Strictly scoped: only scholarships this provider created
    const providerScholarships = await Scholarship.find(
      { createdBy: new mongoose.Types.ObjectId(providerId) },
      { _id: 1 }
    ).lean();

    const scholarshipIds = providerScholarships.map((s) => s._id);

    if (scholarshipIds.length === 0) {
      return res.json({ success: true, data: [], stats: { pending: 0, underReview: 0, approved: 0, rejected: 0 } });
    }

    // Build filter matching both ObjectId and string scholarshipId types
    const stringScholarshipIds = scholarshipIds.map((id) => String(id));

    const orConditions = scholarshipId
      ? [
          { scholarshipId: new mongoose.Types.ObjectId(scholarshipId) },
          { scholarshipId: scholarshipId },
        ]
      : [
          { scholarshipId: { $in: scholarshipIds } },
          { scholarshipId: { $in: stringScholarshipIds } },
        ];

    // Build the data filter — apply status separately so statConditions stay unaffected
    const dataFilter = status
      ? { $or: orConditions, status }
      : { $or: orConditions };

    const applications = await Application.collection
      .find(dataFilter)
      .sort({ submittedAt: -1 })
      .toArray();

    // Stats always use ALL statuses — never filtered by the tab's status param
    const statConditions = scholarshipId
      ? [
          { scholarshipId: new mongoose.Types.ObjectId(scholarshipId) },
          { scholarshipId: scholarshipId },
        ]
      : [
          { scholarshipId: { $in: scholarshipIds } },
          { scholarshipId: { $in: stringScholarshipIds } },
        ];

    const counts = await Application.collection
      .aggregate([
        { $match: { $or: statConditions } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ])
      .toArray();

    const stats = {
      // "Pending" DB status
      pending: counts.find((c) => c._id === "Pending")?.count || 0,
      // "Under Review" and "System Qualified" both map to Under Evaluation
      underReview: (counts.find((c) => c._id === "Under Review")?.count || 0) +
                   (counts.find((c) => c._id === "System Qualified")?.count || 0),
      approved: counts.find((c) => c._id === "Approved")?.count || 0,
      rejected: counts.find((c) => c._id === "Rejected")?.count || 0,
    };

    res.json({ success: true, data: applications, stats });
  } catch (err) {
    console.error("[Provider Applications GET] Error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch applications" });
  }
};

/**
 * GET /api/provider/applications/:scholarshipId/applicants
 * Returns all applications for a specific scholarship owned by this provider.
 */
export const getApplicantsByScholarship = async (req, res) => {
  try {
    const { scholarshipId } = req.params;
    const providerId = req.providerId;

    // Verify this scholarship belongs to this provider
    const scholarship = await Scholarship.findById(scholarshipId);
    if (!scholarship) {
      return res.status(404).json({ success: false, message: "Scholarship not found" });
    }
    if (String(scholarship.createdBy) !== String(providerId)) {
      return res.status(403).json({ success: false, message: "You do not own this scholarship" });
    }

    const applications = await Application.collection
      .find({
        $or: [
          { scholarshipId: scholarship._id },
          { scholarshipId: String(scholarship._id) },
        ],
      })
      .sort({ matchScore: -1, submittedAt: 1 })
      .toArray();

    res.json({
      success: true,
      scholarship: {
        id: scholarship._id,
        name: scholarship.name,
        deadline: scholarship.deadline,
        status: scholarship.status,
      },
      data: applications,
      count: applications.length,
    });
  } catch (err) {
    console.error("[Provider Applicants GET] Error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch applicants" });
  }
};

/**
 * PATCH /api/provider/applications/:id/approve
 * Provider approves an application for their scholarship.
 */
export const approveApplicationByProvider = async (req, res) => {
  try {
    const { id } = req.params;
    const providerId = req.providerId;

    const application = await Application.findById(id);
    if (!application) {
      return res.status(404).json({ success: false, message: "Application not found" });
    }

    // Strictly verify the scholarship belongs to this provider — no bypass
    const scholarship = await Scholarship.findById(application.scholarshipId);
    if (!scholarship) {
      return res.status(404).json({ success: false, message: "Scholarship not found" });
    }
    if (String(scholarship.createdBy) !== String(providerId)) {
      return res.status(403).json({ success: false, message: "You do not have permission to approve this application" });
    }

    const update = {
      status: "Approved",
      approvedBy: new mongoose.Types.ObjectId(providerId),
      approvedByRole: "provider",
      approvedAt: new Date(),
      updatedAt: new Date(),
    };
    await Application.findByIdAndUpdate(id, { $set: update });
    const updated = await Application.findById(id);

    res.json({ success: true, data: updated, message: "Application approved" });
  } catch (err) {
    console.error("[Provider Approve Application] Error:", err);
    res.status(500).json({ success: false, message: "Failed to approve application" });
  }
};

/**
 * PATCH /api/provider/applications/:id/reject
 * Provider rejects an application for their scholarship.
 */
export const rejectApplicationByProvider = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const providerId = req.providerId;

    const application = await Application.findById(id);
    if (!application) {
      return res.status(404).json({ success: false, message: "Application not found" });
    }

    // Strictly verify the scholarship belongs to this provider — no bypass
    const scholarship = await Scholarship.findById(application.scholarshipId);
    if (!scholarship) {
      return res.status(404).json({ success: false, message: "Scholarship not found" });
    }
    if (String(scholarship.createdBy) !== String(providerId)) {
      return res.status(403).json({ success: false, message: "You do not have permission to reject this application" });
    }

    const update = {
      status: "Rejected",
      rejectedBy: new mongoose.Types.ObjectId(providerId),
      rejectedByRole: "provider",
      rejectedAt: new Date(),
      rejectionReason: String(reason || "").trim() || null,
      updatedAt: new Date(),
    };
    await Application.findByIdAndUpdate(id, { $set: update });
    const updated = await Application.findById(id);

    res.json({ success: true, data: updated, message: "Application rejected" });
  } catch (err) {
    console.error("[Provider Reject Application] Error:", err);
    res.status(500).json({ success: false, message: "Failed to reject application" });
  }
};

/**
 * PATCH /api/provider/applications/:id/qualify
 * Provider qualifies an applicant for final screening.
 * Optionally schedules a virtual meeting.
 */
export const qualifyApplicationByProvider = async (req, res) => {
  try {
    const { id } = req.params;
    const { scheduledDate, scheduledTime, venue, notes } = req.body;
    const providerId = req.providerId;

    const application = await Application.findById(id);
    if (!application) {
      return res.status(404).json({ success: false, message: "Application not found" });
    }

    // Strictly verify the scholarship belongs to this provider — no bypass
    const scholarship = await Scholarship.findById(application.scholarshipId);
    if (!scholarship) {
      return res.status(404).json({ success: false, message: "Scholarship not found" });
    }
    if (String(scholarship.createdBy) !== String(providerId)) {
      return res.status(403).json({ success: false, message: "You do not have permission to qualify this application" });
    }

    const update = {
      status: "System Qualified",
      updatedAt: new Date(),
    };

    // Schedule virtual meeting if details provided
    if (scheduledDate && scheduledTime && venue) {
      update.screeningSchedule = {
        scheduledDate: new Date(scheduledDate),
        scheduledTime,
        venue,
        notes: notes || "",
        scheduledBy: new mongoose.Types.ObjectId(providerId),
        scheduledAt: new Date(),
        isScheduled: true,
      };
    }

    await Application.findByIdAndUpdate(id, { $set: update });
    const updated = await Application.findById(id);

    res.json({
      success: true,
      data: updated,
      message: scheduledDate
        ? "Application qualified and screening scheduled"
        : "Application qualified for final screening",
    });
  } catch (err) {
    console.error("[Provider Qualify Application] Error:", err);
    res.status(500).json({ success: false, message: "Failed to qualify application" });
  }
};

/**
 * GET /api/provider/profile
 * Returns the full provider profile for the settings page.
 * Maps all 9 profile fields from req.provider; missing fields return null.
 */
export const getProviderProfileHandler = (req, res) => {
  try {
    const user = req.provider;

    const name = user.fullName || user.userName || null;
    const email = user.email || null;
    const organizationName = user.providerDetails?.organizationName || null;
    const position = user.providerDetails?.position || null;
    const phone = user.providerDetails?.phone || null;
    const officeAddress = user.providerDetails?.officeAddress || null;
    const description = user.providerDetails?.description || null;
    const website = user.providerDetails?.website || null;
    const profilePicture = user.profilePicture || null;

    return res.json({
      success: true,
      data: {
        name,
        email,
        organizationName,
        position,
        phone,
        officeAddress,
        description,
        website,
        profilePicture,
      },
    });
  } catch (err) {
    console.error("[Provider Profile GET] Error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch provider profile" });
  }
};

/**
 * GET /api/provider/me
 * Returns live provider identity from the database.
 * Used by ProviderLayout to render the sidebar header.
 * req.provider is already the full user document, attached by requireProvider.
 */
export const getProviderMe = (req, res) => {
  try {
    const user = req.provider;

    const name = user.fullName || user.userName || null;
    const email = user.email || null;
    const organizationName = user.providerDetails?.organizationName || null;
    const profilePicture = user.profilePicture || null;

    return res.json({
      success: true,
      data: { name, email, organizationName, profilePicture },
    });
  } catch (err) {
    console.error("[Provider Me GET] Error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch provider identity" });
  }
};

/**
 * Helper — maps a User document to the 9-field provider profile shape.
 * All absent/null fields are returned as null.
 */
function mapProviderProfile(user) {
  return {
    name: user.fullName || user.userName || null,
    email: user.email || null,
    organizationName: user.providerDetails?.organizationName || null,
    position: user.providerDetails?.position || null,
    phone: user.providerDetails?.phone || null,
    officeAddress: user.providerDetails?.officeAddress || null,
    description: user.providerDetails?.description || null,
    website: user.providerDetails?.website || null,
    profilePicture: user.profilePicture || null,
  };
}

/**
 * PUT /api/provider/profile
 * Validates and partially updates allowed profile fields.
 * Requirements: 6.2, 6.3, 6.4, 6.5
 */
export const updateProviderProfile = async (req, res) => {
  try {
    const {
      name,
      organizationName,
      position,
      phone,
      officeAddress,
      description,
      website,
    } = req.body;

    // ---- Validation (fail-fast, no partial updates on error) ----

    if (name !== undefined) {
      const trimmedName = String(name ?? "").trim();
      if (trimmedName.length === 0) {
        return res.status(400).json({
          success: false,
          message: "name cannot be empty",
        });
      }
    }

    if (organizationName !== undefined) {
      const trimmedOrg = String(organizationName ?? "").trim();
      if (trimmedOrg.length === 0) {
        return res.status(400).json({
          success: false,
          message: "organizationName cannot be empty",
        });
      }
    }

    if (website !== undefined) {
      const w = String(website ?? "").trim();
      if (w.length > 0 && !w.startsWith("http://") && !w.startsWith("https://")) {
        return res.status(400).json({
          success: false,
          message: "Website must start with http:// or https://",
        });
      }
    }

    // ---- Build $set — only include keys that were present in the body ----
    const updates = {};

    if (name !== undefined) {
      updates.fullName = String(name ?? "").trim();
    }

    if (organizationName !== undefined) {
      updates["providerDetails.organizationName"] = String(organizationName ?? "").trim();
    }
    if (position !== undefined) {
      updates["providerDetails.position"] = position ? String(position).trim() : null;
    }
    if (phone !== undefined) {
      updates["providerDetails.phone"] = phone ? String(phone).trim() : null;
    }
    if (officeAddress !== undefined) {
      updates["providerDetails.officeAddress"] = officeAddress ? String(officeAddress).trim() : null;
    }
    if (description !== undefined) {
      updates["providerDetails.description"] = description ? String(description).trim() : null;
    }
    if (website !== undefined) {
      updates["providerDetails.website"] = website ? String(website).trim() : null;
    }

    const updated = await User.findByIdAndUpdate(
      req.providerId,
      { $set: updates },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Provider not found" });
    }

    const data = mapProviderProfile(updated);
    return res.json({ success: true, data });
  } catch (err) {
    console.error("[Provider Profile PUT] Error:", err);
    return res.status(500).json({ success: false, message: "Failed to update provider profile" });
  }
};

/**
 * GET /api/provider/dashboard/stats
 * Returns dashboard stats for the provider.
 * totalScholarships = count of ALL scholarship documents (no ownership filter).
 * pendingApplications = count of Application documents with status "Pending" across ALL scholarships.
 */
export const getProviderDashboardStats = async (req, res) => {
  try {
    const providerId = req.providerId;

    // Strictly scoped: only this provider's scholarships
    const scholarships = await Scholarship.find(
      { createdBy: new mongoose.Types.ObjectId(providerId) },
      { _id: 1, status: 1 }
    ).lean();

    const totalScholarships = scholarships.length;
    const activeScholarships = scholarships.filter((s) => s.status === "Active").length;

    if (totalScholarships === 0) {
      return res.json({
        success: true,
        stats: { totalScholarships: 0, activeScholarships: 0, totalApplicants: 0, pendingApplications: 0, approvedApplications: 0 },
      });
    }

    // Count applications only for this provider's scholarships
    const scholarshipIds = scholarships.map((s) => s._id);
    const stringIds = scholarshipIds.map((id) => String(id));

    const appCounts = await Application.aggregate([
      {
        $match: {
          $or: [
            { scholarshipId: { $in: scholarshipIds } },
            { scholarshipId: { $in: stringIds } },
          ],
        },
      },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const totalApplicants = appCounts.reduce((sum, c) => sum + c.count, 0);
    const pendingCount = appCounts.find((c) => c._id === "Pending")?.count || 0;
    const approvedCount = appCounts.find((c) => c._id === "Approved")?.count || 0;

    res.json({
      success: true,
      stats: {
        totalScholarships,
        activeScholarships,
        totalApplicants,
        pendingApplications: pendingCount,
        approvedApplications: approvedCount,
      },
    });
  } catch (err) {
    console.error("[Provider Dashboard Stats] Error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch dashboard stats" });
  }
};

/**
 * POST /api/provider/upload-avatar
 * Saves the uploaded file path to the provider's profilePicture field.
 * If the DB write fails after the file is already on disk, deletes the file
 * before returning HTTP 500.
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.7, 8.8
 */
export const uploadProviderAvatar = async (req, res) => {
  // Requirement 8.7 — missing file field
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No avatar file provided" });
  }

  // Requirement 8.2 — path stored as /uploads/providers/{filename}
  const profilePicture = `/uploads/providers/${req.file.filename}`;

  try {
    // Requirement 8.2 — update User document
    await User.findByIdAndUpdate(
      req.providerId,
      { $set: { profilePicture } },
      { new: true }
    );

    // Requirement 8.4 — success response
    return res.json({ success: true, avatarUrl: profilePicture });
  } catch (err) {
    console.error("[Provider Avatar Upload] DB error:", err);

    // Requirement 8.3 — delete file from disk before returning 500
    try {
      fs.unlinkSync(req.file.path);
    } catch (unlinkErr) {
      console.error("[Provider Avatar Upload] Failed to delete file after DB error:", unlinkErr);
    }

    return res.status(500).json({ success: false, message: "Failed to update profile picture" });
  }
};
