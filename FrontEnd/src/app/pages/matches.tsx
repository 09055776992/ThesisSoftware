import { useEffect, useMemo, useState } from "react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Bookmark, ExternalLink, TrendingUp, TrendingDown, Minus, Star, AlertCircle, XCircle } from "lucide-react";
import { fetchScholarshipsWithEligibility, resolveDisplayMatchScore } from "../lib/api-client";
import { getStoredUser } from "../lib/user-storage";
import { galeShapleyMatch, type RankedScholarship } from "../lib/galeShapleyMatch";
import { generateShapContributions, type ShapContribution } from "../lib/generateShapContributions";

// Scholarship cover images mapping
const scholarshipImages: Record<string, string> = {
  "College Academic Scholarship": "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=600&q=80",
  "College Athletic and Arts Scholarship": "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=600&q=80",
  "College Youth Leaders Scholarship": "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=600&q=80",
  "Economic Scholarship": "https://images.unsplash.com/photo-1532619675605-1ede6c2ed2b0?w=600&q=80",
  "Specialized Courses Scholarship": "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=600&q=80",
  "QC Excel Scholarship": "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=600&q=80",
  "SHS Academic Scholarship": "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=600&q=80",
  "SHS Specialized Track Scholarship": "https://images.unsplash.com/photo-1513258496099-48168024aec0?w=600&q=80",
  "SHS Athletic and Arts Scholarship": "https://images.unsplash.com/photo-1547347298-4074fc3086f0?w=600&q=80",
  "SHS Youth Leaders Scholarship": "https://images.unsplash.com/photo-1544717305-2782549b5136?w=600&q=80",
  "QC Postgraduate Scholarship": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80",
  "Vocational/TESDA Scholarship": "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=600&q=80",
};

// Default fallback image
const defaultScholarshipImage = "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=600&q=80";

// SHAP contribution bar component
function ShapBar({ contribution }: { contribution: ShapContribution }) {
  const barWidth = Math.min(100, Math.abs(contribution.contribution) * 2);
  const barColor =
    contribution.impact === "positive"
      ? "bg-emerald-500"
      : contribution.impact === "negative"
        ? "bg-amber-500"
        : "bg-gray-300";

  const ImpactIcon =
    contribution.impact === "positive"
      ? TrendingUp
      : contribution.impact === "negative"
        ? TrendingDown
        : Minus;

  return (
    <div className="flex items-center gap-2 text-xs">
      <ImpactIcon className="size-3 shrink-0 text-muted-foreground" />
      <span className="w-[110px] shrink-0 truncate text-muted-foreground">
        {contribution.factor}
      </span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <span className={`w-10 text-right font-semibold shrink-0 ${
        contribution.impact === "positive" ? "text-emerald-600" : 
        contribution.impact === "negative" ? "text-amber-600" : "text-gray-500"
      }`}>
        {contribution.displayContribution}
      </span>
    </div>
  );
}

