import mongoose from "mongoose";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import FeedPost from "../models/feed-post.model.js";
import Scholarship from "../models/scholarship.model.js";
import User from "../models/user.model.js";
import { getDb } from "../db.js";
import { notifyUsersOfProviderPost } from "../services/newScholarshipNotificationService.js";

const PRIVATE_POST_UPLOAD_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../private-uploads/student-posts");
const STUDENT_CATEGORIES = new Set(["academic", "achievements", "updates", "appreciation"]);
const STUDENT_ROLES = new Set(["student", "customer"]);

function providerDisplayName(provider) {
  return String(provider?.providerDetails?.organizationName || provider?.fullName || provider?.userName || "Provider").trim();
}

function currentRole(req) {
  return String(req.currentUser?.role || req.currentUser?.userType || "").toLowerCase();
}

function studentPostResponse(post, { includeWarning = false } = {}) {
  return {
    _id: String(post._id),
    authorName: post.authorName || "Scholar",
    authorHeadline: post.authorHeadline || "Student",
    content: post.content,
    category: post.category || "updates",
    moderationStatus: post.moderationStatus,
    createdAt: post.createdAt,
    ...(includeWarning && post.warningReason ? { warningReason: post.warningReason } : {}),
    attachments: (post.attachments || []).map(({ storedName, ...attachment }) => ({
      ...attachment,
      url: `/api/posts/${post._id}/attachments/${encodeURIComponent(attachment.id)}`,
    })),
    feedType: "student-post",
  };
}

async function removeUploadedFiles(files = []) {
  await Promise.all(files.map((file) => fs.unlink(file.path).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  })));
}

export const createStudentPost = async (req, res) => {
  const files = req.files || [];
  try {
    if (!STUDENT_ROLES.has(currentRole(req))) {
      await removeUploadedFiles(files);
      return res.status(403).json({ success: false, message: "Student posting access required." });
    }

    const content = String(req.body?.content || "").trim();
    const category = String(req.body?.category || "updates").trim().toLowerCase();
    if (!content || content.length > 5000) {
      await removeUploadedFiles(files);
      return res.status(400).json({ success: false, message: "Post text is required and must be 5,000 characters or fewer." });
    }
    if (!STUDENT_CATEGORIES.has(category)) {
      await removeUploadedFiles(files);
      return res.status(400).json({ success: false, message: "Choose a valid post category." });
    }

    const authorName = String(req.currentUser?.fullName || req.currentUser?.userName || "Scholar").trim();
    const post = await FeedPost.create({
      authorId: new mongoose.Types.ObjectId(req.userId),
      authorType: "student",
      authorName,
      authorHeadline: String(req.currentUser?.fieldOfStudy || req.currentUser?.educationLevel || "Student").trim(),
      providerName: "Scholar",
      title: content.slice(0, 160),
      content,
      category,
      attachments: files.map((file) => ({
        id: path.parse(file.filename).name,
        storedName: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        kind: file.mimetype === "application/pdf" ? "document" : "photo",
      })),
      moderationStatus: "pending",
      visibility: "public",
    });

    return res.status(201).json({
      success: true,
      message: "Your post was submitted for admin review.",
      data: studentPostResponse(post.toObject()),
    });
  } catch (error) {
    try {
      await removeUploadedFiles(files);
    } catch (cleanupError) {
      console.error("[Student Feed POST] Uploaded file cleanup failed:", cleanupError);
    }
    console.error("[Student Feed POST] Error:", error);
    return res.status(500).json({ success: false, message: "Failed to submit your post." });
  }
};

export const getStudentHomePosts = async (req, res) => {
  try {
    if (!STUDENT_ROLES.has(currentRole(req))) {
      return res.status(403).json({ success: false, message: "Student feed access required." });
    }
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    const posts = await FeedPost.find({
      authorType: "student",
      $or: [
        { moderationStatus: "approved" },
        { authorId: req.userId, moderationStatus: "pending" },
      ],
    }).sort({ createdAt: -1 }).lean();
    return res.json({
      success: true,
      data: posts.map((post) => studentPostResponse(post, {
        includeWarning: String(post.authorId) === String(req.userId),
      })),
    });
  } catch (error) {
    console.error("[Student Home Feed GET] Error:", error);
    return res.status(500).json({ success: false, message: "Failed to load student posts." });
  }
};

export const getProviderStudentPosts = async (req, res) => {
  try {
    const posts = await FeedPost.find({
      authorType: "student",
      moderationStatus: "approved",
    }).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: posts.map((post) => studentPostResponse(post)) });
  } catch (error) {
    console.error("[Provider Student Feed GET] Error:", error);
    return res.status(500).json({ success: false, message: "Failed to load scholar posts." });
  }
};

