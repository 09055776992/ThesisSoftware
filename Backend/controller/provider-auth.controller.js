import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import { getDb } from "../db.js";
import { ObjectId } from "mongodb";
import { generateOTP, getOTPExpiry } from "../utils/otpUtils.js";
import { getProviderLoginOtpStatus } from "../utils/provider-login-otp.js";
import {
  sendProviderRequestReceivedEmail,
  sendProviderApprovedEmail,
  sendProviderRejectedEmail,
  sendAdminNewProviderRequestEmail,
  sendOTPEmail,
} from "../services/emailService.js";

async function insertProviderStatusNotification(user, title, message) {
  const db = await getDb();
  await db.collection("notifications").insertOne({
    userEmail: String(user.email).trim().toLowerCase(),
    userId: String(user._id),
    userRole: "provider",
    type: "provider_status",
    title,
    message,
    read: false,
    is_read: false,
    createdAt: new Date(),
  });
}

// ---------------------------------------------------------------------------
// Helper: create a signed JWT for a provider
// ---------------------------------------------------------------------------
function createProviderToken(user) {
  return jwt.sign(
    {
      userId: String(user._id),
      email: String(user.email).toLowerCase(),
      userType: "provider",
      role: "provider",
    },
    process.env.JWT_SECRET || "your-secret-key",
    { expiresIn: "7d" }
  );
}

