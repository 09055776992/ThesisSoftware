/**
 * Simple endpoint diagnostics
 */

const BASE_URL = "http://localhost:5000/api";

async function testEndpoint(method, path) {
  try {
    const response = await fetch(`${BASE_URL}${path}`, { method });
    const data = await response.json();
    console.log(`[${method}] ${path}`);
    console.log(`  Status: ${response.status}`);
    console.log(`  Response: ${JSON.stringify(data).substring(0, 100)}`);
    return response.status;
  } catch (error) {
    console.log(`[${method}] ${path}`);
    console.log(`  Error: ${error.message}`);
    return 0;
  }
}

async function run() {
  console.log("Testing API Routes...\n");
  
  // Test existing endpoints to ensure they're working
  console.log("=== Existing Endpoints (Should all work) ===");
  await testEndpoint("GET", "/scholarships");
  await testEndpoint("GET", "/admin/users");
  
  // Test new screening endpoints
  console.log("\n=== New Screening Endpoints ===");
  await testEndpoint("PATCH", "/admin/applications/test-id/schedule-screening");
  await testEndpoint("GET", "/users/test@example.com/screening-appointments");
  await testEndpoint("GET", "/admin/applications/test-id/screening");
}

run();
