import fs from "fs/promises";
import path from "path";
import mongoose from "mongoose";
import Application from "../models/application.model.js";
import Scholarship from "../models/scholarship.model.js";
import ScholarshipRenewal from "../models/scholarship-renewal.model.js";
import User from "../models/user.model.js";
import { getDb } from "../db.js";
import { canSubmitScholarshipRenewal, isStudentUser } from "../utils/scholarship-renewal.js";
import { fileURLToPath } from "url";

const renewalStatuses = new Set(["Pending", "Approved", "Rejected"]);
const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function removeUploadedFiles(files = {}) {
  const uploaded = Object.values(files).flat();
  await Promise.all(uploaded.map(async (file) => {
    try {
      await fs.unlink(file.path);
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.error("[Scholarship Renewal] Failed to remove rejected upload:", error);
      }
    }
  }));
}

function documentRecord(file) {
  return {
    fileName: file.originalname,
    filePath: file.path,
    fileSize: file.size,
    mimeType: file.mimetype,
    uploadedAt: new Date(),
  };
}

function documentUrls(renewal) {
  return {
    ...renewal,
    registrationCardUrl: `/api/renewals/${renewal._id}/documents/registration-card`,
    previousSemesterGradesUrl: `/api/renewals/${renewal._id}/documents/previous-semester-grades`,
  };
}

async function insertRenewalNotification({ userId, userEmail, userRole, type, title, message, renewal }) {
  try {
    const db = await getDb();
    await db.collection("notifications").insertOne({
      userId: String(userId),
      userEmail: String(userEmail || "").trim().toLowerCase(),
      userRole,
      type,
      title,
      message,
      renewalId: String(renewal._id),
      scholarshipId: String(renewal.scholarshipId),
      scholarshipName: renewal.scholarshipName,
      read: false,
      is_read: false,
      createdAt: new Date(),
    });
  } catch (error) {
    console.warn("[Scholarship Renewal] Notification could not be created:", error.message);
  }
}

export const setRenewalPeriod = async (req, res) => {
  try {
    const { id } = req.params;
    const { open } = req.body ?? {};
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid scholarship ID." });
    }
    if (typeof open !== "boolean") {
      return res.status(400).json({ success: false, message: "The open field must be true or false." });
    }

    const scholarship = await Scholarship.findById(id);
    if (!scholarship) {
      return res.status(404).json({ success: false, message: "Scholarship not found." });
    }
    if (String(scholarship.createdBy) !== String(req.providerId)) {
      return res.status(403).json({ success: false, message: "You do not own this scholarship." });
    }

    if (open && scholarship.renewalPeriodOpen !== true) {
      scholarship.renewalPeriodNumber = Number(scholarship.renewalPeriodNumber || 0) + 1;
      scholarship.renewalPeriodOpenedAt = new Date();
      scholarship.renewalPeriodClosedAt = null;
    } else if (!open && scholarship.renewalPeriodOpen === true) {
      scholarship.renewalPeriodClosedAt = new Date();
    }
    scholarship.renewalPeriodOpen = open;
    await scholarship.save();

    return res.json({
      success: true,
      renewalPeriodOpen: scholarship.renewalPeriodOpen,
      renewalPeriodNumber: scholarship.renewalPeriodNumber,
      message: open ? "Scholarship renewal submissions are now open." : "Scholarship renewal submissions are now closed.",
    });
  } catch (error) {
    console.error("[Scholarship Renewal Period] Error:", error);
    return res.status(500).json({ success: false, message: "Failed to update the scholarship renewal period." });
  }
};

