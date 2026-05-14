import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardDescription, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { Bookmark, Award, Calendar, MapPin, ExternalLink } from "lucide-react";
import { fetchScholarshipsWithEligibility } from "../lib/api-client";
import { getStoredUser } from "../lib/user-storage";
import { calculateMatchScore } from "../lib/calculateMatchScore";

// Scholarship cover images mapping (FIX 5)
const scholarshipImages: Record<string, string> = {
  "College Academic Scholarship": "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=600&q=80",
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

export function Matches() {
  const [scholarships, setScholarships] = useState<any[]>([]);

  useEffect(() => {
    const user = getStoredUser();
    console.debug("Matches: current user profile:", user);
    console.debug("Matches: profile fields used -> gpa, fieldOfStudy, location, incomeCategory, financialNeed:", {
      gpa: user?.gpa,
      fieldOfStudy: user?.fieldOfStudy,
      location: user?.location,
      incomeCategory: user?.incomeCategory,
      financialNeed: user?.financialNeed,
    });

    // Fetch scholarships - use regular endpoint since we'll calculate scores client-side
    fetchScholarshipsWithEligibility(user?.email || "")
      .then((result: any) => {
        const raw = result.data || [];
        console.log("Matches: fetched scholarships count:", raw.length);

        // Calculate match scores using unified function
        const withMatchScores = raw.map((item: any, idx: number) => {
          let match = { score: 0, qualified: false, failedReasons: [] };
          
          if (user) {
            try {
              match = calculateMatchScore(user, item);
              console.log(`${item.name}: ${match.score}%,`, match.qualified ? 'QUALIFIED' : 'NOT QUALIFIED', match.failedReasons);
            } catch (err) {
              console.error(`Error calculating match for ${item.name}:`, err);
              match = { score: 0, qualified: false, failedReasons: ['Error calculating match'] };
            }
          }
          
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
            matchPercent: match.score,
            qualified: match.qualified,
            failedReasons: match.failedReasons,
            location: String(item.location || ""),
            fieldOfStudy: String(item.fieldOfStudy || ""),
            minimumGpa: item.minimumGpa !== undefined ? Number(item.minimumGpa) : undefined,
            targetIncomeCategory: item.targetIncomeCategory ?? item.incomeCategory ?? null,
            requiresFinancialNeed: !!item.requiresFinancialNeed,
            eligibility: String(item.eligibility || ""),
            requirements: Array.isArray(item.requirements) ? item.requirements.map((v: any) => String(v)) : [],
            description: String(item.description || ""),
            eligibilityStatus: item.eligibilityStatus || "unknown",
          };
        });

        setScholarships(withMatchScores);
      })
      .catch((err: any) => {
        console.error("Failed to fetch scholarships for matches:", err);
        setScholarships([]);
      });
  }, []);

  const { matches, lowMatches, userMissingFields, userHasProfileFields } = useMemo(() => {
    const user = getStoredUser();
    const missing: string[] = [];
    const userHasProfileFields = !!(user && (user.gpa || user.fieldOfStudy || user.location || user.incomeCategory || (user.financialNeed && user.financialNeed.length)));

    if (!user) {
      missing.push("GPA", "Field of Study", "Location", "Financial need / Income");
    } else {
      if (!user.gpa) missing.push("GPA");
      if (!user.fieldOfStudy) missing.push("Field of Study");
      if (!user.location) missing.push("Location");
      if (!user.incomeCategory && !(user.financialNeed && user.financialNeed.length)) missing.push("Financial need / Income");
    }

    // Filter to ONLY show scholarships where user is fully qualified
    // Sort by match score (highest first)
    const qualified = scholarships.filter((s) => s.qualified === true);
    qualified.sort((a, b) => (b.matchPercent || 0) - (a.matchPercent || 0));

    return { matches: qualified, lowMatches: [], userMissingFields: missing, userHasProfileFields };
  }, [scholarships]);

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Scholarship Matches</h1>
          <p className="text-muted-foreground">Scholarships that match your profile, sorted by match percentage.</p>
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
            {matches.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <div className="max-w-md mx-auto">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">No scholarships match your profile yet</h2>
                  <p className="text-gray-600">Try updating your profile or check back for new scholarships that match your qualifications.</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {matches.map((s) => (
                  <Card key={s.id} className="hover:shadow-lg transition-shadow">
                    <div className="relative h-36">
                      <img
                        src={scholarshipImages[s.name] || defaultScholarshipImage}
                        alt={s.name}
                        className="w-full h-full object-cover rounded-t-lg"
                      />
                      {/* Dark gradient overlay for badge readability */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent rounded-t-lg" />
                      <div className="absolute top-2 right-2">
                        <Badge className="bg-accent">{s.matchPercent}% Match</Badge>
                      </div>
                    </div>
                    <CardHeader>
                      <CardTitle className="text-base line-clamp-2">{s.name}</CardTitle>
                      <CardDescription className="line-clamp-1">{s.provider}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Due: {s.deadline}</span>
                          <Button size="sm" variant="ghost">
                            <Bookmark className="h-4 w-4" />
                            <span className="ml-2">Save</span>
                          </Button>
                        </div>
                        <Button className="w-full" size="sm">View Details</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

