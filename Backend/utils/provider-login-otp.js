export function getProviderLoginOtpStatus(record, submittedOtp, now = new Date()) {
  if (
    !record ||
    record.purpose !== "provider-login" ||
    record.userType !== "provider" ||
    record.isUsed !== false
  ) {
    return "invalid";
  }
  if (new Date(record.otpExpiry) <= now) return "expired";
  if ((record.attempts || 0) >= 5) return "locked";
  if (String(record.otp) !== String(submittedOtp).trim()) return "incorrect";
  return "valid";
}
