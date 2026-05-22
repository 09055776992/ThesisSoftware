/**
 * SCHOLAR Email Service
 * Handles OTP emails and welcome emails using nodemailer + Gmail.
 *
 * Setup:
 *   Add to Backend/.env:
 *     EMAIL_USER=your_gmail@gmail.com
 *     EMAIL_PASS=your_gmail_app_password   (16-char App Password, NOT your real password)
 *     EMAIL_FROM=SCHOLAR System <your_gmail@gmail.com>
 *
 *   How to get a Gmail App Password:
 *     1. Google Account → Security → 2-Step Verification (enable it)
 *     2. Google Account → Security → App Passwords
 *     3. Generate password for "Mail"
 *     4. Paste the 16-character code as EMAIL_PASS
 */

import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ---------------------------------------------------------------------------
// Helper: mask email for display  e.g. juan@gmail.com → j**n@gmail.com
// ---------------------------------------------------------------------------
export function maskEmail(email) {
  const [local, domain] = String(email || "").split("@");
  if (!local || !domain) return email;
  if (local.length <= 2) return `${local[0]}*@${domain}`;
  const masked = local[0] + "*".repeat(local.length - 2) + local[local.length - 1];
  return `${masked}@${domain}`;
}

// ---------------------------------------------------------------------------
// OTP login verification email
// ---------------------------------------------------------------------------
export async function sendOTPEmail(email, otp, name) {
  const displayName = String(name || "Scholar").trim();

  const mailOptions = {
    from: process.env.EMAIL_FROM || `SCHOLAR System <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "SCHOLAR — Your Login Verification Code",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;
                  padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">

        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #1d4ed8; margin: 0;">🎓 SCHOLAR</h2>
          <p style="color: #6b7280; margin: 4px 0 0;">Scholarship Management System</p>
        </div>

        <h3 style="color: #111827;">Hello, ${displayName}!</h3>

        <p style="color: #374151;">Your login verification code is:</p>

        <div style="text-align: center; margin: 32px 0;">
          <span style="font-size: 48px; font-weight: bold; letter-spacing: 12px;
                       color: #1d4ed8; background: #eff6ff;
                       padding: 16px 24px; border-radius: 8px;">
            ${otp}
          </span>
        </div>

        <p style="color: #374151;">
          This code will expire in <strong>10 minutes</strong>.
        </p>

        <p style="color: #ef4444; font-size: 14px;">
          ⚠️ Never share this code with anyone.
          SCHOLAR staff will never ask for this code.
        </p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

        <p style="color: #9ca3af; font-size: 12px; text-align: center;">
          If you did not attempt to login, please ignore this email.<br>
          © 2026 SCHOLAR — Quezon City Youth Development Office
        </p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
  console.log(`[Email] OTP sent to ${maskEmail(email)}`);
}

// ---------------------------------------------------------------------------
// Welcome email sent on new student registration
// ---------------------------------------------------------------------------
export async function sendWelcomeEmail(email, name) {
  const displayName = String(name || "Scholar").trim();

  const mailOptions = {
    from: process.env.EMAIL_FROM || `SCHOLAR System <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Welcome to SCHOLAR! 🎓",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #1d4ed8;">🎓 SCHOLAR</h2>
        </div>

        <h2 style="color: #1d4ed8;">Welcome to SCHOLAR, ${displayName}! 🎉</h2>

        <p style="color: #374151;">Your account has been created successfully.</p>

        <p style="color: #374151;">
          SCHOLAR helps Quezon City students find and apply for scholarships
          from the Quezon City Youth Development Office (QCYDO).
        </p>

        <p style="color: #374151;">
          Every time you log in, we will send a verification code to this
          email address to keep your account secure.
        </p>

        <div style="background: #eff6ff; border-radius: 8px; padding: 16px; margin: 24px 0;">
          <p style="color: #1d4ed8; margin: 0; font-weight: bold;">Getting Started</p>
          <ul style="color: #374151; margin: 8px 0 0; padding-left: 20px;">
            <li>Complete your student profile</li>
            <li>Browse available QCYDO scholarships</li>
            <li>Apply to scholarships you qualify for</li>
            <li>Track your application status</li>
          </ul>
        </div>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

        <p style="color: #9ca3af; font-size: 12px; text-align: center;">
          If you did not create this account, please ignore this email.<br>
          © 2026 SCHOLAR — Quezon City Youth Development Office
        </p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
  console.log(`[Email] Welcome email sent to ${maskEmail(email)}`);
}
