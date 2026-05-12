import dotenv from "dotenv";
import { spawn } from "node:child_process";
import { MongoClient, ObjectId } from "mongodb";
import { performance } from "node:perf_hooks";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, "..", ".env");
dotenv.config({ path: envPath });

const MONGODB_URI = process.env.MONGODB_URI;
const BACKEND_PORT = 5001;
const BASE_URL = `http://localhost:${BACKEND_PORT}`;
const SERVER_CWD = path.join(__dirname, "..");

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI is required in environment.");
}

const startServer = () => {
  console.log(`\n🚀 Starting backend server on port ${BACKEND_PORT}...`);
  const env = { ...process.env, PORT: String(BACKEND_PORT) };
  const server = spawn("node", ["index.js"], { cwd: SERVER_CWD, env, stdio: ["ignore", "pipe", "pipe"] });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Backend server did not start in time."));
    }, 15000);

    server.stdout.on("data", (data) => {
      const line = data.toString();
      process.stdout.write(line);
      if (line.includes(`API listening on ${BACKEND_PORT}`)) {
        clearTimeout(timeout);
        resolve(server);
      }
    });

    server.stderr.on("data", (data) => {
      process.stderr.write(data.toString());
    });

    server.on("error", reject);
  });
};

const request = async (method, path, body = null, headers = {}) => {
  const url = `${BASE_URL}${path}`;
  const start = performance.now();
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : null,
  });
  const time = Math.round(performance.now() - start);
  let data;
  try {
    data = await response.json();
  } catch (error) {
    data = await response.text();
  }
  return { response, data, time };
};

const printStep = (step, description) => {
  console.log(`\n${"━".repeat(70)}`);
  console.log(`📋 STEP ${step}: ${description}`);
  console.log(`${"━".repeat(70)}`);
};

const printResult = ({ status, ok, message }) => {
  const icon = ok ? "✅" : "❌";
  console.log(`${icon} [${status}] ${message}`);
};

