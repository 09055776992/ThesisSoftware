import mongoose from "mongoose";
import User from "../models/user.model.js";

/**
 * GET /api/admin/users
 * Fetch all users for admin dashboard
 * Returns users with fields: id, name, email, type (role), status, joinedDate, profileCompleteness
 */
export const getAllUsers = async (req, res) => {
  try {
    // Get all users from raw collection to access every field stored in MongoDB
    const users = await User.collection.find({}).sort({ createdAt: -1 }).toArray();

    // Transform to frontend format
    const transformedUsers = users.map((user) => {
      // Map role to type for frontend (admin can see: student, provider, mentor, admin)
      const roleMap = {
        customer: "Student",
        student: "Student",
        provider: "Provider",
        mentor: "Mentor",
        admin: "Admin",
      };

      return {
        id: user._id.toString(),
        name: user.userName || user.fullName || "",
        email: user.email || "",
        type: roleMap[user.role?.toLowerCase()] || roleMap[user.userType?.toLowerCase()] || "Unknown",
        status: "Active",
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
    });

    res.json({
      success: true,
      count: transformedUsers.length,
      data: transformedUsers,
    });
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ success: false, error: "Failed to fetch users" });
  }
};

/**
 * GET /api/admin/users/stats
 * Get user statistics for dashboard
 */
export const getUserStats = async (req, res) => {
  try {
    const [
      totalUsers,
      studentCount,
      providerCount,
      mentorCount,
      adminCount,
      activeCount,
      newUsersThisMonth,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: { $in: ["customer", "student"] } }),
      User.countDocuments({ role: "provider" }),
      User.countDocuments({ role: "mentor" }),
      User.countDocuments({ role: "admin" }),
      User.countDocuments({ status: { $ne: "suspended" } }), // Assuming no status field, all are active
      User.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      }),
    ]);

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalStudents: studentCount,
        totalProviders: providerCount,
        totalMentors: mentorCount,
        totalAdmins: adminCount,
        activeUsers: activeCount,
        newUsersThisMonth,
      },
    });
  } catch (err) {
    console.error("Error fetching user stats:", err);
    res.status(500).json({ success: false, error: "Failed to fetch statistics" });
  }
};

/**
 * GET /api/admin/users/:id
 * Get a specific user by ID
 */
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.collection.findOne({ _id: new mongoose.Types.ObjectId(id) });

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
      id: user._id.toString(),
      name: user.userName || user.fullName || "",
      email: user.email || "",
      type: roleMap[user.role?.toLowerCase()] || roleMap[user.userType?.toLowerCase()] || "Unknown",
      phone: user.phone || "",
      address: user.address || user.location || "",
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
  } catch (err) {
    console.error("Error fetching user:", err);
    res.status(500).json({ success: false, error: "Failed to fetch user" });
  }
};

/**
 * PATCH /api/admin/users/:id
 * Update a user (suspend, activate, etc.)
 */
export const updateUserAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, role } = req.body;

    const update = {};
    if (status) update.status = status;
    if (role) update.role = role;

    await User.collection.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: update }
    );

    const user = await User.collection.findOne({ _id: new mongoose.Types.ObjectId(id) });

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
      id: user._id.toString(),
      name: user.userName || user.fullName || "",
      email: user.email || "",
      type: roleMap[user.role?.toLowerCase()] || roleMap[user.userType?.toLowerCase()] || "Unknown",
      joinedDate: user.createdAt
        ? new Date(user.createdAt).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : "Unknown",
      profileCompleteness: calculateProfileCompleteness(user),
    };

    res.json({ success: true, data: transformedUser });
  } catch (err) {
    console.error("Error updating user:", err);
    res.status(500).json({ success: false, error: "Failed to update user" });
  }
};

/**
 * Helper function to calculate profile completeness
 * Scoring: 10 fields x 10% each = 100%
 */
function calculateProfileCompleteness(user) {
  const fields = [
    { key: 'fullName', fallback: 'userName', weight: 10 },
    { key: 'email', weight: 10 },
    { key: 'phone', weight: 10 },
    { key: 'location', fallback: 'address', weight: 10 },
    { key: 'about', weight: 10 },
    { key: 'profileImage', fallback: 'avatar', weight: 10 },
    { key: 'skills', weight: 10 },
    { key: 'gpa', fallback: 'gwa', weight: 10 },
    { key: 'fieldOfStudy', fallback: 'course', weight: 10 },
    { key: 'incomeCategory', fallback: 'netWorth', weight: 10 },
  ]
  return fields.reduce((total, field) => {
    const value = user[field.key] ?? user[field.fallback]
    const filled = value !== null &&
      value !== undefined &&
      value !== '' &&
      !(Array.isArray(value) && value.length === 0)
    return total + (filled ? field.weight : 0)
  }, 0)
}
