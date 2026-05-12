/**
 * Comprehensive Full-Stack Test Suite
 * Tests all student and admin functionality together
 * Run this file directly: node comprehensiveTest.js
 */

import "dotenv/config";
import { getDb } from "../db.js";
import { seedQCSPPScholarships } from "../seed-qcsp-scholarships.js";

const API_BASE = "http://localhost:5000";
const ADMIN_EMAIL = "admin@qcsp.gov.ph";
const ADMIN_PASSWORD = "admin123";

// Color codes
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  blue: "\x1b[34m",
  gray: "\x1b[90m"
};

function log(msg, color = "reset") {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function section(title) {
  console.log(`\n${colors.blue}${"═".repeat(80)}${colors.reset}`);
  log(`📋 ${title}`, "blue");
  console.log(`${colors.blue}${"═".repeat(80)}${colors.reset}`);
}

function result(label, passed, details = "") {
  const icon = passed ? "✅" : "❌";
  const color = passed ? "green" : "red";
  log(`${icon} ${label} ${details}`, color);
  return passed;
}

async function api(method, path, body = null, token = null) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const resp = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null
    });
    const data = await resp.json();
    return { status: resp.status, data, ok: resp.ok };
  } catch (e) {
    log(`API Error: ${e.message}`, "red");
    return { status: 0, data: null, ok: false };
  }
}

