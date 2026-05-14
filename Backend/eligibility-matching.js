// Eligibility Matching Logic for QCSP Scholarships
const DEBUG_ELIGIBILITY = process.env.DEBUG_ELIGIBILITY === "1";

// CHED Priority Courses (reference)
const CHED_PRIORITY_COURSES = [
  "Accountancy", "Architecture", "Civil Engineering", "Computer Engineering",
  "Computer Science", "Electrical Engineering", "Electronics Engineering",
  "Industrial Engineering", "Mechanical Engineering", "Nursing", "Pharmacy",
  "Psychology", "Teacher Education", "Information Technology", "Business Administration",
  "Public Administration", "Social Work", "Development Communication",
  "Environmental Science", "Statistics"
];

function normalizeBoolean(value) {
  return value === true || value === "true" || value === "True" || value === 1 || value === "1";
}

function getStudentSpecialCategories(student) {
  const nested = student.specialCategories || {};
  return {
    isAthlete: normalizeBoolean(nested.isAthlete) || normalizeBoolean(student.isAthlete) || normalizeBoolean(student.is_athlete),
    isArtist: normalizeBoolean(nested.isArtist) || normalizeBoolean(student.isArtist) || normalizeBoolean(student.is_artist),
    isSKOfficial: normalizeBoolean(nested.isSKOfficial) || normalizeBoolean(student.isSKOfficial) || normalizeBoolean(student.is_sk_official),
    isStudentLeader: normalizeBoolean(nested.isStudentLeader) || normalizeBoolean(student.isStudentLeader) || !!student.is_student_leader || !!student.student_council_position || !!student.studentGovernmentPosition,
    // UI historically saved "From Indigent / Low-income" as isFromIndigenousFamily; treat as indigent for need-based matching
    isIndigent:
      normalizeBoolean(nested.isIndigent) ||
      normalizeBoolean(nested.isFromIndigenousFamily) ||
      normalizeBoolean(student.isIndigent) ||
      normalizeBoolean(student.is_indigent),
    isPWD: normalizeBoolean(nested.isPWD) || normalizeBoolean(student.isPWD) || normalizeBoolean(student.is_pwd),
    isSoloParent: normalizeBoolean(nested.isSoloParent) || normalizeBoolean(student.isSoloParent) || normalizeBoolean(student.is_solo_parent),
    isFromIndigenousFamily: normalizeBoolean(nested.isFromIndigenousFamily) || normalizeBoolean(student.isFromIndigenousFamily) || normalizeBoolean(student.is_from_indigenous_family),
  };
}

function isPovertyIncomeCategory(incomeCategory) {
  const normalized = String(incomeCategory || "").trim().toLowerCase();
  if (normalized === "under-25000" || normalized === "under_25000") return true;
  return (
    normalized === "₱10,000 – ₱25,000" ||
    normalized === "₱10,000 - ₱25,000" ||
    normalized === "₱10,000–₱25,000" ||
    normalized === "₱10,000-₱25,000" ||
    normalized === "10,000 – 25,000" ||
    normalized === "10,000 - 25,000" ||
    normalized === "10,000–25,000" ||
    normalized === "10,000-25,000" ||
    normalized === "under ₱25,000"
  );
}

function isQuezonCityText(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return (
    normalized === "quezon-city" ||
    normalized === "quezon city" ||
    normalized.includes("quezon city") ||
    normalized === "qc" ||
    normalized === "q.c." ||
    /^qc[,.]?$/.test(normalized) ||
    normalized.includes("qc,") ||
    normalized.endsWith(" qc") ||
    normalized.startsWith("qc ")
  );
}

function getStudentGradeValue(student) {
  const values = [student.gpa, student.GPA, student.gwa, student.GWA]
    .map((value) => parseFloat(value))
    .filter((value) => Number.isFinite(value));
  return values.length > 0 ? values[0] : null;
}

function getStudentPercentageValue(student) {
  const values = [student.percentage, student.percentageGrade]
    .map((value) => parseFloat(value))
    .filter((value) => Number.isFinite(value));
  return values.length > 0 ? values[0] : null;
}

function getEconomicPass(student) {
  const studentCategories = getStudentSpecialCategories(student);
  const incomeCategory = String(student.incomeCategory || student.income_category || "").trim();
  const incomeLower = incomeCategory.toLowerCase();
  return (
    ["Under ₱25,000", "₱10,000 – ₱25,000", "₱10,000 - ₱25,000", "under-25000", "under_25000"].includes(incomeCategory) ||
    incomeLower === "under ₱25,000" ||
    studentCategories.isFromIndigenousFamily ||
    studentCategories.isPWD ||
    studentCategories.isSoloParent ||
    studentCategories.isIndigent ||
    isPovertyIncomeCategory(incomeCategory) ||
    parseInt(student.financialNeed, 10) >= 4 ||
    parseInt(student.financial_need, 10) >= 4
  );
}

