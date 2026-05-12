import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

export const sendOtpEmail = async (to, code) => {
  const mailOptions = {
    from: process.env.GMAIL_USER,
    to,
    subject: "Your CraftyNeth OTP Code",
    text: `Your one-time password is ${code}. It will expire in 10 minutes.`,
  };

  await transporter.sendMail(mailOptions);
};

export const sendPasswordResetEmail = async (to, token) => {
  const resetUrl = `${process.env.FRONTEND_BASE_URL || "http://localhost:5173"}/reset-password?token=${encodeURIComponent(
    token
  )}&email=${encodeURIComponent(to)}`;

  const mailOptions = {
    from: process.env.GMAIL_USER,
    to,
    subject: "Reset your CraftyNeth password",
    text: `You requested a password reset. Click the link below to set a new password. This link will expire in 1 hour.\n\n${resetUrl}`,
  };

  await transporter.sendMail(mailOptions);
};
