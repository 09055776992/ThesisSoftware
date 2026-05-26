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

const EMAIL_USER = process.env.EMAIL_USER || process.env.GMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS || process.env.GMAIL_PASS;

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
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

// ---------------------------------------------------------------------------
// Screening qualification email - Recorded Video Interview
// ---------------------------------------------------------------------------
export async function sendScreeningEmail({
  to,
  studentName,
  scholarshipName,
  googleDriveLink,
  submissionDeadline,
  dateNotified,
  timeNotified,
  notes,
}) {
  const displayName = String(studentName || "Scholar").trim();
  const scholarship = String(scholarshipName || "the scholarship").trim();
  const driveLink = String(googleDriveLink || "").trim();
  const deadline = String(submissionDeadline || "TBD");
  const notifiedDate = String(dateNotified || "");
  const notifiedTime = String(timeNotified || "");
  const adminNotes = String(notes || "").trim();

  const mailOptions = {
    from: process.env.EMAIL_FROM || `SCHOLAR System <${process.env.EMAIL_USER}>`,
    to,
    subject: `Congratulations! Qualified for Final Screening - ${scholarship}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8fafc;">
        <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="font-size: 32px; margin-bottom: 8px;">🎓</div>
            <h1 style="color: #2563eb; margin: 0; font-size: 28px; font-weight: bold;">SCHOLAR</h1>
            <p style="color: #64748b; margin: 4px 0 0; font-size: 14px;">Scholarship Management System</p>
          </div>

          <!-- Greeting -->
          <h2 style="color: #1e293b; font-size: 20px; margin-bottom: 16px;">
            Hello, ${displayName}!
          </h2>
          
          <p style="color: #334155; line-height: 1.6; margin-bottom: 20px;">
            We are pleased to inform you that you are 
            <strong style="color: #2563eb;">qualified for the Final Screening</strong>
            for the <strong style="color: #2563eb;">${scholarship}</strong>.
          </p>

          <!-- Status Card -->
          <div style="background: linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%); border-radius: 12px; padding: 24px; margin-bottom: 24px; border: 1px solid #dbeafe;">
            <div style="display: flex; align-items: flex-start; gap: 16px;">
              <div style="background: #3b82f6; border-radius: 12px; padding: 16px; flex-shrink: 0;">
                <div style="font-size: 32px;">📹</div>
              </div>
              <div style="flex: 1;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                  <span style="background: #22c55e; color: white; border-radius: 50%; width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; font-size: 14px;">✓</span>
                  <h3 style="color: #1d4ed8; margin: 0; font-size: 18px; font-weight: bold;">Status: Qualified for Final Screening</h3>
                </div>
                <p style="color: #475569; margin: 0; font-size: 14px; line-height: 1.5;">
                  Please continue to monitor your application for updates on the schedule and requirements.
                </p>
              </div>
            </div>
          </div>

          <!-- Details Card -->
          <div style="background: white; border-radius: 12px; padding: 20px; margin-bottom: 24px; border: 1px solid #e2e8f0;">
            
            <!-- Scholarship Program -->
            <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #f1f5f9;">
              <div style="background: #eff6ff; border-radius: 8px; padding: 10px; flex-shrink: 0;">
                <span style="font-size: 20px;">📅</span>
              </div>
              <div>
                <h4 style="color: #1e293b; margin: 0 0 4px 0; font-size: 14px; font-weight: 600;">Scholarship Program</h4>
                <p style="color: #64748b; margin: 0; font-size: 14px;">${scholarship}</p>
              </div>
            </div>

            <!-- Application Status -->
            <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #f1f5f9;">
              <div style="background: #f0fdf4; border-radius: 8px; padding: 10px; flex-shrink: 0;">
                <span style="font-size: 20px;">📋</span>
              </div>
              <div>
                <h4 style="color: #1e293b; margin: 0 0 4px 0; font-size: 14px; font-weight: 600;">Application Status</h4>
                <span style="background: #dbeafe; color: #1d4ed8; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; display: inline-block;">
                  Qualified for Final Screening
                </span>
              </div>
            </div>

            <!-- Date Notified -->
            <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #f1f5f9;">
              <div style="background: #fef3c7; border-radius: 8px; padding: 10px; flex-shrink: 0;">
                <span style="font-size: 20px;">🕐</span>
              </div>
              <div>
                <h4 style="color: #1e293b; margin: 0 0 4px 0; font-size: 14px; font-weight: 600;">Date Notified</h4>
                <p style="color: #64748b; margin: 0; font-size: 14px;">${notifiedDate} • ${notifiedTime}</p>
              </div>
            </div>

            <!-- Video Interview Submission Link -->
            <div style="display: flex; align-items: flex-start; gap: 12px;">
              <div style="background: #ede9fe; border-radius: 8px; padding: 10px; flex-shrink: 0;">
                <span style="font-size: 20px;">🔗</span>
              </div>
              <div style="flex: 1;">
                <h4 style="color: #1e293b; margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">Video Interview Submission Link</h4>
                <a href="${driveLink}" target="_blank" rel="noopener noreferrer" 
                   style="color: #2563eb; text-decoration: none; font-size: 14px; word-break: break-all; display: inline-block; margin-bottom: 8px;">
                  ${driveLink}
                </a>
                <p style="color: #dc2626; margin: 0; font-size: 13px; font-weight: 500;">
                  ⏰ Video Submission Deadline: ${deadline}
                </p>
              </div>
            </div>

          </div>

          ${adminNotes ? `
          <!-- Admin Notes -->
          <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 24px; border-left: 4px solid #3b82f6;">
            <p style="color: #475569; margin: 0; font-size: 14px; font-style: italic;">
              <strong>Additional Instructions:</strong> ${adminNotes}
            </p>
          </div>
          ` : ""}

          <!-- Footer -->
          <div style="text-align: center; padding-top: 24px; border-top: 1px solid #e2e8f0;">
            <p style="color: #64748b; margin: 0 0 8px 0; font-size: 14px;">
              Thank you for your interest and best of luck!
            </p>
            <p style="color: #94a3b8; margin: 0; font-size: 12px;">
              – Scholar Scholarship Management System
            </p>
          </div>

        </div>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
  console.log(`[Email] Screening qualification sent to ${maskEmail(to)}`);
}

// ---------------------------------------------------------------------------
// New scholarship alert email - sent to pre-filtered eligible students
// ---------------------------------------------------------------------------
export async function sendNewScholarshipEmail({
  to,
  studentName,
  scholarshipName,
  amount,
  deadline,
  provider,
  description,
  frontendUrl,
}) {
  const displayName = String(studentName || "Scholar").trim();
  const scholarship = String(scholarshipName || "a new scholarship").trim();
  const providerName = String(provider || "SCHOLAR").trim();
  const desc = String(description || "").trim();
  const baseUrl = String(frontendUrl || process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");

  const formattedAmount = amount
    ? `₱${Number(amount).toLocaleString("en-PH")}`
    : "To be announced";

  const formattedDeadline = deadline
    ? new Date(deadline).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "See details";

  const mailOptions = {
    from: process.env.EMAIL_FROM || `SCHOLAR System <${process.env.EMAIL_USER}>`,
    to,
    subject: `🎓 New Opportunity: You might be a match for ${scholarship}!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8fafc;">
        <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">

          <!-- Header -->
          <div style="text-align: center; margin-bottom: 28px;">
            <div style="font-size: 36px; margin-bottom: 8px;">🎓</div>
            <h1 style="color: #2563eb; margin: 0; font-size: 28px; font-weight: bold;">SCHOLAR</h1>
            <p style="color: #64748b; margin: 4px 0 0; font-size: 14px;">Scholarship Management System</p>
          </div>

          <!-- Headline -->
          <div style="background: linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%); border-radius: 12px; padding: 24px; margin-bottom: 24px; border: 1px solid #dbeafe; text-align: center;">
            <p style="color: #1e293b; font-size: 18px; font-weight: 600; margin: 0 0 8px 0;">
              Hello, ${displayName}!
            </p>
            <p style="color: #334155; font-size: 15px; margin: 0; line-height: 1.6;">
              A new scholarship matching your profile has been posted.
            </p>
          </div>

          <!-- Scholarship Card -->
          <div style="background: white; border-radius: 12px; padding: 24px; margin-bottom: 24px; border: 1px solid #e2e8f0;">

            <!-- Scholarship Name -->
            <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 18px; padding-bottom: 18px; border-bottom: 1px solid #f1f5f9;">
              <div style="background: #eff6ff; border-radius: 8px; padding: 10px; flex-shrink: 0;">
                <span style="font-size: 20px;">🏆</span>
              </div>
              <div>
                <h4 style="color: #64748b; margin: 0 0 4px 0; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Scholarship Program</h4>
                <p style="color: #1e293b; margin: 0; font-size: 16px; font-weight: 700;">${scholarship}</p>
                <p style="color: #64748b; margin: 4px 0 0; font-size: 13px;">by ${providerName}</p>
              </div>
            </div>

            <!-- Award Amount -->
            <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 18px; padding-bottom: 18px; border-bottom: 1px solid #f1f5f9;">
              <div style="background: #f0fdf4; border-radius: 8px; padding: 10px; flex-shrink: 0;">
                <span style="font-size: 20px;">💰</span>
              </div>
              <div>
                <h4 style="color: #64748b; margin: 0 0 4px 0; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Award Amount</h4>
                <p style="color: #16a34a; margin: 0; font-size: 20px; font-weight: 700;">${formattedAmount}</p>
              </div>
            </div>

            <!-- Application Deadline -->
            <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 18px; padding-bottom: 18px; border-bottom: 1px solid #f1f5f9;">
              <div style="background: #fef3c7; border-radius: 8px; padding: 10px; flex-shrink: 0;">
                <span style="font-size: 20px;">📅</span>
              </div>
              <div>
                <h4 style="color: #64748b; margin: 0 0 4px 0; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Application Deadline</h4>
                <p style="color: #dc2626; margin: 0; font-size: 15px; font-weight: 600;">${formattedDeadline}</p>
              </div>
            </div>

            ${desc ? `
            <!-- Description -->
            <div style="display: flex; align-items: flex-start; gap: 12px;">
              <div style="background: #f5f3ff; border-radius: 8px; padding: 10px; flex-shrink: 0;">
                <span style="font-size: 20px;">📋</span>
              </div>
              <div>
                <h4 style="color: #64748b; margin: 0 0 4px 0; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">About This Scholarship</h4>
                <p style="color: #475569; margin: 0; font-size: 14px; line-height: 1.6;">${desc.length > 200 ? desc.substring(0, 200) + "…" : desc}</p>
              </div>
            </div>
            ` : ""}
          </div>

          <!-- CTA Button -->
          <div style="text-align: center; margin-bottom: 28px;">
            <a href="${baseUrl}/scholarships"
               style="display: inline-block; background: #2563eb; color: white; text-decoration: none;
                      padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;
                      letter-spacing: 0.02em;">
              View Details &amp; Apply
            </a>
          </div>

          <!-- Tip -->
          <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 24px; border-left: 4px solid #3b82f6;">
            <p style="color: #475569; margin: 0; font-size: 13px; line-height: 1.5;">
              <strong>💡 Tip:</strong> Log in to SCHOLAR and ensure your profile is complete to maximize your match score and application readiness.
            </p>
          </div>

          <!-- Footer -->
          <div style="text-align: center; padding-top: 24px; border-top: 1px solid #e2e8f0;">
            <p style="color: #64748b; margin: 0 0 8px 0; font-size: 14px;">
              You received this email because your profile matches the preliminary criteria for this scholarship.
            </p>
            <p style="color: #94a3b8; margin: 0; font-size: 12px;">
              © 2026 SCHOLAR — Quezon City Youth Development Office
            </p>
          </div>

        </div>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
  console.log(`[Email] New scholarship alert sent to ${maskEmail(to)}`);
}