// ---------------------------------------------------------------------------
// POST /api/provider/register
// Provider submits account request — does NOT log them in or require OTP.
// Sets isApproved: false and notifies provider + admin.
// ---------------------------------------------------------------------------
export const registerProvider = async (req, res) => {
  try {
    const { fullName, email, password, phone, organizationName, position } = req.body;

    // Validate required fields
    if (!fullName || !email || !password || !organizationName || !position) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: fullName, email, password, organizationName, position",
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Check globally — both confirmed users AND pending student signups
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "An account with this email address already exists.",
      });
    }
    // Also check pending student signups (not yet verified)
    const db = await getDb();
    const pendingStudent = await db.collection("pendingSignups").findOne({ email: normalizedEmail });
    if (pendingStudent) {
      return res.status(400).json({
        success: false,
        message: "An account with this email address already exists.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Provider email is verified as part of the sign-in OTP after approval.
    const user = await User.create({
      userName: String(fullName).trim(),
      email: normalizedEmail,
      phone: String(phone || "").trim(),
      address: String(organizationName).trim(),
      passwordHash,
      role: "provider",
      providerDetails: {
        organizationName: String(organizationName).trim(),
        position: String(position).trim(),
        isApproved: false,
        isActive: true,
        isEmailVerified: false,
        requestedAt: new Date(),
        credentials: Array.isArray(req.body.credentialFiles) ? req.body.credentialFiles : [],
      },
    });

    // Explicitly write credentials via raw driver to guarantee they are
    // persisted even if a future schema change would strip them.
    const credentialFiles = Array.isArray(req.body.credentialFiles) ? req.body.credentialFiles : [];
    if (credentialFiles.length > 0) {
      await User.collection.updateOne(
        { _id: user._id },
        { $set: { "providerDetails.credentials": credentialFiles } }
      );
    }

    void Promise.all([
      sendProviderRequestReceivedEmail({
        to: user.email,
        providerName: user.userName,
        organizationName: user.providerDetails?.organizationName || "",
      }),
      User.find({ role: "admin" }, { email: 1 }).lean().then((admins) =>
        Promise.all(admins.map((admin) => sendAdminNewProviderRequestEmail({
          adminEmail: admin.email,
          providerName: user.userName,
          organizationName: user.providerDetails?.organizationName || "",
          position: user.providerDetails?.position || "",
          providerEmail: user.email,
        }))),
      ),
    ]).catch((err) => console.error("[Provider Register] Request notification failed:", err));

    res.status(201).json({
      success: true,
      providerId: String(user._id),
      pending: true,
      message: "Your provider account request has been submitted for admin review. You can sign in after it is approved.",
    });
  } catch (err) {
    console.error("[Provider Register] Error:", err);
    res.status(500).json({ success: false, message: "Registration failed" });
  }
};

// ---------------------------------------------------------------------------
// POST /api/provider/login
// Provider logs in — blocked if not approved or deactivated.
// Approved providers must also complete email OTP verification.
// ---------------------------------------------------------------------------
export const loginProvider = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "This email is not registered as a provider. Please check the email or create a provider account.",
      });
    }

    // Must be a provider account
    const isProvider = user.role === "provider" || user.userType === "provider";
    if (!isProvider) {
      return res.status(403).json({ success: false, message: "Not a provider account" });
    }

    // Check account lock
    if (user.lockUntil && user.lockUntil > new Date()) {
      const remainingMs = user.lockUntil.getTime() - Date.now();
      const remainingMinutes = Math.ceil(remainingMs / 60000);
      return res.status(423).json({
        success: false,
        message: `Account locked. Try again in ${remainingMinutes} minute(s).`,
      });
    }

    // Verify password
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      user.loginAttempts = (user.loginAttempts || 0) + 1;
      if (user.loginAttempts >= 3) {
        user.lockUntil = new Date(Date.now() + 10 * 60 * 1000);
        user.loginAttempts = 0;
      }
      await user.save();
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    // Reset login attempts on success
    user.loginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    // Auto-heal legacy accounts: if admin already approved this provider but
    // isEmailVerified was never set (registered before OTP feature), mark it now.
    if (user.providerDetails?.isApproved && !user.providerDetails?.isEmailVerified) {
      await User.findByIdAndUpdate(user._id, {
        $set: { "providerDetails.isEmailVerified": true },
      });
      // Refresh the in-memory object so downstream checks see the updated value
      user.providerDetails.isEmailVerified = true;
    }

    // Block if not yet approved by admin
    if (!user.providerDetails?.isApproved) {
      return res.status(403).json({
        success: false,
        pending: true,
        message: "Your account is pending admin approval. You will receive an email once it has been reviewed.",
      });
    }

    // Block if deactivated
    if (user.providerDetails?.isActive === false) {
      return res.status(403).json({
        success: false,
        deactivated: true,
        message: "Your provider account has been deactivated. Please contact the administrator.",
      });
    }

    const db = await getDb();
    const providerId = new ObjectId(String(user._id));
    const recentOtp = await db.collection("otps").findOne({
      userId: { $in: [providerId, String(user._id)] },
      purpose: "provider-login",
      isUsed: false,
      otpExpiry: { $gt: new Date() },
      createdAt: { $gt: new Date(Date.now() - 60 * 1000) },
    });
    if (recentOtp) {
      return res.json({
        success: true,
        requiresOTP: true,
        userId: String(user._id),
        maskedEmail: normalizedEmail.replace(/(.{2})(.*)(@.*)/, "$1***$3"),
        message: "A sign-in code was recently sent. Please check your email.",
      });
    }

    await db.collection("otps").deleteMany({
      userId: { $in: [providerId, String(user._id)] },
      purpose: "provider-login",
      isUsed: false,
    });

    const otp = generateOTP();
    const createdAt = new Date();
    await db.collection("otps").insertOne({
      userId: providerId,
      email: user.email,
      otp,
      otpExpiry: getOTPExpiry(),
      isUsed: false,
      attempts: 0,
      purpose: "provider-login",
      userType: "provider",
      createdAt,
    });

    sendOTPEmail(user.email, otp, user.userName || user.email)
      .catch((err) => console.error("[Provider Login] OTP email failed:", err.message));

    res.json({
      success: true,
      requiresOTP: true,
      userId: String(user._id),
      maskedEmail: normalizedEmail.replace(/(.{2})(.*)(@.*)/, "$1***$3"),
      message: "A 6-digit sign-in code has been sent to your email.",
    });
  } catch (err) {
    console.error("[Provider Login] Error:", err);
    res.status(500).json({ success: false, message: "Login failed" });
  }
};

function providerLoginResponse(user) {
  const token = createProviderToken(user);
  return {
    success: true,
    token,
    user: {
      id: user._id.toString(),
      name: user.userName,
      email: user.email,
      role: "provider",
      userType: "provider",
      organizationName: user.providerDetails?.organizationName || "",
      position: user.providerDetails?.position || "",
    },
  };
}

