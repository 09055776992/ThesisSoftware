/**
 * SHAP Contribution Generator (Client-side)
 *
 * Decomposes a scholarship match percentage into 4 student-facing factors:
 *   GPA                    (Academic Performance)  — 30%
 *   Household Income       (Financial Status)      — 30%
 *   Financial Support Source (Financial Status)     — 20%
 *   Economic Dependency    (Financial Status)       — 20%
 *
 * These weights reflect the system's priority: 70% financial, 30% academic —
 * aligned with the Gale-Shapley utility score (60% financial relief, 40% academic fit).
 *
 * Contributions are additive: they sum to the total match percentage,
 * making the score fully transparent to the student.
 */

export interface ShapContribution {
  factor: string;
  contribution: number;        // Percentage points contributed (e.g., +22)
  displayContribution: string; // Formatted string (e.g., "+22%")
  impact: "positive" | "negative" | "neutral";
  rawScore: number;            // Factor's individual score (0-100)
  weightPercent: number;       // Weight of this factor (e.g., 30 for GPA)
  explanation: string;         // Human-readable explanation
}

function getHouseholdIncome(student: StudentProfile): number {
  return Number(student.householdIncome || student.household_income || estimateIncomeFromCategory(student.incomeCategory));
}

function getSupportSource(student: StudentProfile): string {
  return formatValue(student.financialSupportSource || student.financial_support_source);
}

function getDependents(student: StudentProfile): number {
  return Number(student.economicDependency || student.economic_dependency || student.householdDependents || student.dependents || 0);
}

function getSpecialCategory(student: StudentProfile): string {
  const categories = student.specialCategories || {};
  const labels: Record<string, string> = {
    isAthlete: "athletic",
    isArtist: "arts",
    isSKOfficial: "community leadership",
    isStudentLeader: "student leadership",
    isIndigent: "indigent",
    isPWD: "PWD",
    isSoloParent: "solo-parent",
    hasAcademicHonors: "academic honors",
  };
  const active = Object.keys(labels).find((key) => categories[key] || student[key] === true);
  return active ? labels[active] : "";
}

export interface ShapExplanation {
  contributions: ShapContribution[];
  totalMatchPercent: number;
  topStrength: ShapContribution | null;
  topWeakness: ShapContribution | null;
  summary: string;
}

export type SystemRecommendation = {
  message: string;
  reason: "academic" | "financial" | "special-category" | "profile";
};

// Student-facing 4-factor weights
const WEIGHTS: Record<string, number> = {
  "GPA":                      0.30,
  "Household Income":         0.30,
  "Financial Support Source":  0.20,
  "Economic Dependency":      0.20,
};

function getLevel(score: number): string {
  if (score === 0) return "zero";
  if (score >= 75) return "high";
  if (score >= 50) return "medium";
  return "low";
}

function formatValue(value: unknown): string {
  return String(value ?? "").trim();
}

function getFactorExplanation(
  factor: string,
  level: string,
  student: StudentProfile,
  scholarship: ScholarshipData,
): string {
  const scholarshipName = formatValue(scholarship.name) || "this scholarship";

  if (factor === "GPA") {
    const gpa = Number(student.gpa);
    const requirement = Number(scholarship.minimumGpa);
    if (!Number.isFinite(gpa)) return `Add your GPA or GWA to see how it affects your match for ${scholarshipName}.`;
    if (Number.isFinite(requirement)) {
      return gpa <= requirement
        ? `Your GPA of ${gpa.toFixed(2)} meets the ${requirement.toFixed(2)} requirement for ${scholarshipName}.`
        : `Your GPA of ${gpa.toFixed(2)} is above the ${requirement.toFixed(2)} requirement for ${scholarshipName}.`;
    }
    return level === "high"
      ? `Your GPA of ${gpa.toFixed(2)} is a strong academic factor for ${scholarshipName}.`
      : `Your GPA of ${gpa.toFixed(2)} provides a moderate academic contribution to this match.`;
  }

  if (factor === "Household Income") {
    const income = getHouseholdIncome(student);
    if (!income) return `Add your household income to see how financial need affects your match for ${scholarshipName}.`;
    return `Your reported household income of ${income.toLocaleString()} contributes ${level === "high" ? "strongly" : "moderately"} to your financial-need match.`;
  }

  if (factor === "Financial Support Source") {
    const source = getSupportSource(student);
    if (!source) return `Add your financial support source to complete your personalized explanation for ${scholarshipName}.`;
    return `Your stated financial support source, "${source}", contributes to your need assessment for ${scholarshipName}.`;
  }

  const dependents = getDependents(student);
  if (!Number.isFinite(dependents) || dependents <= 0) {
    return `Your economic dependency information currently adds no household-dependency points for ${scholarshipName}.`;
  }
  return `${dependents} household dependent${dependents === 1 ? "" : "s"} contribute${dependents === 1 ? "s" : ""} to your financial-need match for ${scholarshipName}.`;
}

