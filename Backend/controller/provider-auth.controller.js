import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import {
  sendProviderRequestReceivedEmail,
  sendProviderApprovedEmail,
  sendProviderRejectedEmail,
  sendAdminNewProviderRequestEmail,
} from "../services/emailService.js";

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
// Provider submits account request — does NOT log them in.
// Sets isApproved: false, notifies provider + admin.
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

    // Check for duplicate email
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Create provider user with isApproved: false
    const user = await User.create({
      userName: String(fullName).trim(),
      email: normalizedEmail,
      phone: String(phone || "").trim(),
      address: String(organizationName).trim(), // address field reused for org address
      passwordHash,
      role: "provider",
      providerDetails: {
        organizationName: String(organizationName).trim(),
        position: String(position).trim(),
        isApproved: false,
        isActive: true,
        requestedAt: new Date(),
      },
    });

    // Notify the provider that their request was received
    sendProviderRequestReceivedEmail({
      to: normalizedEmail,
      providerName: user.userName,
      organizationName: user.providerDetails.organizationName,
    }).catch((err) =>
      console.error("[Provider Register] Failed to send request received email:", err.message)
    );

    // Notify all admins about the new request
    const admins = await User.find({ role: "admin" }, { email: 1 }).lean();
    for (const admin of admins) {
      sendAdminNewProviderRequestEmail({
        adminEmail: admin.email,
        providerName: user.userName,
        organizationName: user.providerDetails.organizationName,
        position: user.providerDetails.position,
        providerEmail: normalizedEmail,
      }).catch((err) =>
        console.error("[Provider Register] Failed to notify admin:", err.message)
      );
    }

    res.status(201).json({
      success: true,
      pending: true,
      message:
        "Your account request has been submitted. You will receive an email once an administrator reviews your request.",
    });
  } catch (err) {
    console.error("[Provider Register] Error:", err);
    res.status(500).json({ success: false, message: "Registration failed" });
  }
};

// ---------------------------------------------------------------------------
// POST /api/provider/login
// Provider logs in — blocked if not approved or deactivated.
// No OTP for providers (simpler flow, can be added later if needed).
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
      return res.status(401).json({ success: false, message: "Invalid email or password" });
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

    // Block if not yet approved
    if (!user.providerDetails?.isApproved) {
      return res.status(403).json({
        success: false,
        pending: true,
        message:
          "Your account is pending admin approval. You will receive an email once it has been reviewed.",
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

    const token = createProviderToken(user);

    res.json({
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
    });
  } catch (err) {
    console.error("[Provider Login] Error:", err);
    res.status(500).json({ success: false, message: "Login failed" });
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

    if (user.providerDetails?.isApproved) {
      return res.status(400).json({ success: false, message: "Provider is already approved" });
    }

    user.providerDetails.isApproved = true;
    user.providerDetails.isActive = true;
    user.providerDetails.approvedBy = adminId;
    user.providerDetails.approvedAt = new Date();
    user.providerDetails.rejectedAt = null;
    user.providerDetails.rejectionReason = null;
    await user.save();

    // Notify provider
    sendProviderApprovedEmail({
      to: user.email,
      providerName: user.userName,
      organizationName: user.providerDetails.organizationName,
    }).catch((err) =>
      console.error("[Approve Provider] Failed to send approval email:", err.message)
    );

    res.json({
      success: true,
      message: `Provider account for ${user.userName} has been approved.`,
      provider: {
        id: user._id.toString(),
        name: user.userName,
        email: user.email,
        organizationName: user.providerDetails.organizationName,
        isApproved: true,
        approvedAt: user.providerDetails.approvedAt,
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
      // Derived status label for frontend display
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