function evaluateSpecialCategoryRequirement(student, criteria) {
  const studentCategories = getStudentSpecialCategories(student);
  const requiresAthlete = criteria.isAthlete === true;
  const requiresArtist = criteria.isArtist === true;
  const requiresSKOfficial = criteria.isSKOfficial === true;
  const requiresStudentLeader = criteria.isStudentLeader === true;
  const requiresIndigent = criteria.isIndigent === true;
  const requiresPWD = criteria.isPWD === true;
  const requiresSoloParent = criteria.isSoloParent === true;

  const athleteOrArtistRequired = requiresAthlete && requiresArtist;
  const athleticArtsPassed = athleteOrArtistRequired
    ? studentCategories.isAthlete || studentCategories.isArtist
    : (requiresAthlete ? studentCategories.isAthlete : (requiresArtist ? studentCategories.isArtist : true));

  const leaderRequired = requiresSKOfficial && requiresStudentLeader;
  const leaderPassed = leaderRequired
    ? studentCategories.isSKOfficial || studentCategories.isStudentLeader
    : (requiresSKOfficial ? studentCategories.isSKOfficial : (requiresStudentLeader ? studentCategories.isStudentLeader : true));

  const economicRequired = requiresIndigent || requiresPWD || requiresSoloParent;
  const economicPassed = economicRequired ? getEconomicPass(student) : true;

  const specialRequirementPassed = (athleteOrArtistRequired ? athleticArtsPassed : true)
    && (leaderRequired ? leaderPassed : true)
    && (economicRequired ? economicPassed : true);

  return {
    studentCategories,
    requiresAthlete,
    requiresArtist,
    athleteOrArtistRequired,
    athleticArtsPassed,
    requiresSKOfficial,
    requiresStudentLeader,
    leaderRequired,
    leaderPassed,
    requiresIndigent,
    requiresPWD,
    requiresSoloParent,
    economicPassed,
    specialRequirementPassed,
  };
}

/**
 * Check if a student is eligible for a scholarship based on their profile
 * @param {Object} student - Student profile data
 * @param {Object} scholarship - Scholarship data with eligibility criteria
 * @returns {Object} - Eligibility result with reasons
 */
