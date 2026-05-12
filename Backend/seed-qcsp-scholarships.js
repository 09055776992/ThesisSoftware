import "dotenv/config";
import { getDb } from "./db.js";

// CHED Priority Courses for QC Government
const CHED_PRIORITY_COURSES = [
  "Accountancy",
  "Architecture",
  "Civil Engineering",
  "Computer Engineering",
  "Computer Science",
  "Electrical Engineering",
  "Electronics Engineering",
  "Industrial Engineering",
  "Mechanical Engineering",
  "Nursing",
  "Pharmacy",
  "Psychology",
  "Teacher Education",
  "Information Technology",
  "Business Administration",
  "Public Administration",
  "Social Work",
  "Development Communication",
  "Environmental Science",
  "Statistics"
];

// QCSP Scholarship Data
const QCSP_SCHOLARSHIPS = [
  // Senior High School Scholarships
  {
    name: "SHS Academic Scholarship",
    provider: "Quezon City Youth Development Office (QCYDO)",
    organization: "Quezon City Youth Development Office (QCYDO)",
    type: "Academic",
    educationLevel: "Senior High School",
    minGWA: 89,
    maxGWA: 100,
    amount: 15000,
    deadline: "2024-12-31",
    status: "Active",
    fieldOfStudy: "",
    location: "Quezon City",
    description: "Academic scholarship for Senior High School students with excellent academic performance. JHS graduate with Academic Honors (Rank 1–10) or GWA ≥ 89%.",
    eligibilityCriteria: {
      educationLevel: ["Senior High School"],
      minGWA: 89,
      requiresAcademicHonors: true,
      qcResident: true,
      additionalCriteria: "JHS graduate with Academic Honors (Rank 1–10) or GWA ≥ 89%"
    },
    applicationsCount: 0,
    category: "qcsp"
  },
  {
    name: "SHS Specialized Track Scholarship",
    provider: "Quezon City Youth Development Office (QCYDO)",
    organization: "Quezon City Youth Development Office (QCYDO)",
    type: "Specialized",
    educationLevel: "Senior High School",
    minGWA: 89,
    maxGWA: 100,
    amount: 18000,
    deadline: "2024-12-31",
    status: "Active",
    fieldOfStudy: "STEM, ABM, HUMSS, TVL",
    location: "Quezon City",
    description: "Scholarship for students enrolled in Specialized Public Senior High School tracks.",
    eligibilityCriteria: {
      educationLevel: ["Senior High School"],
      minGWA: 89,
      requiresSpecializedTrack: true,
      qcResident: true,
      additionalCriteria: "Enrolled in a Specialized Public SHS"
    },
    applicationsCount: 0,
    category: "qcsp"
  },
  {
    name: "SHS Athletic and Arts Scholarship",
    provider: "Quezon City Youth Development Office (QCYDO)",
    organization: "Quezon City Youth Development Office (QCYDO)",
    type: "Athletic/Arts",
    educationLevel: "Senior High School",
    minGWA: 85,
    maxGWA: 100,
    amount: 12000,
    deadline: "2024-12-31",
    status: "Active",
    fieldOfStudy: "",
    location: "Quezon City",
    description: "Scholarship for student-athletes and artists who have received recent major sports/arts awards or are members of city-recognized programs.",
    eligibilityCriteria: {
      educationLevel: ["Senior High School"],
      minGWA: 85,
      isAthlete: true,
      isArtist: true,
      requiresAward: true,
      qcResident: true,
      additionalCriteria: "Recent major sports/arts award recipient or member of city-recognized program"
    },
    applicationsCount: 0,
    category: "qcsp"
  },
  {
    name: "SHS Youth Leaders Scholarship",
    provider: "Quezon City Youth Development Office (QCYDO)",
    organization: "Quezon City Youth Development Office (QCYDO)",
    type: "Youth Leaders",
    educationLevel: "Senior High School",
    minGWA: 85,
    maxGWA: 100,
    amount: 12000,
    deadline: "2024-12-31",
    status: "Active",
    fieldOfStudy: "",
    location: "Quezon City",
    description: "Scholarship for youth leaders serving in official capacities.",
    eligibilityCriteria: {
      educationLevel: ["Senior High School"],
      minGWA: 85,
      isSKOfficial: true,
      isStudentLeader: true,
      qcResident: true,
      additionalCriteria: "Elected SK official, Supreme Student Government, or QC-registered youth org officer"
    },
    applicationsCount: 0,
    category: "qcsp"
  },

  // Tertiary (College) Scholarships
  {
    name: "QC Excel Scholarship",
    provider: "Quezon City Youth Development Office (QCYDO)",
    organization: "Quezon City Youth Development Office (QCYDO)",
    type: "Academic Excellence",
    educationLevel: "College",
    minGWA: null, // holistic evaluation
    maxGWA: null,
    amount: 50000,
    deadline: "2024-12-31",
    status: "Active",
    fieldOfStudy: "Priority Courses",
    location: "Quezon City",
    description: "Premier scholarship for incoming first-year college students in priority courses. Evaluated holistically on academics, leadership, and socio-civic involvement.",
    eligibilityCriteria: {
      educationLevel: ["College"],
      minGWA: null, // holistic
      isFirstYear: true,
      priorityCourse: true,
      qcResident: true,
      holisticEvaluation: true,
      additionalCriteria: "Incoming first-year college, priority courses; evaluated on academics, leadership, and socio-civic involvement"
    },
    applicationsCount: 0,
    category: "qcsp"
  },
  {
    name: "College Academic Scholarship",
    provider: "Quezon City Youth Development Office (QCYDO)",
    organization: "Quezon City Youth Development Office (QCYDO)",
    type: "Academic",
    educationLevel: "College",
    minGWA: 1.75,
    maxGWA: 1.0,
    amount: 30000,
    deadline: "2024-12-31",
    status: "Active",
    fieldOfStudy: "",
    location: "Quezon City",
    description: "Academic scholarship for college students with excellent high school performance.",
    eligibilityCriteria: {
      educationLevel: ["College"],
      minGWA: 1.75,
      requiresAcademicHonors: true,
      qcResident: true,
      additionalCriteria: "SHS graduate with honors (Rank 1–10)"
    },
    applicationsCount: 0,
    category: "qcsp"
  },
  {
    name: "Economic Scholarship",
    provider: "Quezon City Youth Development Office (QCYDO)",
    organization: "Quezon City Youth Development Office (QCYDO)",
    type: "Need-Based",
    educationLevel: "College",
    minGWA: 3.0,
    maxGWA: 1.0,
    amount: 25000,
    deadline: "2024-12-31",
    status: "Active",
    fieldOfStudy: "",
    location: "Quezon City",
    description: "Need-based scholarship for indigent and marginalized students including PWDs, solo parents, tricycle driver families, and household helpers.",
    eligibilityCriteria: {
      educationLevel: ["College"],
      minGWA: 3.0,
      isIndigent: true,
      isPWD: true,
      isSoloParent: true,
      qcResident: true,
      additionalCriteria: "Indigent/marginalized (PWDs, solo parents, tricycle driver families, household helpers)"
    },
    applicationsCount: 0,
    category: "qcsp"
  },
  {
    name: "College Athletic and Arts Scholarship",
    provider: "Quezon City Youth Development Office (QCYDO)",
    organization: "Quezon City Youth Development Office (QCYDO)",
    type: "Athletic/Arts",
    educationLevel: "College",
    minGWA: 2.5,
    maxGWA: 1.0,
    amount: 20000,
    deadline: "2024-12-31",
    status: "Active",
    fieldOfStudy: "",
    location: "Quezon City",
    description: "Scholarship for college athletes and artists with outstanding achievements.",
    eligibilityCriteria: {
      educationLevel: ["College"],
      minGWA: 2.5,
      isAthlete: true,
      isArtist: true,
      requiresAward: true,
      qcResident: true,
      additionalCriteria: "Award-winning athlete/artist or member of city-recognized program"
    },
    applicationsCount: 0,
    category: "qcsp"
  },
  {
    name: "College Youth Leaders Scholarship",
    provider: "Quezon City Youth Development Office (QCYDO)",
    organization: "Quezon City Youth Development Office (QCYDO)",
    type: "Youth Leaders",
    educationLevel: "College",
    minGWA: 2.5,
    maxGWA: 1.0,
    amount: 20000,
    deadline: "2024-12-31",
    status: "Active",
    fieldOfStudy: "",
    location: "Quezon City",
    description: "Scholarship for college students serving in leadership positions.",
    eligibilityCriteria: {
      educationLevel: ["College"],
      minGWA: 2.5,
      isSKOfficial: true,
      isStudentLeader: true,
      qcResident: true,
      additionalCriteria: "City-recognized youth leader or SK/student council official"
    },
    applicationsCount: 0,
    category: "qcsp"
  },
  {
    name: "Specialized Courses Scholarship",
    provider: "Quezon City Youth Development Office (QCYDO)",
    organization: "Quezon City Youth Development Office (QCYDO)",
    type: "Specialized",
    educationLevel: "College",
    minGWA: 1.75,
    maxGWA: 1.0,
    amount: 35000,
    deadline: "2024-12-31",
    status: "Active",
    fieldOfStudy: "CHED Priority Courses",
    location: "Quezon City",
    description: "Scholarship for students enrolled in CHED-identified priority courses required by QC Government.",
    eligibilityCriteria: {
      educationLevel: ["College"],
      minGWA: 1.75,
      priorityCourse: true,
      qcResident: true,
      additionalCriteria: "Enrolled in CHED-identified priority courses required by QC Government"
    },
    applicationsCount: 0,
    category: "qcsp"
  },

  // Postgraduate Scholarships
  {
    name: "QC Postgraduate Scholarship",
    provider: "Quezon City Youth Development Office (QCYDO)",
    organization: "Quezon City Youth Development Office (QCYDO)",
    type: "Postgraduate",
    educationLevel: "Postgraduate",
    minGWA: 2.5,
    maxGWA: 1.0,
    amount: 80000,
    deadline: "2024-12-31",
    status: "Active",
    fieldOfStudy: "",
    location: "Quezon City",
    description: "Scholarship for Masters and Doctorate students who are QC Government employees or co-located office staff. Includes thesis/dissertation grant.",
    eligibilityCriteria: {
      educationLevel: ["Postgraduate"],
      minGWA: 2.5,
      isGovernmentEmployee: true,
      qcResident: true,
      employmentDuration: 1, // years
      additionalCriteria: "QC Government employee or co-located office staff for at least 1 year; includes thesis/dissertation grant"
    },
    applicationsCount: 0,
    category: "qcsp"
  },

  // Vocational / Continuing Education Scholarships
  {
    name: "Vocational/TESDA Scholarship",
    provider: "Quezon City Youth Development Office (QCYDO)",
    organization: "Quezon City Youth Development Office (QCYDO)",
    type: "Vocational",
    educationLevel: "Vocational",
    minGWA: null,
    maxGWA: null,
    amount: 15000,
    deadline: "2024-12-31",
    status: "Active",
    fieldOfStudy: "TESDA Courses",
    location: "Quezon City",
    description: "Scholarship for marginalized/indigent groups enrolled in TESDA-accredited or QC-recognized vocational institutions.",
    eligibilityCriteria: {
      educationLevel: ["Vocational"],
      minGWA: null,
      isIndigent: true,
      qcResident: true,
      additionalCriteria: "Marginalized/indigent group enrolled in TESDA-accredited or QC-recognized vocational institution"
    },
    applicationsCount: 0,
    category: "qcsp"
  }
];

