/**
 * OTP Utilities
 * Cryptographically secure 6-digit OTP generation.
 */

import crypto from "crypto";

/**
 * Generates a cryptographically secure 6-digit OTP string.
 * Uses crypto.randomInt to avoid Math.random() bias.
 */
export function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Returns a Date 10 minutes from now — the OTP expiry time.
 */
export function getOTPExpiry() {
  return new Date(Date.now() + 10 * 60 * 1000);
}