function checkEligibility(student, scholarship) {
  const eligibility = {
    isEligible: true,
    reasons: [],
    mayBeEligible: false,
    unmetCriteria: [],
    criteriaChecks: {} // Detailed pass/fail per criterion
  };

  const criteria = scholarship.eligibilityCriteria || {};

  // ============================================================================
  // PART 1: UNIVERSAL ELIGIBILITY CHECKS (Apply to ALL QCYDO Scholarships)
  // ============================================================================

  // 1.1 QC Residency Check (ALL QCSP scholarships require QC residency)
  const studentLocation = student.location || student.address || student.city || student.residence || student.userAddress || "";
  const locationLower = String(studentLocation).toLowerCase().trim();
  
  const isQCResident = student.is_qc_resident === true || 
                       student.isQCResident === true ||
                       student.qcResident === true ||
                       isQuezonCityText(locationLower);
  
  eligibility.criteriaChecks.qcResident = {
    passed: isQCResident,
    label: "Quezon City Resident",
    message: isQCResident ? "Verified QC Resident" : "Must be a Quezon City resident"
  };
  
  if (!isQCResident) {
    eligibility.isEligible = false;
    eligibility.unmetCriteria.push("Must be a Quezon City resident");
    return eligibility; // Early exit - QC residency is mandatory
  }

  // 1.2 Not a scholar of another Local Government Unit
  const isOtherLGUScholar = student.is_lgu_scholar === true || 
                            student.isOtherLGUScholar === true ||
                            student.lguScholar === true;
  
  eligibility.criteriaChecks.notOtherLGUScholar = {
    passed: !isOtherLGUScholar,
    label: "Not a scholar of another LGU",
    message: !isOtherLGUScholar ? "Not receiving other LGU scholarship" : "Currently a scholar of another Local Government Unit"
  };
  
  if (isOtherLGUScholar) {
    eligibility.isEligible = false;
    eligibility.unmetCriteria.push("Must not be a scholar of another Local Government Unit");
    return eligibility; // Early exit - cannot be another LGU scholar
  }

  // 1.3 Enrolled/Registered/Accepted in QC-recognized school
  // NEW: Check using detailed school fields from student settings
  const hasSchoolName = student.schoolName && student.schoolName.trim().length > 0;
  const schoolLocation = student.schoolLocation || student.school_location || student.schoolCity || "";
  const schoolLocationProvided = String(schoolLocation).trim().length > 0;
  const schoolInQC = isQuezonCityText(schoolLocation) || isQuezonCityText(student.schoolCampus);
  const legacyEnrolledCheck = student.enrolled_in_qc_school === true || 
                               student.enrolledInQCRecognized === true ||
                               student.enrolledInQCSchool === true ||
                               student.school_qc_recognized === true ||
                               (student.enrollment_status && 
                                (student.enrollment_status.toLowerCase().includes("enrolled") ||
                                 student.enrollment_status.toLowerCase().includes("registered") ||
                                 student.enrollment_status.toLowerCase().includes("accepted")));
  
  // Check if they have enrollment proof uploaded
  const hasEnrollmentProof = student.has_enrollment_proof === true ||
                            student.hasEnrollmentProof === true ||
                            (student.documents && student.documents.some(d => 
                              d.type?.toLowerCase().includes("enrollment") || 
                              d.type?.toLowerCase().includes("registration")
                            ));
  
  // Determine enrollment status with enhanced logic
  let enrollmentCheck = false;
  let enrollmentStatus = "unknown";
  let enrollmentMessage = "";
  let enrollmentLabel = "Enrolled in QC-recognized school";
  
  if (!hasSchoolName && !legacyEnrolledCheck && !schoolLocationProvided) {
    // No school info at all
    enrollmentStatus = "no_school";
    enrollmentCheck = false;
    enrollmentLabel = "School Not Provided";
    enrollmentMessage = "Please add your school in Settings before applying";
  } else if (schoolInQC || legacyEnrolledCheck) {
    // School is in QC - auto verified
    enrollmentStatus = "qc_verified";
    enrollmentCheck = true;
    enrollmentLabel = "Enrolled in QC-recognized school";
    enrollmentMessage = student.schoolName ? `${student.schoolName} — Quezon City ✓` : "Enrolled/registered in QC-recognized school";
  } else if (hasSchoolName && !schoolInQC) {
    // School is outside QC - requires verification
    enrollmentStatus = "requires_verification";
    enrollmentCheck = false; // Will be verified during final screening
    enrollmentLabel = "School Requires Verification";
    eligibility.mayBeEligible = true;
    enrollmentMessage = `${student.schoolName} — Staff will verify during final screening`;
  } else if (hasEnrollmentProof) {
    // Has enrollment proof but no explicit QC status
    enrollmentStatus = "proof_uploaded";
    enrollmentCheck = true;
    enrollmentMessage = "Enrollment proof uploaded";
  }
  
  eligibility.criteriaChecks.qcSchoolEnrollment = {
    passed: enrollmentCheck,
    label: enrollmentLabel,
    message: enrollmentMessage,
    status: enrollmentStatus,
    schoolName: student.schoolName || "",
    schoolCampus: student.schoolCampus || "",
    schoolLocation: student.schoolLocation || "",
    schoolType: student.schoolType || ""
  };
  
  if (!enrollmentCheck && enrollmentStatus !== "requires_verification") {
    // Only fail if no school info at all
    eligibility.isEligible = false;
    eligibility.unmetCriteria.push("Must provide school information in Settings");
  } else if (enrollmentStatus === "requires_verification") {
    // May be eligible but requires verification
    eligibility.mayBeEligible = true;
    eligibility.unmetCriteria.push("School requires staff verification");
  } else {
    eligibility.reasons.push("Enrolled in QC-recognized school");
  }

  // ============================================================================
  // PART 2: EDUCATION LEVEL & GPA CHECKS
  // ============================================================================

  // 2.1 Education Level Check - EXACT MATCHING WITH STANDARDIZED VALUES
  // The student settings now uses dropdowns with these exact values:
  // - "Junior High School"
  // - "Senior High School"
  // - "College / Undergraduate"
  // - "Vocational / TESDA"
  // - "Postgraduate (Masters / Doctorate)"
  if (criteria.educationLevel && criteria.educationLevel.length > 0) {
    const studentLevelRaw = student.educationLevel || student.education_level || "";
    const studentLevel = String(studentLevelRaw).trim();
    
    // Normalize criteria levels for comparison
    const normalizedCriteriaLevels = criteria.educationLevel.map(level => String(level).trim());
    
    // EXACT matching: Check if student's education level exactly matches any required level
    const levelMappings = {
      "Senior High School": ["Senior High School", "SHS", "Senior High"],
      "College / Undergraduate": ["College / Undergraduate", "College", "Undergraduate"],
      "Vocational / TESDA": ["Vocational / TESDA", "Vocational", "TESDA"],
      "Postgraduate (Masters / Doctorate)": ["Postgraduate (Masters / Doctorate)", "Postgraduate", "Masters", "Doctorate", "Graduate"],
      "Junior High School": ["Junior High School", "JHS", "Junior High"]
    };
    
    let levelMatches = normalizedCriteriaLevels.includes(studentLevel);
    
    if (!levelMatches) {
      let studentCategory = null;
      for (const [category, variations] of Object.entries(levelMappings)) {
        if (variations.some(v => studentLevel.toLowerCase() === v.toLowerCase())) {
          studentCategory = category;
          break;
        }
      }
      
      if (studentCategory) {
        const studentVariations = levelMappings[studentCategory];
        levelMatches = normalizedCriteriaLevels.some(criteriaLevel => 
          studentVariations.some(v => criteriaLevel.toLowerCase() === v.toLowerCase())
        );
      }
    }
    
    eligibility.criteriaChecks.educationLevel = {
      passed: levelMatches,
      label: "Education Level",
      required: criteria.educationLevel,
      actual: studentLevel || "Not provided",
      message: levelMatches 
        ? `Education level matches: ${studentLevel}` 
        : `Education level mismatch. Required: ${criteria.educationLevel.join(", ")}, Yours: ${studentLevel || 'Not provided'}`
    };
    
    if (!levelMatches) {
      eligibility.isEligible = false;
      eligibility.unmetCriteria.push(`Education level mismatch. Required: ${criteria.educationLevel.join(", ")}, Yours: ${studentLevel || 'Not provided'}`);
      return eligibility;
    }
  }

  // 2.2 GPA/GWA/Percentage Check (supports GPA 0-4.0, GWA 1-5.0, and Percentage 0-100 scales)
  // Check scholarship's minimumGPA field first, then fall back to minGPA/minGWA
  const minimumGPA = scholarship.minimumGPA !== undefined ? scholarship.minimumGPA : 
                     (criteria.minGPA !== undefined ? criteria.minGPA : criteria.minGWA);
  
  if (minimumGPA !== null && minimumGPA !== undefined) {
    // Check for percentage-based grades (SHS uses 0-100 scale)
    const studentPercentage = getStudentPercentageValue(student);
    const studentGPA = getStudentGradeValue(student);
    
    // Determine which scale the requirement uses
    const isPercentage = minimumGPA > 50; // Percentage grades (e.g., 85, 89)
    const isGWA = minimumGPA >= 1.0 && minimumGPA <= 3.0 && minimumGPA <= 5.0; // Philippine GWA: 1.0 (best) to 5.0
    const isGPA = minimumGPA >= 2.0 && minimumGPA <= 4.0; // International GPA: 0-4.0, higher is better
    
    let passed = false;
    let message = "";
    let actualValue = "";
    let label = "Grade";
    
    if (isPercentage) {
      // SHS Percentage scale: 0-100, higher is better
      // Convert student's GWA to percentage if needed (approximate: GWA 1.0 ≈ 95%)
      let studentPercentageValue = studentPercentage;
      if (!studentPercentageValue && studentGPA && studentGPA <= 5.0) {
        // Convert GWA to approximate percentage: (5 - GWA) / 4 * 100
        studentPercentageValue = ((5 - studentGPA) / 4) * 100;
      }
      
      actualValue = studentPercentageValue?.toFixed(2) || studentGPA?.toString() || "Not provided";
      label = "Percentage Grade";
      
      if (studentPercentageValue === null && studentGPA === null) {
        passed = false;
        message = `Grade not provided. Minimum required: ${minimumGPA}%`;
      } else {
        const gradeToCheck = studentPercentageValue !== null ? studentPercentageValue : (studentGPA * 20); // Rough conversion
        passed = gradeToCheck >= minimumGPA;
        message = passed 
          ? `Grade: ${actualValue}% (meets minimum ${minimumGPA}%)`
          : `Grade requirement not met. Minimum: ${minimumGPA}%, Yours: ${actualValue}%`;
      }
    } else if (isGWA) {
      // GWA scale: 1.0 (best) to 5.0 (worst), lower is better
      label = "General Weighted Average (GWA)";
      actualValue = studentGPA !== null ? studentGPA.toString() : "Not provided";
      
      if (studentGPA === null) {
        passed = false;
        message = `GWA not provided. Minimum required: ${minimumGPA}`;
      } else {
        passed = studentGPA <= minimumGPA;
        message = passed 
          ? `GWA: ${studentGPA} (meets maximum ${minimumGPA})`
          : `GWA requirement not met. Maximum: ${minimumGPA}, Yours: ${studentGPA}`;
      }
    } else {
      // Philippine GPA/GWA scale: lower is better
      label = "Grade Point Average (GPA)";
      actualValue = studentGPA !== null ? studentGPA.toString() : "Not provided";
      
      if (studentGPA === null) {
        passed = false;
        message = `GPA not provided. Minimum required: ${minimumGPA}`;
      } else {
        passed = studentGPA <= minimumGPA;
        message = passed 
          ? `GPA: ${studentGPA} (meets maximum ${minimumGPA})`
          : `GPA requirement not met. Maximum: ${minimumGPA}, Yours: ${studentGPA}`;
      }
    }

    if (DEBUG_ELIGIBILITY) {
      console.log('GPA Check:', {
        studentGPA,
        requiredMinimum: minimumGPA,
        comparisonUsed: 'student.gpa <= scholarship.minimumGPA',
        passed: studentGPA !== null ? studentGPA <= minimumGPA : false,
      });
    }
    
    eligibility.criteriaChecks.gpa = {
      passed: passed,
      label: label,
      required: minimumGPA,
      actual: actualValue,
      message: message
    };
    
    if (!passed) {
      eligibility.isEligible = false;
      eligibility.unmetCriteria.push(message);
      return eligibility;
    }
  }

  // 3. GPA/GWA Check (if specified - supports both GPA and GWA scales)
  if (criteria.minGWA !== null && criteria.minGWA !== undefined) {
    const studentGWA = getStudentGradeValue(student);
    // GWA scale: 1.0 (best) to 5.0 (worst), lower is better
    if (studentGWA === null || studentGWA > criteria.minGWA) {
      eligibility.isEligible = false;
      eligibility.unmetCriteria.push(`GWA requirement not met. Minimum: ${criteria.minGWA}, Yours: ${studentGWA || 'Not provided'}`);
      return eligibility; // Early exit - GWA too low
    }
  }

  if (criteria.minGPA !== null && criteria.minGPA !== undefined) {
    const studentGPA = getStudentGradeValue(student);
    // Philippine GPA/GWA scale: lower is better
    if (studentGPA === null || studentGPA > criteria.minGPA) {
      eligibility.isEligible = false;
      eligibility.unmetCriteria.push(`GPA requirement not met. Maximum: ${criteria.minGPA}, Yours: ${studentGPA || 'Not provided'}`);
      return eligibility; // Early exit - GPA too low
    }
  }

  // 4. Field of Study Check
  if (criteria.fieldOfStudy && criteria.fieldOfStudy.length > 0) {
    const studentField = student.fieldOfStudy || student.field_of_study || student.course;
    const isMatch = criteria.fieldOfStudy.some(field => 
      studentField?.toLowerCase().includes(field.toLowerCase()) ||
      field.toLowerCase().includes(studentField?.toLowerCase())
    );
    if (!isMatch) {
      eligibility.isEligible = false;
      eligibility.unmetCriteria.push(`Field of study mismatch. Required: ${criteria.fieldOfStudy.join(", ")}`);
    }
  }

  // 5. Location/Residency Check
  if (criteria.location || criteria.qcResident) {
    const studentLocation = student.location || student.address || student.city;
    const isQCResident = student.is_qc_resident || student.isQCResident || 
                        studentLocation?.toLowerCase().includes("quezon city") ||
                        studentLocation?.toLowerCase().includes("qc");
    
    if (criteria.qcResident && !isQCResident) {
      eligibility.isEligible = false;
      eligibility.unmetCriteria.push("Must be a Quezon City resident");
      return eligibility; // Early exit - QC residency is mandatory
    }
  }

  // 6. Income Category Check
  if (criteria.incomeCategory) {
    const studentIncome = student.incomeCategory || student.income_category;
    if (studentIncome !== criteria.incomeCategory) {
      eligibility.isEligible = false;
      eligibility.unmetCriteria.push(`Income category mismatch. Required: ${criteria.incomeCategory}`);
    }
  }

  if (criteria.maxIncome !== null && criteria.maxIncome !== undefined) {
    const studentIncome = parseFloat(student.income) || parseFloat(student.annualIncome) || 0;
    if (studentIncome > criteria.maxIncome) {
      eligibility.isEligible = false;
      eligibility.unmetCriteria.push(`Income exceeds maximum. Maximum: ₱${criteria.maxIncome.toLocaleString()}, Yours: ₱${studentIncome.toLocaleString()}`);
    }
  }

  // 7. Financial Need Score Check
  if (criteria.financialNeedScore !== null && criteria.financialNeedScore !== undefined) {
    const studentNeedScore = parseInt(student.financialNeedScore) || parseInt(student.financial_need_score) || 0;
    if (studentNeedScore < criteria.financialNeedScore) {
      eligibility.isEligible = false;
      eligibility.unmetCriteria.push(`Financial need score not met. Minimum: ${criteria.financialNeedScore}, Yours: ${studentNeedScore}`);
    }
  }

  // 8. Category-specific checks
  const categoryChecks = {
    // Academic Honors
    requiresAcademicHonors: () => {
      if (criteria.requiresAcademicHonors) {
        const hasHonors = student.academic_honors || student.hasAcademicHonors || 
                         (student.academic_rank && student.academic_rank <= 10);
        if (!hasHonors) {
          eligibility.isEligible = false;
          eligibility.unmetCriteria.push("Requires academic honors (Rank 1-10)");
        } else {
          eligibility.reasons.push("Meets academic honors requirement");
        }
      }
    },

    // Specialized Track (SHS Specialized Track Scholarship)
    requiresSpecializedTrack: () => {
      if (criteria.requiresSpecializedTrack) {
        const isPublicSHS = student.schoolType === "Public Senior High School";
        const hasSpecialized = student.specialized_track || student.hasSpecializedTrack || isPublicSHS;
        
        eligibility.criteriaChecks.specializedTrack = {
          passed: hasSpecialized,
          label: "Enrolled in Public Specialized SHS",
          message: hasSpecialized 
            ? `✓ ${student.schoolName || "Public SHS"} — Verified` 
            : "Must be enrolled in a Public Specialized Senior High School",
          schoolName: student.schoolName || "",
          schoolType: student.schoolType || ""
        };
        
        if (!hasSpecialized) {
          eligibility.isEligible = false;
          eligibility.unmetCriteria.push("Must be enrolled in a Public Specialized Senior High School");
        } else {
          eligibility.reasons.push("Enrolled in Public Specialized SHS");
        }
      }
    },

    // Postgraduate School Check (QC Postgraduate Scholarship)
    requiresGraduateSchool: () => {
      if (criteria.educationLevel && criteria.educationLevel.includes("Postgraduate")) {
        const isGraduateSchool = student.schoolType === "Graduate School" ||
                                 student.schoolType?.toLowerCase().includes("graduate") ||
                                 student.educationLevel?.toLowerCase().includes("postgraduate") ||
                                 student.educationLevel?.toLowerCase().includes("graduate");
        
        eligibility.criteriaChecks.graduateSchool = {
          passed: isGraduateSchool,
          label: "Enrolled in Graduate School",
          message: isGraduateSchool 
            ? `✓ ${student.schoolName || "Graduate School"} — Verified` 
            : "Must be enrolled in a Graduate School / pursuing Master's or Doctorate",
          schoolName: student.schoolName || "",
          schoolType: student.schoolType || ""
        };
        
        if (!isGraduateSchool) {
          eligibility.isEligible = false;
          eligibility.unmetCriteria.push("Must be enrolled in a Graduate School");
        } else {
          eligibility.reasons.push("Enrolled in Graduate School");
        }
      }
    },

    // Athletic/Arts - Handle as OR logic when both are present
    isAthlete: () => {
      const studentCategories = getStudentSpecialCategories(student);
      const needsAthlete = criteria.isAthlete === true;
      const needsArtist = criteria.isArtist === true;
      
      if (needsAthlete && needsArtist) {
        const passed = studentCategories.isAthlete || studentCategories.isArtist;
        eligibility.criteriaChecks.specialCategory = {
          passed,
          label: "Recent sports/arts award recipient or QC-recognized program member",
          message: passed
            ? (studentCategories.isAthlete ? "Athlete status confirmed" : "Artist status confirmed")
            : "Must be a recent recipient of a major sports/arts award or member of a QC-recognized sports/arts program"
        };
        if (!passed) {
          eligibility.isEligible = false;
          eligibility.unmetCriteria.push("Must be a recent recipient of a major sports/arts award or member of a QC-recognized sports/arts program");
        } else {
          eligibility.reasons.push(studentCategories.isAthlete ? "Athlete status confirmed" : "Artist status confirmed");
        }
      } else if (needsAthlete) {
        const passed = studentCategories.isAthlete;
        eligibility.criteriaChecks.specialCategory = {
          passed,
          label: "Athlete status required",
          message: passed ? "Athlete status confirmed" : "Must be an athlete"
        };
        if (!passed) {
          eligibility.isEligible = false;
          eligibility.unmetCriteria.push("Must be an athlete");
        } else {
          eligibility.reasons.push("Athlete status confirmed");
        }
      }
    },

    isArtist: () => {
      const studentCategories = getStudentSpecialCategories(student);
      const needsAthlete = criteria.isAthlete === true;
      const needsArtist = criteria.isArtist === true;
      if (needsArtist && !(needsAthlete && needsArtist)) {
        const passed = studentCategories.isArtist;
        eligibility.criteriaChecks.specialCategory = {
          passed,
          label: "Artist status required",
          message: passed ? "Artist status confirmed" : "Must be an artist"
        };
        if (!passed) {
          eligibility.isEligible = false;
          eligibility.unmetCriteria.push("Must be an artist");
        } else {
          eligibility.reasons.push("Artist status confirmed");
        }
      }
    },

    // Youth Leadership
    isSKOfficial: () => {
      const studentCategories = getStudentSpecialCategories(student);
      const needsSKOfficial = criteria.isSKOfficial === true;
      const needsStudentLeader = criteria.isStudentLeader === true;
      
      if (needsSKOfficial && needsStudentLeader) {
        const passed = studentCategories.isSKOfficial || studentCategories.isStudentLeader;
        eligibility.criteriaChecks.specialCategory = {
          passed,
          label: "SK official or student council/government leader",
          message: passed
            ? (studentCategories.isSKOfficial ? "SK official status confirmed" : "Student leader status confirmed")
            : "Must be an SK/SSG official or recipient of a recognized leadership award"
        };
        if (!passed) {
          eligibility.isEligible = false;
          eligibility.unmetCriteria.push("Must be an SK/SSG official or recipient of a recognized leadership award");
        } else {
          eligibility.reasons.push(studentCategories.isSKOfficial ? "SK official status confirmed" : "Student leader status confirmed");
        }
      } else if (needsSKOfficial) {
        const passed = studentCategories.isSKOfficial;
        eligibility.criteriaChecks.specialCategory = {
          passed,
          label: "SK official status required",
          message: passed ? "SK official status confirmed" : "Must be an SK official"
        };
        if (!passed) {
          eligibility.isEligible = false;
          eligibility.unmetCriteria.push("Must be an SK official");
        } else {
          eligibility.reasons.push("SK official status confirmed");
        }
      }
    },

    isStudentLeader: () => {
      const studentCategories = getStudentSpecialCategories(student);
      const needsSKOfficial = criteria.isSKOfficial === true;
      const needsStudentLeader = criteria.isStudentLeader === true;
      if (needsStudentLeader && !(needsSKOfficial && needsStudentLeader)) {
        const passed = studentCategories.isStudentLeader;
        eligibility.criteriaChecks.specialCategory = {
          passed,
          label: "Student leader status required",
          message: passed ? "Student leader status confirmed" : "Must be a student leader"
        };
        if (!passed) {
          eligibility.isEligible = false;
          eligibility.unmetCriteria.push("Must be a student leader");
        } else {
          eligibility.reasons.push("Student leadership confirmed");
        }
      }
    },

    // Need-based
    isIndigent: () => {
      const studentCategories = getStudentSpecialCategories(student);
      const needsIndigent = criteria.isIndigent === true;
      const needsPWD = criteria.isPWD === true;
      const needsSoloParent = criteria.isSoloParent === true;
      const anyEconomicRequired = needsIndigent || needsPWD || needsSoloParent;
      if (anyEconomicRequired) {
        const passed = getEconomicPass(student);
        eligibility.criteriaChecks.specialCategory = {
          passed,
          label: "Indigent / PWD / Solo parent / poverty-income requirement",
          message: passed
            ? (studentCategories.isIndigent ? "Indigent status confirmed" : studentCategories.isPWD ? "PWD status confirmed" : studentCategories.isSoloParent ? "Solo parent status confirmed" : studentCategories.isFromIndigenousFamily ? "Indigenous family status confirmed" : parseInt(student.financialNeed, 10) >= 4 ? "Financial need confirms eligibility" : "Income category qualifies")
            : "Must be from indigent/marginalized group or within the poverty income threshold"
        };
        if (!passed) {
          eligibility.isEligible = false;
          eligibility.unmetCriteria.push("Must be from indigent/marginalized group or within the poverty income threshold");
        } else {
          if (studentCategories.isIndigent) eligibility.reasons.push("Indigent status confirmed");
          if (studentCategories.isPWD) eligibility.reasons.push("PWD status confirmed");
          if (studentCategories.isSoloParent) eligibility.reasons.push("Solo parent status confirmed");
          if (studentCategories.isFromIndigenousFamily) eligibility.reasons.push("Indigenous family status confirmed");
          if (!studentCategories.isIndigent && !studentCategories.isPWD && !studentCategories.isSoloParent) eligibility.reasons.push("Income category qualifies");
        }
      }
    },

    // PWD
    isPWD: () => {
      if (criteria.isPWD && !criteria.isIndigent && !criteria.isSoloParent) {
        const studentCategories = getStudentSpecialCategories(student);
        const passed = studentCategories.isPWD;
        eligibility.criteriaChecks.specialCategory = {
          passed,
          label: "PWD status required",
          message: passed ? "PWD status confirmed" : "Must be a PWD"
        };
        if (!passed) {
          eligibility.isEligible = false;
          eligibility.unmetCriteria.push("Must be a PWD");
        } else {
          eligibility.reasons.push("PWD status confirmed");
        }
      }
    },

    // Solo Parent
    isSoloParent: () => {
      if (criteria.isSoloParent && !criteria.isIndigent && !criteria.isPWD) {
        const studentCategories = getStudentSpecialCategories(student);
        const passed = studentCategories.isSoloParent;
        eligibility.criteriaChecks.specialCategory = {
          passed,
          label: "Solo parent status required",
          message: passed ? "Solo parent status confirmed" : "Must be a solo parent"
        };
        if (!passed) {
          eligibility.isEligible = false;
          eligibility.unmetCriteria.push("Must be a solo parent");
        } else {
          eligibility.reasons.push("Solo parent status confirmed");
        }
      }
    },

    // Government Employee
    isGovernmentEmployee: () => {
      if (criteria.isGovernmentEmployee) {
        const isGovEmployee = student.is_government_employee || student.isGovernmentEmployee;
        if (!isGovEmployee) {
          eligibility.isEligible = false;
          eligibility.unmetCriteria.push("Must be a QC Government employee");
        } else {
          eligibility.reasons.push("Government employee confirmed");
        }
      }
    },

    // Priority Course
    priorityCourse: () => {
      if (criteria.priorityCourse) {
        const studentCourse = student.course || student.field_of_study || student.fieldOfStudy;
        const isPriorityCourse = CHED_PRIORITY_COURSES.some(
          course => course.toLowerCase() === studentCourse?.toLowerCase()
        );
        if (!isPriorityCourse) {
          eligibility.isEligible = false;
          eligibility.unmetCriteria.push(`Course must be a CHED priority course. Your course: ${studentCourse || 'Not specified'}`);
        } else {
          eligibility.reasons.push(`Enrolled in priority course: ${studentCourse}`);
        }
      }
    },

    // First Year Student
    isFirstYear: () => {
      if (criteria.isFirstYear) {
        const isFirstYear = student.year_level === 1 || student.yearLevel === 1 || 
                           student.year_level === "First Year" || student.isFirstYear;
        if (!isFirstYear) {
          eligibility.isEligible = false;
          eligibility.unmetCriteria.push("Must be a first-year college student");
        } else {
          eligibility.reasons.push("First-year student confirmed");
        }
      }
    },

    // Holistic Evaluation
    holisticEvaluation: () => {
      if (criteria.holisticEvaluation) {
        eligibility.mayBeEligible = true;
        eligibility.reasons.push("Subject to holistic evaluation");
        eligibility.unmetCriteria.push("Requires holistic evaluation of academics, leadership, and socio-civic involvement");
      }
    }
  };

  // Run all relevant category checks
  Object.keys(categoryChecks).forEach(check => {
    if (categoryChecks[check]) {
      categoryChecks[check]();
    }
  });

  const specialReport = evaluateSpecialCategoryRequirement(student, criteria);
  if (DEBUG_ELIGIBILITY && String(scholarship.name || "").toLowerCase().includes("economic")) {
    console.log('Income Check:', {
      incomeCategory: student.incomeCategory,
      isIndigenous: specialReport.studentCategories.isFromIndigenousFamily,
      financialNeed: student.financialNeed,
      passed: specialReport.economicPassed || getEconomicPass(student)
    });
  }
  if (DEBUG_ELIGIBILITY) {
    console.log('Special Categories Check:', {
      scholarship: scholarship.name,
      requiresAthlete: specialReport.requiresAthlete,
      studentIsAthlete: specialReport.studentCategories.isAthlete,
      requiresArtist: specialReport.requiresArtist,
      studentIsArtist: specialReport.studentCategories.isArtist,
      requiresSKOfficial: specialReport.requiresSKOfficial,
      studentIsSKOfficial: specialReport.studentCategories.isSKOfficial,
      requiresStudentLeader: specialReport.requiresStudentLeader,
      studentIsStudentLeader: specialReport.studentCategories.isStudentLeader,
      requiresIndigent: specialReport.requiresIndigent,
      studentIsIndigent: specialReport.studentCategories.isIndigent,
      requiresPWD: specialReport.requiresPWD,
      studentIsPWD: specialReport.studentCategories.isPWD,
      requiresSoloParent: specialReport.requiresSoloParent,
      studentIsSoloParent: specialReport.studentCategories.isSoloParent,
      passed: specialReport.specialRequirementPassed
    });
  }

  // Final eligibility determination
  if (eligibility.isEligible && eligibility.mayBeEligible) {
    eligibility.mayBeEligible = true; // Some criteria need verification
  }

  return eligibility;
}

