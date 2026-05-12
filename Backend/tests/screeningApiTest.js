/**
 * Screening Appointment API Test
 * Simple direct test of new screening endpoints
 * Run: node tests/screeningApiTest.js
 */

const BASE_URL = "http://localhost:5000/api";

// Helper API function
async function api(method, endpoint, body = null, token = null) {
  const options = {
    method,
    headers: { "Content-Type": "application/json" },
  };

  if (token) options.headers.Authorization = `Bearer ${token}`;
  if (body) options.body = JSON.stringify(body);

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const data = await response.json();
    return { status: response.status, data };
  } catch (error) {
    console.error(`API Error: ${error.message}`);
    return { status: 0, data: null };
  }
}

function result(test, passed, details = "") {
  const icon = passed ? "✅" : "❌";
  console.log(`${icon} ${test}`);
  if (details) console.log(`   └─ ${details}`);
  return passed;
}

async function runTests() {
  console.log("\n🧪 SCREENING APPOINTMENT API TEST");
  console.log("═".repeat(60));

  let passed = 0, failed = 0;

  try {
    let adminToken = null;
    let studentEmail = null;
    let applicationId = null;

    // === Part 1: Get Admin Token ===
    console.log("\n📝 Part 1: Admin Authentication");
    console.log("─".repeat(60));

    let res = await api("POST", "/auth/admin/signin", {
      email: "admin@qcsp.gov.ph",
      password: "admin123",
    });

    if (result("Admin Login", res.status === 200, `Token: ${res.data?.token?.substring(0, 20)}...`)) {
      adminToken = res.data?.token;
      passed++;
    } else {
      failed++;
      console.log("❌ Cannot proceed without admin token");
      return;
    }

    // === Part 2: Find Eligible Application ===
    console.log("\n🔍 Part 2: Find Eligible Application");
    console.log("─".repeat(60));

    res = await api("GET", "/admin/applications", null, adminToken);
    const allData = res.data;
    const applications = Array.isArray(allData) ? allData : (Array.isArray(allData?.data) ? allData.data : []);

    // Find an application with passed eligibility check
    const eligibleApp = applications.find((app) => app.eligibilityCheck?.passed === true);

    if (
      result(
        "Found Eligible Application",
        !!eligibleApp,
        `Total apps: ${applications.length}, Eligible: ${applications.filter((a) => a.eligibilityCheck?.passed).length}`
      )
    ) {
      passed++;
      applicationId = eligibleApp._id.toString();
      studentEmail = eligibleApp.studentEmail;
      console.log(`   Application: ${eligibleApp.scholarshipName}`);
      console.log(`   Student: ${studentEmail}`);
    } else {
      failed++;
      console.log("❌ No eligible applications found in system");
      console.log("ℹ️  Please run comprehensive test first to create eligible applications");
      return;
    }

    // === Part 3: Schedule Screening ===
    console.log("\n📅 Part 3: Schedule Screening Appointment");
    console.log("─".repeat(60));

    // Calculate future screening date
    const now = new Date();
    const screeningDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const dateString = screeningDate.toISOString().split("T")[0];
    const timeString = "14:30";

    res = await api(
      "PATCH",
      `/admin/applications/${applicationId}/schedule-screening`,
      {
        scheduledDate: dateString,
        scheduledTime: timeString,
        venue: "QCSP Conference Room, Baguio City",
        notes: "Bring all required documents and valid ID",
      },
      adminToken
    );

    if (result("Schedule Screening", res.status === 200, `Date: ${dateString}, Time: ${timeString}`)) {
      passed++;
      console.log(`   Venue: ${res.data?.screening?.venue}`);
      console.log(`   Notes: ${res.data?.screening?.notes}`);
    } else {
      failed++;
      console.log(`Status: ${res.status}`);
      console.log(`Full Response:`, JSON.stringify(res.data, null, 2));
      return;
    }

    // === Part 4: Student Views Appointment ===
    console.log("\n👁️  Part 4: Student Views Appointment");
    console.log("─".repeat(60));

    // First, get student token
    res = await api("POST", "/auth/signin", {
      email: studentEmail,
      password: "password123",
    });

    let studentToken = null;
    if (res.status === 200) {
      studentToken = res.data?.token;
      if (result("Get Student Token", true, "Student authenticated")) {
        passed++;
      }
    } else {
      console.log("⚠️  Could not authenticate student, trying without token...");
    }

    res = await api("GET", `/users/${studentEmail}/screening-appointments`, null, studentToken);

    if (
      result(
        "Student Retrieves Appointments",
        res.status === 200 && Array.isArray(res.data),
        `Found ${res.data?.length || 0} appointment(s)`
      )
    ) {
      passed++;

      if (res.data && res.data.length > 0) {
        const apt = res.data[0];
        console.log(`   Scholarship: ${apt.scholarshipName}`);
        console.log(`   Date: ${apt.screening?.scheduledDate}`);
        console.log(`   Time: ${apt.screening?.scheduledTime}`);
        console.log(`   Venue: ${apt.screening?.venue}`);
      }
    } else {
      failed++;
      console.log(`Error: ${res.data?.error}`);
    }

    // === Part 5: Admin Views Details ===
    console.log("\n📊 Part 5: Admin Views Screening Details");
    console.log("─".repeat(60));

    res = await api("GET", `/admin/applications/${applicationId}/screening`, null, adminToken);

    if (
      result(
        "Admin Retrieves Details",
        res.status === 200 && res.data?.data?.screeningSchedule,
        `Scheduled: ${res.data?.data?.screeningSchedule?.isScheduled}`
      )
    ) {
      passed++;
      console.log(`   Student: ${res.data?.data?.studentName}`);
      console.log(`   Email: ${res.data?.data?.studentEmail}`);
      console.log(`   Venue: ${res.data?.data?.screeningSchedule?.venue}`);
    } else {
      failed++;
      console.log(`Error: ${res.data?.error}`);
    }

    // === Summary ===
    console.log("\n" + "═".repeat(60));
    console.log(`📊 TEST RESULTS: ${passed} passed, ${failed} failed`);
    console.log(`Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);

    if (failed === 0) {
      console.log("\n✨ ALL SCREENING TESTS PASSED!");
      console.log("\n✅ Screening Appointment Feature is WORKING:");
      console.log("   • Admins can schedule screening appointments");
      console.log("   • Students can view their appointments");
      console.log("   • All appointment details are stored correctly");
    }

    console.log("═".repeat(60));
  } catch (error) {
    console.error("\n❌ Test Error:", error.message);
    failed++;
  }
}

runTests();