async function runTests() {
  section("🚀 COMPREHENSIVE FULL-STACK TEST SUITE");
  
  let passed = 0;
  let failed = 0;

  try {
    // Initialize database
    log("Initializing database...", "cyan");
    const db = await getDb();
    await seedQCSPPScholarships();

    // ========================================
    // PART 1: STUDENT WORKFLOWS
    // ========================================
    section("PART 1: STUDENT CORE WORKFLOWS");

    // 1.1 Student Signup
    section("1.1: Student Registration");
    const email1 = `student${Date.now()}@test.com`;
    const pass1 = "Pass123!";
    const { status: s1, data: d1, ok: ok1 } = await api("POST", "/api/auth/signup", {
      email: email1,
      password: pass1,
      userType: "student"
    });
    
    if (result("Register Student", ok1 && s1 === 201)) {
      passed++;
      var token1 = d1.token;
      var sid1 = d1.user?.id || (await db.collection("users").findOne({ email: email1 }))?._id?.toString();
      log(`  Email: ${email1}`, "gray");
    } else {
      failed++;
    }

    // 1.2 Update Profile
    section("1.2: Complete Student Profile");
    const { ok: ok2 } = await api("PUT", "/api/users/profile", {
      email: email1,
      fullName: "Test Scholar",
      location: "Quezon City",
      educationLevel: "College / Undergraduate",
      schoolName: "University of the Philippines",
      schoolLocation: "Quezon City",
      enrolledInQCSchool: true,
      gwa: "2.0",
      incomeCategory: "Low",
      financialNeed: ["Needs financial support"]
    }, token1);

    if (result("Update Profile with GWA", ok2)) {
      passed++;
    } else {
      failed++;
    }

    // 1.3 Get Eligible Scholarships
    section("1.3: View Eligible Scholarships");
    const { status: s3, data: d3, ok: ok3 } = await api("GET", `/api/scholarships?studentEmail=${email1}`);
    const scholCount = d3?.data?.length || 0;
    
    if (result("Fetch Scholarships", ok3 && scholCount > 0, `(Found ${scholCount})`)) {
      passed++;
      var schol1 = d3.data[0];
    } else {
      failed++;
    }

    // 1.4 Save Scholarship
    section("1.4: Student Saves Scholarship");
    const { ok: ok4 } = await api("PUT", `/api/users/${email1}/saved-scholarships`, {
      scholarshipId: schol1?._id?.toString()
    }, token1);

    if (result("Save Scholarship", ok4)) {
      passed++;
    } else {
      failed++;
    }

    // 1.5 Get Saved Scholarships
    section("1.5: Retrieve Saved Scholarships");
    const { data: d5, ok: ok5 } = await api("GET", `/api/users/${email1}/saved-scholarships`, null, token1);
    const savedCount = d5?.data?.length || 0;

    if (result("Get Saved Scholarships", ok5, `(Retrieved ${savedCount})`)) {
      passed++;
    } else {
      failed++;
    }

    // 1.6 Apply for Scholarship
    section("1.6: Submit Scholarship Application");
    const { status: s6, data: d6, ok: ok6 } = await api("POST", "/api/applications", {
      studentId: sid1,
      studentName: "Test Scholar",
      studentEmail: email1,
      scholarshipId: schol1?._id?.toString(),
      scholarshipName: schol1?.name || "Test Scholarship",
      matchScore: 75
    }, token1);

    let appId1 = null;
    if (result("Submit Application", ok6 && s6 === 201)) {
      passed++;
      appId1 = d6?.data?._id || d6?._id;
      log(`  Application ID: ${appId1}`, "gray");
    } else {
      failed++;
    }

    // 1.7 Student Saves Conversation
    section("1.7: Save Conversation");
    const { ok: ok7 } = await api("PUT", `/api/users/${email1}/conversations`, {
      scholarshipId: schol1?._id?.toString(),
      message: "I'm interested in this scholarship"
    }, token1);

    if (result("Save Conversation", ok7)) {
      passed++;
    } else {
      failed++;
    }

    // 1.8 Get Conversations
    section("1.8: Retrieve Conversations");
    const { data: d8, ok: ok8 } = await api("GET", `/api/users/${email1}/conversations`, null, token1);
    const convCount = d8?.data?.length || 0;

    if (result("Get Conversations", ok8, `(Retrieved ${convCount})`)) {
      passed++;
    } else {
      failed++;
    }

    // ========================================
    // PART 2: ADMIN WORKFLOWS
    // ========================================
    section("PART 2: ADMIN WORKFLOWS");

    // 2.1 Create Admin Account
    section("2.1: Admin Authentication");
    const adminExists = await db.collection("users").findOne({ email: ADMIN_EMAIL });
    let adminToken = null;

    if (!adminExists) {
      await api("POST", "/api/auth/admin/signup", {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        userType: "admin"
      });
    }

    const { data: d21, ok: ok21 } = await api("POST", "/api/auth/admin/signin", {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });

    if (result("Admin Signin", ok21)) {
      passed++;
      adminToken = d21.token;
    } else {
      failed++;
    }

    // 2.2 Admin Views All Applications
    section("2.2: Admin Views Applications");
    const { data: d22, ok: ok22 } = await api("GET", "/api/admin/applications", null, adminToken);
    const appCount = d22?.data?.length || 0;

    if (result("Get Applications List", ok22, `(Total: ${appCount})`)) {
      passed++;
    } else {
      failed++;
    }

    // 2.3 Find Student's Application in Admin List
    section("2.3: Verify Student Application in Admin List");
    const studentAppFound = appId1 && d22?.data?.some(a => 
      a._id?.toString() === appId1?.toString()
    );

    if (result("Find Student Application", !!studentAppFound)) {
      passed++;
    } else {
      failed++;
    }

    // 2.4 Admin Views User List
    section("2.4: Admin Views All Users");
    const { data: d24, ok: ok24 } = await api("GET", "/api/admin/users", null, adminToken);
    const userCount = d24?.data?.length || 0;

    if (result("Get Users List", ok24, `(Total: ${userCount})`)) {
      passed++;
    } else {
      failed++;
    }

    // 2.5 Admin Views Specific User
    section("2.5: Admin Views User Details");
    const { data: d25, ok: ok25 } = await api("GET", `/api/admin/users/${sid1}`, null, adminToken);

    if (result("Get User Details", ok25)) {
      passed++;
      log(`  Email: ${d25?.data?.email}`, "gray");
      log(`  GWA: ${d25?.data?.gwa}`, "gray");
    } else {
      failed++;
    }

    // 2.6 Admin Views Statistics
    section("2.6: Admin Views Statistics");
    const { data: d26, ok: ok26 } = await api("GET", "/api/admin/stats", null, adminToken);

    if (result("View Statistics", ok26)) {
      passed++;
      log(`  Total Apps: ${d26?.stats?.totalApplications || 0}`, "gray");
      log(`  Pending: ${d26?.stats?.pending || 0}`, "gray");
    } else {
      failed++;
    }

    // 2.7 Admin Views Scholarships
    section("2.7: Admin Views All Scholarships");
    const { data: d27, ok: ok27 } = await api("GET", "/api/admin/scholarships", null, adminToken);
    const adminScholCount = d27?.data?.length || 0;

    if (result("Get Admin Scholarships", ok27, `(Total: ${adminScholCount})`)) {
      passed++;
    } else {
      failed++;
    }

    // 2.8 Admin Creates Scholarship
    section("2.8: Admin Creates New Scholarship");
    const { data: d28, ok: ok28 } = await api("POST", "/api/admin/scholarships", {
      name: `Test Scholarship ${Date.now()}`,
      description: "Test scholarship",
      amount: 50000,
      deadline: new Date(Date.now() + 90*24*60*60*1000).toISOString(),
      status: "Active",
      minGPA: 2.5
    }, adminToken);

    let newScholId = null;
    if (result("Create Scholarship", ok28)) {
      passed++;
      newScholId = d28?.data?._id || d28?._id;
      log(`  Scholarship ID: ${newScholId}`, "gray");
    } else {
      failed++;
    }

    // 2.9 Admin Updates Scholarship
    section("2.9: Admin Updates Scholarship");
    if (newScholId) {
      const { ok: ok29, data: d29 } = await api("PUT", `/api/admin/scholarships/${newScholId}`, {
        name: `Updated Scholarship ${Date.now()}`,
        amount: 75000
      }, adminToken);

      if (result("Update Scholarship", ok29)) {
        passed++;
      } else {
        failed++;
        log(`  Error: ${d29?.error || "Unknown error"}`, "gray");
        log(`  Details: ${d29?.details || "No details"}`, "gray");
      }
    }

    // ========================================
    // PART 3: MULTI-USER SCENARIOS
    // ========================================
    section("PART 3: MULTI-USER SCENARIOS");

    // 3.1 Second Student
    section("3.1: Second Student Registration");
    const email2 = `student2${Date.now()}@test.com`;
    const { data: d31, ok: ok31 } = await api("POST", "/api/auth/signup", {
      email: email2,
      password: "Pass123!",
      userType: "student"
    });

    let token2 = null;
    let sid2 = null;
    if (result("Register Second Student", ok31)) {
      passed++;
      token2 = d31.token;
      sid2 = d31.user?.id || (await db.collection("users").findOne({ email: email2 }))?._id?.toString();
    } else {
      failed++;
    }

    // 3.2 Second Student Profile
    section("3.2: Second Student Completes Profile");
    const { ok: ok32 } = await api("PUT", "/api/users/profile", {
      email: email2,
      fullName: "Another Scholar",
      location: "Quezon City",
      educationLevel: "High School / Senior High",
      schoolName: "Quezon City National High School",
      schoolLocation: "Quezon City",
      enrolledInQCSchool: true,
      gwa: "89"
    }, token2);

    if (result("Complete Profile", ok32)) {
      passed++;
    } else {
      failed++;
    }

    // 3.3 Second Student Gets Scholarships
    section("3.3: Second Student Gets Eligible Scholarships");
    const { data: d33, ok: ok33 } = await api("GET", `/api/scholarships?studentEmail=${email2}`);
    const schol2Count = d33?.data?.length || 0;

    if (result("Get Scholarships", ok33, `(Found ${schol2Count})`)) {
      passed++;
      var schol2 = d33.data?.[0];
    } else {
      failed++;
    }

    // 3.4 Second Student Applies
    section("3.4: Second Student Applies for Scholarship");
    const { ok: ok34 } = await api("POST", "/api/applications", {
      studentId: sid2,
      studentName: "Another Scholar",
      studentEmail: email2,
      scholarshipId: schol2?._id?.toString(),
      scholarshipName: schol2?.name || "Scholarship",
      matchScore: 85
    }, token2);

    if (result("Submit Application", ok34)) {
      passed++;
    } else {
      failed++;
    }

    // 3.5 Admin Sees Multiple Applications
    section("3.5: Admin Views Updated Application Count");
    const { data: d35, ok: ok35 } = await api("GET", "/api/admin/applications", null, adminToken);
    const finalAppCount = d35?.data?.length || 0;

    if (result("View Applications", ok35, `(Now ${finalAppCount} total)`)) {
      passed++;
    } else {
      failed++;
    }

    // ========================================
    // FINAL REPORT
    // ========================================
    section("📊 FINAL TEST REPORT");

    const total = passed + failed;
    const percentage = Math.round((passed / total) * 100);

    console.log();
    log(`✅ Passed: ${passed}`, "green");
    log(`❌ Failed: ${failed}`, failed > 0 ? "red" : "green");
    log(`Success Rate: ${percentage}% (${passed}/${total})`, percentage === 100 ? "green" : "yellow");

    if (failed === 0) {
      log("\n🎉 ALL TESTS PASSED! System is working correctly.", "green");
      process.exit(0);
    } else {
      log(`\n⚠️  ${failed} test(s) failed. Check output above.`, "yellow");
      process.exit(1);
    }

  } catch (error) {
    log(`Fatal Error: ${error.message}`, "red");
    console.error(error);
    process.exit(1);
  }
}

// Run tests
runTests();
