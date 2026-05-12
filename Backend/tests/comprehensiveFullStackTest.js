import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, "../.env");

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach(line => {
    const [key, ...value] = line.split("=");
    if (key && !process.env[key]) {
      process.env[key] = value.join("=").trim();
    }
  });
}

// Set test database
process.env.MONGODB_DB = "thesis_software_test";

const { getDb } = await import("../db.js");
const { seedQCSPPScholarships } = await import("../seed-qcsp-scholarships.js");

const API_BASE = "http://localhost:5001";
const ADMIN_EMAIL = "admin@qcsp.gov.ph";
const ADMIN_PASSWORD = "admin123";

// Color codes for terminal output
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

function printSection(title) {
  console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  log(`📋 ${title}`, "blue");
  console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
}

function printResult(label, status, details = "") {
  const icon = status ? "✅" : "❌";
  const color = status ? "green" : "red";
  log(`${icon} [${label}] ${details}`, color);
  return status;
}

async function apiCall(method, path, body = null, token = null) {
  const headers = {
    "Content-Type": "application/json"
  };
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const options = {
    method,
    headers
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${API_BASE}${path}`, options);
    const data = await response.json();
    return { response, data };
  } catch (error) {
    console.error(`API Error on ${method} ${path}:`, error.message);
    return { response: null, data: null, error };
  }
}

async function waitForServer() {
  let attempts = 0;
  const maxAttempts = 30;
  
  while (attempts < maxAttempts) {
    try {
      const response = await fetch(`${API_BASE}/health`);
      if (response.ok) {
        log("✅ Server is ready", "green");
        return true;
      }
    } catch (e) {
      // Server not ready yet
    }
    
    attempts++;
    await new Promise(r => setTimeout(r, 500));
  }
  
  throw new Error("Server failed to become ready");
}

async function startServer() {
  return new Promise((resolve, reject) => {
    const server = spawn("node", ["./Backend/index.js"], {
      cwd: process.cwd(),
      env: { 
        ...process.env, 
        MONGODB_DB: "thesis_software_test",
        DOTENV_CONFIG_PATH: "Backend/.env"
      }
    });

    let isReady = false;

    server.stdout.on("data", (data) => {
      const output = data.toString();
      if (output.includes("listening on") || output.includes("5001")) {
        if (!isReady) {
          isReady = true;
          setTimeout(() => resolve(server), 1500);
        }
      }
    });

    server.stderr.on("data", (data) => {
      const output = data.toString();
      if (!output.includes("DeprecationWarning")) {
        // Only log non-deprecation errors
      }
    });

    server.on("error", reject);

    // Timeout if server doesn't start
    setTimeout(() => {
      if (!isReady) {
        reject(new Error("Server failed to start within 15 seconds"));
      }
    }, 15000);
  });
}

// ============================================================================
// COMPREHENSIVE TEST SUITE
// ============================================================================

async function runFullTest() {
  printSection("🚀 STARTING COMPREHENSIVE FULL-STACK TEST");
  
  // Start server
  log("Starting backend server...", "cyan");
  const server = await startServer();
  
  try {
    // Wait for server to be fully ready
    log("Waiting for server to be ready...", "cyan");
    await waitForServer();

    // Initialize database
    log("Initializing database...", "cyan");
    const db = await getDb();
    
    // Seed scholarships
    log("Seeding QCSP scholarships...", "cyan");
    await seedQCSPPScholarships();

    // Test counters
    let passCount = 0;
    let failCount = 0;

    // ====================================================================
    // PART 1: STUDENT WORKFLOWS
    // ====================================================================
    printSection("PART 1: STUDENT WORKFLOWS");

    // 1.1 Student Signup
    printSection("1.1: Student Registration");
    const studentEmail = `student+${Date.now()}@example.com`;
    const studentPassword = "Pass123!";
    const { response: signupRes, data: signupData } = await apiCall("POST", "/api/auth/signup", {
      email: studentEmail,
      password: studentPassword,
      userType: "student"
    });
    
    if (printResult("Student Signup", signupRes?.status === 201)) {
      passCount++;
      var studentToken = signupData.token;
      var studentId = signupData.user?.id || (await db.collection("users").findOne({ email: studentEmail }))._id.toString();
      log(`  Student Email: ${studentEmail}`, "gray");
      log(`  Student ID: ${studentId}`, "gray");
    } else {
      failCount++;
    }

    // 1.2 Student Profile Setup
    printSection("1.2: Student Profile Setup");
    const { response: profileRes } = await apiCall("PUT", "/api/users/profile", {
      email: studentEmail,
      fullName: "Test Scholar",
      phone: "09170000001",
      location: "Quezon City",
      educationLevel: "College / Undergraduate",
      schoolName: "University of the Philippines",
      schoolLocation: "Quezon City",
      enrolledInQCSchool: true,
      gwa: "2.0",
      incomeCategory: "Low",
      financialNeed: ["Needs financial support"]
    }, studentToken);

    printResult("Profile Update", profileRes?.status === 200, "GWA, education, and school fields");
    if (profileRes?.status === 200) passCount++; else failCount++;

    // 1.3 View Scholarships with Eligibility
    printSection("1.3: Student Views Eligible Scholarships");
    const { response: scholRes, data: scholData } = await apiCall("GET", `/api/scholarships?studentEmail=${studentEmail}`);
    
    const scholarshipCount = scholData?.data?.length || 0;
    if (printResult("Fetch Scholarships", scholRes?.status === 200, `Found ${scholarshipCount} eligible scholarships`)) {
      passCount++;
      var scholarshipToApplyFor = scholData.data?.[0];
    } else {
      failCount++;
    }

    // 1.4 Save Scholarship
    printSection("1.4: Student Saves Scholarship");
    if (scholarshipToApplyFor) {
      const { response: saveRes } = await apiCall("PUT", `/api/users/${studentEmail}/saved-scholarships`, {
        scholarshipId: scholarshipToApplyFor._id.toString()
      }, studentToken);

      printResult("Save Scholarship", saveRes?.status === 200, scholarshipToApplyFor.name);
      if (saveRes?.status === 200) passCount++; else failCount++;

      // 1.5 Retrieve Saved Scholarships
      printSection("1.5: Student Retrieves Saved Scholarships");
      const { response: getSavedRes, data: getSavedData } = await apiCall("GET", `/api/users/${studentEmail}/saved-scholarships`, null, studentToken);
      
      const savedCount = getSavedData?.data?.length || 0;
      printResult("Get Saved Scholarships", getSavedRes?.status === 200, `Retrieved ${savedCount} saved scholarships`);
      if (getSavedRes?.status === 200) passCount++; else failCount++;
    }

    // 1.6 Apply for Scholarship
    printSection("1.6: Student Applies for Scholarship");
    const { response: applyRes, data: applyData } = await apiCall("POST", "/api/applications", {
      studentId,
      studentName: "Test Scholar",
      studentEmail,
      scholarshipId: scholarshipToApplyFor._id.toString(),
      scholarshipName: scholarshipToApplyFor.name,
      matchScore: 75
    }, studentToken);

    let applicationId = null;
    if (printResult("Submit Application", applyRes?.status === 201, scholarshipToApplyFor.name)) {
      passCount++;
      applicationId = applyData._id;
      log(`  Application ID: ${applicationId}`, "gray");
    } else {
      failCount++;
    }

    // ====================================================================
    // PART 2: ADMIN WORKFLOWS
    // ====================================================================
    printSection("PART 2: ADMIN WORKFLOWS");

    // 2.1 Admin Signin
    printSection("2.1: Admin Authentication");
    
    // First create admin account if not exists
    const adminUser = await db.collection("users").findOne({ email: ADMIN_EMAIL });
    let adminToken = null;

    if (!adminUser) {
      const { data: adminSignupData } = await apiCall("POST", "/api/auth/admin/signup", {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        userType: "admin"
      });
      adminToken = adminSignupData?.token;
      printResult("Admin Account Created", adminToken !== null);
    }

    const { response: adminSigninRes, data: adminSigninData } = await apiCall("POST", "/api/auth/admin/signin", {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });

    if (printResult("Admin Signin", adminSigninRes?.status === 200)) {
      passCount++;
      adminToken = adminSigninData.token;
    } else {
      failCount++;
    }

    // 2.2 Admin Views All Applications
    printSection("2.2: Admin Views All Applications");
    const { response: appsRes, data: appsData } = await apiCall("GET", "/api/admin/applications", null, adminToken);
    
    const appCount = appsData?.data?.length || 0;
    if (printResult("Get Applications List", appsRes?.status === 200, `Retrieved ${appCount} total applications`)) {
      passCount++;
    } else {
      failCount++;
    }

    // 2.3 Verify Student's Application in Admin List
    printSection("2.3: Admin Verifies Student's Application");
    let studentAppInList = false;
    if (applicationId && appsData?.data) {
      studentAppInList = appsData.data.some(app => 
        app._id?.toString() === applicationId.toString()
      );
    }

    if (printResult("Find Student Application", studentAppInList, "Application visible in admin list")) {
      passCount++;
    } else {
      failCount++;
    }

    // 2.4 Admin Views Application Details
    printSection("2.4: Admin Views Specific Application");
    if (applicationId) {
      const appDetail = appsData?.data?.find(a => a._id?.toString() === applicationId.toString());
      if (appDetail) {
        log(`  Student: ${appDetail.studentName} (${appDetail.studentEmail})`, "gray");
        log(`  Scholarship: ${appDetail.scholarshipName}`, "gray");
        log(`  Status: ${appDetail.status}`, "gray");
        log(`  Submitted: ${appDetail.submittedDate}`, "gray");
        printResult("Application Details", true);
        passCount++;
      } else {
        printResult("Application Details", false, "Application not found in details");
        failCount++;
      }
    }

    // 2.5 Admin Approves Application
    printSection("2.5: Admin Approves Application");
    if (applicationId) {
      const { response: approveRes } = await apiCall("PATCH", `/api/admin/applications/${applicationId}/approve`, {
        feedback: "Application approved by admin"
      }, adminToken);

      printResult("Approve Application", approveRes?.status === 200 || approveRes?.status === 201);
      if (approveRes?.status === 200 || approveRes?.status === 201) passCount++; else failCount++;
    }

    // 2.6 Admin Views Analytics
    printSection("2.6: Admin Views Analytics");
    const { response: statsRes, data: statsData } = await apiCall("GET", "/api/admin/stats", null, adminToken);
    
    if (printResult("View Statistics", statsRes?.status === 200)) {
      passCount++;
      if (statsData?.stats) {
        log(`  Total Applications: ${statsData.stats.totalApplications || 0}`, "gray");
        log(`  Pending: ${statsData.stats.pending || 0}`, "gray");
        log(`  Approved: ${statsData.stats.approved || 0}`, "gray");
      }
    } else {
      failCount++;
    }

    // 2.7 Admin Views All Users
    printSection("2.7: Admin Views All Users");
    const { response: usersRes, data: usersData } = await apiCall("GET", "/api/admin/users", null, adminToken);
    
    const userCount = usersData?.data?.length || 0;
    if (printResult("Get Users List", usersRes?.status === 200, `Retrieved ${userCount} total users`)) {
      passCount++;
    } else {
      failCount++;
    }

    // 2.8 Admin Views User Details
    printSection("2.8: Admin Views Specific User");
    if (studentId && usersData?.data?.length > 0) {
      const { response: userDetailRes, data: userDetailData } = await apiCall("GET", `/api/admin/users/${studentId}`, null, adminToken);
      
      if (printResult("Get User Details", userDetailRes?.status === 200)) {
        passCount++;
        log(`  Email: ${userDetailData?.data?.email}`, "gray");
        log(`  Education Level: ${userDetailData?.data?.educationLevel}`, "gray");
        log(`  GWA: ${userDetailData?.data?.gwa}`, "gray");
      } else {
        failCount++;
      }
    }

    // ====================================================================
    // PART 3: MESSAGING & CONVERSATIONS
    // ====================================================================
    printSection("PART 3: STUDENT MESSAGING");

    // 3.1 Student Saves Conversation
    printSection("3.1: Student Saves Conversation");
    const { response: convRes } = await apiCall("PUT", `/api/users/${studentEmail}/conversations`, {
      scholarshipId: scholarshipToApplyFor._id.toString(),
      message: "I'm interested in this scholarship",
      provider: "QCSP"
    }, studentToken);

    printResult("Save Conversation", convRes?.status === 200);
    if (convRes?.status === 200) passCount++; else failCount++;

    // 3.2 Retrieve Conversations
    printSection("3.2: Student Retrieves Conversations");
    const { response: getConvRes, data: getConvData } = await apiCall("GET", `/api/users/${studentEmail}/conversations`, null, studentToken);
    
    const convCount = getConvData?.data?.length || 0;
    if (printResult("Get Conversations", getConvRes?.status === 200, `Retrieved ${convCount} conversations`)) {
      passCount++;
    } else {
      failCount++;
    }

    // ====================================================================
    // PART 4: SCHOLARSHIP MANAGEMENT
    // ====================================================================
    printSection("PART 4: SCHOLARSHIP MANAGEMENT (Admin)");

    // 4.1 Admin Views All Scholarships
    printSection("4.1: Admin Views All Scholarships");
    const { response: adminScholRes, data: adminScholData } = await apiCall("GET", "/api/admin/scholarships", null, adminToken);
    
    const adminScholCount = adminScholData?.data?.length || 0;
    if (printResult("Get Admin Scholarships", adminScholRes?.status === 200, `Retrieved ${adminScholCount} scholarships`)) {
      passCount++;
    } else {
      failCount++;
    }

    // 4.2 Admin Creates New Scholarship
    printSection("4.2: Admin Creates New Scholarship");
    const { response: createScholRes, data: createScholData } = await apiCall("POST", "/api/admin/scholarships", {
      name: `Test Scholarship ${Date.now()}`,
      description: "Test scholarship for comprehensive testing",
      amount: 50000,
      deadline: new Date(Date.now() + 90*24*60*60*1000).toISOString(),
      status: "Active",
      minGPA: 2.5,
      requirements: ["QC Residency", "Active Student"]
    }, adminToken);

    let newScholarshipId = null;
    if (printResult("Create Scholarship", createScholRes?.status === 201 || createScholRes?.status === 200)) {
      passCount++;
      newScholarshipId = createScholData?.data?._id || createScholData?._id;
      log(`  New Scholarship ID: ${newScholarshipId}`, "gray");
    } else {
      failCount++;
    }

    // 4.3 Admin Updates Scholarship
    if (newScholarshipId) {
      printSection("4.3: Admin Updates Scholarship");
      const { response: updateScholRes } = await apiCall("PUT", `/api/admin/scholarships/${newScholarshipId}`, {
        name: `Updated Test Scholarship ${Date.now()}`,
        amount: 75000,
        status: "Active"
      }, adminToken);

      printResult("Update Scholarship", updateScholRes?.status === 200, "Amount updated to 75,000");
      if (updateScholRes?.status === 200) passCount++; else failCount++;
    }

    // ====================================================================
    // PART 5: CROSS-FUNCTIONAL TESTS
    // ====================================================================
    printSection("PART 5: CROSS-FUNCTIONAL TESTS");

    // 5.1 Verify Application Status Change
    printSection("5.1: Verify Application Status After Approval");
    const { response: updatedAppRes, data: updatedAppData } = await apiCall("GET", "/api/admin/applications", null, adminToken);
    
    const approvedApp = updatedAppData?.data?.find(a => a._id?.toString() === applicationId?.toString());
    if (approvedApp) {
      const statusCorrect = approvedApp.status === "Approved" || approvedApp.status === "approved";
      printResult("Application Status", statusCorrect, `Status is now: ${approvedApp.status}`);
      if (statusCorrect) passCount++; else failCount++;
    } else {
      printResult("Application Status", false, "Could not find updated application");
      failCount++;
    }

    // 5.2 Create Second Student for Multi-User Testing
    printSection("5.2: Multi-User Test - Second Student");
    const student2Email = `student2+${Date.now()}@example.com`;
    const { response: signup2Res, data: signup2Data } = await apiCall("POST", "/api/auth/signup", {
      email: student2Email,
      password: "Pass123!",
      userType: "student"
    });

    let student2Id = null;
    let student2Token = null;
    if (printResult("Second Student Registration", signup2Res?.status === 201)) {
      passCount++;
      student2Token = signup2Data.token;
      student2Id = signup2Data.user?.id || (await db.collection("users").findOne({ email: student2Email }))._id.toString();
    } else {
      failCount++;
    }

    // 5.3 Second Student Applies for Same Scholarship
    if (student2Id && scholarshipToApplyFor) {
      printSection("5.3: Second Student Applies for Scholarship");
      const { response: apply2Res, data: apply2Data } = await apiCall("POST", "/api/applications", {
        studentId: student2Id,
        studentName: "Second Scholar",
        studentEmail: student2Email,
        scholarshipId: scholarshipToApplyFor._id.toString(),
        scholarshipName: scholarshipToApplyFor.name,
        matchScore: 65
      }, student2Token);

      printResult("Second Application", apply2Res?.status === 201, "Different student, same scholarship");
      if (apply2Res?.status === 201) passCount++; else failCount++;
    }

    // 5.4 Admin Sees Multiple Applications
    printSection("5.4: Admin Sees Multiple Applications");
    const { response: finalAppsRes, data: finalAppsData } = await apiCall("GET", "/api/admin/applications", null, adminToken);
    
    const finalAppCount = finalAppsData?.data?.length || 0;
    printResult("Final Applications Count", finalAppCount >= 2, `Total: ${finalAppCount} applications (includes both students)`);
    if (finalAppCount >= 2) passCount++; else failCount++;

    // ====================================================================
    // FINAL REPORT
    // ====================================================================
    printSection("📊 FINAL TEST REPORT");

    log(`✅ Passed Tests: ${passCount}`, "green");
    log(`❌ Failed Tests: ${failCount}`, failCount > 0 ? "red" : "green");
    
    const totalTests = passCount + failCount;
    const percentage = Math.round((passCount / totalTests) * 100);
    
    console.log(`\n${colors.blue}Overall Success Rate: ${percentage}% (${passCount}/${totalTests})${colors.reset}`);

    if (failCount === 0) {
      log("\n🎉 ALL TESTS PASSED! System is working correctly.", "green");
    } else {
      log(`\n⚠️  ${failCount} test(s) failed. Please review above for details.`, "yellow");
    }

    log("\n✨ Full-stack test completed.", "cyan");

  } catch (error) {
    log(`Fatal Error: ${error.message}`, "red");
    console.error(error);
  } finally {
    // Stop server
    if (server) {
      server.kill();
      log("Backend server stopped", "gray");
    }
  }
}

// Run the test
runFullTest();