export const verifyProviderLoginOtp = async (req, res) => {
  let stage = "validating request";
  try {
    const { userId, otp } = req.body ?? {};
    if (!userId || !otp) {
      return res.status(400).json({ success: false, message: "userId and otp are required." });
    }
    if (!ObjectId.isValid(String(userId))) {
      return res.status(400).json({ success: false, message: "Invalid provider ID." });
    }

    stage = "loading OTP record";
    const db = await getDb();
    const providerId = new ObjectId(String(userId));
    const otpRecord = await db.collection("otps").findOne({
      userId: { $in: [providerId, String(userId)] },
      purpose: "provider-login",
      userType: "provider",
      isUsed: false,
    });
    if (!otpRecord) {
      return res.status(400).json({ success: false, message: "Sign-in code expired or not found. Please sign in again." });
    }
    stage = "validating OTP";
    const submittedOtp = String(otp).trim();
    const otpStatus = getProviderLoginOtpStatus(otpRecord, submittedOtp);
    if (otpStatus === "expired") {
      await db.collection("otps").deleteOne({ _id: otpRecord._id });
      return res.status(400).json({ success: false, message: "Sign-in code expired. Please sign in again." });
    }
    if (otpStatus === "locked") {
      await db.collection("otps").deleteOne({ _id: otpRecord._id });
      return res.status(429).json({ success: false, message: "Too many incorrect attempts. Please sign in again." });
    }
    if (otpStatus === "incorrect") {
      await db.collection("otps").updateOne(
        { _id: otpRecord._id, isUsed: false },
        { $inc: { attempts: 1 } },
      );
      return res.status(400).json({ success: false, message: "Invalid verification code." });
    }
    if (otpStatus !== "valid") {
      return res.status(400).json({ success: false, message: "Sign-in code expired or not found. Please sign in again." });
    }

    stage = "loading provider account";
    const user = await User.findById(String(userId)).lean();
    if (!user || (user.role !== "provider" && user.userType !== "provider")) {
      return res.status(403).json({ success: false, message: "Provider account not found." });
    }
    if (!user.providerDetails?.isApproved) {
      return res.status(403).json({
        success: false,
        pending: true,
        message: "Your account is pending admin approval. You will receive an email once it has been reviewed.",
      });
    }
    if (user.providerDetails?.isActive === false) {
      return res.status(403).json({
        success: false,
        deactivated: true,
        message: "Your provider account has been deactivated. Please contact the administrator.",
      });
    }

    stage = "creating provider session";
    const loginResponse = providerLoginResponse(user);

    stage = "consuming OTP";
    const consumed = await db.collection("otps").updateOne(
      {
        _id: otpRecord._id,
        isUsed: false,
        otp: submittedOtp,
        otpExpiry: { $gt: new Date() },
        attempts: { $lt: 5 },
      },
      { $set: { isUsed: true, usedAt: new Date() } },
    );
    if (consumed.modifiedCount !== 1) {
      return res.status(400).json({ success: false, message: "Sign-in code is no longer valid. Please sign in again." });
    }

    return res.json(loginResponse);
  } catch (err) {
    console.error(`[Provider Login OTP] Verification error while ${stage}:`, err);
    return res.status(500).json({
      success: false,
      message: "Failed to verify sign-in code.",
      stage,
    });
  }
};

export const resendProviderLoginOtp = async (req, res) => {
  try {
    const { userId } = req.body ?? {};
    if (!userId || !ObjectId.isValid(String(userId))) {
      return res.status(400).json({ success: false, message: "A valid provider ID is required." });
    }

    const provider = await User.findById(userId).lean();
    if (!provider || (provider.role !== "provider" && provider.userType !== "provider")) {
      return res.status(404).json({ success: false, message: "Provider not found." });
    }
    if (!provider.providerDetails?.isApproved || provider.providerDetails?.isActive === false) {
      return res.status(403).json({ success: false, message: "This provider account cannot sign in." });
    }

    const db = await getDb();
    const providerId = new ObjectId(String(provider._id));
    const recentOtp = await db.collection("otps").findOne({
      userId: { $in: [providerId, String(provider._id)] },
      purpose: "provider-login",
      createdAt: { $gt: new Date(Date.now() - 60 * 1000) },
    });
    if (recentOtp) {
      return res.status(429).json({ success: false, message: "Please wait 60 seconds before requesting another code." });
    }

    await db.collection("otps").deleteMany({
      userId: { $in: [providerId, String(provider._id)] },
      purpose: "provider-login",
      isUsed: false,
    });
    const otp = generateOTP();
    await db.collection("otps").insertOne({
      userId: providerId,
      email: provider.email,
      otp,
      otpExpiry: getOTPExpiry(),
      isUsed: false,
      attempts: 0,
      purpose: "provider-login",
      userType: "provider",
      createdAt: new Date(),
    });
    sendOTPEmail(provider.email, otp, provider.userName || provider.email)
      .catch((err) => console.error("[Provider Login] Resend OTP email failed:", err.message));

    return res.json({
      success: true,
      message: "A new sign-in code has been sent to your email.",
      maskedEmail: provider.email.replace(/(.{2})(.*)(@.*)/, "$1***$3"),
    });
  } catch (err) {
    console.error("[Provider Login OTP] Resend error:", err);
    return res.status(500).json({ success: false, message: "Failed to resend sign-in code." });
  }
};

