import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Slider } from "../components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip";
import { Separator } from "../components/ui/separator";
import { Search, Calendar, MapPin, Award, Bookmark, ExternalLink, FileText, CheckCircle, XCircle, ListChecks, GraduationCap, AlertCircle } from "lucide-react";
import { Checkbox } from "../components/ui/checkbox";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { fetchSavedScholarships, saveSavedScholarships, fetchScholarshipsWithEligibility, checkEligibility, applyForScholarship, resolveDisplayMatchScore, fetchProfileDocuments, type ProfileDocumentResponse } from "../lib/api-client";
import { getStoredUser } from "../lib/user-storage";
import API_BASE_URL from "../../config/api";
import { toast } from "sonner";

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

const fieldOfStudyOptions = [
  { value: "all", label: "All Fields" },
  { value: "computer-science", label: "Computer Science" },
  { value: "information-technology", label: "Information Technology" },
  { value: "nursing", label: "Nursing" },
  { value: "education", label: "Education" },
  { value: "engineering", label: "Engineering" },
  { value: "accountancy", label: "Accountancy" },
  { value: "business-administration", label: "Business Administration" },
  { value: "psychology", label: "Psychology" },
  { value: "architecture", label: "Architecture" },
  { value: "criminology", label: "Criminology" },
  { value: "medicine", label: "Medicine" },
];

const scholarshipTypeOptions = [
  { value: "all", label: "All Types" },
  { value: "merit-based", label: "Merit-Based" },
  { value: "need-based", label: "Need-Based" },
  { value: "athletic", label: "Athletic" },
  { value: "minority", label: "Minority" },
  { value: "other", label: "Other" },
];

const gwaOptions = [
  { value: "all", label: "Any GWA" },
  { value: "1.50", label: "1.00–1.50 (Excellent)" },
  { value: "2.00", label: "1.51–2.00 (Very Good)" },
  { value: "2.50", label: "2.01–2.50 (Good)" },
  { value: "3.00", label: "2.51–3.00 (Satisfactory)" },
];

interface EligibilityInfo {
  isEligible: boolean;
  mayBeEligible: boolean;
  unmetCriteria: string[];
  reasons: string[];
  criteriaChecks?: Record<string, {
    passed: boolean;
    label: string;
    message: string;
    status?: string;
    schoolName?: string;
    schoolCampus?: string;
    schoolLocation?: string;
    schoolType?: string;
    required?: string[] | number;
    actual?: string | number;
  }>;
}

interface Scholarship {
  _id: string;
  scholarshipName?: string;
  name: string;
  provider: string;
  amount: number;
  deadline: string;
  status: string;
  type: string;
  fieldOfStudy?: string;
  location?: string;
  description: string;
  matchScore?: number;
  saved?: boolean;
  isStableMatch?: boolean;
  amountValue?: number;
  minimumGpa?: number;
  minimumGPA?: number;
  minimumGWA?: number;
  requiredEducationLevel?: string[];
  specificCriteria?: string[];
  requiredDocuments?: string[];
  generalDocuments?: string[];
  eligibilityCriteria?: {
    minGPA?: number;
    minGwa?: number;
    minGWA?: number;
    educationLevel?: string[];
    qcResident?: boolean;
  };
  eligibilityStatus?: "eligible" | "may-be-eligible" | "not-eligible" | "unknown";
  eligibility?: EligibilityInfo;
  deadlineStatus?: "open" | "closing-soon" | "closed" | "not-yet-open";
  canApply?: boolean;
  daysUntilDeadline?: number;
}

/** Server sends canApply; keep aligned with deadline + status when merging list vs filters. */
function mergeCanApplyFlags(item: {
  canApply?: boolean;
  eligibilityStatus?: string;
  deadlineStatus?: string;
}): boolean {
  const deadlineOk =
    item.deadlineStatus !== "closed" && item.deadlineStatus !== "not-yet-open";
  const statusOk =
    item.eligibilityStatus === "eligible" || item.eligibilityStatus === "may-be-eligible";
  if (typeof item.canApply === "boolean") {
    return item.canApply && deadlineOk && statusOk;
  }
  return Boolean(statusOk && deadlineOk);
}

function deriveStudentApplyAllowed(s: Scholarship | null | undefined): boolean {
  return mergeCanApplyFlags({
    canApply: s?.canApply,
    eligibilityStatus: s?.eligibilityStatus,
    deadlineStatus: s?.deadlineStatus,
  });
}

function eligibilityCriteriaToLines(criteria: Scholarship["eligibilityCriteria"]): string[] {
  if (!criteria || typeof criteria !== "object") return [];
  const lines: string[] = [];
  if (criteria.minGPA != null) lines.push(`Minimum GWA: ${criteria.minGPA}`);
  if (criteria.minGwa != null) lines.push(`Minimum GWA: ${criteria.minGwa}`);
  if (criteria.minGWA != null) lines.push(`Minimum GWA: ${criteria.minGWA}`);
  if (Array.isArray(criteria.educationLevel) && criteria.educationLevel.length > 0) {
    lines.push(`Education level: ${criteria.educationLevel.join(", ")}`);
  }
  if (criteria.qcResident === true) lines.push("Must be a Quezon City resident");
  return lines;
}

/**
 * Education Level Visibility Filter
 * - SHS students: See ALL scholarships (SHS + College)
 * - College students: Only see College scholarships (hide SHS-specific)
 */
