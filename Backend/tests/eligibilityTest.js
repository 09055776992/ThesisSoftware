import dotenv from "dotenv";
dotenv.config();

import { checkEligibility, calculateMatchScore } from "../eligibility-matching.js";
import { QCSP_SCHOLARSHIPS } from "../seed-qcsp-scholarships.js";

const getScholarship = (name) => {
  const scholarship = QCSP_SCHOLARSHIPS.find((s) => s.name === name);
  if (!scholarship) {
    throw new Error(`Scholarship not found: ${name}`);
  }
  return scholarship;
};

const profileCompleteness = (user) => {
  const fields = [
    { key: "name" },
    { key: "email" },
    { key: "phone" },
    { key: "location" },
    { key: "bio" },
    { key: "profilePicture" },
    { key: "skills" },
    { key: "gpa" },
    { key: "fieldOfStudy" },
    { key: "incomeCategory" },
  ];

  return fields.reduce((total, field) => {
    const value = user[field.key];
    const filled = value !== null && value !== undefined && value !== "" && !(Array.isArray(value) && value.length === 0);
    return total + (filled ? 10 : 0);
  }, 0);
};

const testEligibility = () => {
  const cases = [
    {
      id: "TEST CASE A",
      student: {
        location: "Quezon City",
        educationLevel: "College / Undergraduate",
        yearLevel: "1st Year",
        year_level: "First Year",
        gpa: 1.75,
        fieldOfStudy: "Computer Science",
        course: "Computer Science",
        incomeCategory: "₱25,000 – ₱50,000",
        financialNeed: 4,
        isScholarOfAnotherLGU: false,
        is_lgu_scholar: false,
        isOtherLGUScholar: false,
        schoolLocation: "Quezon City",
        is_qc_resident: true,
        isGovernmentEmployee: false,
        isAthlete: false,
        isArtist: false,
        isIndigent: false,
        isPWD: false,
        isSoloParent: false,
        isFirstYear: true,
      },
      expectations: [
        { scholarship: "College Academic Scholarship", expected: true },
        { scholarship: "College Athletic and Arts Scholarship", expected: false },
        { scholarship: "Economic Scholarship", expected: true },
        { scholarship: "SHS Academic Scholarship", expected: false },
        { scholarship: "QC Postgraduate Scholarship", expected: false },
      ],
    },
    {
      id: "TEST CASE B",
      student: {
        location: "Quezon City",
        educationLevel: "Senior High School",
        yearLevel: "Grade 12",
        gpa: 1.5,
        isScholarOfAnotherLGU: false,
        is_lgu_scholar: false,
        isOtherLGUScholar: false,
        schoolLocation: "Quezon City",
        schoolType: "Public Senior High School",
        specialized_track: true,
        is_qc_resident: true,
      },
      expectations: [
        { scholarship: "SHS Academic Scholarship", expected: true },
        { scholarship: "SHS Specialized Track Scholarship", expected: true },
        { scholarship: "SHS Athletic and Arts Scholarship", expected: false },
        { scholarship: "College Academic Scholarship", expected: false },
      ],
    },
    {
      id: "TEST CASE C",
      student: {
        location: "Marikina City",
        educationLevel: "College / Undergraduate",
        gpa: 1.5,
        is_qc_resident: false,
      },
      expectations: QCSP_SCHOLARSHIPS.map((scholarship) => ({ scholarship: scholarship.name, expected: false })),
    },
    {
      id: "TEST CASE D",
      student: {
        location: "Quezon City",
        educationLevel: "College / Undergraduate",
        gpa: 1.5,
        isScholarOfAnotherLGU: true,
        is_lgu_scholar: true,
        isOtherLGUScholar: true,
        is_qc_resident: true,
      },
      expectations: QCSP_SCHOLARSHIPS.map((scholarship) => ({ scholarship: scholarship.name, expected: false })),
    },
    {
      id: "TEST CASE E",
      student: {
        location: "Quezon City",
        educationLevel: "Postgraduate (Masters / Doctorate)",
        gpa: 2.5,
        isQCGovernmentEmployee: true,
        is_government_employee: true,
        yearsInService: 2,
        employmentDuration: 2,
        is_qc_resident: true,
        schoolType: "Graduate School",
      },
      expectations: [
        { scholarship: "QC Postgraduate Scholarship", expected: true },
        { scholarship: "College Academic Scholarship", expected: false },
        { scholarship: "SHS Academic Scholarship", expected: false },
        { scholarship: "Economic Scholarship", expected: false },
      ],
    },
    {
      id: "TEST CASE F",
      student: {
        location: "Quezon City",
        educationLevel: "College / Undergraduate",
        gpa: 3.5,
        is_qc_resident: true,
      },
      expectations: [
        { scholarship: "College Academic Scholarship", expected: false },
        { scholarship: "Economic Scholarship", expected: false },
      ],
    },
  ];

  const results = [];

  cases.forEach((testCase) => {
    console.log(`\n=== ${testCase.id} ===`);
    testCase.expectations.forEach(({ scholarship, expected }) => {
      const award = getScholarship(scholarship);
      const eligibility = checkEligibility(testCase.student, award);
      const actual = eligibility.isEligible === true;
      const status = actual === expected ? "✅ PASS" : "❌ FAIL";
      console.log(`${status} — ${scholarship}: ${actual ? "QUALIFIED" : "NOT QUALIFIED"} as expected: ${expected ? "QUALIFIED" : "NOT QUALIFIED"}`);
      if (status.startsWith("❌")) {
        console.log(`   Expected ${expected ? "QUALIFIED" : "NOT QUALIFIED"} but got ${actual ? "QUALIFIED" : "NOT QUALIFIED"}`);
        console.log(`   reasons: ${eligibility.unmetCriteria.join(", ") || "none"}`);
      }
      results.push({ testCase: testCase.id, scholarship, expected, actual, eligibility });
    });
  });

  return results;
};