// ---------------------------------------------------------------------------
// GET /api/provider/me
// Returns the current provider's profile. Requires requireProvider middleware.
// ---------------------------------------------------------------------------
export const getProviderProfile = async (req, res) => {
  try {
    const user = req.currentUser;

    res.json({
      success: true,
      user: {
        id: user._id.toString(),
        name: user.userName,
        email: user.email,
        role: "provider",
        userType: "provider",
        organizationName: user.providerDetails?.organizationName || "",
        position: user.providerDetails?.position || "",
        isApproved: user.providerDetails?.isApproved || false,
        isActive: user.providerDetails?.isActive !== false,
        approvedAt: user.providerDetails?.approvedAt || null,
        requestedAt: user.providerDetails?.requestedAt || null,
      },
    });
  } catch (err) {
    console.error("[Provider Profile] Error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch profile" });
  }
};

// ---------------------------------------------------------------------------
// PATCH /api/admin/providers/:id/approve
// Admin approves a provider account. Requires requireAdmin middleware.
// ---------------------------------------------------------------------------
export const approveProvider = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.adminId;

    const user = await User.findById(id);
    if (!user || user.role !== "provider") {
      return res.status(404).json({ success: false, message: "Provider not found" });
    }

    if (user.providerDetails?.isApproved && !user.providerDetails?.rejectedAt) {
      return res.status(400).json({ success: false, message: "Provider is already approved" });
    }

    await User.findByIdAndUpdate(
      id,
      {
        $set: {
          "providerDetails.isApproved": true,
          "providerDetails.isActive": true,
          "providerDetails.isEmailVerified": true,
          "providerDetails.approvedBy": adminId,
          "providerDetails.approvedAt": new Date(),
          "providerDetails.rejectedAt": null,
          "providerDetails.rejectionReason": null,
          "providerDetails.deactivatedAt": null,
        },
      },
      { new: true },
    );

    const updated = await User.findById(id);
    await insertProviderStatusNotification(
      user,
      "Provider Account Approved",
      "Your provider account has been approved. You can now access your provider dashboard.",
    );

    // Notify provider
    sendProviderApprovedEmail({
      to: user.email,
      providerName: user.userName,
      organizationName: user.providerDetails?.organizationName || "",
    }).catch((err) =>
      console.error("[Approve Provider] Failed to send approval email:", err.message)
    );

    res.json({
      success: true,
      message: `Provider account for ${user.userName} has been approved.`,
      provider: {
        id: updated._id.toString(),
        name: updated.userName,
        email: updated.email,
        organizationName: updated.providerDetails?.organizationName || "",
        isApproved: true,
        approvedAt: updated.providerDetails?.approvedAt,
      },
    });
  } catch (err) {
    console.error("[Approve Provider] Error:", err);
    res.status(500).json({ success: false, message: "Failed to approve provider" });
  }
};

// ---------------------------------------------------------------------------
// PATCH /api/admin/providers/:id/reject
// Admin rejects a provider account. Requires requireAdmin middleware.
// ---------------------------------------------------------------------------
export const rejectProvider = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const user = await User.findById(id);
    if (!user || user.role !== "provider") {
      return res.status(404).json({ success: false, message: "Provider not found" });
    }

    user.providerDetails.isApproved = false;
    user.providerDetails.rejectedAt = new Date();
    user.providerDetails.rejectionReason = String(reason || "").trim() || null;
    await user.save();
    await insertProviderStatusNotification(
      user,
      "Provider Account Update",
      user.providerDetails.rejectionReason
        ? `Your provider account request was rejected. Reason: ${user.providerDetails.rejectionReason}`
        : "Your provider account request was rejected.",
    );

    // Notify provider
    sendProviderRejectedEmail({
      to: user.email,
      providerName: user.userName,
      organizationName: user.providerDetails.organizationName,
      reason: user.providerDetails.rejectionReason,
    }).catch((err) =>
      console.error("[Reject Provider] Failed to send rejection email:", err.message)
    );

    res.json({
      success: true,
      message: `Provider account for ${user.userName} has been rejected.`,
    });
  } catch (err) {
    console.error("[Reject Provider] Error:", err);
    res.status(500).json({ success: false, message: "Failed to reject provider" });
  }
};