/**
 * Calculate match percentage based on criteria met
 * @param {Object} student - Student profile
 * @param {Object} scholarship - Scholarship data
 * @param {Object} eligibility - Eligibility result from checkEligibility
 * @returns {number} - Match percentage (0-100)
 */
function calculateMatchScore(student, scholarship, eligibility) {
  const criteria = scholarship.eligibilityCriteria || {};
  const breakdown = {
    locationMatch: false,
    gpaMatch: false,
    educationMatch: false,
    fieldMatch: false,
    incomeMatch: false,
    criteriaDetails: []
  };
  
  // Calculate individual criterion matches for detailed breakdown
  let points = 0;
  let maxPoints = 0;
  
  // 1. QC Residency (25% weight)
  if (criteria.qcResident) {
    maxPoints += 25;
    const studentLocation = String(student.location || student.address || student.city || "").toLowerCase().trim();
    const isQC = student.is_qc_resident === true || isQuezonCityText(studentLocation);
    if (isQC) {
      points += 25;
      breakdown.locationMatch = true;
    }
    breakdown.criteriaDetails.push({ name: "QC Residency", weight: 25, matched: isQC });
  }
  
  // 2. Education Level (25% weight) - STRICT MATCHING
  if (criteria.educationLevel && criteria.educationLevel.length > 0) {
    maxPoints += 25;
    const studentLevel = String(student.educationLevel || student.education_level || "").toLowerCase().trim();
    const requiredLevels = criteria.educationLevel.map(l => String(l).toLowerCase().trim());
    
    // Define level mappings
    const levelMappings = {
      "shs": ["senior high school", "shs", "senior high", "grade 11", "grade 12", "k-12"],
      "college": ["college", "undergraduate", "bachelor", "bachelor's", "bs", "ba", "university", "b.s.", "b.a.", "bachelor of science", "bachelor of arts"],
      "postgraduate": ["postgraduate", "graduate", "master", "master's", "phd", "ph.d.", "doctoral", "doctorate"],
      "vocational": ["vocational", "tesda", "technical", "tvet"]
    };
    
    // Find student category
    let studentCategory = null;
    for (const [category, variations] of Object.entries(levelMappings)) {
      if (variations.some(v => studentLevel === v || studentLevel.includes(v))) {
        studentCategory = category;
        break;
      }
    }
    
    // Find required categories
    const requiredCategories = [];
    for (const reqLevel of requiredLevels) {
      for (const [category, variations] of Object.entries(levelMappings)) {
        if (variations.some(v => reqLevel === v || reqLevel.includes(v))) {
          requiredCategories.push(category);
          break;
        }
      }
    }
    
    const educationMatches = studentCategory && requiredCategories.includes(studentCategory);
    
    if (educationMatches) {
      points += 25;
      breakdown.educationMatch = true;
    }
    breakdown.criteriaDetails.push({ 
      name: "Education Level", 
      weight: 25, 
      matched: educationMatches,
      studentLevel: studentLevel,
      requiredLevels: requiredLevels,
      studentCategory: studentCategory,
      requiredCategories: requiredCategories
    });
  }
  
  // 3. GPA/GWA (25% weight)
  if (criteria.minGWA !== null && criteria.minGWA !== undefined) {
    maxPoints += 25;
    const studentGWA = getStudentGradeValue(student);
    if (studentGWA !== null && studentGWA <= criteria.minGWA) {
      points += 25;
      breakdown.gpaMatch = true;
    }
    breakdown.criteriaDetails.push({ 
      name: "GWA Requirement", 
      weight: 25, 
      matched: breakdown.gpaMatch,
      required: criteria.minGWA,
      actual: studentGWA
    });
  } else if (criteria.minGPA !== null && criteria.minGPA !== undefined) {
    maxPoints += 25;
    const studentGPA = getStudentGradeValue(student);
    if (studentGPA !== null && studentGPA <= criteria.minGPA) {
      points += 25;
      breakdown.gpaMatch = true;
    }
    breakdown.criteriaDetails.push({ 
      name: "GPA Requirement", 
      weight: 25, 
      matched: breakdown.gpaMatch,
      required: criteria.minGPA,
      actual: studentGPA
    });
  }
  
  // 4. Field of Study (15% weight)
  if (criteria.fieldOfStudy && criteria.fieldOfStudy.length > 0) {
    maxPoints += 15;
    const studentField = String(student.fieldOfStudy || student.course || "").toLowerCase().trim();
    const requiredFields = criteria.fieldOfStudy.map(f => String(f).toLowerCase().trim());
    
    const fieldMatches = requiredFields.some(reqField => 
      studentField === reqField || studentField.includes(reqField) || reqField.includes(studentField)
    );
    
    if (fieldMatches) {
      points += 15;
      breakdown.fieldMatch = true;
    }
    breakdown.criteriaDetails.push({ 
      name: "Field of Study", 
      weight: 15, 
      matched: fieldMatches,
      studentField: studentField,
      requiredFields: requiredFields
    });
  }
  
  // 5. Income/Financial Need (10% weight)
  const needsEconomicWeight = criteria.incomeCategory || criteria.maxIncome !== null || criteria.isIndigent || criteria.isPWD || criteria.isSoloParent || String(scholarship.name || "").toLowerCase().includes("economic");
  if (needsEconomicWeight) {
    maxPoints += 25;
    const incomeMatches = getEconomicPass(student) || !!student.incomeCategory || !!(student.financialNeed && student.financialNeed.length > 0);
    if (incomeMatches) {
      points += 25;
      breakdown.incomeMatch = true;
    }
    breakdown.criteriaDetails.push({ 
      name: "Income/Financial Need", 
      weight: 25, 
      matched: incomeMatches 
    });
  }
  
  // Calculate final percentage
  let finalScore;
  if (maxPoints === 0) {
    // No specific criteria - default to 50%
    finalScore = 50;
  } else {
    finalScore = Math.round((points / maxPoints) * 100);
  }
  
  // Override: If education level doesn't match at all, score should be 0%
  if (criteria.educationLevel && criteria.educationLevel.length > 0 && !breakdown.educationMatch) {
    finalScore = 0;
  }
  
  // Override: If QC residency is required and not met, score should be 0%
  if (criteria.qcResident && !breakdown.locationMatch) {
    finalScore = 0;
  }
  
  // Log detailed breakdown
  if (DEBUG_ELIGIBILITY) {
    console.log("[Match Score Calculation]", {
      studentEmail: student.email,
      scholarship: scholarship.name,
      scholarshipId: scholarship._id,
      breakdown: {
        locationMatch: breakdown.locationMatch,
        gpaMatch: breakdown.gpaMatch,
        educationMatch: breakdown.educationMatch,
        fieldMatch: breakdown.fieldMatch,
        incomeMatch: breakdown.incomeMatch
      },
      criteriaDetails: breakdown.criteriaDetails,
      points: points,
      maxPoints: maxPoints,
      rawPercentage: maxPoints > 0 ? Math.round((points / maxPoints) * 100) : 50,
      finalScore: finalScore,
      eligibilityStatus: eligibility.isEligible ? "eligible" : (eligibility.mayBeEligible ? "may_be_eligible" : "not_eligible")
    });

    if (String(scholarship.name || "").toLowerCase().includes("economic")) {
      console.log('Income Check:', {
        incomeCategory: student.incomeCategory,
        isIndigenous: getStudentSpecialCategories(student).isFromIndigenousFamily,
        financialNeed: student.financialNeed,
        passed: getEconomicPass(student)
      });
    }
  }
  
  return Math.min(100, Math.max(0, finalScore));
}

