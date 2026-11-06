const KNOWN_ROLES = new Set(["admin", "provider", "student"]);

export const ADMIN_SIGNIN_REQUIRED_MESSAGE =
  "This is an admin account. Please use the Admin Login page.";

export function resolveAccountRole(account, fallback = "student") {
  const roles = [account?.role, account?.userType]
    .map((role) => String(role || "").trim().toLowerCase())
    .filter(Boolean);

  if (roles.includes("admin")) return "admin";
  if (roles.includes("provider")) return "provider";
  return roles.find((role) => KNOWN_ROLES.has(role)) || fallback;
}

export function getStudentSigninRestriction(account) {
  const accountRole = resolveAccountRole(account);
  if (accountRole === "admin") {
    return {
      status: 403,
      body: { error: ADMIN_SIGNIN_REQUIRED_MESSAGE, accountRole },
    };
  }
  if (accountRole === "provider") {
    return {
      status: 403,
      body: {
        error: "This is a provider account. Please use the Provider Login page.",
        accountRole,
      },
    };
  }
  return null;
}