// ---------------------------------------------------------------------------
// PATCH /api/admin/providers/:id/deactivate
// Admin deactivates an active provider. Requires requireAdmin middleware.
// ---------------------------------------------------------------------------
export const deactivateProvider = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user || user.role !== "provider") {
      return res.status(404).json({ success: false, message: "Provider not found" });
    }

    user.providerDetails.isActive = false;
    user.providerDetails.deactivatedAt = new Date();
    await user.save();
    await insertProviderStatusNotification(
      user,
      "Provider Account Deactivated",
      "Your provider account has been deactivated. Contact support if you believe this is an error.",
    );

    res.json({
      success: true,
      message: `Provider account for ${user.userName} has been deactivated.`,
    });
  } catch (err) {
    console.error("[Deactivate Provider] Error:", err);
    res.status(500).json({ success: false, message: "Failed to deactivate provider" });
  }
};

// ---------------------------------------------------------------------------
// PATCH /api/admin/providers/:id/reactivate
// Admin reactivates a deactivated provider. Requires requireAdmin middleware.
// ---------------------------------------------------------------------------
export const reactivateProvider = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user || user.role !== "provider") {
      return res.status(404).json({ success: false, message: "Provider not found" });
    }

    user.providerDetails.isActive = true;
    user.providerDetails.deactivatedAt = null;
    await user.save();
    await insertProviderStatusNotification(
      user,
      "Provider Account Reactivated",
      "Your provider account has been reactivated.",
    );

    res.json({
      success: true,
      message: `Provider account for ${user.userName} has been reactivated.`,
    });
  } catch (err) {
    console.error("[Reactivate Provider] Error:", err);
    res.status(500).json({ success: false, message: "Failed to reactivate provider" });
  }
};

// ---------------------------------------------------------------------------
// GET /api/admin/providers
// Admin gets all provider accounts (pending, approved, rejected, deactivated).
// Requires requireAdmin middleware.
// ---------------------------------------------------------------------------
export const getAllProviders = async (req, res) => {
  try {
    const { status } = req.query;

    let filter = { role: "provider" };

    // Optional status filter
    if (status === "pending") {
      filter["providerDetails.isApproved"] = false;
      filter["providerDetails.rejectedAt"] = null;
    } else if (status === "approved") {
      filter["providerDetails.isApproved"] = true;
      filter["providerDetails.isActive"] = true;
    } else if (status === "rejected") {
      filter["providerDetails.isApproved"] = false;
      filter["providerDetails.rejectedAt"] = { $ne: null };
    } else if (status === "deactivated") {
      filter["providerDetails.isActive"] = false;
    }

    const providers = await User.find(filter)
      .select("-passwordHash -resetPasswordToken -resetPasswordExpires")
      .sort({ createdAt: -1 })
      .lean();

    const transformed = providers.map((p) => ({
      id: p._id.toString(),
      name: p.userName,
      email: p.email,
      phone: p.phone || "",
      organizationName: p.providerDetails?.organizationName || "",
      position: p.providerDetails?.position || "",
      isApproved: p.providerDetails?.isApproved || false,
      isActive: p.providerDetails?.isActive !== false,
      approvedAt: p.providerDetails?.approvedAt || null,
      rejectedAt: p.providerDetails?.rejectedAt || null,
      rejectionReason: p.providerDetails?.rejectionReason || null,
      requestedAt: p.providerDetails?.requestedAt || p.createdAt,
      deactivatedAt: p.providerDetails?.deactivatedAt || null,
      credentialCount: (p.providerDetails?.credentials || []).length,
      statusLabel: (() => {
        if (p.providerDetails?.isActive === false) return "Deactivated";
        if (p.providerDetails?.isApproved) return "Active";
        if (p.providerDetails?.rejectedAt) return "Rejected";
        return "Pending";
      })(),
    }));

    res.json({
      success: true,
      count: transformed.length,
      data: transformed,
    });
  } catch (err) {
    console.error("[Get Providers] Error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch providers" });
  }
};
