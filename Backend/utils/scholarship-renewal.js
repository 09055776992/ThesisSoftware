export function isStudentAwardOwner(application, user) {
  if (!application || !user) return false;
  const userId = String(user._id ?? user.id ?? "");
  const userEmail = String(user.email ?? "").trim().toLowerCase();
  return (
    (userId && String(application.studentId ?? "") === userId) ||
    (userEmail && String(application.studentEmail ?? "").trim().toLowerCase() === userEmail)
  );
}

export function isStudentUser(user) {
  const roles = [user?.role, user?.userType].map((value) => String(value ?? "").trim().toLowerCase());
  return roles.includes("student") ||
    (roles.includes("customer") && !roles.includes("provider") && !roles.includes("admin"));
}

export function canSubmitScholarshipRenewal(application, scholarship, user) {
  return (
    isStudentUser(user) &&
    isStudentAwardOwner(application, user) &&
    application.status === "Approved" &&
    scholarship?.renewalPeriodOpen === true &&
    Number.isInteger(Number(scholarship.renewalPeriodNumber)) &&
    Number(scholarship.renewalPeriodNumber) > 0
  );
}
