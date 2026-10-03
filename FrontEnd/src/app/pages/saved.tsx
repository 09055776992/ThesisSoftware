import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { Bookmark } from "lucide-react";
import { fetchSavedScholarships, saveSavedScholarships } from "../lib/api-client";
import { getStoredUser } from "../lib/user-storage";
import API_BASE_URL from "../../config/api";

const SAVED_SCHOLARSHIPS_KEY_PREFIX = "scholarship-portal-saved-scholarships";

// Scholarship cover images mapping (FIX 5)
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

// FIX 6: Helper function to format dates
function formatDeadline(dateString: string): string {
  if (!dateString || dateString === "December 31, 2030") return "December 31, 2030";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
}

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

function saveScholarships(ids: string[], email?: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(savedScholarshipsKey(email), JSON.stringify(ids));
}

async function getSavedScholarshipsWithFallback(email?: string): Promise<string[]> {
  const localIds = loadSavedScholarships(email);

  if (!email) {
    return localIds;
  }

  try {
    const result = await fetchSavedScholarships(email);
    const remoteIds = Array.isArray(result.data) ? result.data.map((v) => String(v)) : [];
    saveScholarships(remoteIds, email);
    return remoteIds;
  } catch {
    return localIds;
  }
}

async function saveScholarshipsWithFallback(email: string | undefined, ids: string[]): Promise<void> {
  saveScholarships(ids, email);

  if (!email) {
    return;
  }

  try {
    await saveSavedScholarships(email, ids);
  } catch {
    // Keep local state when backend is unavailable.
  }
}

export function SavedItems() {
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [scholarships, setScholarships] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = getStoredUser();

    // Load saved IDs and all scholarships in parallel
    Promise.all([
      getSavedScholarshipsWithFallback(user?.email),
      fetch(`${API_BASE_URL}/api/scholarships`).then((r) => r.json()),
    ])
      .then(([ids, result]) => {
        setSavedIds(ids);
        // Keep _id as the identifier — same as scholarships.tsx
        const normalized = (result.data || []).map((item: any) => ({
          id: String(item._id || item.id || ""),
          name: String(item.name || item.scholarshipName || ""),
          provider: String(item.provider || item.organization || ""),
          amount: Number(item.amount || 0),
          deadline: item.deadline
            ? new Date(item.deadline).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })
            : "December 31, 2030",
          location: String(item.location || ""),
        }));
        setScholarships(normalized);
      })
      .catch(() => {
        setScholarships([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const toggleUnsave = (id: string) => {
    const next = savedIds.filter((sid) => sid !== id);
    setSavedIds(next);
    const user = getStoredUser();
    saveScholarshipsWithFallback(user?.email, next);
  };

  const savedList = scholarships.filter((s) => savedIds.includes(String(s.id)));

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Saved Scholarships</h1>
        <p className="text-gray-600 mb-8">Your bookmarked scholarships</p>

        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-gray-500">Loading saved scholarships...</p>
          </div>
        ) : savedList.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="size-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="size-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">No saved scholarships</h2>
              <p className="text-gray-600">Bookmark scholarships to easily find them later</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {savedList.map((s) => (
              <Card key={s.id} className="hover:shadow-lg transition-shadow">
                <div className="relative h-36">
                  <img
                    src={scholarshipImages[s.name] || defaultScholarshipImage}
                    alt={s.name}
                    className="w-full h-full object-cover rounded-t-lg"
                  />
                  {/* Dark gradient overlay for readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent rounded-t-lg" />
                </div>
                <CardHeader>
                  <CardTitle className="text-base line-clamp-2">{s.name}</CardTitle>
                  <CardDescription className="line-clamp-1">{s.provider}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Due: {formatDeadline(s.deadline)}</span>
                      <Button size="sm" variant="ghost" onClick={() => toggleUnsave(s.id)} className="text-green-600 hover:text-green-700 bg-green-50 hover:bg-green-100">
                        <Bookmark className="size-4" />
                        <span className="ml-2">Unsave</span>
                      </Button>
                    </div>
                    <Button className="w-full" size="sm">View Details</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
