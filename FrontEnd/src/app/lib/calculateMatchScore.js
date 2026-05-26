/**
 * Unified scholarship match score calculator
 * Used by ALL scholarship pages and API endpoints
 * 
 * Returns object with:
 *   - score: 0-100 percentage
 *   - qualified: boolean (true only if all criteria are met)
 *   - failedReasons: array of strings explaining why not qualified (if applicable)
 */

export const calculateMatchScore = (student, scholarship) => {
  let totalCriteria = 0;
  let metCriteria = 0;
  const failedReasons = [];

  // Defensive checks for missing inputs
  if (!student || !scholarship) {
    return { score: 0, qualified: false, failedReasons: ['Invalid student or scholarship data'] };
  }

  // Helper to check QC residency
  const isQCResident = () => {
    const location = (student?.location || '').toLowerCase().trim();
    const schoolLocation = (student?.schoolLocation || '').toLowerCase().trim();
    const address = (student?.address || '').toLowerCase().trim();
    const city = (student?.city || '').toLowerCase().trim();
    
    return location.includes('quezon city') ||
      location.includes('q.c') ||
      location === 'qc' ||
      schoolLocation.includes('quezon city') ||
      schoolLocation.includes('q.c') ||
      address.includes('quezon city') ||
      city.includes('quezon city') ||
      student?.is_qc_resident === true ||
      student?.isQCResident === true;
  };

  // === UNIVERSAL CHECKS (apply to ALL scholarships) ===

  // 1. QC Residency - FAIL FAST (REQUIRED)
  totalCriteria++;
  if (isQCResident()) {
    metCriteria++;
  } else {
    failedReasons.push('Must be a QC resident');
  }

  // 2. Not a scholar of another LGU - FAIL FAST (REQUIRED)
  totalCriteria++;
  const isScholarOfAnotherLGU =
    student?.isScholarOfAnotherLGU ||
    student?.is_lgu_scholar === true ||
    student?.isOtherLGUScholar === true ||
    student?.lguScholar === true;
  if (!isScholarOfAnotherLGU) {
    metCriteria++;
  } else {
    failedReasons.push('Must not be a scholar of another LGU');
  }

  // === EDUCATION LEVEL CHECK (REQUIRED) ===
  totalCriteria++;
  const normalizeEducationLevel = (value) => {
    const text = String(value || "").toLowerCase();
    if (!text) return "";
    if (text.includes("college") || text.includes("undergraduate") || text === "college") return "college";
    if (text.includes("senior high") || text.includes("shs") || text.includes("senior-high")) return "senior high";
    if (text.includes("junior high") || text.includes("jhs") || text.includes("junior-high")) return "junior high";
    if (text.includes("postgraduate") || text.includes("masters") || text.includes("doctorate") || text.includes("graduate")) return "postgraduate";
    if (text.includes("vocational") || text.includes("tesda")) return "vocational";
    if (text.includes("all")) return "all";
    return text.trim();
  };

  const studentEduNormalized = normalizeEducationLevel(student?.educationLevel || student?.education_level);
  const requiredEducationRaw = scholarship?.requiredEducationLevel;
  const requiredEducationLevels = Array.isArray(requiredEducationRaw)
    ? requiredEducationRaw
    : (typeof requiredEducationRaw === "string" ? [requiredEducationRaw] : []);
  const requiredEducationNormalized = requiredEducationLevels
    .map(normalizeEducationLevel)
    .filter(Boolean);

  let eduMatch = false;
  if (requiredEducationNormalized.length === 0 || requiredEducationNormalized.includes("all")) {
    eduMatch = true;
  } else if (studentEduNormalized) {
    eduMatch = requiredEducationNormalized.includes(studentEduNormalized);
  }

  if (eduMatch) {
    metCriteria++;
  } else {
    failedReasons.push(
      `Education level mismatch. Required: ${scholarship?.requiredEducationLevel || 'Not specified'}, Yours: ${student?.educationLevel || 'Not provided'}`
    );
    // If education level doesn't match, return 0% immediately
    return { score: 0, qualified: false, failedReasons };
  }

  // === GWA CHECK (supports both SHS percentage and College GWA scales) ===
  if (scholarship?.minimumGPA || scholarship?.minimumGWA) {
    totalCriteria++;
    // Check both gwa (preferred) and gpa (legacy) fields
    const studentGWA = parseFloat(student?.gwa || student?.gpa);
    const requiredGrade = parseFloat(scholarship.minimumGWA || scholarship.minimumGPA);
    
    // Determine scale: > 50 is percentage (SHS), <= 5.0 is GWA (College)
    const isPercentageScale = requiredGrade > 50;
    
    let passed = false;
    if (!isNaN(studentGWA)) {
      if (isPercentageScale) {
        // SHS percentage scale: 70-100, higher is better
        passed = studentGWA >= requiredGrade;
      } else {
        // College GWA scale: 1.0-5.0, lower is better (1.0 = best)
        passed = studentGWA <= requiredGrade;
      }
    }
    
    if (passed) {
      metCriteria++;
    } else {
      const msg = isPercentageScale
        ? `Grade requirement not met. Minimum: ${requiredGrade}%, Yours: ${isNaN(studentGWA) ? 'Not provided' : studentGWA + '%'}`
        : `GWA requirement not met. Maximum: ${requiredGrade}, Yours: ${isNaN(studentGWA) ? 'Not provided' : studentGWA}`;
      failedReasons.push(msg);
    }
  }

  // === SCHOLARSHIP-SPECIFIC CHECKS ===
  const scholarshipName = (scholarship?.name || '').toLowerCase();
  const specialCategories = student?.specialCategories || {};

  // Athletic and Arts scholarships
  if (scholarshipName.includes('athletic') || scholarshipName.includes('arts')) {
    totalCriteria++;
    const hasCategory = 
      specialCategories?.isAthlete ||
      specialCategories?.isArtist ||
      student?.isAthlete ||
      student?.isArtist;
    if (hasCategory) {
      metCriteria++;
    } else {
      failedReasons.push(
        'Must be a recent sports/arts award recipient or member of a QC-recognized program'
      );
    }
  }

  // Youth Leaders scholarships
  if (scholarshipName.includes('youth leader')) {
    totalCriteria++;
    const hasCategory = 
      specialCategories?.isSKOfficial ||
      specialCategories?.isStudentCouncilLeader ||
      student?.isSKOfficial ||
      student?.isStudentCouncilLeader;
    if (hasCategory) {
      metCriteria++;
    } else {
      failedReasons.push(
        'Must be an SK/SSG official or leadership award recipient'
      );
    }
  }

  // Economic Scholarship
  if (scholarshipName.includes('economic')) {
    totalCriteria++;
    const incomeCategory = String(student?.incomeCategory || '').toLowerCase();
    const hasLowIncome =
      incomeCategory.includes('₱10,000') ||
      incomeCategory.includes('10,000') ||
      incomeCategory.includes('under ₱25,000') ||
      incomeCategory.includes('under-25000') ||
      incomeCategory.includes('under_25000');
    const financialNeedValue = Array.isArray(student?.financialNeed)
      ? student.financialNeed[0]
      : student?.financialNeed;
    const qualifies = 
      hasLowIncome ||
      specialCategories?.isFromIndigenousFamily ||
      specialCategories?.isIndigent ||
      specialCategories?.isPersonWithDisability ||
      specialCategories?.isPWD ||
      specialCategories?.isSoloParent ||
      student?.isFromIndigenousFamily ||
      student?.isIndigent === true ||
      student?.isPWD ||
      student?.isSoloParent ||
      parseInt(financialNeedValue, 10) >= 4;
    if (qualifies) {
      metCriteria++;
    } else {
      failedReasons.push(
        'Must be from low-income household or marginalized sector'
      );
    }
  }

  // QC Excel and Specialized Courses — must be 1st year
  if (
    scholarshipName.includes('excel') || 
    scholarshipName.includes('specialized courses')
  ) {
    totalCriteria++;
    const isFirstYear = 
      (student?.yearLevel || '').toLowerCase().includes('1st') ||
      (student?.yearLevel || '').toLowerCase().includes('first') ||
      student?.isFirstYear;
    if (isFirstYear) {
      metCriteria++;
    } else {
      failedReasons.push(
        'Must be a first year / freshman student'
      );
    }
  }

  // Postgraduate — must be QC government employee
  if (scholarshipName.includes('postgraduate')) {
    totalCriteria++;
    if (student?.isQCGovernmentEmployee) {
      metCriteria++;
    } else {
      failedReasons.push(
        'Must be employed in QC Government for at least 1 year'
      );
    }
  }

  // === FINAL SCORE ===
  const score = totalCriteria > 0 
    ? Math.round((metCriteria / totalCriteria) * 100) 
    : 0;
  const qualified = failedReasons.length === 0;

  return { score, qualified, failedReasons };
};