const testMatchScore = () => {
  console.log("\n=== MATCH SCORE TESTS ===");
  const studentA = {
    location: "Quezon City",
    educationLevel: "College / Undergraduate",
    yearLevel: "1st Year",
    year_level: "First Year",
    gpa: 1.75,
    fieldOfStudy: "Computer Science",
    course: "Computer Science",
    incomeCategory: "₱25,000 – ₱50,000",
    financialNeed: 4,
    is_qc_resident: true,
    isScholarOfAnotherLGU: false,
    is_lgu_scholar: false,
    isOtherLGUScholar: false,
  };

  const collegeAcademic = getScholarship("College Academic Scholarship");
  const shsAcademic = getScholarship("SHS Academic Scholarship");
  const nonQc = {
    location: "Marikina City",
    educationLevel: "College / Undergraduate",
    gpa: 1.5,
    is_qc_resident: false,
  };

  const tests = [
    {
      student: studentA,
      scholarship: collegeAcademic,
      expectedRange: [75, 100],
      description: "TEST CASE A against College Academic Scholarship",
    },
    {
      student: studentA,
      scholarship: shsAcademic,
      expectedRange: [0, 0],
      description: "TEST CASE A against SHS Academic Scholarship",
    },
    {
      student: nonQc,
      scholarship: collegeAcademic,
      expectedRange: [0, 0],
      description: "TEST CASE C against College Academic Scholarship",
    },
  ];

  tests.forEach((test) => {
    const eligibility = checkEligibility(test.student, test.scholarship);
    const finalScore = calculateMatchScore(test.student, test.scholarship, eligibility);
    const match = finalScore >= test.expectedRange[0] && finalScore <= test.expectedRange[1];
    const status = match ? "✅ PASS" : "❌ FAIL";
    console.log(`\n${status} — ${test.description}`);
    console.log(JSON.stringify({
      scholarshipName: test.scholarship.name,
      studentCase: test.description,
      locationMatch: test.scholarship.eligibilityCriteria.qcResident ? test.student.is_qc_resident === true : undefined,
      educationMatch: eligibility.criteriaChecks.educationLevel?.passed || false,
      gpaMatch: eligibility.criteriaChecks.gpa?.passed || false,
      specificCriteriaMatch: eligibility.isEligible || eligibility.mayBeEligible,
      finalScore: `${finalScore}%`,
      result: status,
    }, null, 2));
  });
};

const testProfileCompleteness = () => {
  console.log("\n=== PROFILE COMPLETENESS TESTS ===");
  const cases = [
    { id: "Empty profile", user: { email: "empty@example.com" }, expected: 10 },
    { id: "Partial profile", user: { name: "Jane Doe", email: "jane@example.com", location: "Quezon City", gpa: 1.7 }, expected: 40 },
    {
      id: "Full profile",
      user: {
        name: "Jane Doe",
        email: "jane@example.com",
        phone: "09171234567",
        location: "Quezon City",
        bio: "Student",
        profilePicture: "avatar.png",
        skills: ["Leadership"],
        gpa: 1.5,
        fieldOfStudy: "Computer Science",
        incomeCategory: "Low",
      },
      expected: 100,
    },
  ];

  cases.forEach(({ id, user, expected }) => {
    const actual = profileCompleteness(user);
    const status = actual === expected ? "✅ PASS" : "❌ FAIL";
    console.log(`${status} — ${id}: actual=${actual}%, expected=${expected}%`);
    if (status.startsWith("❌")) {
      console.log(`   User data: ${JSON.stringify(user)}`);
    }
  });
};

const main = () => {
  console.log("SCHOLAR ALGORITHM CORRECTNESS TEST\n");
  testEligibility();
  testMatchScore();
  testProfileCompleteness();
};

main();