export const submitScholarshipRenewal = async (req, res) => {
  const files = req.files ?? {};
  try {
    const user = req.currentUser;
    if (!isStudentUser(user)) {
      await removeUploadedFiles(files);
      return res.status(403).json({ success: false, message: "Only students can submit scholarship renewals." });
    }

    const { registrationCard, previousSemesterGrades } = files;
    if (!registrationCard?.[0] || !previousSemesterGrades?.[0]) {
      await removeUploadedFiles(files);
      return res.status(400).json({
        success: false,
        message: "Upload both the current-semester registration card and grades from the previous semester.",
      });
    }

    if (!mongoose.isValidObjectId(req.params.applicationId)) {
      await removeUploadedFiles(files);
      return res.status(400).json({ success: false, message: "Invalid scholarship application ID." });
    }

    const application = await Application.findById(req.params.applicationId).lean();
    if (!application) {
      await removeUploadedFiles(files);
      return res.status(404).json({ success: false, message: "Scholarship application not found." });
    }
    if (
      String(application.studentId ?? "") !== String(user._id) &&
      String(application.studentEmail ?? "").trim().toLowerCase() !== String(user.email ?? "").trim().toLowerCase()
    ) {
      await removeUploadedFiles(files);
      return res.status(403).json({ success: false, message: "This scholarship award does not belong to you." });
    }
    if (application.status !== "Approved") {
      await removeUploadedFiles(files);
      return res.status(403).json({
        success: false,
        message: "Only students with an approved scholarship award can submit a renewal.",
      });
    }

    const scholarship = await Scholarship.findById(application.scholarshipId).lean();
    if (!scholarship) {
      await removeUploadedFiles(files);
      return res.status(404).json({ success: false, message: "Scholarship not found." });
    }
    if (!canSubmitScholarshipRenewal(application, scholarship, user)) {
      await removeUploadedFiles(files);
      return res.status(403).json({
        success: false,
        message: scholarship.renewalPeriodOpen
          ? "Only students with an approved scholarship award can submit a renewal."
          : "The provider has not opened the renewal period for this scholarship.",
      });
    }

    const existing = await ScholarshipRenewal.findOne({
      originalApplicationId: application._id,
      renewalPeriodNumber: scholarship.renewalPeriodNumber,
      isCurrent: true,
    }).lean();
    if (existing) {
      await removeUploadedFiles(files);
      return res.status(409).json({
        success: false,
        message: "A renewal has already been submitted for this scholarship period.",
      });
    }

    const submissionNumber = await ScholarshipRenewal.countDocuments({
      originalApplicationId: application._id,
      renewalPeriodNumber: scholarship.renewalPeriodNumber,
    }) + 1;
    const renewal = await ScholarshipRenewal.create({
      studentId: String(user._id),
      studentName: user.fullName || user.userName || user.name || "",
      studentEmail: String(user.email).trim().toLowerCase(),
      originalApplicationId: application._id,
      scholarshipId: scholarship._id,
      scholarshipName: application.scholarshipName || scholarship.name,
      renewalPeriodNumber: scholarship.renewalPeriodNumber,
      submissionNumber,
      registrationCard: documentRecord(registrationCard[0]),
      previousSemesterGrades: documentRecord(previousSemesterGrades[0]),
      status: "Pending",
    });

    const providerId = String(scholarship.createdBy ?? "");
    const provider = providerId ? await User.findById(providerId).lean() : null;
    if (provider) {
      await insertRenewalNotification({
        userId: provider._id,
        userEmail: provider.email,
        userRole: "provider",
        type: "scholarship_renewal_submitted",
        title: "Scholarship renewal submitted",
        message: `${renewal.studentName || renewal.studentEmail} submitted renewal documents for ${renewal.scholarshipName}.`,
        renewal,
      });
    }

    return res.status(201).json({
      success: true,
      data: documentUrls(renewal.toObject()),
      message: "Renewal documents submitted successfully.",
    });
  } catch (error) {
    await removeUploadedFiles(files);
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A renewal has already been submitted for this scholarship period.",
      });
    }
    console.error("[Scholarship Renewal Submit] Error:", error);
    return res.status(500).json({ success: false, message: "Failed to submit scholarship renewal." });
  }
};

export const getStudentScholarshipRenewals = async (req, res) => {
  try {
    const user = req.currentUser;
    if (!isStudentUser(user)) {
      return res.status(403).json({ success: false, message: "Only students can view scholarship renewals." });
    }
    const renewals = await ScholarshipRenewal.find({
      $or: [{ studentId: String(user._id) }, { studentEmail: String(user.email).trim().toLowerCase() }],
    }).sort({ submittedAt: -1 }).lean();
    return res.json({ success: true, data: renewals.map(documentUrls) });
  } catch (error) {
    console.error("[Scholarship Renewal Student GET] Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch renewal submissions." });
  }
};

export const getProviderScholarshipRenewals = async (req, res) => {
  try {
    const { status } = req.query;
    if (status && !renewalStatuses.has(String(status))) {
      return res.status(400).json({ success: false, message: "Invalid renewal status filter." });
    }
    const scholarships = await Scholarship.find({ createdBy: req.providerId }, { _id: 1 }).lean();
    const scholarshipIds = scholarships.map((item) => item._id);
    const query = { scholarshipId: { $in: scholarshipIds } };
    if (status) query.status = String(status);
    const renewals = await ScholarshipRenewal.find(query).sort({ submittedAt: -1 }).lean();
    return res.json({ success: true, data: renewals.map(documentUrls) });
  } catch (error) {
    console.error("[Scholarship Renewal Provider GET] Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch scholarship renewals." });
  }
};