function isScholarshipVisibleToUser(scholarship: Scholarship, userEducationLevel?: string): boolean {
  // If no user education level, show all scholarships
  if (!userEducationLevel) return true;
  
  // If scholarship has no specific education level requirement, it's universal
  const requiredLevels = scholarship.requiredEducationLevel || [];
  if (requiredLevels.length === 0) return true;
  
  // Normalize user's education level
  const userLevel = userEducationLevel.toLowerCase().trim();
  const isUserSHS = userLevel.includes("senior high") || userLevel === "shs";
  const isUserCollege = userLevel.includes("college") || userLevel.includes("undergraduate");
  
  // SHS students: see all scholarships
  if (isUserSHS) return true;
  
  // College students: filter out SHS-specific scholarships
  if (isUserCollege) {
    // Check if scholarship is strictly SHS-only
    const isSHSOnly = requiredLevels.every(level => {
      const l = level.toLowerCase();
      return l.includes("senior high") || l === "shs";
    });
    
    // If scholarship is SHS-only, hide it from College students
    if (isSHSOnly) return false;
    
    // Otherwise (College-only or mixed), show it
    return true;
  }
  
  // For other education levels (JHS, Postgrad, etc.), show all
  return true;
}

function savedScholarshipsKey(email?: string): string {
  const normalizedEmail = String(email || "guest").trim().toLowerCase();
  return `${SAVED_SCHOLARSHIPS_KEY_PREFIX}:${normalizedEmail}`;
}

function loadSavedScholarships(email?: string): number[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(savedScholarshipsKey(email));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((value) => Number(value)).filter(Number.isFinite) : [];
  } catch {
    return [];
  }
}

function saveScholarships(ids: number[], email?: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(savedScholarshipsKey(email), JSON.stringify(ids));
}

function normalizeType(value: string): string {
  return String(value || "").trim().toLowerCase().replace(/-/g, " ");
}

async function getSavedScholarshipsWithFallback(email?: string): Promise<number[]> {
  const localIds = loadSavedScholarships(email);

  if (!email) {
    return localIds;
  }

  try {
    const result = await fetchSavedScholarships(email);
    const remoteIds = Array.isArray(result.data) ? result.data.map((v) => Number(v)).filter(Number.isFinite) : [];
    const mergedIds = Array.from(new Set([...localIds, ...remoteIds]));
    saveScholarships(mergedIds, email);

    if (mergedIds.length !== remoteIds.length || mergedIds.some((id, index) => id !== remoteIds[index])) {
      await saveSavedScholarships(email, mergedIds).catch(() => {
        // Keep the merged local state even if the backend sync fails.
      });
    }

    return mergedIds;
  } catch {
    return localIds;
  }
}

