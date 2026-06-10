import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import { getDb } from "../db.js";

/**
 * Helper: extract userId from JWT Bearer token in Authorization header.
 * Returns null if missing or invalid.
 */
function extractTokenPayload(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    try {
      return jwt.verify(token, process.env.JWT_SECRET || "your-secret-key");
    } catch {
      return null;
    }
  }
  return null;
}

function extractUserIdFromToken(req) {
  const decoded = extractTokenPayload(req);
  if (!decoded) return null;
  return decoded.userId || decoded.id || null;
}

function isAdminAccount(user, decoded) {
  if (decoded && String(decoded.userType || "").toLowerCase() === "admin") {
    return true;
  }
  if (!user) return false;
  const role = String(user.role || "").toLowerCase();
  const userType = String(user.userType || "").toLowerCase();
  return role === "admin" || userType === "admin";
}

/**
 * Helper: find a user by ID checking both the Mongoose 'users' collection
 * and the raw MongoDB 'admins' collection (legacy admin accounts).
 */
async function findUserOrAdmin(userId) {
  // First try Mongoose users collection
  try {
    const user = await User.findById(userId).lean();
    if (user) return user;
  } catch {
    // invalid ObjectId or connection issue — fall through
  }

  // Fallback: check raw admins collection (legacy admin accounts)
  try {
    const { ObjectId } = await import("mongodb");
    const db = await getDb();
    const admin = await db.collection("admins").findOne({
      _id: ObjectId.isValid(userId) ? new ObjectId(String(userId)) : userId,
    });
    if (admin) {
      // Normalize to match user shape
      return { ...admin, role: "admin", _id: admin._id };
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * requireAdmin
 * Allows only users with role === "admin".
 * Accepts JWT Bearer token OR adminId in query/body (legacy fallback).
 */
export const requireAdmin = async (req, res, next) => {
  try {
    const decoded = extractTokenPayload(req);
    let userId = decoded?.userId || decoded?.id || null;

    // Legacy fallback: adminId in query params or body
    if (!userId) {
      userId = req.query?.adminId || req.body?.adminId;
    }

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized: Missing or invalid credentials" });
    }

    const user = await findUserOrAdmin(userId);
    if (!isAdminAccount(user, decoded)) {
      return res.status(403).json({ error: "Forbidden: Admin access required" });
    }

    req.userId = String(userId);
    req.adminId = String(userId);
    req.admin = user;
    req.currentUser = user;

    next();
  } catch (err) {
    console.error("requireAdmin error:", err);
    res.status(500).json({ error: "Authentication check failed" });
  }
};

/**
 * optionalAdmin
 * Doesn't fail — just attaches admin context if a valid admin token is present.
 */
export const optionalAdmin = async (req, res, next) => {
  try {
    let userId = extractUserIdFromToken(req);

    if (!userId) {
      userId = req.query?.adminId || req.body?.adminId;
    }

    if (userId) {
      const user = await findUserOrAdmin(userId);
      if (user && isAdminAccount(user, extractTokenPayload(req))) {
        req.userId = String(userId);
        req.adminId = String(userId);
        req.admin = user;
        req.currentUser = user;
      }
    }

    next();
  } catch {
    next();
  }
};

/**
 * requireProvider
 * Allows only users with role === "provider" AND providerDetails.isApproved === true.
 * Checks both role and userType fields to handle legacy inconsistencies.
 */
export const requireProvider = async (req, res, next) => {
  try {
    const userId = extractUserIdFromToken(req);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized: Missing or invalid credentials" });
    }

    const user = await User.findById(userId).lean();

    // Check both role and userType for backward compatibility
    const isProvider =
      user?.role === "provider" || user?.userType === "provider";

    if (!user || !isProvider) {
      return res.status(403).json({ error: "Forbidden: Provider access required" });
    }

    // Block unapproved providers from accessing protected routes
    if (!user.providerDetails?.isApproved) {
      return res.status(403).json({
        error: "Forbidden: Your provider account is pending admin approval",
        pending: true,
      });
    }

    // Block deactivated providers
    if (user.providerDetails?.isActive === false) {
      return res.status(403).json({
        error: "Forbidden: Your provider account has been deactivated",
        deactivated: true,
      });
    }

    req.userId = String(userId);
    req.providerId = String(userId);
    req.provider = user;
    req.currentUser = user;

    next();
  } catch (err) {
    console.error("requireProvider error:", err);
    res.status(500).json({ error: "Authentication check failed" });
  }
};

/**
 * requireAuth
 * Generic authenticated user check — allows any role (student, admin, provider).
 * Use this for routes that just need a logged-in user regardless of role.
 */
export const requireAuth = async (req, res, next) => {
  try {
    const userId = extractUserIdFromToken(req);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized: Please log in" });
    }

    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(401).json({ error: "Unauthorized: User not found" });
    }

    req.userId = String(userId);
    req.currentUser = user;

    next();
  } catch (err) {
    console.error("requireAuth error:", err);
    res.status(500).json({ error: "Authentication check failed" });
  }
};

/**
 * requireAdminOrProvider
 * Allows both admins and approved providers.
 * Useful for routes that both roles can access (e.g., viewing applications).
 */
export const requireAdminOrProvider = async (req, res, next) => {
  try {
    const decoded = extractTokenPayload(req);
    const userId = decoded?.userId || decoded?.id || null;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized: Missing or invalid credentials" });
    }

    const user = await findUserOrAdmin(userId);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized: User not found" });
    }

    const isAdmin = isAdminAccount(user, decoded);
    const isProvider =
      (user.role === "provider" || user.userType === "provider") &&
      user.providerDetails?.isApproved === true &&
      user.providerDetails?.isActive !== false;

    if (!isAdmin && !isProvider) {
      return res.status(403).json({ error: "Forbidden: Admin or Provider access required" });
    }

    req.userId = String(userId);
    req.currentUser = user;

    if (isAdmin) {
      req.adminId = String(userId);
      req.admin = user;
    }
    if (isProvider) {
      req.providerId = String(userId);
      req.provider = user;
    }

    next();
  } catch (err) {
    console.error("requireAdminOrProvider error:", err);
    res.status(500).json({ error: "Authentication check failed" });
  }
};