export const reviewScholarshipRenewal = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid renewal submission ID." });
    }
    const { status, reviewNote = "" } = req.body ?? {};
    if (status !== "Approved" && status !== "Rejected") {
      return res.status(400).json({ success: false, message: "Renewal status must be Approved or Rejected." });
    }
    if (status === "Rejected" && !String(reviewNote).trim()) {
      return res.status(400).json({ success: false, message: "Provide a reason when rejecting a renewal." });
    }

    const renewal = await ScholarshipRenewal.findById(req.params.id);
    if (!renewal) {
      return res.status(404).json({ success: false, message: "Renewal submission not found." });
    }
    const scholarship = await Scholarship.findById(renewal.scholarshipId).lean();
    if (!scholarship || String(scholarship.createdBy) !== String(req.providerId)) {
      return res.status(403).json({ success: false, message: "You do not own this scholarship renewal." });
    }

    const reviewed = await ScholarshipRenewal.findOneAndUpdate(
      { _id: renewal._id, status: "Pending" },
      {
        $set: {
          status,
          isCurrent: status !== "Rejected",
          reviewNote: String(reviewNote).trim(),
          reviewedBy: String(req.providerId),
          reviewedAt: new Date(),
        },
      },
      { new: true, runValidators: true },
    ).lean();
    if (!reviewed) {
      return res.status(409).json({ success: false, message: "This renewal has already been reviewed." });
    }

    await insertRenewalNotification({
      userId: reviewed.studentId,
      userEmail: reviewed.studentEmail,
      userRole: "student",
      type: status === "Approved" ? "scholarship_renewal_approved" : "scholarship_renewal_rejected",
      title: status === "Approved" ? "Scholarship renewal approved" : "Scholarship renewal needs attention",
      message: status === "Approved"
        ? `Your renewal for ${reviewed.scholarshipName} was approved.`
        : `Your renewal for ${reviewed.scholarshipName} was rejected: ${String(reviewNote).trim()}`,
      renewal: reviewed,
    });

    return res.json({
      success: true,
      data: documentUrls(reviewed),
      message: status === "Approved" ? "Scholarship renewal approved." : "Scholarship renewal rejected.",
    });
  } catch (error) {
    console.error("[Scholarship Renewal Review] Error:", error);
    return res.status(500).json({ success: false, message: "Failed to review scholarship renewal." });
  }
};

export const getScholarshipRenewalDocument = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid renewal submission ID." });
    }
    const renewal = await ScholarshipRenewal.findById(req.params.id).lean();
    if (!renewal) {
      return res.status(404).json({ success: false, message: "Renewal submission not found." });
    }

    const user = req.currentUser;
    const userEmail = String(user?.email || "").trim().toLowerCase();
    const isStudent =
      String(renewal.studentId) === String(user._id) ||
      (userEmail && String(renewal.studentEmail || "").trim().toLowerCase() === userEmail);
    const scholarship = await Scholarship.findById(renewal.scholarshipId).lean();
    const isOwningProvider = scholarship && String(scholarship.createdBy) === String(user._id);
    if (!isStudent && !isOwningProvider) {
      return res.status(403).json({ success: false, message: "You cannot access these renewal documents." });
    }

    const documentField = req.params.documentType === "registration-card"
      ? "registrationCard"
      : req.params.documentType === "previous-semester-grades"
        ? "previousSemesterGrades"
        : null;
    const document = documentField && renewal[documentField];
    if (!document?.filePath) {
      return res.status(404).json({ success: false, message: "Renewal document not found." });
    }
    const resolvedPath = path.resolve(document.filePath);
    const uploadRoot = path.resolve(path.join(backendRoot, "private-uploads", "renewals"));
    const normalizedResolved = resolvedPath.toLowerCase();
    const normalizedRoot = `${uploadRoot}${path.sep}`.toLowerCase();
    if (!normalizedResolved.startsWith(normalizedRoot)) {
      return res.status(400).json({ success: false, message: "Invalid document path." });
    }
    res.type(document.mimeType || "application/octet-stream");
    return res.sendFile(resolvedPath);
  } catch (error) {
    console.error("[Scholarship Renewal Document] Error:", error);
    return res.status(500).json({ success: false, message: "Failed to load renewal document." });
  }
};
