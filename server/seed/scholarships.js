import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import { fileURLToPath } from "url";
import path from "path";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(currentDir, "../../Backend/.env") });

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
const dbName = process.env.MONGODB_DB || process.env.MONGO_DB || "thesis_software";

if (!uri) {
  throw new Error("Missing MONGODB_URI.");
}

// General documents required by ALL applicants
const generalDocuments = [
  "Copy of Grades / Transcript of Records / Form 137 or 138 for the last school year attended",
  "Proof of school enrollment/registration/acceptance for the current school year",
  "Valid QCitizen ID"
];

const scholarships = [
  // ============================================================================
  // COLLEGE-LEVEL SCHOLARSHIPS
  // ============================================================================
  
  // 1. College Academic Scholarship
  {
    name: "College Academic Scholarship",
    provider: "Quezon City Youth Development Office",
    organization: "QCYDO",
    amount: 30000,
    deadline: new Date("2026-06-30"),
    status: "Active",
    type: "Academic",
    fieldOfStudy: "All Fields",
    location: "Quezon City",
    description: "Scholarship for college students who graduated from Senior High School with Academic Honors (Rank 1-10) or top 10 highest overall GWA.",
    minimumGPA: 1.75,
    requiredEducationLevel: ["College / Undergraduate"],
    specificCriteria: [
      "Must have graduated from SHS with Academic Honors (Rank 1-10) OR",
      "Must have top 10 highest overall GWA in graduating class"
    ],
    requiredDocuments: [
      "Proof of academic honors received (Rank 1-10 certificate) OR",
      "Proof that GWA is within top 10 highest overall"
    ],
    generalDocuments: generalDocuments,
    eligibilityCriteria: {
      educationLevel: ["College / Undergraduate"],
      requiresAcademicHonors: true,
      qcResident: true
    },
    applicationsCount: 0,
    createdAt: new Date(),
  },
  
  // 2. College Athletic and Arts Scholarship
  {
    name: "College Athletic and Arts Scholarship",
    provider: "Quezon City Youth Development Office",
    organization: "QCYDO",
    amount: 20000,
    deadline: new Date("2026-06-30"),
    status: "Active",
    type: "Athletic / Arts",
    fieldOfStudy: "All Fields",
    location: "Quezon City",
    description: "Scholarship for college students who are recent recipients of major individual awards for sports or arts, or current members of QC-recognized sports/arts programs.",
    minimumGPA: 2.5,
    requiredEducationLevel: ["College / Undergraduate"],
    specificCriteria: [
      "Must be a recent recipient of a major individual award for sports or arts OR",
      "Must be a current member of a sports/arts program recognized by QC City Government"
    ],
    requiredDocuments: [
      "Proof of recent major award/recognition for sports or arts OR",
      "Proof of membership in a QC-recognized sports/arts program"
    ],
    generalDocuments: generalDocuments,
    eligibilityCriteria: {
      educationLevel: ["College / Undergraduate"],
      isAthlete: true,
      isArtist: true,
      qcResident: true
    },
    applicationsCount: 0,
    createdAt: new Date(),
  },
  
  // 3. College Youth Leaders Scholarship
  {
    name: "College Youth Leaders Scholarship",
    provider: "Quezon City Youth Development Office",
    organization: "QCYDO",
    amount: 20000,
    deadline: new Date("2026-06-30"),
    status: "Active",
    type: "Leadership",
    fieldOfStudy: "All Fields",
    location: "Quezon City",
    description: "Scholarship for college students who are recognized youth leaders serving as SK, SSG officials, or members of QC-registered Youth Organizations.",
    minimumGPA: 2.5,
    requiredEducationLevel: ["College / Undergraduate"],
    specificCriteria: [
      "Must be a recent recipient of a recognized leadership award by QC City OR",
      "Must be a current official of SK, SSG, or equivalent, and QC-registered Youth Organizations"
    ],
    requiredDocuments: [
      "Proof of leadership award received OR",
      "Proof of leadership position held (SK/SSG/Youth Org certificate)"
    ],
    generalDocuments: generalDocuments,
    eligibilityCriteria: {
      educationLevel: ["College / Undergraduate"],
      isSKOfficial: true,
      isStudentLeader: true,
      qcResident: true
    },
    applicationsCount: 0,
    createdAt: new Date(),
  },
  
  // 4. Economic Scholarship
  {
    name: "Economic Scholarship",
    provider: "Quezon City Youth Development Office",
    organization: "QCYDO",
    amount: 25000,
    deadline: new Date("2026-06-30"),
    status: "Active",
    type: "Economic",
    fieldOfStudy: "All Fields",
    location: "Quezon City",
    description: "Scholarship for students from low-income households, marginalized sectors, and vulnerable groups in Quezon City.",
    minimumGPA: 3.0,
    requiredEducationLevel: ["College / Undergraduate"],
    specificCriteria: [
      "Must belong to a household with combined annual income within low middle income to poverty threshold levels OR",
      "Must belong to any of these groups: displaced/relocated families within QC, PWDs, Kasambahays, ALS graduates, solo parents, children of parents with final criminal conviction, family members of tricycle drivers/operators, or other vulnerable/marginalized sectors"
    ],
    requiredDocuments: [
      "Certificate of Indigency from Barangay or QC SSDD OR",
      "Proof of SSS registration as Kasambahay OR",
      "DepEd Certification for ALS graduates OR",
      "Solo Parent ID or SSDD certificate OR",
      "Court certification for children of convicted parents OR",
      "Latest contract or proof of income for OFW children OR",
      "Proof of Income / latest ITR of parents OR",
      "Affidavit of Non-filing of ITR OR",
      "BIR Certificate of Tax Exemption"
    ],
    generalDocuments: generalDocuments,
    eligibilityCriteria: {
      educationLevel: ["College / Undergraduate"],
      isIndigent: true,
      isPWD: true,
      isSoloParent: true,
      qcResident: true
    },
    applicationsCount: 0,
    createdAt: new Date(),
  },
  
  // 5. Specialized Courses Scholarship
  {
    name: "Specialized Courses Scholarship",
    provider: "Quezon City Youth Development Office",
    organization: "QCYDO",
    amount: 35000,
    deadline: new Date("2026-06-30"),
    status: "Active",
    type: "Specialized",
    fieldOfStudy: "CHED Priority Courses",
    location: "Quezon City",
    description: "Scholarship for first-year college students enrolled in priority courses identified by QC Government, with demonstrated leadership and volunteer work.",
    minimumGPA: 1.75,
    requiredEducationLevel: ["College / Undergraduate"],
    specificCriteria: [
      "Must be a freshman/first year tertiary student at time of application",
      "Must be enrolled in priority courses identified by QC Government",
      "Must pass interviews and aptitude/psychological tests administered by QC Government",
      "Must show proof of leadership/volunteer work/socio-civic engagements"
    ],
    requiredDocuments: [
      "Proof of leadership position/volunteer work/social engagement",
      "At least two (2) endorsement letters from recognized organizations"
    ],
    generalDocuments: generalDocuments,
    eligibilityCriteria: {
      educationLevel: ["College / Undergraduate"],
      isFirstYear: true,
      isCHEDPriorityCourse: true,
      requiresAcademicHonors: true,
      qcResident: true
    },
    applicationsCount: 0,
    createdAt: new Date(),
  },
  
  // 6. QC Excel Scholarship
  {
    name: "QC Excel Scholarship",
    provider: "Quezon City Youth Development Office",
    organization: "QCYDO",
    amount: 50000,
    deadline: new Date("2026-06-30"),
    status: "Active",
    type: "Excellence",
    fieldOfStudy: "CHED Priority Courses",
    location: "Quezon City",
    description: "Premier scholarship for first-year college students demonstrating academic excellence, leadership, and volunteerism in priority courses.",
    minimumGPA: 1.75,
    requiredEducationLevel: ["College / Undergraduate"],
    specificCriteria: [
      "Must be a freshman/first year tertiary student",
      "Must be enrolled in priority courses identified by QC Government",
      "Must pass interviews and aptitude/psychological tests",
      "Must demonstrate academic excellence, leadership, and volunteerism"
    ],
    requiredDocuments: [
      "Proof of leadership position/volunteer work/social engagement",
      "At least two (2) endorsement letters from recognized organizations"
    ],
    generalDocuments: generalDocuments,
    eligibilityCriteria: {
      educationLevel: ["College / Undergraduate"],
      isFirstYear: true,
      isCHEDPriorityCourse: true,
      holisticEvaluation: true,
      qcResident: true
    },
    applicationsCount: 0,
    createdAt: new Date(),
  },

  // ============================================================================
  // SHS-LEVEL SCHOLARSHIPS
  // ============================================================================
  
  // 7. SHS Academic Scholarship
  {
    name: "SHS Academic Scholarship",
    provider: "Quezon City Youth Development Office",
    organization: "QCYDO",
    amount: 15000,
    deadline: new Date("2026-06-30"),
    status: "Active",
    type: "Academic",
    fieldOfStudy: "All Fields",
    location: "Quezon City",
    description: "Scholarship for Senior High School students who graduated from Junior High School with Academic Honors (Rank 1-10) or top 10 highest overall GWA.",
    minimumGPA: 89, // 89% for SHS percentage-based grading
    requiredEducationLevel: ["Senior High School"],
    specificCriteria: [
      "Must have graduated from JHS with Academic Honors (Rank 1-10) OR",
      "Must have top 10 highest overall GWA in graduating class",
      "Minimum GWA: 89% or equivalent"
    ],
    requiredDocuments: [
      "Proof of academic honors (Rank 1-10 certificate) OR",
      "Proof that GWA is within top 10 highest overall"
    ],
    generalDocuments: generalDocuments,
    eligibilityCriteria: {
      educationLevel: ["Senior High School"],
      requiresAcademicHonors: true,
      qcResident: true
    },
    applicationsCount: 0,
    createdAt: new Date(),
  },
  
  // 8. SHS Specialized Track Scholarship
  {
    name: "SHS Specialized Track Scholarship",
    provider: "Quezon City Youth Development Office",
    organization: "QCYDO",
    amount: 18000,
    deadline: new Date("2026-06-30"),
    status: "Active",
    type: "Specialized",
    fieldOfStudy: "Specialized Public SHS",
    location: "Quezon City",
    description: "Scholarship for students enrolled at Specialized Public Senior High Schools.",
    minimumGPA: 89, // 89% for SHS percentage-based grading
    requiredEducationLevel: ["Senior High School"],
    specificCriteria: [
      "Must be enrolled at a Specialized Public Senior High School",
      "Minimum GWA: 89% or equivalent"
    ],
    requiredDocuments: [],
    generalDocuments: generalDocuments,
    eligibilityCriteria: {
      educationLevel: ["Senior High School"],
      requiresSpecializedTrack: true,
      qcResident: true
    },
    applicationsCount: 0,
    createdAt: new Date(),
  },
  
  // 9. SHS Athletic and Arts Scholarship
  {
    name: "SHS Athletic and Arts Scholarship",
    provider: "Quezon City Youth Development Office",
    organization: "QCYDO",
    amount: 12000,
    deadline: new Date("2026-06-30"),
    status: "Active",
    type: "Athletic / Arts",
    fieldOfStudy: "All Fields",
    location: "Quezon City",
    description: "Scholarship for SHS students who are recent recipients of major awards for sports or arts, or current members of QC-recognized sports/arts programs.",
    minimumGPA: 85, // 85% for SHS percentage-based grading
    requiredEducationLevel: ["Senior High School"],
    specificCriteria: [
      "Must be a recent recipient of a major award for sports or arts OR",
      "Must be a current member of a sports/arts program recognized by QC City",
      "Minimum GWA: 85% or equivalent"
    ],
    requiredDocuments: [
      "Proof of recent major award/recognition for sports or arts OR",
      "Proof of membership in a QC-recognized sports/arts program"
    ],
    generalDocuments: generalDocuments,
    eligibilityCriteria: {
      educationLevel: ["Senior High School"],
      isAthlete: true,
      isArtist: true,
      qcResident: true
    },
    applicationsCount: 0,
    createdAt: new Date(),
  },
  
  // 10. SHS Youth Leaders Scholarship
  {
    name: "SHS Youth Leaders Scholarship",
    provider: "Quezon City Youth Development Office",
    organization: "QCYDO",
    amount: 12000,
    deadline: new Date("2026-06-30"),
    status: "Active",
    type: "Leadership",
    fieldOfStudy: "All Fields",
    location: "Quezon City",
    description: "Scholarship for SHS students serving as SK, SSG officials, or members of QC-registered Youth Organizations, or recent recipients of leadership awards.",
    minimumGPA: 85, // 85% for SHS percentage-based grading
    requiredEducationLevel: ["Senior High School"],
    specificCriteria: [
      "Must currently serve as official of SK, SSG or equivalent, and QC-registered Youth Organizations OR",
      "Must be a recent recipient of a recognized leadership award",
      "Minimum GWA: 85% or equivalent"
    ],
    requiredDocuments: [
      "Proof of leadership award received OR",
      "Proof of leadership position held"
    ],
    generalDocuments: generalDocuments,
    eligibilityCriteria: {
      educationLevel: ["Senior High School"],
      isSKOfficial: true,
      isStudentLeader: true,
      qcResident: true
    },
    applicationsCount: 0,
    createdAt: new Date(),
  },

  // ============================================================================
  // POSTGRADUATE SCHOLARSHIP
  // ============================================================================
  
  // 11. QC Postgraduate Scholarship
  {
    name: "QC Postgraduate Scholarship",
    provider: "Quezon City Youth Development Office",
    organization: "QCYDO",
    amount: 80000,
    deadline: new Date("2026-06-30"),
    status: "Active",
    type: "Postgraduate",
    fieldOfStudy: "All Fields",
    location: "Quezon City",
    description: "Scholarship for QC Government employees or those working with QC Government offices/units for at least 1 year pursuing postgraduate studies.",
    minimumGPA: 2.5,
    requiredEducationLevel: ["Postgraduate (Masters / Doctorate)"],
    specificCriteria: [
      "Must be employed within QC Government OR with offices/units working with QC Government for at least 1 year"
    ],
    requiredDocuments: [
      "Proof of employment (indicating salary grade and position held)",
      "Recommendation from Unit/Department/Office Head",
      "Proof of duties and responsibilities"
    ],
    generalDocuments: generalDocuments,
    eligibilityCriteria: {
      educationLevel: ["Postgraduate (Masters / Doctorate)"],
      isGovernmentEmployee: true,
      qcResident: true
    },
    applicationsCount: 0,
    createdAt: new Date(),
  },

  // ============================================================================
  // VOCATIONAL/TESDA SCHOLARSHIP
  // ============================================================================
  
  // 12. Vocational/TESDA Scholarship
  {
    name: "Vocational/TESDA Scholarship",
    provider: "Quezon City Youth Development Office",
    organization: "QCYDO",
    amount: 15000,
    deadline: new Date("2026-06-30"),
    status: "Active",
    type: "Vocational",
    fieldOfStudy: "TESDA Short Courses",
    location: "Quezon City",
    description: "Scholarship for students enrolled in TESDA short courses or licensure/board/bar exam review courses from QC-recognized training institutions.",
    minimumGPA: null, // No minimum GPA requirement
    requiredEducationLevel: ["Vocational / TESDA"],
    specificCriteria: [
      "Must be enrolled in short courses or licensure/board/bar exam review courses from a training institution recognized by QC City"
    ],
    requiredDocuments: [],
    generalDocuments: generalDocuments,
    eligibilityCriteria: {
      educationLevel: ["Vocational / TESDA"],
      qcResident: true
    },
    applicationsCount: 0,
    createdAt: new Date(),
  },
];

async function main() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const collection = client.db(dbName).collection("scholarships");
    await collection.deleteMany({});
    await collection.insertMany(scholarships);
    console.log(`Seeded ${scholarships.length} scholarships`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