async function saveScholarshipsWithFallback(email: string | undefined, ids: number[]): Promise<void> {
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

// Removed mockScholarships - now using real data from MongoDB

export function Scholarships() {
  const [selectedScholarship, setSelectedScholarship] = useState<Scholarship | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [amountRange, setAmountRange] = useState([0, 100000]);
  const [scholarshipsData, setScholarshipsData] = useState<Scholarship[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState("all");
  const [selectedField, setSelectedField] = useState("all");
  const [selectedLocation, setSelectedLocation] = useState("all");
  const [selectedGwa, setSelectedGwa] = useState("all");
  const [savedScholarships, setSavedScholarships] = useState<string[]>([]);
  
  // Application State - Simplified single-step flow
  const [declarationChecked, setDeclarationChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Legacy modal state - keeping for compatibility but not using multi-step
  const [isApplicationModalOpen, setIsApplicationModalOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  
  // Profile Documents State (from Document Vault)
  const [profileDocuments, setProfileDocuments] = useState<ProfileDocumentResponse[]>([]);
  const [hasProfileDocuments, setHasProfileDocuments] = useState(false);
  const [isLoadingProfileDocs, setIsLoadingProfileDocs] = useState(false);

  useEffect(() => {
    const user = getStoredUser();
    const id = selectedScholarship?._id;
    if (!user?.email || !id) return;
    let cancelled = false;

    // Reset form state when opening a new scholarship detail
    setDeclarationChecked(false);
    setSubmitError(null);

    // Load profile documents when detail dialog opens
    setIsLoadingProfileDocs(true);
    fetchProfileDocuments(user.email)
      .then((result) => {
        if (cancelled) return;
        setProfileDocuments(result.documents);
        setHasProfileDocuments(result.isComplete);
      })
      .catch(() => {
        if (!cancelled) setHasProfileDocuments(false);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingProfileDocs(false);
      });

    checkEligibility(String(id), user.email)
      .then((res) => {
        if (cancelled) return;
        setSelectedScholarship((prev) =>
          prev && String(prev._id) === String(id)
            ? {
                ...prev,
                canApply: mergeCanApplyFlags({
                  canApply: res.canApply,
                  eligibilityStatus: prev.eligibilityStatus,
                  deadlineStatus: prev.deadlineStatus,
                }),
              }
            : prev,
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedScholarship?._id]);

  useEffect(() => {
    const user = getStoredUser();
    loadSavedScholarshipsFromStorage(user?.email);
    loadScholarships();
  }, []);

  const loadSavedScholarshipsFromStorage = async (email?: string) => {
    const localIds = loadSavedScholarships(email);
    setSavedScholarships(localIds.map(String));

    if (email) {
      try {
        const result = await fetchSavedScholarships(email);
        const remoteIds = Array.isArray(result.data) ? result.data.map(String) : [];
        const mergedIds = Array.from(new Set([...localIds.map(String), ...remoteIds]));
        setSavedScholarships(mergedIds);
        saveScholarships(mergedIds.map(Number), email);
      } catch {
        // Keep local state if backend is unavailable
      }
    }
  };

  const loadScholarships = async () => {
    try {
      const user = getStoredUser();
      console.log('Current user:', user);

      console.log('Fetching scholarships...');
      let result: any = null;

      // Use server-side eligibility when logged in (authoritative for QC scholarships)
      if (user?.email) {
        try {
          result = await fetchScholarshipsWithEligibility(user.email);
          console.log('Eligibility fetch succeeded:', result.data?.length || 0, 'scholarships');
        } catch (eligErr) {
          console.warn('fetchScholarshipsWithEligibility failed, falling back to plain list:', eligErr);
          result = null;
        }
      }

      // Fall back to plain /api/scholarships if eligibility endpoint failed or user not logged in
      if (!result || !Array.isArray(result.data)) {
        const r = await fetch(`${API_BASE_URL}/api/scholarships`);
        console.log('Response status:', r.status);
        console.log('Response content-type:', r.headers.get('content-type'));
        result = await r.json();
      }

      console.log('Scholarships received:', result.data?.length || 0, result);
      
      const normalized = (result.data || []).map((item: any) => {
        const serverStatus = item.eligibilityStatus as string | undefined;
        const matchScore = resolveDisplayMatchScore(
          typeof item.matchScore === "number" ? item.matchScore : Number(item.matchScore),
          serverStatus,
        );
        const matchQualified =
          serverStatus === "eligible" || serverStatus === "may-be-eligible";
        
        return {
          ...item,
          id: item._id,
          name: item.name || item.scholarshipName || "Scholarship",
          scholarshipName: item.scholarshipName || item.name,
          amount: Number(item.amount || 0),
          deadline: new Date(item.deadline).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
          matchScore,
          matchQualified,
          image: item.imageUrl || `https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800&q=80`,
          minimumGpa: item.minimumGPA ?? item.minimumGpa ?? item.minGWA ?? item.eligibilityCriteria?.minGPA ?? item.eligibilityCriteria?.minGwa ?? item.eligibilityCriteria?.minGWA,
          minimumGPA: item.minimumGPA ?? item.minimumGpa ?? item.minGWA ?? item.eligibilityCriteria?.minGPA ?? item.eligibilityCriteria?.minGwa ?? item.eligibilityCriteria?.minGWA,
          requiredEducationLevel: item.requiredEducationLevel ?? (item.educationLevel ? (Array.isArray(item.educationLevel) ? item.educationLevel : [item.educationLevel]) : []),
          eligibilityStatus: serverStatus || "unknown",
          eligibility: item.eligibility,
          deadlineStatus: item.deadlineStatus,
          canApply: mergeCanApplyFlags({
            canApply: item.canApply,
            eligibilityStatus: serverStatus || "unknown",
            deadlineStatus: item.deadlineStatus,
          }),
          daysUntilDeadline: item.daysUntilDeadline,
        };
      });
      
      console.log('Normalized scholarships:', normalized.length);
      setScholarshipsData(normalized);
    } catch (error) {
      console.error("Error fetching scholarships:", error);
    } finally {
      setLoading(false);
    }
  };

  // Handle Apply Filters button
  const handleApplyFilters = async () => {
    console.log('Active filters:', {
      amountMin: amountRange[0],
      amountMax: amountRange[1],
      type: selectedType,
      fieldOfStudy: selectedField,
      location: selectedLocation,
      minGPA: selectedGwa
    });

    // Build query parameters
    const params = new URLSearchParams();
    
    // Always include status=Active for public view
    params.append('status', 'Active');
    
    // Add filters only if they're not default values
    if (selectedType !== 'all') {
      params.append('type', selectedType);
    }
    if (selectedField !== 'all') {
      params.append('fieldOfStudy', selectedField);
    }
    if (selectedLocation !== 'all') {
      params.append('location', selectedLocation);
    }
    if (selectedGwa !== 'all') {
      params.append('minGPA', selectedGwa);
    }
    
    // Only include amount range if user changed from defaults
    if (amountRange[0] > 0) {
      params.append('amountMin', amountRange[0].toString());
    }
    if (amountRange[1] < 100000) {
      params.append('amountMax', amountRange[1].toString());
    }

    try {
      const user = getStoredUser();
      const queryString = params.toString();

      // Use the absolute backend URL to avoid relying on dev-server proxy when
      // the frontend is served from a different origin. This ensures the
      // logged-in path calls the real backend endpoint and returns results.
      let result;
      if (user?.email) {
        const url = `${API_BASE_URL}/api/scholarships-with-eligibility?studentEmail=${encodeURIComponent(user.email)}&${queryString}`;
        result = await fetch(url).then((r) => r.json());
      } else {
        const url = `${API_BASE_URL}/api/scholarships?${queryString}`;
        result = await fetch(url).then((r) => r.json());
      }
      
      const normalized = (result.data || []).map((item: any) => ({
        ...item,
        id: item._id,
        name: item.name || item.scholarshipName || "Scholarship",
        scholarshipName: item.scholarshipName || item.name,
        amount: Number(item.amount || 0),
        deadline: new Date(item.deadline).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        matchScore: resolveDisplayMatchScore(
          typeof item.matchScore === "number" ? item.matchScore : Number(item.matchScore),
          item.eligibilityStatus,
        ),
        image: item.imageUrl || `https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800&q=80`,
        minimumGpa: item.minimumGPA ?? item.minimumGpa ?? item.minGWA ?? item.eligibilityCriteria?.minGPA ?? item.eligibilityCriteria?.minGwa ?? item.eligibilityCriteria?.minGWA,
        minimumGPA: item.minimumGPA ?? item.minimumGpa ?? item.minGWA ?? item.eligibilityCriteria?.minGPA ?? item.eligibilityCriteria?.minGwa ?? item.eligibilityCriteria?.minGWA,
        requiredEducationLevel: item.requiredEducationLevel ?? (item.educationLevel ? (Array.isArray(item.educationLevel) ? item.educationLevel : [item.educationLevel]) : []),
        eligibilityStatus: item.eligibilityStatus || "unknown",
        eligibility: item.eligibility,
        deadlineStatus: item.deadlineStatus,
        canApply: mergeCanApplyFlags({
          canApply: item.canApply,
          eligibilityStatus: item.eligibilityStatus || "unknown",
          deadlineStatus: item.deadlineStatus,
        }),
        daysUntilDeadline: item.daysUntilDeadline,
      }));
      
      setScholarshipsData(normalized);
    } catch (error) {
      console.error("Error applying filters:", error);
    }
  };

  // Handle Clear All button
  const handleClearFilters = async () => {
    setSearchQuery("");
    setAmountRange([0, 100000]);
    setSelectedType("all");
    setSelectedField("all");
    setSelectedLocation("all");
    setSelectedGwa("all");
    
    // Reload all scholarships with default filters
    await loadScholarships();
  };

  const recommendedScholarships = useMemo(() => {
    const user = getStoredUser();
    
    return scholarshipsData
      .map((scholarship) => ({
        ...scholarship,
        amountValue: scholarship.amountValue || Number(scholarship.amount) || 0,
      }))
      .filter((scholarship) => isScholarshipVisibleToUser(scholarship, user?.educationLevel))
      .filter((scholarship) => scholarship.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .filter((s) => s.eligibilityStatus === "eligible" || s.eligibilityStatus === "may-be-eligible")
      .sort((a, b) => {
        const statusOrder: Record<string, number> = { eligible: 0, "may-be-eligible": 1, unknown: 2, "not-eligible": 3 };
        const aOrder = statusOrder[a.eligibilityStatus || "unknown"] ?? 2;
        const bOrder = statusOrder[b.eligibilityStatus || "unknown"] ?? 2;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return (b.matchScore || 0) - (a.matchScore || 0);
      });
  }, [scholarshipsData, searchQuery]);

  const fallbackScholarships = useMemo(() => {
    const user = getStoredUser();
    return scholarshipsData
      .map((scholarship) => ({
        ...scholarship,
        amountValue: scholarship.amountValue || Number(scholarship.amount) || 0,
      }))
      .filter((scholarship) => isScholarshipVisibleToUser(scholarship, user?.educationLevel))
      .filter((scholarship) => scholarship.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .filter((s) => s.eligibilityStatus === "not-eligible" || s.eligibilityStatus === "unknown")
      .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
  }, [scholarshipsData, searchQuery]);

  const toggleSavedScholarship = (scholarshipId: string) => {
    setSavedScholarships((current) => {
      const next = current.includes(scholarshipId)
        ? current.filter((id) => id !== scholarshipId)
        : [...current, scholarshipId];

      const user = getStoredUser();
      saveScholarships(next.map(Number), user?.email || '');
      if (user?.email) {
        saveSavedScholarships(user.email, next.map(Number)).catch(() => {
          // Ignore backend sync errors.
        });
      }
      return next;
    });
  };

  // Application Functions - Simplified single-step flow
  const openApplicationModal = async () => {
    // Reset declaration checkbox when opening scholarship details
    setDeclarationChecked(false);
    setSubmitError(null);
    
    // Load profile documents when opening modal
    const user = getStoredUser();
    if (user?.email) {
      setIsLoadingProfileDocs(true);
      try {
        const result = await fetchProfileDocuments(user.email);
        setProfileDocuments(result.documents);
        setHasProfileDocuments(result.isComplete);
      } catch (err) {
        console.error("Failed to load profile documents:", err);
        // Don't block modal opening, but show warning in UI
        setHasProfileDocuments(false);
      } finally {
        setIsLoadingProfileDocs(false);
      }
    }
    
    setIsApplicationModalOpen(true);
  };

  const closeApplicationModal = () => {
    setIsApplicationModalOpen(false);
    setSelectedScholarship(null);
    setDeclarationChecked(false);
    setSubmitError(null);
  };

  const handleSubmitApplication = async () => {
    if (!declarationChecked) {
      setSubmitError("Please check the declaration to proceed");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const user = getStoredUser();
      if (!user?.email) {
        throw new Error("Please sign in to submit your application");
      }

      // Submit application - documents are linked from profile vault on backend
      const response = await fetch(`${API_BASE_URL}/api/applications/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studentEmail: user.email,
          scholarshipId: selectedScholarship!._id,
          declaration: "true",
        }),
      });

      // Check content-type to prevent DOCTYPE errors
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(
          'Cannot connect to the server. ' +
          'Please make sure the backend is running on port 5000.'
        );
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error || "Failed to submit application");
      }

      const result = await response.json();
      
      // Close modal and show success
      closeApplicationModal();
      toast.success(`Application submitted successfully! ${result.message}`);
      
      // Refresh scholarships data
      loadScholarships();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to submit application");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getEligibilityChecks = () => {
    if (!selectedScholarship?.eligibility) return [];
    const checks = selectedScholarship.eligibility.criteriaChecks || {};
    return Object.entries(checks).map(([key, check]) => ({
      key,
      label: check.label,
      passed: check.passed,
      message: check.message
    }));
  };

  return (
    <div className="py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Discover Scholarships</h1>
          <p className="text-muted-foreground">
            Find and apply for scholarships that match your profile
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 min-w-0">
          {/* Filters Panel */}
          <aside className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>Filters</CardTitle>
              </CardHeader>
              <CardContent className="max-h-[calc(100vh-180px)] overflow-y-auto space-y-6">
                {/* Search */}
                <div className="space-y-2">
                  <Label htmlFor="search">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      id="search"
                      placeholder="Search scholarships..."
                      className="pl-9"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>

                <Separator />

                {/* Scholarship Type */}
                <div className="space-y-2">
                  <Label htmlFor="type">Scholarship Type</Label>
                  <Select value={selectedType} onValueChange={setSelectedType}>
                    <SelectTrigger id="type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {scholarshipTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Amount Range */}
                <div className="space-y-3">
                  <Label>Amount Range</Label>
                  <div className="pt-2">
                    <Slider
                      value={amountRange}
                      onValueChange={(value) => setAmountRange([0, value[1]])}
                      min={0}
                      max={100000}
                      step={5000}
                    />
                  </div>
                  <div className="text-center text-sm font-medium text-primary">
                    ₱{amountRange[0].toLocaleString()} – ₱{amountRange[1].toLocaleString()}
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground font-semibold">
                    <span>₱0</span>
                    <span>₱100,000</span>
                  </div>
                </div>

                {/* Field of Study */}
                <div className="space-y-2">
                  <Label htmlFor="field">Field of Study</Label>
                  <Select value={selectedField} onValueChange={setSelectedField}>
                    <SelectTrigger id="field">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fieldOfStudyOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Location */}
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                    <SelectTrigger id="location">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Locations</SelectItem>
                      <SelectItem value="quezon-city">Quezon City</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* GWA Requirement */}
                <div className="space-y-2">
                  <Label htmlFor="gwa">Minimum GWA</Label>
                  <Select value={selectedGwa} onValueChange={setSelectedGwa}>
                    <SelectTrigger id="gwa">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {gwaOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="space-y-2 pt-2">
                  <Button className="w-full" onClick={handleApplyFilters}>Apply Filters</Button>
                  <Button variant="ghost" className="w-full" onClick={handleClearFilters}>Clear All</Button>
                </div>
              </CardContent>
            </Card>
          </aside>

          {/* Scholarships Grid */}
          <div className="lg:col-span-3 min-w-0 overflow-hidden">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {recommendedScholarships.length} scholarships
              </p>
              <Select defaultValue="match">
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="match">Best Match</SelectItem>
                  <SelectItem value="amount">Highest Amount</SelectItem>
                  <SelectItem value="deadline">Deadline Soon</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* ── Empty state when zero matches ── */}
            {!loading && recommendedScholarships.length === 0 && (
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

            {/* ── Matched scholarships grid ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {loading ? (
                <div className="col-span-full text-center py-8">Loading scholarships...</div>
              ) : (
                recommendedScholarships.map((scholarship) => (
                  <Card
                    key={scholarship._id}
                    className="hover:shadow-lg transition-shadow cursor-pointer w-full"
                    onClick={() => setSelectedScholarship(scholarship)}
                  >
                    <div className="relative h-40">
                      <img
                        src={scholarshipImages[scholarship.name] || defaultScholarshipImage}
                        alt={scholarship.name}
                        className="w-full h-full object-cover rounded-t-lg"
                      />
                      {/* Dark gradient overlay for badge readability */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent rounded-t-lg" />
                      <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                        {scholarship.isStableMatch && <Badge variant="secondary">Stable Match</Badge>}
                        {scholarship.deadlineStatus === "closing-soon" && (
                          <Badge className="bg-red-500 text-white">Closing Soon</Badge>
                        )}
                        {scholarship.eligibilityStatus === "eligible" && (
                          <Badge className="bg-green-500 text-white">You Qualify</Badge>
                        )}
                        {scholarship.eligibilityStatus === "may-be-eligible" && (
                          <Badge className="bg-yellow-500 text-white">May Qualify</Badge>
                        )}
                        {scholarship.eligibilityStatus === "not-eligible" && (
                          <Badge variant="outline" className="border-gray-400 text-gray-600">Not Eligible</Badge>
                        )}
                        <Badge className="bg-accent">{scholarship.matchScore}% Match</Badge>
                      </div>
                    </div>
                    <CardHeader>
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base line-clamp-2 break-words">
                            {scholarship.name}
                          </CardTitle>
                          <CardDescription className="line-clamp-1 text-sm">
                            {scholarship.provider}
                          </CardDescription>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="flex-shrink-0 mt-2 sm:mt-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSavedScholarship(scholarship._id);
                          }}
                          aria-pressed={savedScholarships.includes(scholarship._id)}
                          aria-label={savedScholarships.includes(scholarship._id) ? "Unsave scholarship" : "Save scholarship"}
                        >
                          <Bookmark className={`size-4 ${savedScholarships.includes(scholarship._id) ? "fill-current" : ""}`} />
                          <span className="ml-2 hidden sm:inline">{savedScholarships.includes(scholarship._id) ? "Unsave" : "Save"}</span>
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xl sm:text-2xl font-bold text-primary font-mono break-words">
                            ₱{Number(scholarship.amount).toLocaleString()}
                          </span>
                        </div>
                        <Separator />
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Calendar className="size-4 flex-shrink-0" />
                            <span className="break-words">Due: {scholarship.deadline}</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="size-4 flex-shrink-0" />
                            <span className="break-words">{scholarship.location || "Quezon City"}</span>
                          </div>
                        </div>
                        <Button className="w-full mt-4" size="sm">
                          View Details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {/* ── Fallback: Other Active Scholarship Programs ── */}
            {!loading && fallbackScholarships.length > 0 && (
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
                  You do not currently meet all criteria for these programs. View each one to see exactly which requirements are missing.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {fallbackScholarships.map((scholarship) => (
                    <Card
                      key={scholarship._id}
                      className="hover:shadow-lg transition-shadow cursor-pointer w-full border-orange-100"
                      onClick={() => setSelectedScholarship(scholarship)}
                    >
                      <div className="relative h-40">
                        <img
                          src={scholarshipImages[scholarship.name] || defaultScholarshipImage}
                          alt={scholarship.name}
                          className="w-full h-full object-cover rounded-t-lg"
                          style={{ filter: "grayscale(25%)" }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent rounded-t-lg" />
                        <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                          {scholarship.deadlineStatus === "closing-soon" && (
                            <Badge className="bg-red-500 text-white">Closing Soon</Badge>
                          )}
                          <Badge className="bg-orange-500 text-white text-xs">Criteria Missing</Badge>
                          <Badge variant="outline" className="border-orange-300 text-orange-700 bg-white/90 text-xs">
                            {scholarship.matchScore}% Match
                          </Badge>
                        </div>
                      </div>
                      <CardHeader>
                        <CardTitle className="text-base line-clamp-2 break-words">{scholarship.name}</CardTitle>
                        <CardDescription className="line-clamp-1 text-sm">{scholarship.provider}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3 p-4">
                          <span className="text-xl font-bold text-primary font-mono">
                            ₱{Number(scholarship.amount).toLocaleString()}
                          </span>
                          <Separator />
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Calendar className="size-4 flex-shrink-0" />
                              <span className="break-words">Due: {scholarship.deadline}</span>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <MapPin className="size-4 flex-shrink-0" />
                              <span className="break-words">{scholarship.location || "Quezon City"}</span>
                            </div>
                          </div>
                          {scholarship.eligibility?.unmetCriteria && scholarship.eligibility.unmetCriteria.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {scholarship.eligibility.unmetCriteria.slice(0, 2).map((criterion, idx) => (
                                <div key={idx} className="flex items-start gap-1.5 text-xs text-red-600">
                                  <XCircle className="size-3.5 shrink-0 mt-0.5" />
                                  <span className="leading-snug">{criterion}</span>
                                </div>
                              ))}
                              {scholarship.eligibility.unmetCriteria.length > 2 && (
                                <p className="text-xs text-gray-400 pl-5">+{scholarship.eligibility.unmetCriteria.length - 2} more criteria missing</p>
                              )}
                            </div>
                          )}
                          <Button className="w-full mt-4" size="sm" variant="outline">
                            View Details
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Scholarship Detail Modal */}
      <Dialog open={!!selectedScholarship} onOpenChange={() => setSelectedScholarship(null)}>
        <DialogContent className="w-full min-w-[320px] sm:min-w-[600px] sm:max-w-[700px] max-h-[90vh] overflow-y-auto overflow-x-hidden p-8 sm:p-10">
          {selectedScholarship && (
            <>
              <DialogHeader className="space-y-5 mb-6">
                <div className="mb-5 relative h-52">
                  <img
                    src={scholarshipImages[selectedScholarship.name] || defaultScholarshipImage}
                    alt={selectedScholarship.name}
                    className="w-full h-full object-cover rounded-xl"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent rounded-xl" />
                </div>
                <DialogTitle className="text-2xl leading-snug">
                  {selectedScholarship.scholarshipName || selectedScholarship.name}
                </DialogTitle>
                <DialogDescription className="text-base">{selectedScholarship.provider}</DialogDescription>
              </DialogHeader>

              <div className="space-y-8">
                {/* Eligibility Banner */}
                {selectedScholarship.eligibilityStatus === "eligible" && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-5">
                    <div className="flex items-start gap-4">
                      <div className="size-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="size-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-semibold text-green-800 text-base">You qualify for this scholarship!</p>
                        <p className="text-sm text-green-700 mt-1">The system has verified that you meet all eligibility criteria. You can proceed with your application.</p>
                      </div>
                    </div>
                  </div>
                )}

                {selectedScholarship.eligibilityStatus === "may-be-eligible" && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-5">
                    <div className="flex items-start gap-4">
                      <div className="size-8 rounded-full bg-yellow-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="size-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-yellow-800 text-base">You may qualify for this scholarship</p>
                        <p className="text-sm text-yellow-700 mt-1">Some criteria require verification. Your application will need staff review.</p>
                        {selectedScholarship.eligibility?.unmetCriteria && selectedScholarship.eligibility.unmetCriteria.length > 0 && (
                          <ul className="mt-3 text-sm text-yellow-700 list-disc list-inside space-y-1 ml-1">
                            {selectedScholarship.eligibility.unmetCriteria.map((criterion, idx) => (
                              <li key={idx}>{criterion}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {selectedScholarship.eligibilityStatus === "not-eligible" && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-5 space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="size-8 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="size-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-red-800 text-base">You do not currently qualify for this scholarship</p>
                        <p className="text-sm text-red-700 mt-1">The matching engine identified the following unmet requirements from your profile:</p>
                      </div>
                    </div>

                    {/* Per-criterion breakdown */}
                    {selectedScholarship.eligibility?.unmetCriteria && selectedScholarship.eligibility.unmetCriteria.length > 0 && (
                      <div className="rounded-lg border border-red-200 bg-white divide-y divide-red-100">
                        {selectedScholarship.eligibility.unmetCriteria.map((criterion, idx) => (
                          <div key={idx} className="flex items-start gap-3 px-4 py-3">
                            <XCircle className="size-4 text-red-500 shrink-0 mt-0.5" />
                            <span className="text-sm text-red-700 leading-snug">{criterion}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Met criteria — shown only when criteriaChecks exists */}
                    {selectedScholarship.eligibility?.criteriaChecks && (() => {
                      const passed = Object.values(selectedScholarship.eligibility!.criteriaChecks!).filter(c => c.passed);
                      return passed.length > 0 ? (
                        <div>
                          <p className="text-xs font-semibold text-green-700 mb-2 uppercase tracking-wide">Criteria you DO meet:</p>
                          <div className="rounded-lg border border-green-200 bg-white divide-y divide-green-100">
                            {passed.map((c, idx) => (
                              <div key={idx} className="flex items-start gap-3 px-4 py-3">
                                <CheckCircle className="size-4 text-green-500 shrink-0 mt-0.5" />
                                <span className="text-sm text-green-700 leading-snug">{c.label || c.message}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null;
                    })()}

                    <p className="text-xs text-red-600 italic">
                      Update your profile with accurate information to re-evaluate your eligibility automatically.
                    </p>
                  </div>
                )}

                {selectedScholarship.deadlineStatus === "closing-soon" && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-5">
                    <div className="flex items-start gap-4">
                      <div className="size-8 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="size-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-semibold text-red-800 text-base">Closing Soon!</p>
                        <p className="text-sm text-red-700 mt-1">Only {selectedScholarship.daysUntilDeadline} day(s) left to apply. Submit your application now!</p>
                      </div>
                    </div>
                  </div>
                )}

                {selectedScholarship.deadlineStatus === "closed" && (
                  <div className="bg-gray-100 border border-gray-300 rounded-lg p-5">
                    <p className="font-semibold text-gray-700 text-base">Application period has ended</p>
                    <p className="text-sm text-gray-600 mt-1">This scholarship is no longer accepting applications.</p>
                  </div>
                )}

                {selectedScholarship.deadlineStatus === "not-yet-open" && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
                    <p className="font-semibold text-blue-800 text-base">Applications have not opened yet</p>
                    <p className="text-sm text-blue-700 mt-1">Please check back later when applications are open.</p>
                  </div>
                )}

                {/* Stats Row - Award, Deadline, Match Score */}
                <div className="grid grid-cols-3 gap-6 py-6 bg-gray-50 rounded-xl px-6">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-primary font-mono">
                      ₱{Number(selectedScholarship.amount).toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">Award Amount</p>
                  </div>
                  <div className="text-center border-l border-r border-gray-200 px-4">
                    <p className="text-lg font-semibold">{selectedScholarship.deadline}</p>
                    <p className="text-sm text-muted-foreground mt-2">Application Deadline</p>
                  </div>
                  <div className="text-center">
                    <Badge
                      className={`text-lg px-4 py-1.5 ${
                        selectedScholarship.eligibilityStatus === "not-eligible"
                          ? "bg-gray-500 hover:bg-gray-500"
                          : "bg-accent"
                      }`}
                    >
                      {selectedScholarship.matchScore}% Match
                    </Badge>
                    <p className="text-sm text-muted-foreground mt-2">
                      {selectedScholarship.eligibilityStatus === "not-eligible"
                        ? "Profile fit (not eligible to apply)"
                        : "Your Match Score"}
                    </p>
                  </div>
                </div>

                <Separator className="my-8" />

                {/* Description Section */}
                <div className="space-y-8">
                  <div>
                    <h3 className="font-semibold text-lg mb-4">Description</h3>
                    <p className="text-muted-foreground leading-[1.7]">{selectedScholarship.description}</p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-lg mb-4">Type</h3>
                    <div className="flex flex-wrap gap-2">
                      {(selectedScholarship.type || "General")
                        .split(" / ")
                        .map((typePart, idx) => (
                          <Badge key={idx} variant="outline" className="text-base px-3 py-1.5">
                            {typePart.trim()}
                          </Badge>
                        ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                      <MapPin className="size-5 text-primary" />
                      Location
                    </h3>
                    <p className="text-muted-foreground leading-[1.7]">
                      {selectedScholarship.location?.trim() || "Quezon City"}
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-lg mb-4">Field of Study</h3>
                    <p className="text-muted-foreground leading-[1.7]">
                      {selectedScholarship.fieldOfStudy?.trim() ? selectedScholarship.fieldOfStudy : "All Fields"}
                    </p>
                  </div>
                </div>

                <hr className="border-gray-300 my-8" />

                {/* Requirements Section */}
                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                      <ListChecks className="size-5 text-primary" />
                      Requirements
                    </h3>

                    {/* Specific Eligibility Criteria */}
                    {selectedScholarship.specificCriteria && selectedScholarship.specificCriteria.length > 0 && (
                      <div className="mb-6">
                        <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                          <CheckCircle className="size-4 text-green-600" />
                          Eligibility Criteria
                        </h4>
                        <ul className="space-y-3">
                          {selectedScholarship.specificCriteria.map((criterion, idx) => (
                            <li key={idx} className="text-sm text-gray-600 flex items-start gap-3 leading-relaxed">
                              <span className="text-green-600 mt-1">•</span>
                              <span>{criterion}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {eligibilityCriteriaToLines(selectedScholarship.eligibilityCriteria).length > 0 &&
                      (!selectedScholarship.specificCriteria ||
                        selectedScholarship.specificCriteria.length === 0) && (
                        <div className="mb-6">
                          <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                            <CheckCircle className="size-4 text-green-600" />
                            Eligibility Criteria
                          </h4>
                          <ul className="space-y-3">
                            {eligibilityCriteriaToLines(selectedScholarship.eligibilityCriteria).map((line, idx) => (
                              <li key={idx} className="text-sm text-gray-600 flex items-start gap-3 leading-relaxed">
                                <span className="text-green-600 mt-1">•</span>
                                <span>{line}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                    {/* Education Level */}
                    {selectedScholarship.requiredEducationLevel && selectedScholarship.requiredEducationLevel.length > 0 && (
                      <div className="mb-6">
                        <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                          <GraduationCap className="size-4 text-blue-600" />
                          Education Level Required
                        </h4>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {selectedScholarship.requiredEducationLevel.map((level, idx) => (
                            <Badge key={idx} variant="secondary" className="text-sm px-3 py-1">
                              {level}
                            </Badge>
                          ))}
                        </div>
                        {selectedScholarship.minimumGWA && (
                          <p className="text-sm text-gray-600 mt-3">
                            Minimum GWA Required: <span className="font-medium">{selectedScholarship.minimumGWA}</span>
                          </p>
                        )}
                      </div>
                    )}

                    {/* General Documents (Required by ALL) */}
                    {selectedScholarship.generalDocuments && selectedScholarship.generalDocuments.length > 0 && (
                      <div className="mb-6">
                        <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                          <FileText className="size-4 text-amber-600" />
                          General Documents (Required for ALL applicants)
                        </h4>
                        <ul className="space-y-3">
                          {selectedScholarship.generalDocuments.map((doc, idx) => (
                            <li key={idx} className="text-sm text-gray-600 flex items-start gap-3 leading-relaxed">
                              <span className="text-amber-600 mt-1">•</span>
                              <span>{doc}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Scholarship-Specific Required Documents */}
                    {selectedScholarship.requiredDocuments && selectedScholarship.requiredDocuments.length > 0 && (
                      <div className="mb-6">
                        <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                          <FileText className="size-4 text-blue-600" />
                          Scholarship-Specific Documents
                        </h4>
                        <ul className="space-y-3">
                          {selectedScholarship.requiredDocuments.map((doc, idx) => (
                            <li key={idx} className="text-sm text-gray-600 flex items-start gap-3 leading-relaxed">
                              <span className="text-blue-600 mt-1">•</span>
                              <span>{doc}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* No documents case */}
                    {(!selectedScholarship.requiredDocuments || selectedScholarship.requiredDocuments.length === 0) &&
                     (!selectedScholarship.generalDocuments || selectedScholarship.generalDocuments.length === 0) && (
                      <p className="text-sm text-gray-500 italic">
                        No specific document requirements listed for this scholarship.
                      </p>
                    )}
                  </div>
                </div>

                <Separator className="my-8" />

                {/* Certification & Application Submission */}
                <div className="space-y-6">
                  {/* Document Status Summary */}
                  {selectedScholarship.eligibilityStatus === "eligible" ||
                    selectedScholarship.eligibilityStatus === "may-be-eligible" ? (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                        <FileText className="size-4 text-primary" />
                        Application Documents
                      </h4>
                      <p className="text-sm text-gray-600 mb-2">
                        Your profile documents will be automatically linked to this application:
                      </p>
                      <ul className="text-sm text-gray-600 space-y-1 ml-5 list-disc">
                        <li>Copy of Grades / Transcript of Records / Form 137 or 138</li>
                        <li>Proof of school enrollment/registration/acceptance</li>
                        <li>Valid QCitizen ID</li>
                      </ul>
                      <p className="text-xs text-muted-foreground mt-3">
                        Scholarship-specific documents will be requested after acceptance.
                      </p>
                      {!isLoadingProfileDocs && !hasProfileDocuments && (
                        <div className="mt-3 flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                          <AlertCircle className="size-3.5 mt-0.5 shrink-0" />
                          <span>
                            One or more required documents are not yet uploaded. Please go to{" "}
                            <strong>Profile &gt; Document Vault</strong> and upload all three documents before applying.
                          </span>
                        </div>
                      )}
                    </div>
                  ) : null}

                  {selectedScholarship.deadlineStatus === "closed" ? (
                    <Button className="w-full h-12 text-base" disabled>
                      Application Closed
                    </Button>
                  ) : selectedScholarship.deadlineStatus === "not-yet-open" ? (
                    <Button className="w-full h-12 text-base" disabled>
                      Opens Soon
                    </Button>
                  ) : selectedScholarship.eligibilityStatus === "eligible" ||
                    selectedScholarship.eligibilityStatus === "may-be-eligible" ? (
                    <div className="space-y-4">
                      {/* Error message */}
                      {submitError && (
                        <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                          <AlertCircle className="size-4 mt-0.5 shrink-0" />
                          <span>{submitError}</span>
                        </div>
                      )}

                      {/* Certification Checkbox - At Top */}
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="declaration"
                          checked={declarationChecked}
                          onCheckedChange={(checked) => setDeclarationChecked(checked === true)}
                          className="mt-1"
                        />
                        <Label htmlFor="declaration" className="text-sm font-normal cursor-pointer">
                          I certify that all information and documents submitted are true and correct. 
                          I understand that any false information may result in the disqualification of my application.
                        </Label>
                      </div>
                      
                      {/* Buttons Row - Below Checkbox */}
                      <div className="flex flex-col sm:flex-row gap-4">
                        {/* Apply Scholarship Button */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              className={`inline-flex flex-1 ${!declarationChecked || !deriveStudentApplyAllowed(selectedScholarship) ? "cursor-not-allowed" : ""}`}
                            >
                              <Button
                                onClick={handleSubmitApplication}
                                disabled={!declarationChecked || isSubmitting || !deriveStudentApplyAllowed(selectedScholarship)}
                                className={`w-full h-12 text-base bg-blue-600 hover:bg-blue-700 ${
                                  !declarationChecked || isSubmitting || !deriveStudentApplyAllowed(selectedScholarship)
                                    ? "opacity-50 cursor-not-allowed"
                                    : ""
                                }`}
                              >
                                {isSubmitting ? (
                                  <>
                                    <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                                    Submitting...
                                  </>
                                ) : (
                                  <>
                                    <FileText className="size-5 mr-2" />
                                    Apply Scholarship
                                  </>
                                )}
                              </Button>
                            </span>
                          </TooltipTrigger>
                          {(!declarationChecked || !deriveStudentApplyAllowed(selectedScholarship)) && !isSubmitting && (
                            <TooltipContent side="top" className="max-w-xs text-left">
                              {!declarationChecked
                                ? "Please check the certification box to proceed with your application."
                                : "You cannot apply yet. Confirm eligibility and that applications are open."}
                            </TooltipContent>
                          )}
                        </Tooltip>
                        
                        {/* Save for Later Button */}
                        <Button
                          variant="outline"
                          className={`flex-1 h-12 text-base ${savedScholarships.includes(selectedScholarship._id) ? "border-green-500 text-green-700 bg-green-50 hover:bg-green-100" : ""}`}
                          onClick={() => toggleSavedScholarship(selectedScholarship._id)}
                        >
                          <Bookmark className={`size-5 mr-2 ${savedScholarships.includes(selectedScholarship._id) ? "fill-current" : ""}`} />
                          {savedScholarships.includes(selectedScholarship._id) ? "Saved" : "Save for Later"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex w-full cursor-not-allowed">
                          <Button className="w-full h-12 text-base bg-gray-400 opacity-50 cursor-not-allowed" disabled>
                            Not Eligible
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-left">
                        Your profile does not meet this scholarship&apos;s eligibility requirements.
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Legacy multi-step modal removed - application now uses simplified single-step flow in detail view */}
    </div>
  );
}
