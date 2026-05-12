import dotenv from "dotenv";
import { execSync } from "node:child_process";
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
  console.log(`Starting backend server on port ${BACKEND_PORT} for API tests...`);
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
  const contentType = response.headers.get("content-type") || "";
  let data;
  try {
    data = await response.json();
  } catch (error) {
    data = await response.text();
  }
  return { response, data, time, contentType };
};

const printResult = ({ path, method, status, time, ok, type, note }) => {
  const statusLabel = ok ? "✅ PASS" : status >= 500 ? "❌ FAIL" : "⚠️ SLOW";
  console.log(`${statusLabel} — ${method} ${path} — ${time}ms — ${status} ${type}${note ? ` — ${note}` : ""}`);
};

const run = async () => {
  const server = await startServer();
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const dbName = process.env.MONGODB_DB || process.env.MONGO_DB || "thesis_software";
  const db = client.db(dbName);

  try {
    const summary = { passed: 0, failed: 0, warnings: 0, notes: [] };

    const email = `testuser+${Date.now()}@example.com`;
    const password = "TestPass123!";
    const signup = await request("POST", "/api/auth/signup", { email, password, fullName: "Test User", phone: "09170000000", location: "Quezon City" });
    const signupOk = signup.response.status === 201 && signup.data?.token;
    printResult({ path: "/api/auth/signup", method: "POST", status: signup.response.status, time: signup.time, ok: signupOk, type: signup.response.statusText });
    if (!signupOk) summary.failed += 1;
    else summary.passed += 1;

    const signin = await request("POST", "/api/auth/signin", { email, password });
    const signinOk = signin.response.status === 200 && signin.data?.token;
    printResult({ path: "/api/auth/signin", method: "POST", status: signin.response.status, time: signin.time, ok: signinOk, type: signin.response.statusText });
    if (!signinOk) summary.failed += 1; else summary.passed += 1;
    const token = signin.data?.token;

    const signinWrong = await request("POST", "/api/auth/signin", { email, password: "WrongPass" });
    const wrongOk = signinWrong.response.status === 401;
    printResult({ path: "/api/auth/signin", method: "POST", status: signinWrong.response.status, time: signinWrong.time, ok: wrongOk, type: signinWrong.response.statusText });
    if (!wrongOk) summary.failed += 1; else summary.passed += 1;

    console.log("DEBUG signup.data:", JSON.stringify(signup.data, null, 2));
    let userId = signup.data?.user?.id || signin.data?.user?.id;
    if (!userId) {
      const userRecord = await db.collection("users").findOne({ email });
      userId = userRecord?._id?.toString();
    }

    const updateProfile = await request("PUT", "/api/users/profile", {
      email,
      fullName: "Updated User",
      phone: "09171111111",
      location: "Quezon City",
      educationLevel: "College / Undergraduate",
      schoolName: "Test University",
      schoolLocation: "Quezon City",
      enrolledInQCSchool: true,
      gwa: "1.75",
      incomeCategory: "Low",
      financialNeed: ["Needs financial support"],
    });
    const updateOk = updateProfile.response.status === 200 && updateProfile.data?.user?.educationLevel === "College / Undergraduate";
    printResult({ path: "/api/users/profile", method: "PUT", status: updateProfile.response.status, time: updateProfile.time, ok: updateOk, type: updateProfile.response.statusText });
    if (!updateOk) summary.failed += 1; else summary.passed += 1;

    const scholarships = await request("GET", "/api/scholarships");
    const scholarshipOk = scholarships.response.status === 200 && Array.isArray(scholarships.data?.data);
    printResult({ path: "/api/scholarships", method: "GET", status: scholarships.response.status, time: scholarships.time, ok: scholarshipOk, type: scholarships.response.statusText });
    if (!scholarshipOk) summary.failed += 1; else summary.passed += 1;

    const savedList = await request("GET", `/api/users/${encodeURIComponent(email)}/saved-scholarships`);
    const savedOk = savedList.response.status === 200 && Array.isArray(savedList.data?.data);
    printResult({ path: "/api/users/:email/saved-scholarships", method: "GET", status: savedList.response.status, time: savedList.time, ok: savedOk, type: savedList.response.statusText });
    if (!savedOk) summary.failed += 1; else summary.passed += 1;

    const saveAction = await request("PUT", `/api/users/${encodeURIComponent(email)}/saved-scholarships`, { ids: [1, 2, 3] });
    const saveOk = saveAction.response.status === 200 && Array.isArray(saveAction.data?.data);
    printResult({ path: "/api/users/:email/saved-scholarships", method: "PUT", status: saveAction.response.status, time: saveAction.time, ok: saveOk, type: saveAction.response.statusText });
    if (!saveOk) summary.failed += 1; else summary.passed += 1;

    const savedListAfter = await request("GET", `/api/users/${encodeURIComponent(email)}/saved-scholarships`);
    const savedAfterOk = savedListAfter.response.status === 200 && Array.isArray(savedListAfter.data?.data) && savedListAfter.data.data.length === 3;
    printResult({ path: "/api/users/:email/saved-scholarships", method: "GET", status: savedListAfter.response.status, time: savedListAfter.time, ok: savedAfterOk, type: savedListAfter.response.statusText });
    if (!savedAfterOk) summary.failed += 1; else summary.passed += 1;

    const eligibilityFiltered = await request("GET", `/api/scholarships?studentEmail=${encodeURIComponent(email)}`);
    const eligibilityOk = eligibilityFiltered.response.status === 200 && Array.isArray(eligibilityFiltered.data?.data);
    printResult({ path: "/api/scholarships?studentEmail=...", method: "GET", status: eligibilityFiltered.response.status, time: eligibilityFiltered.time, ok: eligibilityOk, type: eligibilityFiltered.response.statusText });
    if (!eligibilityOk) summary.failed += 1; else summary.passed += 1;

    const scholarshipList = Array.isArray(eligibilityFiltered.data?.data) ? eligibilityFiltered.data.data : [];
    const scholarshipId = scholarshipList[0]?._id;
    const scholarshipName = scholarshipList[0]?.name;
    if (!scholarshipId) {
      console.log("❌ FAIL — No scholarship found to create an application.");
      summary.failed += 1;
    }

    let applicationId1 = null;
    let applicationId2 = null;
    if (scholarshipId) {
      const application1 = await request("POST", "/api/applications", {
        studentId: userId,
        studentName: "Updated User",
        studentEmail: email,
        scholarshipId,
        scholarshipName,
        matchScore: 80,
      });
      const applicationOk1 = application1.response.status === 201 && application1.data?.data?._id;
      printResult({ path: "/api/applications", method: "POST", status: application1.response.status, time: application1.time, ok: applicationOk1, type: application1.response.statusText });
      if (!applicationOk1) {
        console.log("Application 1 response:", JSON.stringify(application1.data, null, 2));
        summary.failed += 1;
      } else {
        summary.passed += 1;
      }
      applicationId1 = application1.data?.data?._id;

      const application2 = await request("POST", "/api/applications", {
        studentId: userId,
        studentName: "Updated User",
        studentEmail: email,
        scholarshipId,
        scholarshipName,
        matchScore: 75,
      });
      const applicationOk2 = application2.response.status === 201 && application2.data?.data?._id;
      if (!applicationOk2) {
        console.log("Application 2 response:", JSON.stringify(application2.data, null, 2));
      }
      if (applicationOk2) {
        applicationId2 = application2.data?.data?._id;
      }
      if (!applicationOk2) {
        console.log("❌ FAIL — second application creation failed; cannot run approve/reject tests.");
        summary.failed += 1;
      } else {
        summary.passed += 1;
      }

      const adminUsers = await request("GET", "/api/admin/users");
      const adminUsersOk = adminUsers.response.status === 200 && Array.isArray(adminUsers.data);
      printResult({ path: "/api/admin/users", method: "GET", status: adminUsers.response.status, time: adminUsers.time, ok: adminUsersOk, type: adminUsers.response.statusText });
      if (!adminUsersOk) summary.failed += 1; else summary.passed += 1;

      const adminScholarships = await request("GET", "/api/admin/scholarships");
      const adminScholarshipsOk = adminScholarships.response.status === 200 && Array.isArray(adminScholarships.data);
      const hasApplicationsCount = Array.isArray(adminScholarships.data) && adminScholarships.data.every((row) => typeof row.applicationsCount === "number");
      printResult({ path: "/api/admin/scholarships", method: "GET", status: adminScholarships.response.status, time: adminScholarships.time, ok: adminScholarshipsOk && hasApplicationsCount, type: adminScholarships.response.statusText, note: hasApplicationsCount ? "applicationsCount present" : "applicationsCount missing" });
      if (!adminScholarshipsOk || !hasApplicationsCount) summary.failed += 1; else summary.passed += 1;

      const adminApplications = await request("GET", "/api/admin/applications");
      const adminApplicationsOk = adminApplications.response.status === 200 && Array.isArray(adminApplications.data);
      printResult({ path: "/api/admin/applications", method: "GET", status: adminApplications.response.status, time: adminApplications.time, ok: adminApplicationsOk, type: adminApplications.response.statusText });
      if (!adminApplicationsOk) summary.failed += 1; else summary.passed += 1;

      const adminStats = await request("GET", "/api/admin/stats");
      const hasNoNaN = adminStats.response.status === 200 && Object.values(adminStats.data || {}).every((value) => typeof value !== "number" || !Number.isNaN(value));
      const adminStatsOk = adminStats.response.status === 200 && hasNoNaN;
      printResult({ path: "/api/admin/stats", method: "GET", status: adminStats.response.status, time: adminStats.time, ok: adminStatsOk, type: adminStats.response.statusText });
      if (!adminStatsOk) summary.failed += 1; else summary.passed += 1;

      if (applicationId1) {
        const approve = await request("PATCH", `/api/admin/applications/${encodeURIComponent(applicationId1)}/approve`);
        const approveOk = approve.response.status === 200 && approve.data?.data?.status === "Approved";
        printResult({ path: "/api/admin/applications/:id/approve", method: "PATCH", status: approve.response.status, time: approve.time, ok: approveOk, type: approve.response.statusText });
        if (!approveOk) summary.failed += 1; else summary.passed += 1;
      }
      if (applicationId2) {
        const reject = await request("PATCH", `/api/admin/applications/${encodeURIComponent(applicationId2)}/reject`);
        const rejectOk = reject.response.status === 200 && reject.data?.data?.status === "Rejected";
        printResult({ path: "/api/admin/applications/:id/reject", method: "PATCH", status: reject.response.status, time: reject.time, ok: rejectOk, type: reject.response.statusText });
        if (!rejectOk) summary.failed += 1; else summary.passed += 1;
      }
    }

    // Database integrity checks
    console.log("\n=== DATABASE INTEGRITY CHECKS ===");
    const dbSummary = [];
    const now = new Date();
    const futureDate = new Date("2026-06-30T00:00:00Z");

    const scholarshipsCollection = db.collection("scholarships");
    const usersCollection = db.collection("users");
    const applicationsCollection = db.collection("applications");

    const pastDeadlines = await scholarshipsCollection.find({ deadline: { $lt: futureDate } }).toArray();
    if (pastDeadlines.length === 0) {
      console.log(`✅ PASS — All scholarship deadlines are June 30, 2026 or later`);
    } else {
      console.log(`❌ FAIL — ${pastDeadlines.length} scholarships have deadlines before June 30, 2026:`);
      pastDeadlines.slice(0, 10).forEach((s) => console.log(`   - ${s.name} (${s.deadline})`));
      summary.failed += 1;
    }

    const missingEducationLevel = await scholarshipsCollection.find({ $or: [ { requiredEducationLevel: { $exists: false } }, { requiredEducationLevel: null } ] }).toArray();
    if (missingEducationLevel.length === 0) {
      console.log(`✅ PASS — No scholarships missing requiredEducationLevel`);
    } else {
      console.log(`❌ FAIL — ${missingEducationLevel.length} scholarships missing requiredEducationLevel:`);
      missingEducationLevel.slice(0, 10).forEach((s) => console.log(`   - ${s.name}`));
      summary.failed += 1;
    }

    const missingMinimumGPA = await scholarshipsCollection.find({ $or: [ { minimumGPA: { $exists: false } }, { minimumGPA: null } ] }).toArray();
    if (missingMinimumGPA.length === 0) {
      console.log(`✅ PASS — No scholarships missing minimumGPA`);
    } else {
      console.log(`❌ FAIL — ${missingMinimumGPA.length} scholarships missing minimumGPA:`);
      missingMinimumGPA.slice(0, 10).forEach((s) => console.log(`   - ${s.name}`));
      summary.failed += 1;
    }

    const duplicateEmails = await usersCollection.aggregate([
      { $group: { _id: "$email", count: { $sum: 1 }, docs: { $push: "$_id" } } },
      { $match: { count: { $gt: 1 } } },
    ]).toArray();
    if (duplicateEmails.length === 0) {
      console.log(`✅ PASS — No duplicate user emails`);
    } else {
      console.log(`❌ FAIL — Duplicate emails found:`);
      duplicateEmails.forEach((entry) => console.log(`   - ${entry._id}: ${entry.count} entries`));
      summary.failed += 1;
    }

    const invalidScholarshipRefs = await applicationsCollection.aggregate([
      { $lookup: { from: "scholarships", localField: "scholarshipId", foreignField: "_id", as: "scholarship" } },
      { $match: { scholarship: { $size: 0 } } },
    ]).toArray();
    if (invalidScholarshipRefs.length === 0) {
      console.log(`✅ PASS — No applications referencing non-existent scholarshipId`);
    } else {
      console.log(`❌ FAIL — ${invalidScholarshipRefs.length} applications reference missing scholarshipId`);
      invalidScholarshipRefs.slice(0, 10).forEach((app) => console.log(`   - app ${app._id}`));
      summary.failed += 1;
    }

    const invalidStudentRefs = await applicationsCollection.aggregate([
      { $lookup: { from: "users", localField: "studentId", foreignField: "_id", as: "student" } },
      { $match: { student: { $size: 0 } } },
    ]).toArray();
    if (invalidStudentRefs.length === 0) {
      console.log(`✅ PASS — No applications referencing non-existent studentId`);
    } else {
      console.log(`❌ FAIL — ${invalidStudentRefs.length} applications reference missing studentId`);
      invalidStudentRefs.slice(0, 10).forEach((app) => console.log(`   - app ${app._id}`));
      summary.failed += 1;
    }

    const demoUsers = await usersCollection.find({ email: { $in: ["demo@example.com", "nonqc@email.com", "test@test.com"] } }).toArray();
    if (demoUsers.length === 0) {
      console.log(`✅ PASS — No hardcoded/demo test users remain`);
    } else {
      console.log(`❌ FAIL — Demo/test users found:`);
      demoUsers.forEach((user) => console.log(`   - ${user.email}`));
      summary.failed += 1;
    }

    const testScholarships = await scholarshipsCollection.find({ name: { $in: ["Test Excellence Scholarship", "Closed Test Scholarship"] } }).toArray();
    if (testScholarships.length === 0) {
      console.log(`✅ PASS — No test/dummy scholarships remain`);
    } else {
      console.log(`❌ FAIL — Test/dummy scholarships found:`);
      testScholarships.forEach((s) => console.log(`   - ${s.name}`));
      summary.failed += 1;
    }

    console.log("\n=== API & DATABASE TEST SUMMARY ===");
    console.log(`Passed: ${summary.passed}, Failed: ${summary.failed}`);

    if (summary.failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error("Test execution error:", error);
    process.exit(1);
  } finally {
    await client.close();
    if (server) {
      server.kill();
    }
  }
};

run();
