// Using built-in fetch (available in Node.js 18+)
const BASE_URL = "http://localhost:5000/api";
let studentToken = null;
let adminToken = null;
let applicationId = null;

// Import database and seeding functions
import "dotenv/config";
import { getDb } from "../db.js";
import { seedQCSPPScholarships } from "../seed-qcsp-scholarships.js";

// Helper function to make API calls
async function api(method, endpoint, body = null, token = null) {
  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (token) {
    options.headers.Authorization = `Bearer ${token}`;
  }

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const data = await response.json();
    return { status: response.status, data };
  } catch (error) {
    console.error(`API Error on ${method} ${endpoint}:`, error.message);
    throw error;
  }
}

// Helper for test results
function result(testName, passed, details = "") {
  const icon = passed ? "✅" : "❌";
  console.log(`${icon} ${testName}`);
  if (details) console.log(`   └─ ${details}`);
}

// Helper for section headers
function section(title) {
  console.log(`\n📋 ${title}`);
  console.log("─".repeat(50));
}

async function runTests() {
  console.log("\n🎯 SCREENING APPOINTMENT FEATURE TEST");
  console.log("═".repeat(50));

  try {
    // Initialize database and seed scholarships
    console.log("📚 Seeding scholarships...");
    const db = await getDb();
    await seedQCSPPScholarships();
    console.log("✅ Scholarships seeded\n");

    // === PART 1: SETUP ===
    section("Part 1: Setup - Student Registration & Application");

    // 1.1 Register student
    const studentEmail = `test-screening-${Date.now()}@example.com`;
    const studentPassword = "password123";

    let response = await api("POST", "/auth/signup", {
      email: studentEmail,
      password: studentPassword,
      fullName: "Test Screening Student",
      role: "student",
    });
    result("1.1 Student Registration", response.status === 201, `Email: ${studentEmail}`);
    studentToken = response.data?.token;

    // 1.1b Complete student profile (required for eligibility)
    response = await api("PUT", "/users/profile", {
      email: studentEmail,
      fullName: "Test Screening Student",
      educationLevel: "undergraduate",
      gwa: 3.5,
      school: "University Test",
      is_qc_resident: true,
      address: "Quezon City",
      phonE: "1234567890",
    }, studentToken);
    result("1.1b Complete Student Profile", response.status === 200 || response.status === 201, 
      "Profile completed with GWA and location");

    // 1.2 Get eligible scholarships
    response = await api("GET", `/scholarships?email=${studentEmail}`, null, studentToken);
    const scholarships = (response.data?.data || response.data) || [];
    result("1.2 Get Eligible Scholarships", Array.isArray(scholarships) && scholarships.length > 0, 
      `Found ${scholarships.length} eligible scholarships`);

    if (scholarships.length === 0) {
      console.log("❌ No scholarships available to apply for. Aborting tests.");
      return;
    }

    // 1.3 Submit application for first scholarship
    const scholarshipId = scholarships[0]?.id || scholarships[0]?._id;
    response = await api("POST", "/applications", {
      studentEmail,
      scholarshipId,
    }, studentToken);
    result("1.3 Student Submits Application", response.status === 201, 
      `Application ID: ${response.data?.data?._id}`);
    applicationId = response.data?.data?._id;

    // === PART 2: ADMIN VERIFICATION ===
    section("Part 2: Admin Verification & Approval");

    // 2.1 Admin login
    response = await api("POST", "/auth/admin/signin", {
      email: "admin@qcsp.gov.ph",
      password: "admin123",
    });
    result("2.1 Admin Login", response.status === 200, "Admin authenticated");
    adminToken = response.data?.token;

    // 2.2 Admin views all applications
    response = await api("GET", "/admin/applications", null, adminToken);
    const applications = (response.data?.data || response.data) || [];
    result("2.2 Admin Views Applications", Array.isArray(applications) && applications.length > 0, 
      `Found ${applications.length} total applications`);

    // 2.3 Find student's application
    const studentApp = applications.find((app) => app.studentEmail === studentEmail);
    result("2.3 Admin Finds Student Application", !!studentApp, 
      `Application status: ${studentApp?.status}`);

    // === PART 3: ELIGIBILITY CHECK ===
    section("Part 3: Admin Checks Eligibility");

    // 3.1 Verify eligibility check passed
    const eligibilityPassed = studentApp?.eligibilityCheck?.passed;
    result("3.1 Student is Eligible", eligibilityPassed === true, 
      `Passed: ${eligibilityPassed}, Met Criteria: ${studentApp?.eligibilityCheck?.metCriteria?.length || 0}`);

    if (!eligibilityPassed) {
      console.log("⚠️  Student is not eligible for screening. Skipping screening tests.");
      return;
    }

    // === PART 4: SCREENING APPOINTMENT SCHEDULING ===
    section("Part 4: Admin Schedules Screening Appointment");

    // 4.1 Calculate future screening date
    const now = new Date();
    const screeningDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    const dateString = screeningDate.toISOString().split("T")[0]; // YYYY-MM-DD
    const timeString = "14:30"; // 2:30 PM

    // 4.2 Schedule screening
    response = await api("PATCH", `/admin/applications/${applicationId}/schedule-screening`, {
      scheduledDate: dateString,
      scheduledTime: timeString,
      venue: "QCSP Conference Room, Baguio City",
      notes: "Bring all required documents and valid ID",
    }, adminToken);

    result("4.2 Schedule Screening Appointment", response.status === 200, 
      `Scheduled for: ${dateString} at ${timeString}`);

    const screening = response.data?.screening;
    result("4.3 Verify Screening Details", 
      screening?.isScheduled === true && screening?.venue !== null,
      `Venue: ${screening?.venue}`);

    // === PART 5: STUDENT VIEWS SCREENING ===
    section("Part 5: Student Views Screening Appointment");

    // 5.1 Get screening appointments
    response = await api("GET", `/users/${studentEmail}/screening-appointments`, null, studentToken);
    const appointments = response.data || [];

    result("5.1 Student Retrieves Screening Appointments", 
      Array.isArray(appointments) && appointments.length > 0,
      `Found ${appointments.length} appointment(s)`);

    if (appointments.length > 0) {
      const appointment = appointments[0];
      result("5.2 Verify Appointment Details",
        appointment?.screening?.venue && appointment?.screening?.scheduledDate && appointment?.screening?.scheduledTime,
        `Venue: ${appointment?.screening?.venue}, Time: ${appointment?.screening?.scheduledTime}`);

      result("5.3 Confirm Scholarship Name",
        appointment?.scholarshipName !== null && appointment?.scholarshipName !== undefined,
        `Scholarship: ${appointment?.scholarshipName}`);

      result("5.4 Display Appointment Notes",
        appointment?.screening?.notes !== null,
        `Notes: ${appointment?.screening?.notes}`);
    }

    // === PART 6: GET SCREENING DETAILS ===
    section("Part 6: Admin Views Screening Details");

    // 6.1 Get specific screening details
    response = await api("GET", `/admin/applications/${applicationId}/screening`, null, adminToken);
    result("6.1 Admin Retrieves Screening Details", response.status === 200,
      `Application status: ${response.data?.data?.status}`);

    const screeningInfo = response.data?.data?.screeningSchedule;
    result("6.2 Verify Complete Screening Info",
      screeningInfo?.isScheduled === true && screeningInfo?.scheduledTime === timeString,
      `Date: ${screeningInfo?.scheduledDate}, Time: ${screeningInfo?.scheduledTime}`);

  } catch (error) {
    console.error("❌ Test Error:", error.message);
  }

  // === FINAL SUMMARY ===
  console.log("\n" + "═".repeat(50));
  console.log("✨ SCREENING FEATURE TEST COMPLETE");
  console.log("═".repeat(50));
}

// Run tests
runTests();
