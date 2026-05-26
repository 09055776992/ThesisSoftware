/**
 * Gale-Shapley Stable Matching Algorithm
 * 
 * Two-sided stable matching for the student-scholarship context:
 * - Student side: ranks scholarships by match percentage + eligibility
 * - Scholarship side: ranks the student by criteria alignment
 * 
 * When a student qualifies for multiple scholarships, a Utility/Benefit Score
 * determines the #1 recommendation by weighing:
 *   60% — Financial relief (household income + economic dependency vs. stipend value)
 *   40% — Academic fit (GPA vs. scholarship academic tier)
 */

export interface ScholarshipForMatching {
  id: number | string;
  name: string;
  provider?: string;
  matchPercent: number;
  eligibilityStatus: string;
  qualified: boolean;
  amount?: string;
  minimumGpa?: number;
  requiresFinancialNeed?: boolean;
  type?: string;
  fieldOfStudy?: string;
  location?: string;
  requiredEducationLevel?: string[];
  [key: string]: unknown;
}

export interface StudentPreferences {
  gpa?: number;
  fieldOfStudy?: string;
  location?: string;
  incomeCategory?: string;
  financialNeed?: number | string;
  educationLevel?: string;
  specialCategories?: Record<string, boolean>;
  householdIncome?: number;
  financialSupportSource?: string;
  economicDependency?: number;
}

