import test from "node:test";
import assert from "node:assert/strict";
import { getProviderLoginOtpStatus } from "../utils/provider-login-otp.js";

const now = new Date("2026-11-01T10:00:00.000Z");
const validRecord = {
  purpose: "provider-login",
  userType: "provider",
  isUsed: false,
  otp: "123456",
  otpExpiry: new Date("2026-11-01T10:10:00.000Z"),
  attempts: 0,
};

test("accepts a correct unexpired provider login code", () => {
  assert.equal(getProviderLoginOtpStatus(validRecord, "123456", now), "valid");
});

test("rejects incorrect, expired, reused, and exhausted codes", () => {
  assert.equal(getProviderLoginOtpStatus(validRecord, "000000", now), "incorrect");
  assert.equal(getProviderLoginOtpStatus({
    ...validRecord,
    otpExpiry: new Date("2026-11-01T09:59:59.000Z"),
  }, "123456", now), "expired");
  assert.equal(getProviderLoginOtpStatus({ ...validRecord, isUsed: true }, "123456", now), "invalid");
  assert.equal(getProviderLoginOtpStatus({ ...validRecord, attempts: 5 }, "123456", now), "locked");
});

test("rejects OTP records created for a different purpose or role", () => {
  assert.equal(getProviderLoginOtpStatus({ ...validRecord, purpose: "registration" }, "123456", now), "invalid");
  assert.equal(getProviderLoginOtpStatus({ ...validRecord, userType: "student" }, "123456", now), "invalid");
});
