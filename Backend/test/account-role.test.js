import test from "node:test";
import assert from "node:assert/strict";
import {
  ADMIN_SIGNIN_REQUIRED_MESSAGE,
  getStudentSigninRestriction,
  resolveAccountRole,
} from "../utils/account-role.js";

test("admin role is recognized even when userType is absent or conflicting", () => {
  assert.equal(resolveAccountRole({ role: "admin" }), "admin");
  assert.equal(resolveAccountRole({ role: "student", userType: "admin" }), "admin");
  assert.equal(resolveAccountRole({ role: " ADMIN " }), "admin");
});

test("provider accounts remain distinct from student accounts", () => {
  assert.equal(resolveAccountRole({ role: "provider" }), "provider");
  assert.equal(resolveAccountRole({ userType: "provider" }), "provider");
});

test("student and legacy customer records resolve to the student sign-in role", () => {
  assert.equal(resolveAccountRole({ role: "student" }), "student");
  assert.equal(resolveAccountRole({ role: "customer" }), "student");
  assert.equal(resolveAccountRole({ role: "customer", userType: "student" }), "student");
});

test("admin sign-in rejection directs the user to the admin login page", () => {
  assert.match(ADMIN_SIGNIN_REQUIRED_MESSAGE, /Admin Login/i);
  assert.deepEqual(getStudentSigninRestriction({ role: "admin" }), {
    status: 403,
    body: {
      error: ADMIN_SIGNIN_REQUIRED_MESSAGE,
      accountRole: "admin",
    },
  });
});

test("student sign-in restrictions preserve provider handling and allow students", () => {
  assert.deepEqual(getStudentSigninRestriction({ userType: "provider" }), {
    status: 403,
    body: {
      error: "This is a provider account. Please use the Provider Login page.",
      accountRole: "provider",
    },
  });
  assert.equal(getStudentSigninRestriction({ role: "student" }), null);
});
