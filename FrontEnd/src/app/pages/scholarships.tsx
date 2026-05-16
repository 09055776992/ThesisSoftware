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
import { Search, Calendar, MapPin, Award, Bookmark, ExternalLink, FileText, CheckCircle, ListChecks, GraduationCap } from "lucide-react";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { fetchSavedScholarships, saveSavedScholarships, fetchScholarshipsWithEligibility, checkEligibility, applyForScholarship } from "../lib/api-client";
import { getStoredUser } from "../lib/user-storage";
import { calculateMatchScore } from "../lib/calculateMatchScore";

// Toast notification function
const toast = {
  success: (message: string) => {
    console.log(`✅ ${message}`);
    // In a real implementation, you'd use a toast library like react-hot-toast or sonner
    alert(message);
  },
  error: (message: string) => {
    console.error(`❌ ${message}`);
    alert(message);
  }
};

const SAVED_SCHOLARSHIPS_KEY_PREFIX = "scholarship-portal-saved-scholarships";

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

const gpaOptions = [
  { value: "all", label: "Any GPA" },
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
  if (criteria.minGPA != null) lines.push(`Minimum GPA: ${criteria.minGPA}`);
  if (criteria.minGwa != null) lines.push(`Minimum GWA: ${criteria.minGwa}`);
  if (criteria.minGWA != null) lines.push(`Minimum GWA: ${criteria.minGWA}`);
  if (Array.isArray(criteria.educationLevel) && criteria.educationLevel.length > 0) {
    lines.push(`Education level: ${criteria.educationLevel.join(", ")}`);
  }
  if (criteria.qcResident === true) lines.push("Must be a Quezon City resident");
  return lines;
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
  const [amountRange, setAmountRange] = useState([0, 20000]);
  const [scholarshipsData, setScholarshipsData] = useState<Scholarship[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState("all");
  const [selectedField, setSelectedField] = useState("all");
  const [selectedLocation, setSelectedLocation] = useState("all");
  const [selectedGpa, setSelectedGpa] = useState("all");
  const [savedScholarships, setSavedScholarships] = useState<string[]>([]);
  
  // Application Modal State
  const [isApplicationModalOpen, setIsApplicationModalOpen] = useState(false);
  const [applicationStep, setApplicationStep] = useState(1);
  const [uploadedDocuments, setUploadedDocuments] = useState<Record<string, { file: File; preview?: string }>>({});
  const [declarationChecked, setDeclarationChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const user = getStoredUser();
    const id = selectedScholarship?._id;
    if (!user?.email || !id) return;
    let cancelled = false;
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

      // Use server-side eligibility when logged in (authoritative for QC scholarships)
      const result = user?.email
        ? await fetchScholarshipsWithEligibility(user.email)
        : await fetch("/api/scholarships?status=Active").then((r) => r.json());
      console.log('Scholarships fetched:', result.data?.length || 0);
      
      const normalized = (result.data || []).map((item: any) => {
        const serverStatus = item.eligibilityStatus as string | undefined;
        let matchScore = 0;
        let matchQualified = serverStatus === "eligible" || serverStatus === "may-be-eligible";
        
        if (user) {
          try {
            const match = calculateMatchScore(user, item);
            matchScore = match.score;
            // Prefer server eligibility when available; fall back to client score
            if (serverStatus === "eligible") {
              matchScore = Math.max(matchScore, 95);
              matchQualified = true;
            } else if (serverStatus === "may-be-eligible") {
              matchScore = Math.max(matchScore, 75);
              matchQualified = true;
            } else if (serverStatus === "not-eligible") {
              matchQualified = false;
            } else {
              matchQualified = match.qualified;
            }
            console.log(`${item.name}: status=${serverStatus || "unknown"}, score=${matchScore}%`, matchQualified ? 'QUALIFIED' : 'NOT QUALIFIED');
          } catch (err) {
            console.error(`Error calculating match for ${item.name}:`, err);
            matchScore = serverStatus === "eligible" ? 95 : serverStatus === "may-be-eligible" ? 75 : 0;
            matchQualified = serverStatus === "eligible" || serverStatus === "may-be-eligible";
          }
        } else {
          matchScore = serverStatus === "eligible" ? 95 : serverStatus === "may-be-eligible" ? 75 : 0;
        }
        
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
      minGPA: selectedGpa
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
    if (selectedGpa !== 'all') {
      params.append('minGPA', selectedGpa);
    }
    
    // Always include amount range
    params.append('amountMin', amountRange[0].toString());
    params.append('amountMax', amountRange[1].toString());

    try {
      const user = getStoredUser();
      const queryString = params.toString();
      
      // Use eligibility-aware API if user is logged in, otherwise use regular API
      const apiUrl = user?.email 
        ? `/api/scholarships-with-eligibility?studentEmail=${encodeURIComponent(user.email)}&${queryString}`
        : `/api/scholarships?${queryString}`;
        
      const result = await fetch(apiUrl).then(r => r.json());
      
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
        matchScore: typeof item.matchScore === 'number' ? item.matchScore : 
                    (item.eligibilityStatus === "eligible" ? 95 : item.eligibilityStatus === "may-be-eligible" ? 75 : 0),
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
    setAmountRange([0, 20000]);
    setSelectedType("all");
    setSelectedField("all");
    setSelectedLocation("all");
    setSelectedGpa("all");
    
    // Reload all scholarships with default filters
    await loadScholarships();
  };

  const recommendedScholarships = useMemo(() => {
    return scholarshipsData
      .map((scholarship) => ({
        ...scholarship,
        amountValue: scholarship.amountValue || Number(scholarship.amount) || 0,
      }))
      // Only apply search filter on frontend since it's real-time
      .filter((scholarship) => scholarship.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        // Sort by eligibility status first
        const statusOrder = { eligible: 0, "may-be-eligible": 1, unknown: 2, "not-eligible": 3 };
        const aOrder = statusOrder[a.eligibilityStatus || "unknown"] ?? 2;
        const bOrder = statusOrder[b.eligibilityStatus || "unknown"] ?? 2;
        if (aOrder !== bOrder) return aOrder - bOrder;
        // Then by match score
        return (b.matchScore || 0) - (a.matchScore || 0);
      });
  }, [scholarshipsData, searchQuery]);

  // Filter scholarships based on eligibility status
  const matchedScholarships = useMemo(() => {
    const user = getStoredUser();
    
    return scholarshipsData
      .map((scholarship) => ({
        ...scholarship,
        amountValue: scholarship.amountValue || Number(scholarship.amount) || 0,
      }))
      .map((s) => {
        const reasons: string[] = [];
        if (s.eligibilityStatus === "eligible") {
          reasons.push("You meet all eligibility criteria");
        } else if (s.eligibilityStatus === "may-be-eligible") {
          reasons.push("You may be eligible (requires verification)");
        } else if (s.eligibility?.reasons?.length) {
          reasons.push(...s.eligibility.reasons);
        } else if (user) {
          if (user.fieldOfStudy && s.fieldOfStudy && user.fieldOfStudy === s.fieldOfStudy) reasons.push("Matches your field of study");
          if (user.gpa && s.minimumGpa !== undefined) {
            const userGpa = Number(String(user.gpa).replace(/[^0-9.]/g, ""));
            if (!Number.isNaN(userGpa) && userGpa <= (s.minimumGpa ?? 0)) reasons.push("Meets GPA requirement");
          }
          if (user.location && s.location && s.location.toLowerCase().includes(String(user.location).toLowerCase())) reasons.push("Matches your location");
        }

        return { ...s, matchReasons: reasons };
      })
      .filter((s) => s.eligibilityStatus === "eligible" || s.eligibilityStatus === "may-be-eligible" || (s.matchReasons || []).length > 0)
      .sort((a, b) => {
        // Eligible first, then may-be-eligible, then others
        const statusOrder = { eligible: 0, "may-be-eligible": 1, unknown: 2, "not-eligible": 3 };
        const aOrder = statusOrder[a.eligibilityStatus || "unknown"] ?? 2;
        const bOrder = statusOrder[b.eligibilityStatus || "unknown"] ?? 2;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return (b.matchScore || 0) - (a.matchScore || 0);
      });
  }, [scholarshipsData]);

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

  // Application Modal Functions
  const openApplicationModal = () => {
    setApplicationStep(1);
    setUploadedDocuments({});
    setDeclarationChecked(false);
    setSubmitError(null);
    setIsApplicationModalOpen(true);
  };

  const closeApplicationModal = () => {
    setIsApplicationModalOpen(false);
    setApplicationStep(1);
    setUploadedDocuments({});
    setDeclarationChecked(false);
    setSubmitError(null);
  };

  const handleFileUpload = (documentType: string, file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setSubmitError("File size must be less than 5MB");
      toast.error("File size must be less than 5MB");
      return;
    }
    
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      setSubmitError("Only PDF, JPG, JPEG, and PNG files are allowed");
      toast.error("Only PDF, JPG, JPEG, and PNG files are allowed");
      return;
    }

    setUploadedDocuments(prev => ({
      ...prev,
      [documentType]: { file, preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined }
    }));
    setSubmitError(null);
    toast.success(`"${documentType.substring(0, 30)}${documentType.length > 30 ? '...' : ''}" uploaded successfully`);
  };

  const removeUploadedFile = (documentType: string) => {
    setUploadedDocuments(prev => {
      const newDocs = { ...prev };
      if (newDocs[documentType]?.preview) {
        URL.revokeObjectURL(newDocs[documentType].preview!);
      }
      delete newDocs[documentType];
      return newDocs;
    });
  };

  const canProceedToStep3 = () => {
    if (!selectedScholarship?.generalDocuments) return true;
    return selectedScholarship.generalDocuments.every(doc => uploadedDocuments[doc]);
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

      // Create FormData for file upload
      const formData = new FormData();
      formData.append("studentEmail", user.email);
      formData.append("scholarshipId", selectedScholarship!._id);
      formData.append("declaration", "true");
      
      // Append all uploaded files
      Object.entries(uploadedDocuments).forEach(([docType, docData]) => {
        formData.append(`documents`, docData.file);
        formData.append(`documentTypes`, docType);
      });

      const response = await fetch("/api/applications/submit", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to submit application");
      }

      const result = await response.json();
      
      // Close modal and show success
      closeApplicationModal();
      toast.success(`Application submitted successfully! Reference: ${result.applicationId}`);
      alert(`Application submitted successfully! Reference Number: ${result.applicationId}`);
      
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
              <CardContent className="space-y-6">
                {/* Search */}
                <div className="space-y-2">
                  <Label htmlFor="search">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
                      max={20000}
                      step={1000}
                    />
                  </div>
                  <div className="text-center text-sm font-medium text-primary">
                    ₱{amountRange[0].toLocaleString()} – ₱{amountRange[1].toLocaleString()}
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground font-semibold">
                    <span>₱0</span>
                    <span>₱20,000</span>
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

                {/* GPA Requirement */}
                <div className="space-y-2">
                  <Label htmlFor="gpa">Minimum GPA</Label>
                  <Select value={selectedGpa} onValueChange={setSelectedGpa}>
                    <SelectTrigger id="gpa">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {gpaOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="space-y-2">
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
                          <Bookmark className={`h-4 w-4 ${savedScholarships.includes(scholarship._id) ? "fill-current" : ""}`} />
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
                            <Calendar className="h-4 w-4 flex-shrink-0" />
                            <span className="break-words">Due: {scholarship.deadline}</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="h-4 w-4 flex-shrink-0" />
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
                      <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                      <div className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  <div className="bg-red-50 border border-red-200 rounded-lg p-5">
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-red-800 text-base">You do not qualify for this scholarship</p>
                        <p className="text-sm text-red-700 mt-1">You do not meet the required eligibility criteria:</p>
                        {selectedScholarship.eligibility?.unmetCriteria && selectedScholarship.eligibility.unmetCriteria.length > 0 && (
                          <ul className="mt-3 text-sm text-red-700 list-disc list-inside space-y-1 ml-1">
                            {selectedScholarship.eligibility.unmetCriteria.map((criterion, idx) => (
                              <li key={idx}>{criterion}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {selectedScholarship.deadlineStatus === "closing-soon" && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-5">
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    <Badge className="bg-accent text-lg px-4 py-1.5">
                      {selectedScholarship.matchScore}% Match
                    </Badge>
                    <p className="text-sm text-muted-foreground mt-2">Your Match Score</p>
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
                      <MapPin className="h-5 w-5 text-primary" />
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
                      <ListChecks className="h-5 w-5 text-primary" />
                      Requirements
                    </h3>

                    {/* Specific Eligibility Criteria */}
                    {selectedScholarship.specificCriteria && selectedScholarship.specificCriteria.length > 0 && (
                      <div className="mb-6">
                        <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
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
                            <CheckCircle className="h-4 w-4 text-green-600" />
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
                          <GraduationCap className="h-4 w-4 text-blue-600" />
                          Education Level Required
                        </h4>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {selectedScholarship.requiredEducationLevel.map((level, idx) => (
                            <Badge key={idx} variant="secondary" className="text-sm px-3 py-1">
                              {level}
                            </Badge>
                          ))}
                        </div>
                        {selectedScholarship.minimumGPA && (
                          <p className="text-sm text-gray-600 mt-3">
                            Minimum GPA/GWA Required: <span className="font-medium">{selectedScholarship.minimumGPA}</span>
                          </p>
                        )}
                      </div>
                    )}

                    {/* General Documents (Required by ALL) */}
                    {selectedScholarship.generalDocuments && selectedScholarship.generalDocuments.length > 0 && (
                      <div className="mb-6">
                        <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                          <FileText className="h-4 w-4 text-amber-600" />
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
                          <FileText className="h-4 w-4 text-blue-600" />
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

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 pt-2">
                  {selectedScholarship.deadlineStatus === "closed" ? (
                    <Button className="flex-1 h-12 text-base" disabled>
                      Application Closed
                    </Button>
                  ) : selectedScholarship.deadlineStatus === "not-yet-open" ? (
                    <Button className="flex-1 h-12 text-base" disabled>
                      Opens Soon
                    </Button>
                  ) : selectedScholarship.eligibilityStatus === "eligible" ||
                    selectedScholarship.eligibilityStatus === "may-be-eligible" ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className={`inline-flex flex-1 ${!deriveStudentApplyAllowed(selectedScholarship) ? "cursor-not-allowed" : ""}`}
                        >
                          <Button
                            className={`flex-1 h-12 text-base bg-blue-600 hover:bg-blue-700 ${!deriveStudentApplyAllowed(selectedScholarship) ? "opacity-50 cursor-not-allowed" : ""}`}
                            disabled={!deriveStudentApplyAllowed(selectedScholarship)}
                            onClick={openApplicationModal}
                          >
                            <FileText className="h-5 w-5 mr-2" />
                            Submit Requirements
                          </Button>
                        </span>
                      </TooltipTrigger>
                      {!deriveStudentApplyAllowed(selectedScholarship) && (
                        <TooltipContent side="top" className="max-w-xs text-left">
                          You cannot submit yet. Confirm eligibility and that applications are open (deadline not passed).
                        </TooltipContent>
                      )}
                    </Tooltip>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex flex-1 cursor-not-allowed">
                          <Button className="flex-1 h-12 text-base bg-gray-400 opacity-50 cursor-not-allowed" disabled>
                            Not Eligible
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-left">
                        Your profile does not meet this scholarship&apos;s eligibility requirements.
                      </TooltipContent>
                    </Tooltip>
                  )}
                  <Button
                    variant="outline"
                    className={`flex-1 h-12 text-base ${savedScholarships.includes(selectedScholarship._id) ? "border-green-500 text-green-700 bg-green-50 hover:bg-green-100" : ""}`}
                    onClick={() => toggleSavedScholarship(selectedScholarship._id)}
                  >
                    <Bookmark className={`h-5 w-5 mr-2 ${savedScholarships.includes(selectedScholarship._id) ? "fill-current" : ""}`} />
                    {savedScholarships.includes(selectedScholarship._id) ? "Saved" : "Save for Later"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Application Multi-Step Modal */}
      <Dialog open={isApplicationModalOpen} onOpenChange={(open) => !open && closeApplicationModal()}>
        <DialogContent className="w-full min-w-[320px] sm:min-w-[600px] sm:max-w-[800px] max-h-[90vh] overflow-y-auto overflow-x-hidden p-6 sm:p-8">
          {selectedScholarship && (
            <>
              <DialogHeader className="space-y-2">
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-xl">Apply for {selectedScholarship.name}</DialogTitle>
                  <Badge variant="outline">Step {applicationStep} of 3</Badge>
                </div>
                <DialogDescription>
                  Complete your application by following the steps below
                </DialogDescription>
              </DialogHeader>

              {/* Step Indicators */}
              <div className="flex items-center justify-center gap-2 py-4">
                {[1, 2, 3].map((step) => (
                  <div
                    key={step}
                    className={`h-2 rounded-full transition-all ${
                      step === applicationStep
                        ? "w-8 bg-primary"
                        : step < applicationStep
                        ? "w-4 bg-green-500"
                        : "w-4 bg-gray-200"
                    }`}
                  />
                ))}
              </div>

              {/* Error Message */}
              {submitError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-red-600">{submitError}</p>
                </div>
              )}

              {/* STEP 1: Eligibility Summary */}
              {applicationStep === 1 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-primary" />
                      Eligibility Check
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                      The system has automatically verified your eligibility based on your profile:
                    </p>

                    <div className="space-y-3">
                      {/* Universal Checks */}
                      <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        {selectedScholarship.eligibility?.criteriaChecks?.qcResident?.passed ? (
                          <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                        ) : (
                          <div className="h-5 w-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-red-500 text-xs">✗</span>
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-sm">Quezon City Resident</p>
                          <p className="text-xs text-gray-500">
                            {selectedScholarship.eligibility?.criteriaChecks?.qcResident?.passed
                              ? "Verified QC Resident"
                              : "Must be a Quezon City resident"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        {selectedScholarship.eligibility?.criteriaChecks?.notOtherLGUScholar?.passed !== false ? (
                          <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                        ) : (
                          <div className="h-5 w-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-red-500 text-xs">✗</span>
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-sm">Not a Scholar of Another LGU</p>
                          <p className="text-xs text-gray-500">
                            {selectedScholarship.eligibility?.criteriaChecks?.notOtherLGUScholar?.passed !== false
                              ? "Not receiving other LGU scholarship"
                              : "Currently a scholar of another LGU"}
                          </p>
                        </div>
                      </div>

                      {(() => {
                        const schoolCheck = selectedScholarship.eligibility?.criteriaChecks?.qcSchoolEnrollment;
                        const status = schoolCheck?.status;
                        const passed = schoolCheck?.passed;
                        
                        // Determine icon and styling based on status
                        let icon = <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />;
                        let label = schoolCheck?.label || "Enrolled in QC-Recognized School";
                        let message = schoolCheck?.message || "Verified enrollment";
                        
                        if (status === "no_school" || (!passed && !status)) {
                          icon = (
                            <div className="h-5 w-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-red-500 text-xs">✗</span>
                            </div>
                          );
                          label = "School Not Provided";
                          message = "Please add your school in Settings before applying";
                        } else if (status === "requires_verification" || !passed) {
                          icon = (
                            <div className="h-5 w-5 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-yellow-600 text-xs">!</span>
                            </div>
                          );
                          label = "School Requires Verification";
                          message = `${schoolCheck?.schoolName || "Your school"} — Staff will verify during final screening`;
                        } else if (status === "qc_verified" || passed) {
                          icon = <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />;
                          label = "Enrolled in QC-Recognized School";
                          message = schoolCheck?.schoolName 
                            ? `${schoolCheck.schoolName}${schoolCheck.schoolCampus ? ` (${schoolCheck.schoolCampus})` : ""} — Quezon City ✓`
                            : "Verified enrollment";
                        }
                        
                        return (
                          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                            {icon}
                            <div>
                              <p className="font-medium text-sm">{label}</p>
                              <p className="text-xs text-gray-500">{message}</p>
                            </div>
                          </div>
                        );
                      })()}

                      <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        {selectedScholarship.eligibility?.criteriaChecks?.educationLevel?.passed ? (
                          <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                        ) : (
                          <div className="h-5 w-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-red-500 text-xs">✗</span>
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-sm">Education Level</p>
                          <p className="text-xs text-gray-500">
                            {selectedScholarship.eligibility?.criteriaChecks?.educationLevel?.message ||
                              "Education level check"}
                          </p>
                        </div>
                      </div>

                      {selectedScholarship.minimumGPA && (
                        <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                          {selectedScholarship.eligibility?.criteriaChecks?.gpa?.passed ? (
                            <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                          ) : (
                            <div className="h-5 w-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-red-500 text-xs">✗</span>
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-sm">
                              {selectedScholarship.minimumGPA <= 2.0 ? "GWA" : "GPA"} Requirement
                            </p>
                            <p className="text-xs text-gray-500">
                              {selectedScholarship.eligibility?.criteriaChecks?.gpa?.message ||
                                `Minimum: ${selectedScholarship.minimumGPA}`}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end items-center gap-4 flex-wrap">
                    {!deriveStudentApplyAllowed(selectedScholarship) && (
                      <div className="text-right">
                        {selectedScholarship.eligibility?.mayBeEligible ? (
                          <div className="text-sm text-amber-600">
                            <p className="font-semibold">⚠️ Requires Verification</p>
                            <p className="text-xs">
                              {selectedScholarship.eligibility?.unmetCriteria?.[0] || 
                                "Some criteria require verification. Check your Settings for special categories (Athlete, Artist, SK Official, etc.)"}
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm text-red-600">
                            {selectedScholarship.eligibility?.criteriaChecks?.qcSchoolEnrollment?.status === "no_school"
                              ? "Please add your school information in Settings before applying"
                              : "You must meet all eligibility criteria to proceed"}
                          </p>
                        )}
                      </div>
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className={`inline-flex ${!deriveStudentApplyAllowed(selectedScholarship) ? "cursor-not-allowed" : ""}`}
                        >
                          <Button
                            onClick={() => setApplicationStep(2)}
                            className={`bg-green-600 hover:bg-green-700 ${!deriveStudentApplyAllowed(selectedScholarship) ? "opacity-50 cursor-not-allowed" : ""}`}
                            disabled={!deriveStudentApplyAllowed(selectedScholarship)}
                          >
                            Proceed to Documents
                            <ExternalLink className="h-4 w-4 ml-2" />
                          </Button>
                        </span>
                      </TooltipTrigger>
                      {!deriveStudentApplyAllowed(selectedScholarship) && (
                        <TooltipContent side="top" className="max-w-xs text-left">
                          Complete eligibility requirements and ensure applications are open before continuing.
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </div>
                </div>
              )}

              {/* STEP 2: Document Upload */}
              {applicationStep === 2 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      Upload Documents
                    </h3>

                    {/* General Documents */}
                    {selectedScholarship.generalDocuments && selectedScholarship.generalDocuments.length > 0 && (
                      <div className="mb-6">
                        <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                          <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-xs font-semibold">REQUIRED</span>
                          General Documents
                        </h4>
                        <div className="space-y-3">
                          {selectedScholarship.generalDocuments.map((doc, idx) => (
                            <div key={idx} className="border rounded-lg p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                  <p className="text-sm font-medium">{doc}</p>
                                  {uploadedDocuments[doc] ? (
                                    <div className="flex items-center gap-2 mt-2">
                                      <Badge className="bg-green-100 text-green-700 text-xs">
                                        <CheckCircle className="h-3 w-3 mr-1" />
                                        Uploaded
                                      </Badge>
                                      <span className="text-xs text-gray-500">
                                        {uploadedDocuments[doc].file.name}
                                      </span>
                                    </div>
                                  ) : (
                                    <Badge variant="outline" className="text-xs mt-2">
                                      Required
                                    </Badge>
                                  )}
                                </div>
                                {uploadedDocuments[doc] ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeUploadedFile(doc)}
                                  >
                                    ✕
                                  </Button>
                                ) : (
                                  <div className="relative">
                                    <input
                                      type="file"
                                      id={`file-${doc.replace(/\s+/g, '-').substring(0, 30)}`}
                                      accept=".pdf,.jpg,.jpeg,.png"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleFileUpload(doc, file);
                                        // Reset input so same file can be selected again
                                        e.target.value = '';
                                      }}
                                    />
                                    <label 
                                      htmlFor={`file-${doc.replace(/\s+/g, '-').substring(0, 30)}`}
                                      className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 cursor-pointer"
                                    >
                                      📎 Upload
                                    </label>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Scholarship-Specific Documents */}
                    {selectedScholarship.requiredDocuments && selectedScholarship.requiredDocuments.length > 0 && (
                      <div className="mb-6">
                        <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                          <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-semibold">SCHOLARSHIP-SPECIFIC</span>
                          Required Documents
                        </h4>
                        <div className="space-y-3">
                          {selectedScholarship.requiredDocuments.map((doc, idx) => (
                            <div key={idx} className="border rounded-lg p-3 bg-blue-50/50">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                  <p className="text-sm font-medium">{doc}</p>
                                  {uploadedDocuments[doc] ? (
                                    <div className="flex items-center gap-2 mt-2">
                                      <Badge className="bg-green-100 text-green-700 text-xs">
                                        <CheckCircle className="h-3 w-3 mr-1" />
                                        Uploaded
                                      </Badge>
                                      <span className="text-xs text-gray-500">
                                        {uploadedDocuments[doc].file.name}
                                      </span>
                                    </div>
                                  ) : (
                                    <Badge variant="outline" className="text-xs mt-2 text-amber-600 border-amber-300">
                                      Recommended
                                    </Badge>
                                  )}
                                </div>
                                {uploadedDocuments[doc] ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeUploadedFile(doc)}
                                  >
                                    ✕
                                  </Button>
                                ) : (
                                  <div className="relative">
                                    <input
                                      type="file"
                                      id={`file-${doc.replace(/\s+/g, '-').substring(0, 30)}`}
                                      accept=".pdf,.jpg,.jpeg,.png"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleFileUpload(doc, file);
                                        // Reset input so same file can be selected again
                                        e.target.value = '';
                                      }}
                                    />
                                    <label 
                                      htmlFor={`file-${doc.replace(/\s+/g, '-').substring(0, 30)}`}
                                      className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 cursor-pointer"
                                    >
                                      📎 Upload
                                    </label>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {!canProceedToStep3() && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                        <p className="text-sm text-red-600">
                          Please upload all required general documents before proceeding.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setApplicationStep(1)}>
                      Back
                    </Button>
                    <Button 
                      onClick={() => setApplicationStep(3)}
                      disabled={!canProceedToStep3()}
                    >
                      Review & Submit
                      <ExternalLink className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </div>
              )}

              {/* STEP 3: Review & Submit */}
              {applicationStep === 3 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-primary" />
                      Review Your Application
                    </h3>

                    {/* Scholarship Summary */}
                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                      <h4 className="font-medium mb-2">Scholarship</h4>
                      <p className="text-sm text-gray-600">{selectedScholarship.name}</p>
                      <p className="text-lg font-semibold text-primary mt-1">
                        ₱{Number(selectedScholarship.amount).toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-500">
                        Match Score: {selectedScholarship.matchScore}%
                      </p>
                    </div>

                    {/* Uploaded Documents Summary */}
                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                      <h4 className="font-medium mb-2">Uploaded Documents</h4>
                      <div className="space-y-2">
                        {Object.entries(uploadedDocuments).map(([docType, docData]) => (
                          <div key={docType} className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">{docType}</span>
                            <Badge className="bg-green-100 text-green-700 text-xs">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Uploaded
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Declaration */}
                    <div className="border rounded-lg p-4 mb-4">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={declarationChecked}
                          onChange={(e) => setDeclarationChecked(e.target.checked)}
                          className="mt-1 h-4 w-4 text-primary"
                        />
                        <span className="text-sm text-gray-700">
                          I certify that all information and documents submitted are true and correct. 
                          I understand that any false information may result in the disqualification of my application.
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-between items-center gap-4 flex-wrap">
                    <Button variant="outline" onClick={() => setApplicationStep(2)}>
                      Back
                    </Button>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className={`inline-flex ${
                            declarationChecked &&
                            !isSubmitting &&
                            !deriveStudentApplyAllowed(selectedScholarship)
                              ? "cursor-not-allowed"
                              : ""
                          }`}
                        >
                          <Button
                            onClick={handleSubmitApplication}
                            disabled={
                              !declarationChecked ||
                              isSubmitting ||
                              !deriveStudentApplyAllowed(selectedScholarship)
                            }
                            className={`bg-blue-600 hover:bg-blue-700 ${
                              !declarationChecked ||
                              isSubmitting ||
                              !deriveStudentApplyAllowed(selectedScholarship)
                                ? "opacity-50 cursor-not-allowed"
                                : ""
                            }`}
                          >
                            {isSubmitting ? (
                              <>
                                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                                Submitting...
                              </>
                            ) : (
                              <>
                                Submit Application
                                <ExternalLink className="h-4 w-4 ml-2" />
                              </>
                            )}
                          </Button>
                        </span>
                      </TooltipTrigger>
                      {(() => {
                        const blocked =
                          !declarationChecked ||
                          isSubmitting ||
                          !deriveStudentApplyAllowed(selectedScholarship);
                        if (!blocked || isSubmitting) return null;
                        return (
                          <TooltipContent side="top" className="max-w-xs text-left">
                            {!declarationChecked
                              ? "Confirm the declaration checkbox to submit."
                              : "You are not eligible or applications are closed for this scholarship."}
                          </TooltipContent>
                        );
                      })()}
                    </Tooltip>
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