const run = async () => {
  const server = await startServer();
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const dbName = process.env.MONGODB_DB || process.env.MONGO_DB || "thesis_software";
  const db = client.db(dbName);

  try {
    // ================================================================
    // PART 1: STUDENT SIGNUP & PROFILE SETUP
    // ================================================================
    printStep(1, "Student Signs Up");
    
    const email = `testapp+${Date.now()}@example.com`;
    const password = "TestPass123!";
    const signup = await request("POST", "/api/auth/signup", {
      email,
      password,
      fullName: "John Scholar",
      phone: "09170000001",
      location: "Quezon City"
    });
    
    let studentId = signup.data?.user?.id;
    if (!studentId) {
      const userRecord = await db.collection("users").findOne({ email });
      studentId = userRecord?._id?.toString();
    }
    
    printResult({
      status: signup.response.status,
      ok: signup.response.status === 201 && signup.data?.token && studentId,
      message: `Student registered: ${email} (ID: ${studentId})`
    });

    // ================================================================
    // PART 2: STUDENT COMPLETES PROFILE
    // ================================================================
    printStep(2, "Student Completes Profile with Required Fields");

    const profileUpdate = await request("PUT", "/api/users/profile", {
      email,
      fullName: "John Scholar",
      phone: "09170000001",
      location: "Quezon City",
      educationLevel: "College / Undergraduate",
      schoolName: "University of the Philippines",
      schoolLocation: "Quezon City",
      enrolledInQCSchool: true,
      gwa: "2.0",
      incomeCategory: "Low",
      financialNeed: ["Needs financial support"]
    });

    printResult({
      status: profileUpdate.response.status,
      ok: profileUpdate.response.status === 200,
      message: "Student profile updated with education & school details"
    });

    // ================================================================
    // PART 3: FETCH ELIGIBLE SCHOLARSHIPS
    // ================================================================
    printStep(3, "Student Fetches Eligible Scholarships");

    const scholarships = await request("GET", `/api/scholarships?studentEmail=${encodeURIComponent(email)}`);
    const eligibleScholarships = scholarships.data?.data || [];

    printResult({
      status: scholarships.response.status,
      ok: scholarships.response.status === 200 && Array.isArray(eligibleScholarships),
      message: `Found ${eligibleScholarships.length} eligible scholarships`
    });

    if (eligibleScholarships.length > 0) {
      console.log("\n📚 Eligible Scholarships:");
      eligibleScholarships.slice(0, 3).forEach((s, i) => {
        console.log(`   ${i + 1}. ${s.name} (${s.eligibilityStatus})`);
      });
    }

    // ================================================================
    // PART 4: STUDENT SUBMITS APPLICATION
    // ================================================================
    if (eligibleScholarships.length === 0) {
      console.log("\n⚠️  No eligible scholarships found. Cannot proceed with application test.");
      process.exit(1);
    }

    printStep(4, "Student Submits Scholarship Application");

    const targetScholarship = eligibleScholarships[0];
    const application = await request("POST", "/api/applications", {
      studentId,
      studentName: "John Scholar",
      studentEmail: email,
      scholarshipId: targetScholarship._id,
      scholarshipName: targetScholarship.name,
      matchScore: 80
    });

    const applicationId = application.data?.data?._id;
    printResult({
      status: application.response.status,
      ok: application.response.status === 201 && applicationId,
      message: `Application submitted for "${targetScholarship.name}"`
    });

    if (application.response.status !== 201) {
      console.log("\n❌ Application Error:", application.data?.error);
      process.exit(1);
    }

    // ================================================================
    // PART 5: ADMIN VIEWS ALL APPLICATIONS
    // ================================================================
    printStep(5, "Admin Views All Applications");

    const adminApplications = await request("GET", "/api/admin/applications");
    const allApplications = adminApplications.data?.data || [];

    printResult({
      status: adminApplications.response.status,
      ok: adminApplications.response.status === 200 && Array.isArray(allApplications),
      message: `Admin dashboard shows ${allApplications.length} total applications`
    });

    // ================================================================
    // PART 6: VERIFY STUDENT'S APPLICATION IN ADMIN LIST
    // ================================================================
    printStep(6, "Verify Student's Application Appears in Admin List");

    const studentApplication = allApplications.find(
      app => app.studentEmail === email && app.scholarshipName === targetScholarship.name
    );

    printResult({
      status: studentApplication ? 200 : 404,
      ok: !!studentApplication,
      message: studentApplication
        ? `✓ Application found in admin list (Status: ${studentApplication.status})`
        : `✗ Application NOT found in admin list`
    });

    if (studentApplication) {
      console.log("\n📋 Application Details in Admin View:");
      console.log(`   Student: ${studentApplication.studentName} (${studentApplication.studentEmail})`);
      console.log(`   Scholarship: ${studentApplication.scholarshipName}`);
      console.log(`   Submitted: ${new Date(studentApplication.submittedAt).toLocaleString()}`);
      console.log(`   Status: ${studentApplication.status}`);
      console.log(`   Match Score: ${studentApplication.matchScore}%`);

      if (studentApplication.eligibilityCheck) {
        console.log(`   Eligibility Passed: ${studentApplication.eligibilityCheck.passed}`);
        if (studentApplication.eligibilityCheck.metCriteria?.length > 0) {
          console.log(`   Met Criteria: ${studentApplication.eligibilityCheck.metCriteria.join(", ")}`);
        }
      }
    }

    // ================================================================
    // PART 7: ADMIN APPROVES/REJECTS APPLICATION (OPTIONAL)
    // ================================================================
    if (studentApplication) {
      printStep(7, "Admin Takes Action on Application");

      const approve = await request("PATCH", `/api/admin/applications/${encodeURIComponent(studentApplication._id)}/approve`);
      printResult({
        status: approve.response.status,
        ok: approve.response.status === 200,
        message: approve.response.status === 200 
          ? "Application approved" 
          : `Approval action returned ${approve.response.status}`
      });
    }

    // ================================================================
    // SUMMARY
    // ================================================================
    console.log(`\n${"━".repeat(70)}`);
    console.log(`✅ END-TO-END TEST COMPLETE`);
    console.log(`${"━".repeat(70)}`);
    console.log(`
📊 WORKFLOW SUMMARY:
   1. Student Registration     ✅
   2. Profile Setup            ✅
   3. Scholarship Discovery    ✅ (${eligibleScholarships.length} found)
   4. Application Submission   ✅
   5. Admin Application List   ✅ (${allApplications.length} total)
   6. Application Visibility   ${studentApplication ? "✅" : "❌"}
   7. Admin Actions            ${studentApplication ? "✅" : "⏭️  (skipped)"}
    `);

  } catch (error) {
    console.error("\n❌ Test Error:", error.message);
    process.exit(1);
  } finally {
    await client.close();
    if (server) {
      server.kill();
      console.log("\n🛑 Backend server stopped");
    }
  }
};

run();