export const getAdminStudentPosts = async (req, res) => {
  try {
    const status = String(req.query?.status || "pending").trim().toLowerCase();
    if (!["pending", "approved"].includes(status)) {
      return res.status(400).json({ success: false, message: "Choose pending or approved posts." });
    }
    const posts = await FeedPost.find({
      authorType: "student",
      moderationStatus: status,
    }).sort({ createdAt: status === "pending" ? 1 : -1 }).lean();
    return res.json({
      success: true,
      data: posts.map((post) => studentPostResponse(post, { includeWarning: true })),
    });
  } catch (error) {
    console.error("[Admin Student Posts GET] Error:", error);
    return res.status(500).json({ success: false, message: "Failed to load posts for review." });
  }
};

export const moderateStudentPost = async (req, res) => {
  try {
    const { id } = req.params;
    const action = String(req.body?.action || "").trim().toLowerCase();
    const reason = String(req.body?.reason || "").trim();
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid post ID." });
    }
    if (!["approve", "remove", "warn"].includes(action)) {
      return res.status(400).json({ success: false, message: "Choose approve, remove, or warn." });
    }
    if ((action === "remove" || action === "warn") && !reason) {
      return res.status(400).json({ success: false, message: "A reason is required for removal or warning." });
    }

    const statuses = action === "approve" ? ["pending"] : ["pending", "approved"];
    const post = await FeedPost.findOne({
      _id: id,
      authorType: "student",
      moderationStatus: { $in: statuses },
    });
    if (!post) {
      return res.status(404).json({ success: false, message: "Student post not found or action unavailable." });
    }

    const now = new Date();
    let attachmentCleanupWarning = false;
    if (action === "approve") {
      post.moderationStatus = "approved";
      post.reviewedBy = req.adminId;
      post.reviewedAt = now;
      post.moderationReason = "";
      await post.save();
    } else if (action === "remove") {
      post.moderationStatus = "removed";
      post.reviewedBy = req.adminId;
      post.reviewedAt = now;
      post.moderationReason = reason;
      await post.save();
      try {
        await removeUploadedFiles((post.attachments || []).map((attachment) => ({
          path: path.join(PRIVATE_POST_UPLOAD_DIR, attachment.storedName),
        })));
      } catch (cleanupError) {
        attachmentCleanupWarning = true;
        console.error("[Admin Student Post Moderation] Removed post attachments could not all be deleted:", cleanupError);
      }
    } else {
      const author = await User.findById(post.authorId).select("email").lean();
      if (!author?.email) {
        return res.status(404).json({ success: false, message: "Post author could not be found." });
      }
      post.warningReason = reason;
      post.warnedBy = req.adminId;
      post.warnedAt = now;
      await post.save();

      const { ObjectId } = await import("mongodb");
      const db = await getDb();
      await db.collection("notifications").insertOne({
        userId: String(post.authorId),
        userEmail: String(author.email).trim().toLowerCase(),
        title: "Reminder about your scholar post",
        message: `An administrator reviewed your post and issued a warning: ${reason}`,
        type: "warning",
        priority: "high",
        source: "admin",
        postId: String(post._id),
        read: false,
        createdAt: now,
        ...(ObjectId.isValid(String(req.adminId)) ? { adminId: new ObjectId(String(req.adminId)) } : {}),
      });
    }
    const message = attachmentCleanupWarning
      ? "Post removed, but some private attachments could not be deleted."
      : `Post ${action === "warn" ? "warning sent" : `${action}d`}.`;
    return res.json({ success: true, message });
  } catch (error) {
    console.error("[Admin Student Post Moderation] Error:", error);
    return res.status(500).json({ success: false, message: "Failed to moderate student post." });
  }
};

export const getStudentPostAttachment = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.postId)) {
      return res.status(404).json({ success: false, message: "Post attachment not found." });
    }
    const role = currentRole(req);
    const isAdmin = Boolean(req.adminId) || role === "admin";
    const isProvider = role === "provider";
    const isStudent = STUDENT_ROLES.has(role);
    if (!isAdmin && !isProvider && !isStudent) {
      return res.status(403).json({ success: false, message: "Post attachment access denied." });
    }
    const post = await FeedPost.findOne({
      _id: req.params.postId,
      authorType: "student",
      moderationStatus: { $ne: "removed" },
    }).lean();
    if (!post) return res.status(404).json({ success: false, message: "Post attachment not found." });
    if (post.moderationStatus !== "approved" && !(isAdmin || (isStudent && String(post.authorId) === String(req.userId)))) {
      return res.status(404).json({ success: false, message: "Post attachment not found." });
    }

    const attachment = (post.attachments || []).find((item) => item.id === req.params.attachmentId);
    if (!attachment || path.basename(attachment.storedName) !== attachment.storedName) {
      return res.status(404).json({ success: false, message: "Post attachment not found." });
    }
    const filePath = path.join(PRIVATE_POST_UPLOAD_DIR, attachment.storedName);
    await fs.access(filePath);
    res.set("Cache-Control", "private, no-store");
    res.type(attachment.mimeType);
    const safeName = attachment.originalName.replace(/["\\\r\n]/g, "_");
    res.set("Content-Disposition", `inline; filename="${safeName}"`);
    return res.sendFile(filePath);
  } catch (error) {
    if (error.code === "ENOENT") {
      return res.status(404).json({ success: false, message: "Post attachment not found." });
    }
    console.error("[Student Post Attachment GET] Error:", error);
    return res.status(500).json({ success: false, message: "Failed to load post attachment." });
  }
};