/**
 * Filter scholarships based on student eligibility
 * @param {Array} scholarships - Array of scholarship objects
 * @param {Object} student - Student profile data
 * @returns {Array} - Filtered scholarships with eligibility info
 */
function filterScholarshipsByEligibility(scholarships, student) {
  return scholarships.map(scholarship => {
    const eligibility = checkEligibility(student, scholarship);
    const matchScore = calculateMatchScore(student, scholarship, eligibility);
    
    return {
      ...scholarship,
      eligibility,
      // Calculate actual match score based on criteria met
      matchScore,
      eligibilityStatus: eligibility.isEligible ? "eligible" : 
                        (eligibility.mayBeEligible ? "may_be_eligible" : "not_eligible")
    };
  }).filter(scholarship => 
    scholarship.eligibility.isEligible || scholarship.eligibility.mayBeEligible
  ).sort((a, b) => {
    // Sort by eligibility status, then match score
    const statusOrder = { eligible: 0, may_be_eligible: 1, not_eligible: 2 };
    const aStatus = statusOrder[a.eligibilityStatus] || 2;
    const bStatus = statusOrder[b.eligibilityStatus] || 2;
    
    if (aStatus !== bStatus) return aStatus - bStatus;
    return b.matchScore - a.matchScore;
  });
}

export { 
  checkEligibility, 
  filterScholarshipsByEligibility,
  calculateMatchScore,
  CHED_PRIORITY_COURSES 
};
