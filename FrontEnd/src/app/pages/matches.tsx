import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  Bookmark,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Minus,
  Star,
  AlertCircle,
  XCircle,
  MapPin,
  ListChecks,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchScholarshipsWithEligibility,
  fetchSavedScholarships,
  saveSavedScholarships,
  resolveDisplayMatchScore,
} from "../lib/api-client";
import { getStoredUser } from "../lib/user-storage";
import { galeShapleyMatch, type RankedScholarship } from "../lib/galeShapleyMatch";
import {
  generateShapContributions,
  generateSystemRecommendation,
  type ShapContribution,
} from "../lib/generateShapContributions";

const SAVED_SCHOLARSHIPS_KEY_PREFIX = "scholarship-portal-saved-scholarships";

function savedScholarshipsKey(email?: string): string {
  const normalizedEmail = String(email || "guest").trim().toLowerCase();
  return `${SAVED_SCHOLARSHIPS_KEY_PREFIX}:${normalizedEmail}`;
}

function loadSavedScholarships(email?: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(savedScholarshipsKey(email));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((v) => String(v)) : [];
  } catch {
    return [];
  }
}

function persistSavedScholarshipsLocal(ids: string[], email?: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(savedScholarshipsKey(email), JSON.stringify(ids));
}

async function getSavedScholarshipsWithFallback(email?: string): Promise<string[]> {
  const localIds = loadSavedScholarships(email);
  if (!email) return localIds;

  try {
    const result = await fetchSavedScholarships(email);
    const remoteIds = Array.isArray(result.data) ? result.data.map((v) => String(v)) : [];
    const mergedIds = Array.from(new Set([...localIds, ...remoteIds]));
    persistSavedScholarshipsLocal(mergedIds, email);

    if (mergedIds.length !== remoteIds.length || mergedIds.some((id, index) => id !== remoteIds[index])) {
      await saveSavedScholarships(email, mergedIds).catch(() => {
        // Keep merged local state if sync fails.
      });
    }

    return mergedIds;
  } catch {
    return localIds;
  }
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v)).filter(Boolean);
}

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
        : "bg-gray-300 dark:bg-slate-600";

  const ImpactIcon =
    contribution.impact === "positive"
      ? TrendingUp
      : contribution.impact === "negative"
        ? TrendingDown
        : Minus;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <ImpactIcon className="size-3 shrink-0 text-muted-foreground" />
      <span className="min-w-0 shrink-0 max-w-[100px] truncate text-muted-foreground">
        {contribution.factor}
      </span>
      <div className="flex-1 h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <span className={`w-10 text-right font-semibold shrink-0 ${
        contribution.impact === "positive" ? "text-emerald-600 dark:text-emerald-400" : 
        contribution.impact === "negative" ? "text-amber-600 dark:text-amber-400" : "text-gray-500 dark:text-gray-400"
      }`}>
        {contribution.displayContribution}
      </span>
    </div>
  );
}

export function Matches() {
  const navigate = useNavigate();
  const [scholarships, setScholarships] = useState<any[]>([]);
  const [savedScholarshipIds, setSavedScholarshipIds] = useState<string[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<RankedScholarship | null>(null);

  useEffect(() => {
    const user = getStoredUser();
    console.debug("Matches: current user profile:", user);

    getSavedScholarshipsWithFallback(user?.email).then((ids) => {
      setSavedScholarshipIds(ids);
    });

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
          const mongoId = String(item._id || item.id || "").trim();

          return {
            // Preserve Mongo ObjectId as a string so save/open flows stay in sync
            id: mongoId || `match-${idx + 1}`,
            name: String(item.name || item.scholarshipName || ""),
            provider: String(item.provider || ""),
            image: String(item.imageUrl || item.image || ""),
            amount: typeof item.amount === "string" ? item.amount : `₱${Number(item.amount || 0).toLocaleString()}`,
            deadline: item.deadline ? new Date(item.deadline).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            }) : "December 31, 2030",
            type: String(item.type || "Merit-Based"),
            category: String(item.category || item.scholarshipCategory || ""),
            matchPercent: score,
            qualified,
            failedReasons,
            eligibilityStatus: status,
            location: String(item.location || ""),
            fieldOfStudy: String(item.fieldOfStudy || ""),
            minimumGpa:
              item.minimumGpa !== undefined
                ? Number(item.minimumGpa)
                : item.minimumGPA !== undefined
                  ? Number(item.minimumGPA)
                  : undefined,
            requiredEducationLevel: toStringList(
              item.requiredEducationLevel || item.educationLevel || [],
            ),
            targetIncomeCategory: item.targetIncomeCategory ?? item.incomeCategory ?? null,
            requiresFinancialNeed: !!item.requiresFinancialNeed,
            eligibility: item.eligibility ?? null,
            requirements: toStringList(item.requirements),
            specificCriteria: toStringList(item.specificCriteria),
            requiredDocuments: toStringList(item.requiredDocuments),
            generalDocuments: toStringList(item.generalDocuments),
            description: String(item.description || ""),
            benefits: String(item.benefits || item.coverage || ""),
          };
        });

        setScholarships(withMatchScores);
      })
      .catch((err: any) => {
        console.error("Failed to fetch scholarships for matches:", err);
        setScholarships([]);
      });
  }, []);

  const toggleSavedScholarship = (scholarshipId: string) => {
    const id = String(scholarshipId);
    if (!id) return;

    setSavedScholarshipIds((current) => {
      const next = current.includes(id)
        ? current.filter((savedId) => savedId !== id)
        : [...current, id];

      const user = getStoredUser();
      persistSavedScholarshipsLocal(next, user?.email || "");

      if (user?.email) {
        saveSavedScholarships(user.email, next)
          .then(() => {
            toast.success(
              next.includes(id) ? "Scholarship saved" : "Scholarship removed from saved",
            );
          })
          .catch((err) => {
            console.error("Failed to sync saved scholarships:", err);
            toast.error("Failed to sync saved scholarships");
          });
      } else {
        toast.success(
          next.includes(id) ? "Scholarship saved locally" : "Scholarship removed from saved",
        );
      }

      return next;
    });
  };

  const isScholarshipSaved = (scholarshipId: string | number) =>
    savedScholarshipIds.includes(String(scholarshipId));

  // Get stored user for SHAP contributions
  const storedUser = useMemo(() => getStoredUser(), []);

  const buildStudentProfileForShap = () => {
    const user = storedUser || getStoredUser();
    if (!user) return {};
    return {
      ...user,
      gpa: user.gpa || user.gwa ? Number(user.gpa || user.gwa) : undefined,
      householdIncome: user.householdIncome,
      household_income: user.householdIncome,
      financialSupportSource: user.financialSupportSource,
      financial_support_source: user.financialSupportSource,
      economicDependency: user.economicDependency,
      economic_dependency: user.economicDependency,
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
    };
  };

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

  const selectedShapData = useMemo(() => {
    if (!selectedMatch) return null;
    return generateShapContributions(
      buildStudentProfileForShap(),
      {
        name: selectedMatch.name,
        matchPercent: selectedMatch.matchPercent,
        amount: selectedMatch.amount as string | undefined,
        minimumGpa: selectedMatch.minimumGpa,
        qualified: selectedMatch.qualified,
        eligibilityStatus: selectedMatch.eligibilityStatus,
        requiresFinancialNeed: selectedMatch.requiresFinancialNeed,
      },
    );
  }, [selectedMatch, storedUser]);

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">Scholarship Matches</h1>
          <p className="text-muted-foreground">
            Ranked by Gale-Shapley stable matching algorithm based on mutual fit between your profile and scholarship criteria.
          </p>
        </div>

        {/* If there are no scholarships at all */}
        {scholarships.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-12 text-center">
            <div className="max-w-md mx-auto">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No scholarships found</h2>
              <p className="text-gray-600 dark:text-gray-400">There are currently no scholarships in the database.</p>
            </div>
          </div>
        ) : !userHasProfileFields ? (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-8">
            <h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Complete your profile to see matches</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">The matching algorithm uses these fields to personalize results. Add the following to improve matches:</p>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300">
              {userMissingFields.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            {rankedMatches.length === 0 && (
              <div className="mb-8 flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/60 py-14 px-6 text-center">
                <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/40 text-4xl">
                  🔍
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Perfect Matches Right Now</h3>
                <p className="max-w-md text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                  Based on your current profile, you do not meet the baseline criteria for active targeted
                  scholarship allocations. Try updating your academic profile or explore the general
                  opportunities listed below.
                </p>
              </div>
            )}

            {rankedMatches.length > 0 && (
              <div className="flex flex-col gap-4">
                {rankedMatches.map((s) => {
                  const shapData = generateShapContributions(
                    buildStudentProfileForShap(),
                    {
                      name: s.name,
                      matchPercent: s.matchPercent,
                      amount: s.amount,
                      minimumGpa: s.minimumGpa,
                      qualified: s.qualified,
                      eligibilityStatus: s.eligibilityStatus,
                      requiresFinancialNeed: s.requiresFinancialNeed,
                      type: String(s.type || ""),
                      category: String(s.category || ""),
                      fieldOfStudy: String(s.fieldOfStudy || ""),
                      description: String(s.description || ""),
                    },
                  );
                  const recommendation = generateSystemRecommendation(
                    buildStudentProfileForShap(),
                    {
                      name: s.name,
                      matchPercent: s.matchPercent,
                      minimumGpa: s.minimumGpa,
                      requiresFinancialNeed: s.requiresFinancialNeed,
                      type: String(s.type || ""),
                      category: String(s.category || ""),
                      fieldOfStudy: String(s.fieldOfStudy || ""),
                      description: String(s.description || ""),
                    },
                    shapData,
                  );
                  const saved = isScholarshipSaved(s.id);

                  return (
                    <div key={s.id} className="flex flex-col gap-0">
                      <div
                        className="flex flex-col lg:flex-row items-stretch gap-0 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 hover:shadow-md transition-shadow overflow-hidden"
                      >
                        {/* === FAR LEFT: Rank Number === */}
                        <div className="flex items-center justify-center lg:w-16 w-full lg:min-h-0 min-h-[48px] bg-blue-600 text-white shrink-0">
                          <span className="text-2xl font-bold">{s.galeShapleyRank}</span>
                        </div>

                        {/* === MIDDLE LEFT: Square Scholarship Card === */}
                        <div className="flex flex-col w-full lg:w-[280px] shrink-0 border-b lg:border-b-0 lg:border-r border-gray-100 dark:border-slate-800">
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
                              <h3 className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2 leading-tight">
                                {s.name}
                              </h3>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                {String(s.provider || "Quezon City Youth Development Office")}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 mt-3">
                              <Button
                                size="sm"
                                className="flex-1 h-7 text-xs bg-blue-600 hover:bg-blue-700"
                                onClick={() => setSelectedMatch(s)}
                              >
                                <ExternalLink className="size-3 mr-1" />
                                View Details
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className={`size-7 p-0 shrink-0 ${
                                  saved
                                    ? "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-950/60 hover:text-blue-800 dark:hover:text-blue-200"
                                    : ""
                                }`}
                                aria-label={saved ? "Unsave scholarship" : "Save scholarship"}
                                aria-pressed={saved}
                                onClick={() => toggleSavedScholarship(String(s.id))}
                              >
                                <Bookmark className={`size-3.5 ${saved ? "fill-current" : ""}`} />
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* === MIDDLE RIGHT: SHAP Explanation Panel === */}
                        <div className="flex-1 p-4 lg:p-5">
                          <div className="flex items-center gap-2 mb-3">
                            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
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
                        <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-2.5 mt-1">
                          <Star className="size-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5 fill-blue-600 dark:fill-blue-400" />
                          <p className="text-xs text-blue-800 dark:text-blue-200">
                            <span className="font-semibold">System Recommendation:</span>{" "}
                            {recommendation.message}
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
                  <div className="flex-1 border-t border-gray-200 dark:border-slate-800" />
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800 rounded-full">
                    <AlertCircle className="size-4 text-orange-500 dark:text-orange-400" />
                    <span className="text-sm font-semibold text-orange-700 dark:text-orange-300">Other Active Scholarship Programs</span>
                  </div>
                  <div className="flex-1 border-t border-gray-200 dark:border-slate-800" />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center mb-5">
                  You do not currently meet all criteria for these programs. Each card shows which requirements are missing from your profile.
                </p>
                <div className="flex flex-col gap-3">
                  {fallbackScholarships.map((s) => (
                    <div
                      key={s.id}
                      className="flex flex-col sm:flex-row items-stretch bg-white dark:bg-slate-900 rounded-xl border border-orange-100 dark:border-orange-900/60 overflow-hidden hover:shadow-md transition-shadow"
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
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-1">{s.name}</h4>
                            <p className="text-xs text-muted-foreground">{s.provider || "Quezon City Youth Development Office"}</p>
                          </div>
                          <Badge variant="outline" className="border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300 shrink-0 text-xs">
                            {s.matchPercent}% Match
                          </Badge>
                        </div>

                        {/* Unmet criteria list */}
                        {s.eligibility?.unmetCriteria && s.eligibility.unmetCriteria.length > 0 ? (
                          <div className="space-y-1 mt-2">
                            {s.eligibility.unmetCriteria.slice(0, 3).map((criterion: string, idx: number) => (
                              <div key={idx} className="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400">
                                <XCircle className="size-3.5 shrink-0 mt-0.5" />
                                <span className="leading-snug">{criterion}</span>
                              </div>
                            ))}
                            {s.eligibility.unmetCriteria.length > 3 && (
                              <p className="text-xs text-gray-400 dark:text-gray-500 pl-5">
                                +{s.eligibility.unmetCriteria.length - 3} more unmet criteria
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 italic">
                            Complete your profile to see specific missing criteria.
                          </p>
                        )}
                      </div>

                      {/* Amount + deadline */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 px-4 pb-4 sm:py-4 sm:border-l border-gray-100 dark:border-slate-800 shrink-0 sm:min-w-[120px]">
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

      {/* Scholarship Match Detail Modal */}
      <Dialog open={!!selectedMatch} onOpenChange={(open) => !open && setSelectedMatch(null)}>
        <DialogContent className="w-full min-w-[320px] sm:min-w-[600px] sm:max-w-[700px] max-h-[90vh] overflow-y-auto overflow-x-hidden p-8 sm:p-10">
          {selectedMatch && (
            <>
              <DialogHeader className="space-y-5 mb-6">
                <div className="mb-5 relative h-52">
                  <img
                    src={scholarshipImages[selectedMatch.name] || defaultScholarshipImage}
                    alt={selectedMatch.name}
                    className="w-full h-full object-cover rounded-xl"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent rounded-xl" />
                  <div className="absolute top-3 right-3">
                    <Badge className="bg-emerald-500 text-white text-sm font-semibold">
                      {selectedMatch.matchPercent}% Match
                    </Badge>
                  </div>
                </div>
                <DialogTitle className="text-2xl leading-snug text-gray-900 dark:text-white">{selectedMatch.name}</DialogTitle>
                <DialogDescription className="text-base">
                  {String(selectedMatch.provider || "Quezon City Youth Development Office")}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-8">
                {(selectedMatch.eligibilityStatus === "eligible" ||
                  selectedMatch.eligibilityStatus === "may-be-eligible") && (
                  <div
                    className={`rounded-lg border p-5 ${
                      selectedMatch.eligibilityStatus === "eligible"
                        ? "bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800"
                        : "bg-yellow-50 dark:bg-yellow-950/40 border-yellow-200 dark:border-yellow-800"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`size-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          selectedMatch.eligibilityStatus === "eligible" ? "bg-green-500" : "bg-yellow-500"
                        }`}
                      >
                        <CheckCircle className="size-5 text-white" />
                      </div>
                      <div>
                        <p
                          className={`font-semibold text-base ${
                            selectedMatch.eligibilityStatus === "eligible"
                              ? "text-green-800 dark:text-green-200"
                              : "text-yellow-800 dark:text-yellow-200"
                          }`}
                        >
                          {selectedMatch.eligibilityStatus === "eligible"
                            ? "You qualify for this scholarship!"
                            : "You may qualify for this scholarship"}
                        </p>
                        <p
                          className={`text-sm mt-1 ${
                            selectedMatch.eligibilityStatus === "eligible"
                              ? "text-green-700 dark:text-green-300"
                              : "text-yellow-700 dark:text-yellow-300"
                          }`}
                        >
                          Ranked #{selectedMatch.galeShapleyRank} by Gale-Shapley stable matching
                          {selectedMatch.isTopRecommendation ? " · Top system recommendation" : ""}.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-5 bg-gray-50 dark:bg-slate-800/60 rounded-xl px-5">
                  <div className="text-center py-2">
                    <p className="text-2xl font-bold text-primary font-mono">{selectedMatch.amount}</p>
                    <p className="text-sm text-muted-foreground mt-1">Award / Coverage</p>
                  </div>
                  <div className="text-center py-2 sm:border-l sm:border-r border-gray-200 dark:border-slate-700 sm:px-4">
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">{String(selectedMatch.deadline || "—")}</p>
                    <p className="text-sm text-muted-foreground mt-1">Application Deadline</p>
                  </div>
                  <div className="text-center py-2 flex flex-col items-center gap-1">
                    <Badge className="bg-accent text-base px-4 py-1.5">
                      {selectedMatch.matchPercent}% Match
                    </Badge>
                    <p className="text-sm text-muted-foreground mt-1">Your Match Score</p>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-3 text-gray-900 dark:text-white">Description</h3>
                  <p className="text-muted-foreground leading-[1.7]">
                    {String(selectedMatch.description || "No description available for this scholarship.")}
                  </p>
                </div>

                {String(selectedMatch.benefits || "").trim() && (
                  <div>
                    <h3 className="font-semibold text-lg mb-3 text-gray-900 dark:text-white">Benefits / Coverage</h3>
                    <p className="text-muted-foreground leading-[1.7]">{String(selectedMatch.benefits)}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold text-lg mb-3 text-gray-900 dark:text-white">Type</h3>
                    <div className="flex flex-wrap gap-2">
                      {String(selectedMatch.type || "General")
                        .split(" / ")
                        .map((typePart, idx) => (
                          <Badge key={idx} variant="outline" className="text-sm px-3 py-1">
                            {typePart.trim()}
                          </Badge>
                        ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-3 flex items-center gap-2 text-gray-900 dark:text-white">
                      <MapPin className="size-5 text-primary" />
                      Location
                    </h3>
                    <p className="text-muted-foreground">
                      {String(selectedMatch.location || "").trim() || "Quezon City"}
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-3 text-gray-900 dark:text-white">Field of Study</h3>
                    <p className="text-muted-foreground">
                      {String(selectedMatch.fieldOfStudy || "").trim() || "All Fields"}
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-3 text-gray-900 dark:text-white">Provider</h3>
                    <p className="text-muted-foreground">
                      {String(selectedMatch.provider || "Quezon City Youth Development Office")}
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                    <ListChecks className="size-5 text-primary" />
                    Criteria & Requirements
                  </h3>

                  {toStringList(selectedMatch.requiredEducationLevel).length > 0 && (
                    <div className="mb-5">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Education Level Required</h4>
                      <div className="flex flex-wrap gap-2">
                        {toStringList(selectedMatch.requiredEducationLevel).map((level) => (
                          <Badge key={level} variant="secondary" className="text-sm px-3 py-1">
                            {level}
                          </Badge>
                        ))}
                      </div>
                      {selectedMatch.minimumGpa !== undefined && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">
                          Minimum GWA Required:{" "}
                          <span className="font-medium text-gray-900 dark:text-gray-200">{selectedMatch.minimumGpa}</span>
                        </p>
                      )}
                    </div>
                  )}

                  {toStringList(selectedMatch.specificCriteria).length > 0 && (
                    <div className="mb-5">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Eligibility Criteria</h4>
                      <ul className="space-y-2">
                        {toStringList(selectedMatch.specificCriteria).map((criterion) => (
                          <li key={criterion} className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2">
                            <span className="text-green-600 dark:text-green-400 mt-1">•</span>
                            <span>{criterion}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {toStringList(selectedMatch.requirements).length > 0 && (
                    <div className="mb-5">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Requirements</h4>
                      <ul className="space-y-2">
                        {toStringList(selectedMatch.requirements).map((req) => (
                          <li key={req} className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2">
                            <span className="text-blue-600 dark:text-blue-400 mt-1">•</span>
                            <span>{req}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {(toStringList(selectedMatch.generalDocuments).length > 0 ||
                    toStringList(selectedMatch.requiredDocuments).length > 0) && (
                    <div className="mb-2">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Documents</h4>
                      <ul className="space-y-2">
                        {[
                          ...toStringList(selectedMatch.generalDocuments),
                          ...toStringList(selectedMatch.requiredDocuments),
                        ].map((doc) => (
                          <li key={doc} className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2">
                            <span className="text-amber-600 dark:text-amber-400 mt-1">•</span>
                            <span>{doc}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {toStringList(selectedMatch.specificCriteria).length === 0 &&
                    toStringList(selectedMatch.requirements).length === 0 &&
                    toStringList(selectedMatch.generalDocuments).length === 0 &&
                    toStringList(selectedMatch.requiredDocuments).length === 0 && (
                      <p className="text-sm text-muted-foreground italic">
                        No detailed criteria listed. Open the full scholarship page for the complete
                        application checklist.
                      </p>
                    )}
                </div>

                {selectedShapData && (
                  <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <h3 className="font-semibold text-lg text-gray-900 dark:text-white">AI Match Explanation (SHAP Values)</h3>
                      <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                        Feature impact
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {selectedShapData.contributions.map((c) => (
                        <ShapBar key={c.factor} contribution={c} />
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-4 italic">{selectedShapData.summary}</p>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                    onClick={() => {
                      const id = String(selectedMatch.id);
                      setSelectedMatch(null);
                      navigate(`/dashboard/scholarships?open=${encodeURIComponent(id)}`);
                    }}
                  >
                    <ExternalLink className="size-4 mr-2" />
                    Open Full Details & Apply
                  </Button>
                  <Button
                    variant="outline"
                    className={
                      isScholarshipSaved(selectedMatch.id)
                        ? "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-950/60"
                        : ""
                    }
                    onClick={() => toggleSavedScholarship(String(selectedMatch.id))}
                  >
                    <Bookmark
                      className={`size-4 mr-2 ${
                        isScholarshipSaved(selectedMatch.id) ? "fill-current" : ""
                      }`}
                    />
                    {isScholarshipSaved(selectedMatch.id) ? "Saved" : "Save"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