// CHED Priority Courses reference data
const CHED_COURSES_DATA = CHED_PRIORITY_COURSES.map((course, index) => ({
  id: index + 1,
  name: course,
  category: "CHED Priority",
  description: `CHED-identified priority course required by QC Government: ${course}`,
  isActive: true
}));

async function seedQCSPPScholarships() {
  try {
    const db = await getDb();
    console.log("🌱 Starting QCSP scholarship seeding...");

    // Seed CHED Priority Courses first
    const existingCourses = await db.collection("ched_priority_courses").find({}).toArray();
    if (existingCourses.length === 0) {
      await db.collection("ched_priority_courses").insertMany(CHED_COURSES_DATA);
      console.log(`✅ Seeded ${CHED_COURSES_DATA.length} CHED priority courses`);
    } else {
      console.log(`ℹ️  CHED priority courses already exist (${existingCourses.length})`);
    }

    // Check existing QCSP scholarships
    const existingScholarships = await db.collection("scholarships").find({ category: "qcsp" }).toArray();
    const existingNames = new Set(existingScholarships.map(s => s.name));

    // Filter only new scholarships
    const newScholarships = QCSP_SCHOLARSHIPS.filter(scholarship => !existingNames.has(scholarship.name));

    if (newScholarships.length > 0) {
      const result = await db.collection("scholarships").insertMany(newScholarships);
      console.log(`✅ Seeded ${result.insertedCount} new QCSP scholarships`);
      
      // Log seeded scholarships
      newScholarships.forEach(scholarship => {
        console.log(`   - ${scholarship.name} (${scholarship.type})`);
      });
    } else {
      console.log(`ℹ️  All QCSP scholarships already exist (${existingScholarships.length})`);
    }

    // Summary
    const totalQCSP = await db.collection("scholarships").countDocuments({ category: "qcsp" });
    console.log(`📊 Total QCSP scholarships in database: ${totalQCSP}`);

    return { success: true, seeded: newScholarships.length, total: totalQCSP };
  } catch (error) {
    console.error("❌ Error seeding QCSP scholarships:", error);
    return { success: false, error: error.message };
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedQCSPPScholarships().then(result => {
    console.log("\n🎉 Seeding completed:", result);
    process.exit(result.success ? 0 : 1);
  });
}

export { seedQCSPPScholarships, QCSP_SCHOLARSHIPS, CHED_PRIORITY_COURSES };
