import bcrypt from "bcryptjs";
import crypto from "crypto";
import User from "../models/user.model.js";
import { sendOtpEmail, sendPasswordResetEmail } from "../config/email.config.js";

// Simple in-memory OTP store: { [email]: { code, expiresAt } }
const otpStore = new Map();

export const register = async (req, res) => {
  try {
    const { name, email, password, phone, address } = req.body;

    if (!name || !email || !password || !phone || !address) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, message: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      userName: name,
      email,
      phone,
      address,
      passwordHash,
      role: "customer",
    });

    const safeUser = {
      id: user._id.toString(),
      name: user.userName,
      email: user.email,
      phone: user.phone,
      address: user.address,
      role: user.role,
    };

    res.status(201).json({ success: true, user: safeUser });
  } catch (err) {
    res.status(500).json({ success: false, message: "Registration failed" });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
      return res.status(400).json({ success: false, message: "Missing credentials" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    if (user.lockUntil && user.lockUntil > new Date()) {
      const remainingMs = user.lockUntil.getTime() - Date.now();
      const remainingMinutes = Math.ceil(remainingMs / 60000);
      return res.status(423).json({
        success: false,
        message: `Account locked. Try again in ${remainingMinutes} minute(s).`,
      });
    }

    if (role === "admin" && user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Not an admin account" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      user.loginAttempts = (user.loginAttempts || 0) + 1;

      if (user.loginAttempts >= 3) {
        // Lock account for 10 minutes after 3 failed attempts
        user.lockUntil = new Date(Date.now() + 10 * 60 * 1000);
        user.loginAttempts = 0;
      }

      await user.save();

      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    user.loginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    // Generate 6-digit OTP and store with 10-minute expiry
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000;

    otpStore.set(email, { code, expiresAt });

    try {
      await sendOtpEmail(email, code);
    } catch (emailErr) {
      // Clean up OTP on failure to send
      otpStore.delete(email);
      return res.status(500).json({ success: false, message: "Failed to send OTP email" });
    }

    // Do not log in yet; client must verify OTP
    res.json({ success: true, otpRequired: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Login failed" });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const user = await User.findOne({ email });

    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      user.resetPasswordToken = token;
      user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
      await user.save();

      try {
        await sendPasswordResetEmail(email, token);
      } catch (emailErr) {
        return res
          .status(500)
          .json({ success: false, message: "Failed to send reset email" });
      }
    }

    res.json({
      success: true,
      message: "If an account with that email exists, a reset link has been sent.",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to process request" });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;

    if (!email || !token || !newPassword) {
      return res
        .status(400)
        .json({ success: false, message: "Missing reset password data" });
    }

    const user = await User.findOne({
      email,
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired reset link" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    user.passwordHash = passwordHash;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to reset password" });
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const { email, otp, role } = req.body;

    if (!email || !otp || !role) {
      return res.status(400).json({ success: false, message: "Missing OTP data" });
    }

    const entry = otpStore.get(email);
    if (!entry) {
      return res.status(400).json({ success: false, message: "OTP not found or expired" });
    }

    const { code, expiresAt } = entry;

    if (Date.now() > expiresAt) {
      otpStore.delete(email);
      return res.status(400).json({ success: false, message: "OTP expired" });
    }

    if (code !== otp) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    // OTP is valid; consume it
    otpStore.delete(email);

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    if (role === "admin" && user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Not an admin account" });
    }

    const safeUser = {
      id: user._id.toString(),
      name: user.userName,
      email: user.email,
      phone: user.phone,
      address: user.address,
      role: user.role,
    };

    res.json({ success: true, user: safeUser });
  } catch (err) {
    res.status(500).json({ success: false, message: "OTP verification failed" });
  }
};
