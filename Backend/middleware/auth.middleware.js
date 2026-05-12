import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

/**
 * Verify admin role middleware
 * Checks if the request is from an authenticated admin user
 * Expects either:
 * 1. JWT token in Authorization header: "Bearer <token>"
 * 2. adminId in query params or body
 */
export const requireAdmin = async (req, res, next) => {
  try {
    let adminId = null;

    // Check Authorization header for JWT token
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key");
        adminId = decoded.userId || decoded.id;
      } catch (err) {
        // Token verification failed, try other methods
      }
    }

    // Fallback: check query params or body
    if (!adminId) {
      adminId = req.query.adminId || req.body.adminId;
    }

    if (!adminId) {
      return res.status(401).json({ error: "Unauthorized: Missing or invalid credentials" });
    }

    // Verify user exists and has admin role
    const user = await User.findById(adminId).lean();
    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden: Admin access required" });
    }

    // Attach admin info to request for downstream handlers
    req.adminId = adminId;
    req.admin = user;

    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    res.status(500).json({ error: "Authentication check failed" });
  }
};

/**
 * Optional admin check - doesn't fail, just sets admin context if present
 */
export const optionalAdmin = async (req, res, next) => {
  try {
    let adminId = null;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key");
        adminId = decoded.userId || decoded.id;
      } catch (err) {
        // Token verification failed, continue anyway
      }
    }

    if (!adminId) {
      adminId = req.query.adminId || req.body.adminId;
    }

    if (adminId) {
      const user = await User.findById(adminId).lean();
      if (user && user.role === "admin") {
        req.adminId = adminId;
        req.admin = user;
      }
    }

    next();
  } catch (err) {
    // Don't fail, just continue
    next();
  }
};
