import test from "node:test";
import assert from "node:assert/strict";
import {
  canSubmitScholarshipRenewal,
  isStudentAwardOwner,
} from "../utils/scholarship-renewal.js";
import ScholarshipRenewal from "../models/scholarship-renewal.model.js";

const user = {
  _id: "student-123",
  email: "student@example.com",
  role: "student",
};

const approvedApplication = {
  studentId: "student-123",
  studentEmail: "student@example.com",
  status: "Approved",
};

const openScholarship = {
  renewalPeriodOpen: true,
  renewalPeriodNumber: 2,
};

test("allows only an award owner with an approved application during an open renewal period", () => {
  assert.equal(canSubmitScholarshipRenewal(approvedApplication, openScholarship, user), true);
  assert.equal(canSubmitScholarshipRenewal(
    { ...approvedApplication, status: "Pending" },
    openScholarship,
    user,
  ), false);
  assert.equal(canSubmitScholarshipRenewal(
    approvedApplication,
    { ...openScholarship, renewalPeriodOpen: false },
    user,
  ), false);
  assert.equal(canSubmitScholarshipRenewal(
    approvedApplication,
    openScholarship,
    { ...user, role: "provider" },
  ), false);
});

test("matches the awarded student by ID or normalized email", () => {
  assert.equal(isStudentAwardOwner(approvedApplication, user), true);
  assert.equal(isStudentAwardOwner(
    { ...approvedApplication, studentId: "legacy-id", studentEmail: " STUDENT@example.com " },
    user,
  ), true);
  assert.equal(isStudentAwardOwner(
    approvedApplication,
    { ...user, _id: "other-student", email: "other@example.com" },
  ), false);
});

test("renewal records require both supporting documents and keep one active submission per period", () => {
  const validationError = new ScholarshipRenewal({}).validateSync();
  assert.ok(validationError.errors.registrationCard);
  assert.ok(validationError.errors.previousSemesterGrades);
  assert.ok(ScholarshipRenewal.schema.indexes().some(([, options]) =>
    options.unique === true &&
    options.partialFilterExpression?.isCurrent === true
  ));
});