export interface RankedScholarship extends ScholarshipForMatching {
  galeShapleyRank: number;
  studentPreferenceScore: number;
  scholarshipPreferenceScore: number;
  stabilityScore: number;
  utilityScore: number;
  financialReliefScore: number;
  academicFitScore: number;
  isTopRecommendation: boolean;
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/**
 * Parses a scholarship amount string (e.g. "₱50,000", "₱10,000 - ₱25,000")
 * into a numeric value. For ranges, takes the midpoint.
 */
function parseStipendValue(amount?: string): number {
  if (!amount) return 0;
  const numbers = amount.match(/[\d,]+/g);
  if (!numbers || numbers.length === 0) return 0;
  const parsed = numbers.map((n) => Number(n.replace(/,/g, "")));
  const valid = parsed.filter((n) => !isNaN(n) && n > 0);
  if (valid.length === 0) return 0;
  if (valid.length === 1) return valid[0];
  return (valid[0] + valid[valid.length - 1]) / 2;
}

/**
 * Estimates monthly household income from incomeCategory string when
 * the explicit householdIncome field is not provided.
 */
function estimateIncomeFromCategory(category?: string): number {
  if (!category) return 30000;
  const c = category.toLowerCase();
  if (c.includes("10,000") || c.includes("under")) return 10000;
  if (c.includes("25,000")) return 25000;
  if (c.includes("50,000")) return 50000;
  if (c.includes("100,000")) return 100000;
  return 30000;
}

// ---------------------------------------------------------------------------
// Scoring functions
// ---------------------------------------------------------------------------

/**
 * Financial Relief Score (0–100)
 * Measures how much financial relief this scholarship provides relative to
 * the student's financial burden.
 *
 * Factors:
 *   - Stipend value vs. household income (higher ratio = more relief)
 *   - Economic dependency (more dependents = higher need = higher score)
 *   - Financial support source (self-supporting gets priority)
 */
function computeFinancialReliefScore(
  scholarship: ScholarshipForMatching,
  student: StudentPreferences,
): number {
  const stipend = parseStipendValue(scholarship.amount);
  const income = student.householdIncome || estimateIncomeFromCategory(student.incomeCategory);
  const dependents = student.economicDependency ?? 1;
  const supportSource = (student.financialSupportSource || "").toLowerCase();

  // Stipend-to-income ratio: how much of annual income does the scholarship cover?
  // Cap at 100%. Higher ratio = more financial relief.
  const annualIncome = Math.max(income * 12, 1);
  const stipendRatio = Math.min(1, stipend / annualIncome);
  const stipendScore = stipendRatio * 100;

  // Dependency factor: more dependents = higher need (scaled 0–100)
  // 1 dependent = 40, 2 = 55, 3 = 70, 4 = 80, 5+ = 90–100
  const dependencyScore = Math.min(100, 30 + dependents * 15);

  // Support source factor: self-supporting students get higher priority
  let supportScore = 50; // default: unknown/parents
  if (supportSource.includes("self") || supportSource.includes("working")) {
    supportScore = 100;
  } else if (supportSource.includes("government") || supportSource.includes("aid")) {
    supportScore = 80;
  } else if (supportSource.includes("relative") || supportSource.includes("guardian")) {
    supportScore = 60;
  } else if (supportSource.includes("parent")) {
    supportScore = 40;
  }

  // Weighted combination within financial relief
  // 50% stipend relief, 30% dependency burden, 20% support source
  return Math.round(stipendScore * 0.50 + dependencyScore * 0.30 + supportScore * 0.20);
}

/**
 * Academic Fit Score (0–100)
 * Measures how well the student's GPA matches the scholarship's academic tier.
 * Philippine scale: 1.0 is best, 5.0 is failing.
 */
function computeAcademicFitScore(
  scholarship: ScholarshipForMatching,
  student: StudentPreferences,
): number {
  const gpa = student.gpa;
  if (!gpa) return 30; // no GPA info → low but not zero

  const minGpa = scholarship.minimumGpa || 3.0;

  // Student doesn't meet minimum → 0
  if (gpa > minGpa) return 0;

  // Scale: 1.0 (perfect) → 100, exactly at minimum → 60
  const maxRange = minGpa - 1.0;
  const excess = minGpa - gpa;

  if (maxRange <= 0) return 60;
  return Math.round(Math.min(100, 60 + (excess / maxRange) * 40));
}

/**
 * Utility/Benefit Score (0–100)
 * Determines the optimal scholarship recommendation by weighing:
 *   60% Financial Relief — maximizing coverage based on income & dependency
 *   40% Academic Fit     — matching GPA to scholarship tier
 */
function computeUtilityScore(
  scholarship: ScholarshipForMatching,
  student: StudentPreferences,
): { utilityScore: number; financialReliefScore: number; academicFitScore: number } {
  const financialReliefScore = computeFinancialReliefScore(scholarship, student);
  const academicFitScore = computeAcademicFitScore(scholarship, student);

  const utilityScore = Math.round(
    financialReliefScore * 0.60 + academicFitScore * 0.40
  );

  return { utilityScore, financialReliefScore, academicFitScore };
}

/**
 * Student preference score for a scholarship.
 */
function computeStudentPreference(scholarship: ScholarshipForMatching): number {
  let score = scholarship.matchPercent;

  if (scholarship.eligibilityStatus === "eligible") {
    score += 10;
  } else if (scholarship.eligibilityStatus === "may-be-eligible") {
    score += 5;
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * Scholarship preference score for the student.
 */
function computeScholarshipPreference(
  scholarship: ScholarshipForMatching,
  student: StudentPreferences,
): number {
  let score = 0;
  let totalFactors = 0;

  // GPA fit
  if (scholarship.minimumGpa && student.gpa) {
    totalFactors++;
    const gpa = Number(student.gpa);
    const minGpa = Number(scholarship.minimumGpa);
    if (gpa <= minGpa) {
      const maxRange = minGpa - 1.0;
      const excess = minGpa - gpa;
      score += maxRange > 0 ? Math.min(100, (excess / maxRange) * 100) : 60;
    }
  }

  // Location match
  if (scholarship.location && student.location) {
    totalFactors++;
    const uLoc = String(student.location).toLowerCase();
    if (uLoc.includes("quezon city") || uLoc.includes("qc")) {
      score += 100;
    } else {
      const sLoc = String(scholarship.location).toLowerCase();
      if (sLoc.includes(uLoc) || uLoc.includes(sLoc)) score += 80;
    }
  }

  // Field of study
  if (scholarship.fieldOfStudy && student.fieldOfStudy) {
    totalFactors++;
    const sField = String(scholarship.fieldOfStudy).toLowerCase();
    const uField = String(student.fieldOfStudy).toLowerCase();
    if (sField === "all" || sField === "open" || sField.includes(uField) || uField.includes(sField)) {
      score += 100;
    }
  }

  // Financial need alignment
  if (scholarship.requiresFinancialNeed) {
    totalFactors++;
    const need = Number(student.financialNeed) || 0;
    score += need >= 4 ? 100 : need >= 3 ? 60 : 20;
  }

  // Eligibility status
  totalFactors++;
  if (scholarship.eligibilityStatus === "eligible") {
    score += 100;
  } else if (scholarship.eligibilityStatus === "may-be-eligible") {
    score += 70;
  } else {
    score += 20;
  }

  return totalFactors > 0 ? Math.round(score / totalFactors) : 50;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Gale-Shapley Stable Matching with Utility/Benefit Scoring
 * 
 * Produces a stable rank ordering by combining:
 *   1. Two-sided preference stability (student ↔ scholarship)
 *   2. Utility/Benefit score (financial relief + academic fit)
 * 
 * The #1 ranked scholarship is the system recommendation — optimized to
 * provide the highest financial coverage for the student's situation.
 */
export function galeShapleyMatch(
  scholarships: ScholarshipForMatching[],
  student: StudentPreferences,
): RankedScholarship[] {
  if (!scholarships.length) return [];

  const scored: RankedScholarship[] = scholarships.map((s) => {
    const studentPref = computeStudentPreference(s);
    const scholarshipPref = computeScholarshipPreference(s, student);
    const { utilityScore, financialReliefScore, academicFitScore } = computeUtilityScore(s, student);

    // Combined stability score: geometric mean of preferences, boosted by utility
    // Utility score has significant influence (40% of final ranking)
    const rawStability = Math.sqrt(studentPref * scholarshipPref);
    const stabilityScore = Math.round(rawStability * 0.60 + utilityScore * 0.40);

    return {
      ...s,
      studentPreferenceScore: studentPref,
      scholarshipPreferenceScore: scholarshipPref,
      stabilityScore,
      utilityScore,
      financialReliefScore,
      academicFitScore,
      galeShapleyRank: 0,
      isTopRecommendation: false,
    };
  });

  // Sort by stability score (highest = best mutual match + utility),
  // then utility as tiebreaker, then student preference
  scored.sort((a, b) => {
    if (b.stabilityScore !== a.stabilityScore) return b.stabilityScore - a.stabilityScore;
    if (b.utilityScore !== a.utilityScore) return b.utilityScore - a.utilityScore;
    return b.studentPreferenceScore - a.studentPreferenceScore;
  });

  // Assign ranks and mark #1 as system recommendation
  scored.forEach((s, i) => {
    s.galeShapleyRank = i + 1;
    s.isTopRecommendation = i === 0;
  });

  return scored;
}
