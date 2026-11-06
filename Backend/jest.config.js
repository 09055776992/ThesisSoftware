export default {
  testEnvironment: "node",
  transform: {},
  // Only scan tests/ — Backend/test/ uses node:test runner, not Jest
  testMatch: ["**/tests/**/*.test.js"],
};