export interface StudentProfile {
  gpa?: number;
  incomeCategory?: string;
  financialNeed?: number | string | number[];
  householdIncome?: number | string;
  financialSupportSource?: string;
  economicDependency?: number | string;
  householdDependents?: number | string;
  dependents?: number | string;
  financial_support_source?: string;
  economic_dependency?: number | string;
  household_income?: number | string;
  specialCategories?: Record<string, boolean>;
  educationLevel?: string;
  [key: string]: unknown;
}

export interface ScholarshipData {
  matchPercent: number;
  name?: string;
  amount?: string;
  minimumGpa?: number;
  requiresFinancialNeed?: boolean;
  qualified?: boolean;
  eligibilityStatus?: string;
  type?: string;
  category?: string;
  fieldOfStudy?: string;
  requiredEducationLevel?: string | string[];
  specialCategories?: string[];
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Estimates monthly household income from incomeCategory when
 * the explicit householdIncome field is not set.
 */
function estimateIncomeFromCategory(category?: string): number {
  if (!category) return 0;
  const c = category.toLowerCase();
  if (c.includes("10,000") || c.includes("under")) return 10000;
  if (c.includes("25,000")) return 25000;
  if (c.includes("50,000")) return 50000;
  if (c.includes("100,000")) return 100000;
  return 0;
}

// ---------------------------------------------------------------------------
// Factor score estimators
// ---------------------------------------------------------------------------

function estimateFactorScores(
  student: StudentProfile,
  scholarship: ScholarshipData,
): Record<string, number> {
  const scores: Record<string, number> = {};

  // --- GPA (Philippine scale: 1.0 best, 5.0 worst) ---
  if (student.gpa && scholarship.minimumGpa) {
    const gpa = Number(student.gpa);
    const minGpa = Number(scholarship.minimumGpa);
    if (gpa <= minGpa) {
      const maxRange = minGpa - 1.0;
      const excess = minGpa - gpa;
      scores["GPA"] = maxRange > 0 ? Math.min(100, 60 + (excess / maxRange) * 40) : 60;
    } else {
      scores["GPA"] = 0;
    }
  } else if (student.gpa) {
    const gpa = Number(student.gpa);
    scores["GPA"] = gpa <= 1.5 ? 95 : gpa <= 2.0 ? 80 : gpa <= 2.5 ? 65 : gpa <= 3.0 ? 50 : 30;
  } else {
    scores["GPA"] = 0;
  }

  // --- Household Income ---
  // Lower income → higher score (more financial need)
  const income = getHouseholdIncome(student);
  if (income > 0) {
    if (income <= 10000)      scores["Household Income"] = 100;
    else if (income <= 25000) scores["Household Income"] = 85;
    else if (income <= 50000) scores["Household Income"] = 60;
    else if (income <= 100000) scores["Household Income"] = 35;
    else                       scores["Household Income"] = 15;
  } else {
    scores["Household Income"] = 0;
  }

  // --- Financial Support Source ---
  const supportSource = getSupportSource(student).toLowerCase();
  if (!supportSource) {
    scores["Financial Support Source"] = 0;
  } else if (supportSource.includes("self") || supportSource.includes("working")) {
    scores["Financial Support Source"] = 100;
  } else if (supportSource.includes("government") || supportSource.includes("aid") || supportSource.includes("scholarship")) {
    scores["Financial Support Source"] = 80;
  } else if (supportSource.includes("relative") || supportSource.includes("guardian")) {
    scores["Financial Support Source"] = 60;
  } else if (supportSource.includes("parent")) {
    scores["Financial Support Source"] = 40;
  } else {
    scores["Financial Support Source"] = 50;
  }

  // --- Economic Dependency (number of household dependents) ---
  const dependents = getDependents(student);
  if (dependents === 0) {
    scores["Economic Dependency"] = 0;
  } else {
    // 1 dep = 45, 2 = 60, 3 = 75, 4 = 85, 5+ = 95-100
    scores["Economic Dependency"] = Math.min(100, 30 + dependents * 15);
  }

  return scores;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Generates SHAP-style additive explanations for a scholarship match.
 *
 * The contributions are scaled so they sum to the total match percentage,
 * giving a fully transparent breakdown of why the score is what it is.
 */
export function generateShapContributions(
  student: StudentProfile,
  scholarship: ScholarshipData,
): ShapExplanation {
  const matchPercent = scholarship.matchPercent || 0;
  const factorScores = estimateFactorScores(student, scholarship);

  // Calculate raw weighted contributions
  const rawContributions: { factor: string; raw: number; weighted: number }[] = [];
  let totalWeighted = 0;

  for (const [factor, weight] of Object.entries(WEIGHTS)) {
    const raw = factorScores[factor] || 0;
    const weighted = raw * weight;
    rawContributions.push({ factor, raw, weighted });
    totalWeighted += weighted;
  }

  // Scale contributions to sum to the actual matchPercent
  const scaleFactor = totalWeighted > 0 ? matchPercent / totalWeighted : 0;

  const contributions: ShapContribution[] = rawContributions.map(({ factor, raw, weighted }) => {
    const contribution = Math.round(weighted * scaleFactor * 10) / 10;
    const level = getLevel(raw);

    return {
      factor,
      contribution,
      displayContribution: contribution >= 0 ? `+${contribution.toFixed(0)}%` : `${contribution.toFixed(0)}%`,
      impact: raw >= 50 ? "positive" : raw > 0 ? "negative" : "neutral",
      rawScore: Math.round(raw),
      weightPercent: Math.round((WEIGHTS[factor] || 0) * 100),
      explanation: getFactorExplanation(factor, level, student, scholarship),
    };
  });

  // Keep the displayed whole-number contributions additive to the displayed match.
  const targetDisplayTotal = Math.round(matchPercent);
  const displayedTotal = contributions.reduce((sum, item) => sum + Math.round(item.contribution), 0);
  const roundingCorrection = targetDisplayTotal - displayedTotal;
  if (roundingCorrection !== 0) {
    const largest = contributions.reduce((current, item) =>
      Math.abs(item.contribution) > Math.abs(current.contribution) ? item : current,
    );
    largest.contribution = Math.round((largest.contribution + roundingCorrection) * 10) / 10;
    largest.displayContribution = largest.contribution >= 0
      ? `+${Math.round(largest.contribution)}%`
      : `${Math.round(largest.contribution)}%`;
  }

  // Sort by absolute contribution (most impactful first)
  contributions.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  const positives = contributions.filter((c) => c.impact === "positive");
  const negatives = contributions.filter((c) => c.impact === "negative" || c.impact === "neutral");

  const topStrength = positives[0] || null;
  const topWeakness = negatives[0] || null;

  // Generate summary
  const strengthNames = positives
    .filter((c) => c.contribution > 0)
    .slice(0, 2)
    .map((c) => c.factor);
  const weaknessNames = negatives
    .filter((c) => c.rawScore < 50)
    .filter((c) => {
      if (c.factor === "Household Income") return getHouseholdIncome(student) > 0;
      if (c.factor === "Financial Support Source") return Boolean(getSupportSource(student));
      if (c.factor === "Economic Dependency") return getDependents(student) > 0;
      return Number.isFinite(Number(student.gpa));
    })
    .map((c) => c.factor);
  const missingNames = [
    !Number.isFinite(Number(student.gpa)) ? "GPA" : "",
    getHouseholdIncome(student) <= 0 ? "Household Income" : "",
    !getSupportSource(student) ? "Financial Support Source" : "",
    getDependents(student) <= 0 ? "Economic Dependency" : "",
  ].filter(Boolean);

  let summary = "";
  if (strengthNames.length) {
    summary += `For your profile, the strongest factors are ${strengthNames.join(", ")}.`;
  }
  if (weaknessNames.length) {
    summary += ` Your current ${weaknessNames.join(", ")} may limit this match.`;
  }
  if (missingNames.length) {
    summary += ` Add ${missingNames.join(", ")} information for a more complete explanation.`;
  }
  if (!summary) {
    summary = "Your current profile provides a balanced contribution across the available criteria.";
  }

  return {
    contributions,
    totalMatchPercent: matchPercent,
    topStrength,
    topWeakness,
    summary: summary.trim(),
  };
}

export function generateSystemRecommendation(
  student: StudentProfile,
  scholarship: ScholarshipData,
  shap: ShapExplanation,
): SystemRecommendation {
  const scholarshipText = [
    scholarship.name,
    scholarship.type,
    scholarship.category,
    scholarship.fieldOfStudy,
    scholarship.description,
    ...(Array.isArray(scholarship.specialCategories) ? scholarship.specialCategories : []),
  ].join(" ").toLowerCase();
  const specialCategory = getSpecialCategory(student);
  const academic = shap.contributions.find((item) => item.factor === "GPA");
  const financialFactors = shap.contributions.filter((item) =>
    item.factor === "Household Income" ||
    item.factor === "Financial Support Source" ||
    item.factor === "Economic Dependency",
  );
  const strongestFinancial = financialFactors.sort((a, b) => b.contribution - a.contribution)[0];

  if (specialCategory && /(athlet|sport|artist|arts|leader|indigent|pwd|solo parent|special category)/.test(scholarshipText)) {
    return {
      reason: "special-category",
      message: `Matched because your profile includes a verified ${specialCategory} qualification relevant to this scholarship.`,
    };
  }

  if (academic && academic.contribution > 0 && (scholarship.minimumGpa !== undefined || /(academic|merit|gwa|gpa|honor)/.test(scholarshipText))) {
    const gpa = Number(student.gpa);
    const value = Number.isFinite(gpa) ? ` Your GPA/GWA of ${gpa.toFixed(2)} supports this result.` : "";
    return {
      reason: "academic",
      message: `Recommended based on your academic profile and GPA/GWA ranking.${value}`,
    };
  }

  if (strongestFinancial && strongestFinancial.contribution > 0 &&
      (scholarship.requiresFinancialNeed || /(financial|need|income|assistance|allowance|stipend)/.test(scholarshipText))) {
    const income = getHouseholdIncome(student);
    const incomeText = income > 0 ? ` Your reported household income is ₱${income.toLocaleString()}.` : "";
    return {
      reason: "financial",
      message: `Recommended because your financial-need profile aligns with this scholarship.${incomeText}`,
    };
  }

  if (shap.topStrength) {
    return {
      reason: "profile",
      message: `Recommended because your ${shap.topStrength.factor} is the strongest contributor to this scholarship match.`,
    };
  }

  const missing = [
    !Number.isFinite(Number(student.gpa)) ? "GPA/GWA" : "",
    getHouseholdIncome(student) <= 0 ? "household income" : "",
    !getSupportSource(student) ? "financial support source" : "",
  ].filter(Boolean);
  return {
    reason: "profile",
    message: missing.length
      ? `This recommendation is based on the profile information available. Add ${missing.join(", ")} for a more specific explanation.`
      : `This recommendation is based on the overall fit between your profile and this scholarship.`,
  };
}