export function Matches() {
  const [scholarships, setScholarships] = useState<any[]>([]);

  useEffect(() => {
    const user = getStoredUser();
    console.debug("Matches: current user profile:", user);

    fetchScholarshipsWithEligibility(user?.email || "")
      .then((result: any) => {
        const raw = result.data || [];
        console.log("Matches: fetched scholarships count:", raw.length);

        const withMatchScores = raw.map((item: any, idx: number) => {
          const status = String(item.eligibilityStatus || "");
          const score = resolveDisplayMatchScore(
            typeof item.matchScore === "number" ? item.matchScore : Number(item.matchScore),
            status,
          );
          const qualified = status === "eligible" || status === "may-be-eligible";
          const failedReasons = item.eligibility?.unmetCriteria || [];

          return {
            id: Number(item.id) || Number(item._id) || idx + 1,
            name: String(item.name || ""),
            provider: String(item.provider || ""),
            image: String(item.imageUrl || item.image || ""),
            amount: typeof item.amount === "string" ? item.amount : `₱${Number(item.amount || 0).toLocaleString()}`,
            deadline: item.deadline ? new Date(item.deadline).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            }) : "December 31, 2030",
            type: String(item.type || "Merit-Based"),
            matchPercent: score,
            qualified,
            failedReasons,
            eligibilityStatus: status,
            location: String(item.location || ""),
            fieldOfStudy: String(item.fieldOfStudy || ""),
            minimumGpa: item.minimumGpa !== undefined ? Number(item.minimumGpa) : undefined,
            requiredEducationLevel: item.requiredEducationLevel || item.educationLevel || [],
            targetIncomeCategory: item.targetIncomeCategory ?? item.incomeCategory ?? null,
            requiresFinancialNeed: !!item.requiresFinancialNeed,
            eligibility: item.eligibility ?? null,
            requirements: Array.isArray(item.requirements) ? item.requirements.map((v: any) => String(v)) : [],
            description: String(item.description || ""),
          };
        });

        setScholarships(withMatchScores);
      })
      .catch((err: any) => {
        console.error("Failed to fetch scholarships for matches:", err);
        setScholarships([]);
      });
  }, []);

  const { rankedMatches, fallbackScholarships, userMissingFields, userHasProfileFields } = useMemo(() => {
    const user = getStoredUser();
    const missing: string[] = [];
    const hasFields = !!(user && (user.gwa || user.gpa || user.fieldOfStudy || user.location || user.incomeCategory || (user.financialNeed && user.financialNeed.length)));

    if (!user) {
      missing.push("GWA", "Field of Study", "Location", "Financial need / Income");
    } else {
      if (!user.gwa && !user.gpa) missing.push("GWA");
      if (!user.fieldOfStudy) missing.push("Field of Study");
      if (!user.location) missing.push("Location");
      if (!user.incomeCategory && !(user.financialNeed && user.financialNeed.length)) missing.push("Financial need / Income");
    }

    // Education Level Visibility Filter
    // - SHS students: See ALL scholarships (SHS + College)
    // - College students: Only see College scholarships (hide SHS-specific)
    const isVisibleToUser = (scholarship: typeof scholarships[0]): boolean => {
      if (!user?.educationLevel) return true;
      
      const requiredLevels = scholarship.requiredEducationLevel || [];
      if (requiredLevels.length === 0) return true;
      
      const userLevel = user.educationLevel.toLowerCase();
      const isUserSHS = userLevel.includes("senior high") || userLevel === "shs";
      const isUserCollege = userLevel.includes("college") || userLevel.includes("undergraduate");
      
      // SHS students: see all scholarships
      if (isUserSHS) return true;
      
      // College students: filter out SHS-specific scholarships
      if (isUserCollege) {
        const isSHSOnly = requiredLevels.every((level: string) => {
          const l = level.toLowerCase();
          return l.includes("senior high") || l === "shs";
        });
        return !isSHSOnly;
      }
      
      return true;
    };

    // Filter to qualified scholarships AND apply visibility filter
    const qualified = scholarships
      .filter(isVisibleToUser)
      .filter(
        (s) =>
          s.eligibilityStatus === "eligible" ||
          s.eligibilityStatus === "may-be-eligible" ||
          s.qualified === true,
      );

    // Fallback: not-eligible scholarships visible to this education level
    const notEligible = scholarships
      .filter(isVisibleToUser)
      .filter(
        (s) =>
          s.eligibilityStatus === "not-eligible" ||
          (s.eligibilityStatus !== "eligible" && s.eligibilityStatus !== "may-be-eligible" && s.qualified !== true),
      )
      .sort((a, b) => (b.matchPercent || 0) - (a.matchPercent || 0));

    // Apply Gale-Shapley stable matching to produce rank ordering
    const studentPrefs = user ? {
      gwa: (user.gwa || user.gpa) ? Number(user.gwa || user.gpa) : undefined,
      fieldOfStudy: user.fieldOfStudy,
      location: user.location,
      incomeCategory: user.incomeCategory,
      financialNeed: Array.isArray(user.financialNeed) ? user.financialNeed[0] : user.financialNeed,
      educationLevel: user.educationLevel,
      householdIncome: user.householdIncome,
      financialSupportSource: user.financialSupportSource,
      economicDependency: user.economicDependency,
      specialCategories: {
        isAthlete: !!user.isAthlete,
        isArtist: !!user.isArtist,
        isSKOfficial: !!user.isSKOfficial,
        isStudentLeader: !!user.isStudentLeader,
        isIndigent: !!user.isIndigent,
        isPWD: !!user.isPWD,
        isSoloParent: !!user.isSoloParent,
        isFromIndigenousFamily: false,
        isPersonWithDisability: !!user.isPWD,
        hasAcademicHonors: !!user.hasAcademicHonors,
      },
    } : {};

    const ranked = galeShapleyMatch(qualified, studentPrefs);

    return {
      rankedMatches: ranked,
      fallbackScholarships: notEligible,
      userMissingFields: missing,
      userHasProfileFields: hasFields,
    };
  }, [scholarships]);

  // Get stored user for SHAP contributions
  const storedUser = useMemo(() => getStoredUser(), []);

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Scholarship Matches</h1>
          <p className="text-muted-foreground">
            Ranked by Gale-Shapley stable matching algorithm based on mutual fit between your profile and scholarship criteria.
          </p>
        </div>

        {/* If there are no scholarships at all */}
        {scholarships.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="max-w-md mx-auto">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">No scholarships found</h2>
              <p className="text-gray-600">There are currently no scholarships in the database.</p>
            </div>
          </div>
        ) : !userHasProfileFields ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8">
            <h2 className="text-lg font-semibold mb-2">Complete your profile to see matches</h2>
            <p className="text-gray-600 mb-4">The matching algorithm uses these fields to personalize results. Add the following to improve matches:</p>
            <ul className="list-disc list-inside text-gray-700">
              {userMissingFields.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            {rankedMatches.length === 0 && (
              <div className="mb-8 flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 py-14 px-6 text-center">
                <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-blue-50 text-4xl">
                  🔍
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Perfect Matches Right Now</h3>
                <p className="max-w-md text-sm text-gray-500 leading-relaxed">
                  Based on your current profile, you do not meet the baseline criteria for active targeted
                  scholarship allocations. Try updating your academic profile or explore the general
                  opportunities listed below.
                </p>
              </div>
            )}

            {rankedMatches.length > 0 && (
              <div className="flex flex-col gap-4">
                {rankedMatches.map((s) => {
                  const studentProfile = storedUser ? {
                    ...storedUser,
                    gpa: storedUser.gpa ? Number(storedUser.gpa) : undefined,
                    householdIncome: storedUser.householdIncome,
                    financialSupportSource: storedUser.financialSupportSource,
                    economicDependency: storedUser.economicDependency,
                    specialCategories: {
                      isAthlete: !!storedUser.isAthlete,
                      isArtist: !!storedUser.isArtist,
                      isSKOfficial: !!storedUser.isSKOfficial,
                      isStudentLeader: !!storedUser.isStudentLeader,
                      isIndigent: !!storedUser.isIndigent,
                      isPWD: !!storedUser.isPWD,
                      isSoloParent: !!storedUser.isSoloParent,
                      isFromIndigenousFamily: false,
                      isPersonWithDisability: !!storedUser.isPWD,
                      hasAcademicHonors: !!storedUser.hasAcademicHonors,
                    },
                  } : {};
                  const shapData = generateShapContributions(
                    studentProfile,
                    { matchPercent: s.matchPercent, amount: s.amount, minimumGpa: s.minimumGpa, qualified: s.qualified, eligibilityStatus: s.eligibilityStatus, requiresFinancialNeed: s.requiresFinancialNeed },
                  );

                  return (
                    <div key={s.id} className="flex flex-col gap-0">
                      <div
                        className="flex flex-col lg:flex-row items-stretch gap-0 bg-white rounded-xl border border-gray-200 hover:shadow-md transition-shadow overflow-hidden"
                      >
                        {/* === FAR LEFT: Rank Number === */}
                        <div className="flex items-center justify-center lg:w-16 w-full lg:min-h-0 min-h-[48px] bg-blue-600 text-white shrink-0">
                          <span className="text-2xl font-bold">{s.galeShapleyRank}</span>
                        </div>

                        {/* === MIDDLE LEFT: Square Scholarship Card === */}
                        <div className="flex flex-col w-full lg:w-[280px] shrink-0 border-b lg:border-b-0 lg:border-r border-gray-100">
                          {/* Cover image */}
                          <div className="relative h-32 lg:h-28">
                            <img
                              src={scholarshipImages[s.name] || defaultScholarshipImage}
                              alt={s.name}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                            <div className="absolute top-2 right-2">
                              <Badge className="bg-emerald-500 text-white text-xs font-semibold">
                                {s.matchPercent}% Match
                              </Badge>
                            </div>
                          </div>
                          {/* Info + Actions */}
                          <div className="p-3 flex flex-col justify-between flex-1">
                            <div>
                              <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-tight">
                                {s.name}
                              </h3>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                {String(s.provider || "Quezon City Youth Development Office")}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 mt-3">
                              <Button size="sm" className="flex-1 h-7 text-xs bg-blue-600 hover:bg-blue-700">
                                <ExternalLink className="size-3 mr-1" />
                                View Details
                              </Button>
                              <Button size="sm" variant="outline" className="size-7 p-0 shrink-0">
                                <Bookmark className="size-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* === MIDDLE RIGHT: SHAP Explanation Panel === */}
                        <div className="flex-1 p-4 lg:p-5">
                          <div className="flex items-center gap-2 mb-3">
                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                              AI Match Explanation (SHAP Values)
                            </h4>
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                              {String(s.eligibilityStatus === "eligible" ? "Eligible" : "May be eligible")}
                            </Badge>
                          </div>

                          {/* SHAP Contribution Bars */}
                          <div className="space-y-2">
                            {shapData.contributions.map((c) => (
                              <ShapBar key={c.factor} contribution={c} />
                            ))}
                          </div>

                          {/* Summary */}
                          <p className="text-xs text-muted-foreground mt-3 italic">
                            {shapData.summary}
                          </p>
                        </div>
                      </div>

                      {/* #1 Recommendation Badge — shown only for top-ranked */}
                      {s.isTopRecommendation && (
                        <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 mt-1">
                          <Star className="size-4 text-blue-600 shrink-0 mt-0.5 fill-blue-600" />
                          <p className="text-xs text-blue-800">
                            <span className="font-semibold">System Recommendation:</span>{" "}
                            Optimized to provide the highest financial coverage based on your household income and economic dependency.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Fallback: Other Active Scholarship Programs ── */}
            {fallbackScholarships.length > 0 && (
              <div className="mt-10">
                <div className="flex items-center gap-3 mb-5">
                  <div className="flex-1 border-t border-gray-200" />
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-full">
                    <AlertCircle className="size-4 text-orange-500" />
                    <span className="text-sm font-semibold text-orange-700">Other Active Scholarship Programs</span>
                  </div>
                  <div className="flex-1 border-t border-gray-200" />
                </div>
                <p className="text-xs text-gray-500 text-center mb-5">
                  You do not currently meet all criteria for these programs. Each card shows which requirements are missing from your profile.
                </p>
                <div className="flex flex-col gap-3">
                  {fallbackScholarships.map((s) => (
                    <div
                      key={s.id}
                      className="flex flex-col sm:flex-row items-stretch bg-white rounded-xl border border-orange-100 overflow-hidden hover:shadow-md transition-shadow"
                    >
                      {/* Left color bar */}
                      <div className="w-full sm:w-1.5 bg-orange-400 shrink-0" />

                      {/* Cover image */}
                      <div className="relative h-24 sm:h-auto sm:w-28 shrink-0">
                        <img
                          src={scholarshipImages[s.name] || defaultScholarshipImage}
                          alt={s.name}
                          className="w-full h-full object-cover"
                          style={{ filter: "grayscale(30%)" }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                        <div className="absolute top-2 right-2">
                          <Badge className="bg-orange-500 text-white text-xs">Criteria Missing</Badge>
                        </div>
                      </div>

                      {/* Info */}
                      <div className="flex-1 p-4">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <h4 className="text-sm font-semibold text-gray-900 line-clamp-1">{s.name}</h4>
                            <p className="text-xs text-muted-foreground">{s.provider || "Quezon City Youth Development Office"}</p>
                          </div>
                          <Badge variant="outline" className="border-orange-300 text-orange-700 shrink-0 text-xs">
                            {s.matchPercent}% Match
                          </Badge>
                        </div>

                        {/* Unmet criteria list */}
                        {s.eligibility?.unmetCriteria && s.eligibility.unmetCriteria.length > 0 ? (
                          <div className="space-y-1 mt-2">
                            {s.eligibility.unmetCriteria.slice(0, 3).map((criterion: string, idx: number) => (
                              <div key={idx} className="flex items-start gap-1.5 text-xs text-red-600">
                                <XCircle className="size-3.5 shrink-0 mt-0.5" />
                                <span className="leading-snug">{criterion}</span>
                              </div>
                            ))}
                            {s.eligibility.unmetCriteria.length > 3 && (
                              <p className="text-xs text-gray-400 pl-5">
                                +{s.eligibility.unmetCriteria.length - 3} more unmet criteria
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 mt-1 italic">
                            Complete your profile to see specific missing criteria.
                          </p>
                        )}
                      </div>

                      {/* Amount + deadline */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 px-4 pb-4 sm:py-4 sm:border-l border-gray-100 shrink-0 sm:min-w-[120px]">
                        <span className="text-base font-bold text-primary font-mono">{s.amount}</span>
                        <span className="text-xs text-muted-foreground text-right">Due: {s.deadline}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