export const createProviderFeedPost = async (req, res) => {
  try {
    const title = String(req.body?.title || "").trim();
    const content = String(req.body?.content || "").trim();
    const type = req.body?.type === "announcement" ? "announcement" : "update";

    if (!title || !content) {
      return res.status(400).json({ success: false, message: "Title and content are required." });
    }

    const post = await FeedPost.create({
      authorId: new mongoose.Types.ObjectId(req.providerId),
      authorType: "provider",
      providerName: providerDisplayName(req.provider),
      type,
      title,
      content,
      visibility: "public",
    });

    setImmediate(() => {
      notifyUsersOfProviderPost(post.toObject()).catch((error) => {
        console.error("[Provider Feed POST] Notification dispatch failed:", error);
      });
    });

    return res.status(201).json({ success: true, data: post });
  } catch (error) {
    console.error("[Provider Feed POST] Error:", error);
    return res.status(500).json({ success: false, message: "Failed to publish feed post." });
  }
};

export const updateProviderFeedPost = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid post ID." });
    }

    const title = String(req.body?.title || "").trim();
    const content = String(req.body?.content || "").trim();
    const type = req.body?.type === "announcement" ? "announcement" : "update";
    if (!title || !content) {
      return res.status(400).json({ success: false, message: "Title and content are required." });
    }

    const post = await FeedPost.findOneAndUpdate(
      { _id: id, authorId: req.providerId },
      { $set: { title, content, type, isEdited: true, editedAt: new Date() } },
      { new: true, runValidators: true },
    ).lean();

    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found or not owned by this provider." });
    }
    return res.json({ success: true, data: post });
  } catch (error) {
    console.error("[Provider Feed PUT] Error:", error);
    return res.status(500).json({ success: false, message: "Failed to update feed post." });
  }
};

export const deleteProviderFeedPost = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid post ID." });
    }

    const deleted = await FeedPost.findOneAndDelete({ _id: id, authorId: req.providerId });
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Post not found or not owned by this provider." });
    }
    return res.json({ success: true, message: "Feed post deleted." });
  } catch (error) {
    console.error("[Provider Feed DELETE] Error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete feed post." });
  }
};

export const getProviderTimeline = async (req, res) => {
  try {
    const providerId = new mongoose.Types.ObjectId(req.providerId);
    const [scholarships, posts] = await Promise.all([
      Scholarship.find({ createdBy: providerId }).sort({ createdAt: -1 }).lean(),
      FeedPost.find({ authorId: providerId }).sort({ createdAt: -1 }).lean(),
    ]);

    const items = [
      ...scholarships.map((item) => ({ ...item, feedType: "scholarship", createdAt: item.createdAt || item._id.getTimestamp() })),
      ...posts.map((item) => ({ ...item, feedType: "post" })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return res.json({ success: true, data: items });
  } catch (error) {
    console.error("[Provider Timeline GET] Error:", error);
    return res.status(500).json({ success: false, message: "Failed to load provider timeline." });
  }
};

export const getStudentFeed = async (req, res) => {
  try {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");

    const role = String(req.currentUser?.role || req.currentUser?.userType || "").toLowerCase();
    if (!["student", "customer"].includes(role)) {
      return res.status(403).json({ success: false, message: "Student feed access required." });
    }

    const [scholarships, posts] = await Promise.all([
      Scholarship.find({ status: "Active" }).sort({ createdAt: -1 }).lean(),
      // Older feed posts may not have a visibility field because it was added
      // after the initial post documents were created. Provider posts are
      // public by design, so include those legacy documents as well.
      FeedPost.find({
        authorType: { $ne: "student" },
        $or: [{ visibility: "public" }, { visibility: { $exists: false } }, { visibility: null }],
      }).sort({ createdAt: -1 }).lean(),
    ]);

    const items = [
      ...scholarships.map((item) => ({
        ...item,
        feedType: "scholarship",
        createdAt: item.createdAt || item._id.getTimestamp(),
      })),
      ...posts.map((item) => ({
        ...item,
        feedType: "post",
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return res.json({
      success: true,
      data: items,
    });
  } catch (error) {
    console.error("[Student Feed GET] Error:", error);
    return res.status(500).json({ success: false, message: "Failed to load student feed." });
  }
};
