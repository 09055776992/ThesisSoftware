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

export interface ShapExplanation {
  contributions: ShapContribution[];
  totalMatchPercent: number;
  topStrength: ShapContribution | null;
  topWeakness: ShapContribution | null;
  summary: string;
}

// Student-facing 4-factor weights
const WEIGHTS: Record<string, number> = {
  "GPA":                      0.30,
  "Household Income":         0.30,
  "Financial Support Source":  0.20,
  "Economic Dependency":      0.20,
};

// Factor explanations by performance level
const EXPLANATIONS: Record<string, Record<string, string>> = {
  "GPA": {
    high:   "Your academic performance strongly boosts your match.",
    medium: "Your GPA meets the requirement with room to improve.",
    low:    "Your GPA is near the minimum, limiting your score.",
    zero:   "GPA data not available or doesn't meet the requirement.",
  },
  "Household Income": {
    high:   "Your household income level qualifies you for high financial priority.",
    medium: "Your income level shows moderate financial need.",
    low:    "Higher household income reduces priority for need-based aid.",
    zero:   "No household income information provided.",
  },
  "Financial Support Source": {
    high:   "Being self-supporting or reliant on aid significantly increases your priority.",
    medium: "Your financial support situation is recognized as a moderate factor.",
    low:    "Parental or family support lowers need-based priority slightly.",
    zero:   "No financial support source information provided.",
  },
  "Economic Dependency": {
    high:   "A high number of household dependents increases your financial need score.",
    medium: "Moderate household dependency recognized.",
    low:    "Fewer dependents result in a lower economic burden score.",
    zero:   "No economic dependency information provided.",
  },
};

function getLevel(score: number): string {
  if (score === 0) return "zero";
  if (score >= 75) return "high";
  if (score >= 50) return "medium";
  return "low";
}

export interface StudentProfile {
  gpa?: number;
  incomeCategory?: string;
  financialNeed?: number | string;
  householdIncome?: number;
  financialSupportSource?: string;
  economicDependency?: number;
  specialCategories?: Record<string, boolean>;
  educationLevel?: string;
  [key: string]: unknown;
}

export interface ScholarshipData {
  matchPercent: number;
  amount?: string;
  minimumGpa?: number;
  requiresFinancialNeed?: boolean;
  qualified?: boolean;
  eligibilityStatus?: string;
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
  const income = student.householdIncome || estimateIncomeFromCategory(student.incomeCategory);
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
  const supportSource = (student.financialSupportSource || "").toLowerCase();
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
  const dependents = student.economicDependency ?? 0;
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
      explanation: EXPLANATIONS[factor]?.[level] || "",
    };
  });

  // Sort by absolute contribution (most impactful first)
  contributions.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  const positives = contributions.filter((c) => c.impact === "positive");
  const negatives = contributions.filter((c) => c.impact === "negative" || c.impact === "neutral");

  const topStrength = positives[0] || null;
  const topWeakness = negatives[0] || null;

  // Generate summary
  const strengthNames = positives.map((c) => c.factor);
  const weaknessNames = negatives.filter((c) => c.rawScore < 50).map((c) => c.factor);

  let summary = "";
  if (strengthNames.length) {
    summary += `Strengths: ${strengthNames.join(", ")}.`;
  }
  if (weaknessNames.length) {
    summary += ` Areas to improve: ${weaknessNames.join(", ")}.`;
  }
  if (!summary) {
    summary = "Average performance across all criteria.";
  }

  return {
    contributions,
    totalMatchPercent: matchPercent,
    topStrength,
    topWeakness,
    summary: summary.trim(),
  };
}
