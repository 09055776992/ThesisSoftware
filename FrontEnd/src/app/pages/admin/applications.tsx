import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Separator } from "../../components/ui/separator";
import { CheckCircle, XCircle, Clock, ShieldCheck, Eye, Download, FileText, AlertTriangle, CheckSquare, AlertCircle, ArrowLeft, ChevronRight, Calendar, ExternalLink, Search, FileSpreadsheet, Video, Trophy, Brain, TrendingUp, TrendingDown } from "lucide-react";
import {
  fetchScholarshipApplicationSummary,
  fetchScholarshipApplicants,
  fetchApplicationReview,
  qualifyApplication,
  rejectApplicationWithReason,
  requestResubmission,
  updateDocumentStatusByIndex,
  updateDocumentStatus,
  exportApplicants,
  approveApplication,
  resolvePublicAssetUrl,
  generateAIRankings,
  fetchSavedRankings,
  fetchProfileDocuments,
  type AIRanking,
  type ShapContribution,
  type ProfileDocumentResponse,
} from "../../lib/api-client";

// ===== Types =====

interface ScholarshipSummary {
  _id: string;
  scholarshipName: string;
  totalApplications: number;
  pending: number;
  qualifiedForScreening: number;
  approved: number;
  rejected: number;
}

interface SubmittedDocument {
  documentType: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
  status: string;
  rejectionReason?: string;
  confidence_score?: number;
  extracted_gwa?: number;
  matched_keywords?: string[];
  match_scores?: Record<string, number>;
  total_expected_terms?: number;
  fuzzy_threshold?: number;
}

interface ProfileDocument {
  type: string;
  label: string;
  fileName: string | null;
  fileSize: number | null;
  uploadedAt: string | null;
  status: string | null;
  rejectionReason: string | null;
}

interface ScreeningData {
  scheduled: boolean;
  // Legacy fields for backward compatibility
  scheduledDate?: string;
  scheduledTime?: string;
  meetingPlatform?: string;
  meetingLink?: string;
  // New recorded video interview fields
  videoSubmissionType?: "recorded";
  googleDriveLink?: string;
  submissionDeadline?: string;
  notes?: string;
}

interface Application {
  _id: string;
  referenceNumber?: string;
  studentName?: string;
  studentEmail: string;
  scholarshipId: string;
  scholarshipName: string;
  submittedAt: string;
  status: string;
  matchScore: number;
  stage?: "initial" | "accepted" | "completed";
  // Legacy field - replaced by generalDocuments and specificDocuments
  submittedDocuments?: SubmittedDocument[];
  // Stage 1: General documents from profile vault
  generalDocuments?: SubmittedDocument[];
  // Stage 2: Scholarship-specific documents (post-acceptance)
  specificDocuments?: SubmittedDocument[];
  eligibilityCheck?: {
    isEligible?: boolean;
    reasons?: string[];
    unmetCriteria?: string[];
    criteriaChecks?: Record<string, any>;
  };
  finalScreening?: ScreeningData;
  rejectionReason?: string;
  studentProfile?: Record<string, any>;
  scholarshipData?: Record<string, any>;
  // Student's profile documents from Document Vault (for admin view)
  studentProfileDocuments?: ProfileDocument[];
  hasCompleteProfileDocuments?: boolean;
}

// ===== Helper Components =====

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { variant: "default" | "secondary" | "outline" | "destructive"; className?: string }> = {
    "Approved": { variant: "default", className: "bg-blue-600 hover:bg-blue-600" },
    "Qualified for Final Screening": { variant: "default", className: "bg-green-600 hover:bg-green-600" },
    "System Qualified": { variant: "secondary" },
    "Under Review": { variant: "secondary", className: "bg-amber-500 hover:bg-amber-500 text-white" },
    "Pending": { variant: "outline" },
    "Rejected": { variant: "destructive" },
    "Needs Resubmission": { variant: "outline", className: "border-orange-500 text-orange-600" },
  };
  const v = variants[status] || { variant: "outline" as const };
  return (
    <Badge variant={v.variant} className={v.className}>
      {status}
    </Badge>
  );
}

function MatchScoreBadge({ score }: { score: number }) {
  let color = "bg-gray-500";
  if (score >= 90) color = "bg-green-600";
  else if (score >= 75) color = "bg-blue-600";
  else if (score >= 50) color = "bg-amber-500";
  else color = "bg-red-500";
  return <Badge className={`${color} hover:${color} font-mono`}>{score}%</Badge>;
}

function getInitials(name: string) {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function studentProfileAvatar(student: Record<string, unknown> | undefined): string {
  return resolvePublicAssetUrl(
    String(student?.profileImage || student?.profilePicture || student?.avatar || ""),
  );
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatFileSize(bytes: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function getDocumentUrl(filePath: string) {
  if (!filePath) return "";
  if (filePath.startsWith("http")) return filePath;
  const normalized = filePath.replace(/\\/g, "/");
  const uploadIndex = normalized.indexOf("uploads");
  if (uploadIndex >= 0) return `http://localhost:5000/${normalized.slice(uploadIndex)}`;
  return `http://localhost:5000/${normalized}`;
}

// ===== RankingCard Component =====

function ScoreBar({ label, score, weight }: { label: string; score: number; weight: number }) {
  const color = score >= 75 ? "bg-green-500" : score >= 50 ? "bg-amber-400" : "bg-red-400";
  const textColor = score >= 75 ? "text-green-700" : score >= 50 ? "text-amber-700" : "text-red-600";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label} <span className="text-xs opacity-60">({weight}%)</span></span>
        <span className={`font-mono font-semibold ${textColor}`}>{score.toFixed(0)}/100</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function RankingCard({ ranking }: { ranking: AIRanking }) {
  const [expanded, setExpanded] = useState(false);
  const medal = ranking.rank === 1 ? "🥇" : ranking.rank === 2 ? "🥈" : ranking.rank === 3 ? "🥉" : `#${ranking.rank}`;
  const scoreColor = ranking.total_score >= 75 ? "text-green-700 bg-green-50" : ranking.total_score >= 50 ? "text-amber-700 bg-amber-50" : "text-red-700 bg-red-50";
  const bd = ranking.score_breakdown;
  const shap = ranking.shap_explanation;
  // Tiebreaker info from the Python ranking engine
  const tiebreakerUsed = (ranking as Record<string, unknown>).tiebreaker_used as string | null;
  const tiebreakerNote = (ranking as Record<string, unknown>).tiebreaker_note as string | null;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Header row */}
        <div className="flex items-center gap-4 p-4 border-b">
          <span className="text-2xl w-10 text-center">{medal}</span>
          <div className="flex-1">
            <p className="font-semibold text-base">{ranking.student_name}</p>
            <p className="text-xs text-muted-foreground">Rank {ranking.rank}</p>
            {/* Tiebreaker badge */}
            {tiebreakerUsed === "financial_status" && (
              <p className="text-xs text-amber-600 mt-0.5">
                ⚖️ Tied on score — ranked by financial need
              </p>
            )}
            {tiebreakerUsed === "first_come_first_served" && (
              <p className="text-xs text-blue-600 mt-0.5">
                ⚖️ Tied on score & financial need — ranked by submission date (FCFS)
              </p>
            )}
          </div>
          <div className={`px-3 py-1 rounded-full text-sm font-bold font-mono ${scoreColor}`}>
            {ranking.total_score.toFixed(1)} / 100
          </div>
          <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
            {expanded ? "Hide Details" : "Show Details"}
          </Button>
        </div>

        {/* Score bars — always visible */}
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ScoreBar label="GWA" score={bd.gpa_score} weight={30} />
          <ScoreBar label="Financial Need" score={bd.financial_score} weight={25} />
          <ScoreBar label="Document Completeness" score={bd.document_completeness} weight={20} />
          <ScoreBar label="Document Authenticity" score={bd.document_authenticity} weight={15} />
          <ScoreBar label="Special Category" score={bd.special_category_score} weight={10} />
        </div>

        {/* Tiebreaker note — shown when applicable */}
        {tiebreakerNote && (
          <div className="mx-4 mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
            ⚖️ {tiebreakerNote}
          </div>
        )}

        {/* SHAP explanation — expandable */}
        {expanded && shap && (
          <div className="border-t bg-gray-50 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Brain className="size-4" />
              AI Explanation (SHAP)
            </div>
            <p className="text-sm text-muted-foreground italic">"{shap.summary}"</p>

            <div className="space-y-2">
              {shap.contributions.map((c: ShapContribution) => (
                <div key={c.factor} className="flex items-start gap-2 text-sm">
                  {c.impact === "positive"
                    ? <TrendingUp className="size-4 text-green-600 mt-0.5 flex-shrink-0" />
                    : <TrendingDown className="size-4 text-red-500 mt-0.5 flex-shrink-0" />
                  }
                  <div>
                    <span className="font-medium">{c.factor}</span>
                    <span className="text-muted-foreground ml-1">({c.raw_score.toFixed(0)}/100)</span>
                    <p className="text-xs text-muted-foreground">{c.explanation}</p>
                  </div>
                </div>
              ))}
            </div>

            {shap.top_strength && (
              <div className="text-xs text-green-700 bg-green-50 rounded p-2">
                <strong>Top Strength:</strong> {shap.top_strength.factor} ({shap.top_strength.raw_score.toFixed(0)}/100)
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ===== Main Component =====

type ViewMode = "scholarships" | "applicants" | "review";

export function AdminApplications() {
  const [viewMode, setViewMode] = useState<ViewMode>("scholarships");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  // Scholarship list
  const [scholarshipList, setScholarshipList] = useState<ScholarshipSummary[]>([]);

  // Applicants list
  const [selectedScholarshipId, setSelectedScholarshipId] = useState("");
  const [selectedScholarshipName, setSelectedScholarshipName] = useState("");
  const [applicants, setApplicants] = useState<Application[]>([]);
  const [applicantStats, setApplicantStats] = useState<Record<string, number>>({});

  // AI Rankings
  const [applicantsTab, setApplicantsTab] = useState<"list" | "rankings">("list");
  const [rankings, setRankings] = useState<AIRanking[]>([]);
  const [rankingsLoading, setRankingsLoading] = useState(false);
  const [rankingsError, setRankingsError] = useState<string | null>(null);
  const [rankingsGeneratedAt, setRankingsGeneratedAt] = useState<string | null>(null);

  // Review page
  const [reviewApplication, setReviewApplication] = useState<Application | null>(null);
  const [documentStatuses, setDocumentStatuses] = useState<Record<string, { status: string; reason: string }>>({});
  // Student's profile documents from Document Vault
  const [profileDocuments, setProfileDocuments] = useState<ProfileDocument[]>([]);
  const [hasCompleteProfileDocs, setHasCompleteProfileDocs] = useState(false);
  const [isLoadingProfileDocs, setIsLoadingProfileDocs] = useState(false);

  // Modals
  const [showScheduler, setShowScheduler] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showResubmitModal, setShowResubmitModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [resubmitReason, setResubmitReason] = useState("");
  const [rejectedDocs, setRejectedDocs] = useState<Array<{ index: number; name: string; reason: string }>>([]);
  const [isUpdating, setIsUpdating] = useState(false);

  // Screening form - Recorded Video Interview Submission
  const [screeningForm, setScreeningForm] = useState({
    googleDriveLink: "",
    submissionDeadline: "",
    notes: "",
  });

  const API_BASE = (import.meta.env as any).VITE_API_BASE_URL || "http://localhost:5000";

  useEffect(() => {
    if (viewMode === "scholarships") fetchScholarships();
    else if (viewMode === "applicants" && selectedScholarshipId) fetchApplicants();
    else if (viewMode === "review" && reviewApplication?._id) fetchReview();
  }, [viewMode]);

  const fetchScholarships = async () => {
    setLoading(true);
    try {
      const result = await fetchScholarshipApplicationSummary();
      setScholarshipList((result.data as ScholarshipSummary[]) || []);
    } catch (err) {
      console.error("Error fetching scholarship summary:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchApplicants = async () => {
    if (!selectedScholarshipId) return;
    setLoading(true);
    try {
      const result = await fetchScholarshipApplicants(
        selectedScholarshipId,
        statusFilter === "all" ? undefined : statusFilter,
        searchQuery || undefined
      );
      setApplicants((result.data as Application[]) || []);
      setApplicantStats(result.stats || {});
    } catch (err) {
      console.error("Error fetching applicants:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (viewMode === "applicants") fetchApplicants();
  }, [statusFilter, searchQuery]);

  const fetchReview = async () => {
    if (!reviewApplication?._id) return;
    try {
      const result = await fetchApplicationReview(reviewApplication._id);
      const data = result.data as any;
      setReviewApplication(data as Application);

      // Init document statuses for Stage 2 (scholarship-specific) documents
      const statuses: Record<string, { status: string; reason: string }> = {};
      const docsToProcess = data.specificDocuments || data.submittedDocuments || [];
      if (docsToProcess) {
        docsToProcess.forEach((doc: any, idx: number) => {
          statuses[String(idx)] = {
            status: doc.status || "pending_review",
            reason: doc.rejectionReason || "",
          };
        });
      }
      setDocumentStatuses(statuses);

      // Use profile documents from API response (populated from student's Document Vault)
      if (data.studentProfileDocuments) {
        setProfileDocuments(data.studentProfileDocuments as ProfileDocument[]);
        setHasCompleteProfileDocs(data.hasCompleteProfileDocuments || false);
        setIsLoadingProfileDocs(false);
      } else {
        // Fallback: fetch separately if not in response
        setIsLoadingProfileDocs(true);
        try {
          const profileDocsResult = await fetchProfileDocuments(data.studentEmail);
          setProfileDocuments(profileDocsResult.documents as ProfileDocument[]);
          setHasCompleteProfileDocs(profileDocsResult.isComplete);
        } catch (err) {
          console.error("Error fetching profile documents:", err);
          setProfileDocuments([]);
          setHasCompleteProfileDocs(false);
        } finally {
          setIsLoadingProfileDocs(false);
        }
      }
    } catch (err) {
      console.error("Error fetching review:", err);
    }
  };

  const handleViewApplicants = (s: ScholarshipSummary) => {
    setSelectedScholarshipId(s._id);
    setSelectedScholarshipName(s.scholarshipName);
    setStatusFilter("all");
    setSearchQuery("");
    setViewMode("applicants");
  };

  const handleReviewApplication = (app: Application) => {
    setReviewApplication(app);
    setViewMode("review");
  };

  const handleDocumentStatusChange = (docIndex: number, newStatus: string) => {
    setDocumentStatuses((prev) => ({
      ...prev,
      [String(docIndex)]: { ...prev[String(docIndex)], status: newStatus },
    }));
  };

  const handleDocumentReasonChange = (docIndex: number, reason: string) => {
    setDocumentStatuses((prev) => ({
      ...prev,
      [String(docIndex)]: { ...prev[String(docIndex)], reason },
    }));
  };

  const saveDocumentStatus = async (docIndex: number) => {
    if (!reviewApplication?._id) return;
    const status = documentStatuses[String(docIndex)];
    if (!status) return;
    try {
      setIsUpdating(true);
      await updateDocumentStatusByIndex(reviewApplication._id, docIndex, status.status, status.reason);
      await fetchReview();
    } catch (err) {
      console.error("Error saving document status:", err);
    } finally {
      setIsUpdating(false);
    }
  };

  const openScreeningScheduler = (existing?: ScreeningData) => {
    setScreeningForm({
      googleDriveLink: existing?.googleDriveLink || "",
      submissionDeadline: existing?.submissionDeadline
        ? new Date(existing.submissionDeadline).toISOString().slice(0, 16)
        : "",
      notes: existing?.notes || "",
    });
    setShowScheduler(true);
  };

  const handleQualify = () => {
    if (!reviewApplication?._id) return;
    openScreeningScheduler(reviewApplication.finalScreening);
  };

  const handleScheduleScreening = async () => {
    if (!reviewApplication?._id) return;
    if (!screeningForm.googleDriveLink.trim() || !screeningForm.submissionDeadline) {
      alert("Please provide the Google Drive upload link and submission deadline.");
      return;
    }
    const link = screeningForm.googleDriveLink.trim();
    if (!/^https?:\/\//i.test(link)) {
      alert("Google Drive link must start with http:// or https://");
      return;
    }
    try {
      setIsUpdating(true);
      await qualifyApplication(reviewApplication._id, {
        googleDriveLink: link,
        submissionDeadline: screeningForm.submissionDeadline,
        notes: screeningForm.notes.trim(),
      });
      setShowScheduler(false);
      await fetchReview();
      alert("Student qualified for final screening. Video submission instructions were sent to the student.");
    } catch (err) {
      console.error("Error scheduling screening:", err);
      alert(err instanceof Error ? err.message : "Failed to schedule screening.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRejectClick = () => {
    setRejectReason("");
    setShowRejectModal(true);
  };

  const handleConfirmReject = async () => {
    if (!reviewApplication?._id) return;
    try {
      setIsUpdating(true);
      await rejectApplicationWithReason(reviewApplication._id, rejectReason);
      setShowRejectModal(false);
      await fetchReview();
      alert("Application rejected and student notified.");
    } catch (err) {
      console.error("Error rejecting application:", err);
      alert("Failed to reject application.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleResubmitClick = () => {
    const docs: Array<{ index: number; name: string; reason: string }> = [];
    if (reviewApplication?.submittedDocuments) {
      reviewApplication.submittedDocuments.forEach((doc, idx) => {
        if (documentStatuses[String(idx)]?.status === "rejected") {
          docs.push({
            index: idx,
            name: doc.documentType,
            reason: documentStatuses[String(idx)].reason || "",
          });
        }
      });
    }
    setRejectedDocs(docs);
    setResubmitReason("");
    setShowResubmitModal(true);
  };

  const handleConfirmResubmit = async () => {
    if (!reviewApplication?._id) return;
    try {
      setIsUpdating(true);
      await requestResubmission(reviewApplication._id, rejectedDocs, resubmitReason);
      setShowResubmitModal(false);
      await fetchReview();
      alert("Resubmission requested and student notified.");
    } catch (err) {
      console.error("Error requesting resubmission:", err);
      alert("Failed to request resubmission.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleExport = () => {
    if (selectedScholarshipId) {
      exportApplicants(selectedScholarshipId);
    }
  };

  const handleGenerateRankings = async () => {
    if (!selectedScholarshipId) return;
    setRankingsLoading(true);
    setRankingsError(null);
    try {
      const result = await generateAIRankings(selectedScholarshipId);
      setRankings(result.rankings || []);
      setRankingsGeneratedAt(result.ranked_at || new Date().toISOString());
    } catch (err: any) {
      setRankingsError(err.message || "Failed to generate rankings. Make sure the AI server is running on port 8000.");
    } finally {
      setRankingsLoading(false);
    }
  };

  const handleLoadSavedRankings = async () => {
    if (!selectedScholarshipId) return;
    setRankingsLoading(true);
    setRankingsError(null);
    try {
      const result = await fetchSavedRankings(selectedScholarshipId);
      setRankings(result.rankings || []);
    } catch (err: any) {
      setRankingsError(err.message || "No saved rankings found.");
    } finally {
      setRankingsLoading(false);
    }
  };

  // Check Stage 2 (scholarship-specific) documents status
  const stage2Docs = reviewApplication?.specificDocuments || reviewApplication?.submittedDocuments || [];
  const docsVerified = stage2Docs.every((d) => d.status === "verified") ?? false;
  const docsSomePending = stage2Docs.some((d) => d.status === "pending_review" || d.status === "uploaded") ?? false;
  const docsAnyRejected = stage2Docs.some((d) => d.status === "rejected") ?? false;

  // ===== RENDER: Scholarship List =====
  if (viewMode === "scholarships") {
    return (
      <div className="p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Application Review</h1>
          <p className="text-muted-foreground">Scholarships with submitted applications</p>
        </div>

        {loading ? (
          <div className="text-center py-8">Loading scholarships...</div>
        ) : scholarshipList.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <FileText className="size-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No applications received yet</p>
              <p className="text-sm">Scholarships with applications will appear here.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Scholarships with Applications ({scholarshipList.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Scholarship Name</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="text-center">Pending Review</TableHead>
                    <TableHead className="text-center">Qualified for Screening</TableHead>
                    <TableHead className="text-center">Approved</TableHead>
                    <TableHead className="text-center">Rejected</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scholarshipList.map((s) => (
                    <TableRow key={s._id}>
                      <TableCell className="font-medium">{s.scholarshipName}</TableCell>
                      <TableCell className="text-center font-mono">{s.totalApplications}</TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-orange-500 hover:bg-orange-500 text-white">{s.pending}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-green-600 hover:bg-green-600 text-white">{s.qualifiedForScreening}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-blue-600 hover:bg-blue-600 text-white">{s.approved}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {s.rejected > 0 ? (
                          <Badge variant="destructive">{s.rejected}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" onClick={() => handleViewApplicants(s)}>
                          View Applicants <ChevronRight className="size-4 ml-1" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // ===== RENDER: Applicants List =====
  if (viewMode === "applicants") {
    const filterTabs = [
      { value: "all", label: "All" },
      { value: "System Qualified", label: "Pending Review" },
      { value: "Qualified for Final Screening", label: "Qualified" },
      { value: "Approved", label: "Approved" },
      { value: "Rejected", label: "Rejected" },
    ];

    const filtered = applicants.filter((app) => {
      if (statusFilter === "all") return true;
      if (statusFilter === "System Qualified") return app.status === "System Qualified" || app.status === "Pending" || app.status === "Under Review";
      return app.status === statusFilter;
    });

    return (
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-2">
          <Button variant="ghost" size="sm" onClick={() => setViewMode("scholarships")}>
            <ArrowLeft className="size-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{selectedScholarshipName}</h1>
            <p className="text-muted-foreground">{applicants.length} total applicants</p>
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <FileSpreadsheet className="size-4 mr-1" /> Export to Excel
            </Button>
          </div>
        </div>

        {/* Main Tabs: Applicants List | AI Rankings */}
        <div className="flex gap-1 border-b">
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              applicantsTab === "list"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setApplicantsTab("list")}
          >
            <FileText className="size-4 inline mr-1" />
            Applicants List
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              applicantsTab === "rankings"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setApplicantsTab("rankings")}
          >
            <Trophy className="size-4 inline mr-1" />
            AI Rankings
          </button>
        </div>

        {/* ── TAB: Applicants List ── */}
        {applicantsTab === "list" && (
          <>
            {/* Filter Tabs */}
            <div className="flex gap-2 flex-wrap">
              {filterTabs.map((tab) => (
                <Button
                  key={tab.value}
                  variant={statusFilter === tab.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(tab.value)}
                >
                  {tab.label}
                  {tab.value !== "all" && applicantStats[tab.value] > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs">{applicantStats[tab.value]}</Badge>
                  )}
                </Button>
              ))}
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-4 gap-4">
              <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold font-mono">{applicantStats["all"] || applicants.length}</p><p className="text-xs text-muted-foreground">Total</p></CardContent></Card>
              <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold font-mono text-orange-600">{applicantStats["System Qualified"] || 0}</p><p className="text-xs text-muted-foreground">Pending Review</p></CardContent></Card>
              <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold font-mono text-green-600">{applicantStats["Qualified for Final Screening"] || 0}</p><p className="text-xs text-muted-foreground">Qualified</p></CardContent></Card>
              <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold font-mono text-blue-600">{applicantStats["Approved"] || 0}</p><p className="text-xs text-muted-foreground">Approved</p></CardContent></Card>
            </div>

            {loading ? (
              <div className="text-center py-8">Loading applicants...</div>
            ) : (
              <Card>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Match Score</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead>Documents</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((app) => {
                        const verifiedCount = app.submittedDocuments?.filter((d) => d.status === "verified").length || 0;
                        const totalDocs = app.submittedDocuments?.length || 0;
                        const docStatusLabel = totalDocs > 0 ? `${verifiedCount}/${totalDocs} Verified` : "No docs";
                        const docStatusColor = verifiedCount === totalDocs && totalDocs > 0 ? "text-green-600" : verifiedCount > 0 ? "text-amber-600" : "text-muted-foreground";

                        return (
                          <TableRow key={app._id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="size-8">
                                  <AvatarImage src={studentProfileAvatar(app.studentProfile)} />
                                  <AvatarFallback className="text-xs">{getInitials(app.studentName || app.studentEmail)}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <span className="font-medium">{app.studentName || app.studentEmail}</span>
                                  {app.studentName && <p className="text-xs text-muted-foreground">{app.studentEmail}</p>}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell><MatchScoreBadge score={app.matchScore} /></TableCell>
                            <TableCell className="text-sm">{formatDate(app.submittedAt)}</TableCell>
                            <TableCell className={`text-sm ${docStatusColor}`}>{docStatusLabel}</TableCell>
                            <TableCell><StatusBadge status={app.status} /></TableCell>
                            <TableCell className="text-right">
                              <Button size="sm" onClick={() => handleReviewApplication(app)}>
                                Review Application
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {filtered.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No applicants found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* ── TAB: AI Rankings ── */}
        {applicantsTab === "rankings" && (
          <div className="space-y-6">
            {/* Controls */}
            <div className="flex items-center gap-3">
              <Button
                onClick={handleGenerateRankings}
                disabled={rankingsLoading}
                className="gap-2"
              >
                <Brain className="size-4" />
                {rankingsLoading ? "Analyzing with AI..." : "Generate AI Rankings"}
              </Button>
              {rankings.length > 0 && (
                <Button variant="outline" size="sm" onClick={handleLoadSavedRankings} disabled={rankingsLoading}>
                  Load Saved Rankings
                </Button>
              )}
              {rankingsGeneratedAt && (
                <span className="text-xs text-muted-foreground">
                  Last generated: {new Date(rankingsGeneratedAt).toLocaleString()}
                </span>
              )}
            </div>

            {/* Error */}
            {rankingsError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
                <AlertCircle className="size-4 inline mr-2" />
                {rankingsError}
              </div>
            )}

            {/* Loading */}
            {rankingsLoading && (
              <Card>
                <CardContent className="py-12 text-center">
                  <Brain className="size-12 mx-auto mb-4 text-primary animate-pulse" />
                  <p className="text-lg font-medium">Analyzing applications with AI...</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    BERT is verifying documents · Scoring 5 criteria · Generating SHAP explanations
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Empty state */}
            {!rankingsLoading && rankings.length === 0 && !rankingsError && (
              <Card>
                <CardContent className="py-12 text-center">
                  <Trophy className="size-12 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">No rankings yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Click "Generate AI Rankings" to score and rank all qualified applicants.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Rankings list */}
            {!rankingsLoading && rankings.length > 0 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground font-medium">
                  {rankings.length} applicants ranked — sorted by AI score (highest first)
                </p>
                {rankings.map((r) => (
                  <RankingCard key={r.student_id} ranking={r} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ===== RENDER: Individual Review Page =====
  if (viewMode === "review" && reviewApplication) {
    const app = reviewApplication;
    const student = app.studentProfile as any;

    return (
      <div className="p-8 space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-2">
          <Button variant="ghost" size="sm" onClick={() => setViewMode("applicants")}>
            <ArrowLeft className="size-4 mr-1" /> Back to Applicants
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <Avatar className="size-16">
                  <AvatarImage src={studentProfileAvatar(student)} />
                  <AvatarFallback className="text-lg">{getInitials(app.studentName || app.studentEmail)}</AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-2xl font-bold">{app.studentName || student?.fullName || "Unknown Student"}</h2>
                  <p className="text-muted-foreground">{app.studentEmail}</p>
                  <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                    <span className="font-medium">{app.scholarshipName}</span>
                    <span>|</span>
                    <span>Ref: {app.referenceNumber || app._id.slice(-8).toUpperCase()}</span>
                    <span>|</span>
                    <span>Submitted: {formatDate(app.submittedAt)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={app.status} />
                <MatchScoreBadge score={app.matchScore} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 1 - Eligibility Summary */}
        {app.eligibilityCheck?.criteriaChecks && (
          <Card>
            <CardHeader><CardTitle className="text-lg">Eligibility Summary</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(app.eligibilityCheck.criteriaChecks).map(([key, check]: [string, any]) => (
                  <div key={key} className="flex items-start gap-2 p-2 rounded bg-gray-50">
                    {check.passed ? (
                      <CheckCircle className="size-5 text-green-600 mt-0.5 flex-shrink-0" />
                    ) : (
                      <XCircle className="size-5 text-red-500 mt-0.5 flex-shrink-0" />
                    )}
                    <div>
                      <p className="font-medium text-sm">{check.label || key}</p>
                      <p className="text-xs text-muted-foreground">{check.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section 2 - Student Profile Summary */}
        {student && (
          <Card>
            <CardHeader><CardTitle className="text-lg">Student Profile Summary</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                {student.gwa || student.GWA ? (
                  <div><span className="text-muted-foreground">GWA:</span> <span className="font-medium">{student.gwa || student.GWA}</span></div>
                ) : null}
                {student.educationLevel ? (
                  <div><span className="text-muted-foreground">Education Level:</span> <span className="font-medium">{student.educationLevel}</span></div>
                ) : null}
                {student.yearLevel ? (
                  <div><span className="text-muted-foreground">Year Level:</span> <span className="font-medium">{student.yearLevel}</span></div>
                ) : null}
                {student.schoolName ? (
                  <div><span className="text-muted-foreground">School:</span> <span className="font-medium">{student.schoolName}</span></div>
                ) : null}
                {student.schoolCampus ? (
                  <div><span className="text-muted-foreground">Campus:</span> <span className="font-medium">{student.schoolCampus}</span></div>
                ) : null}
                {student.fieldOfStudy ? (
                  <div><span className="text-muted-foreground">Field of Study:</span> <span className="font-medium">{student.fieldOfStudy}</span></div>
                ) : null}
                {student.incomeCategory ? (
                  <div><span className="text-muted-foreground">Income Category:</span> <span className="font-medium">{student.incomeCategory}</span></div>
                ) : null}
                {student.is_qc_resident !== undefined ? (
                  <div><span className="text-muted-foreground">QC Resident:</span> <span className="font-medium">{student.is_qc_resident ? "Yes" : "No"}</span></div>
                ) : null}
                <div className="col-span-full flex flex-wrap gap-1 mt-1">
                  {student.isPWD && <Badge variant="secondary">PWD</Badge>}
                  {student.isSoloParent && <Badge variant="secondary">Solo Parent</Badge>}
                  {student.isIndigent && <Badge variant="secondary">Indigent</Badge>}
                  {student.isAthlete && <Badge variant="secondary">Athlete</Badge>}
                  {student.isStudentLeader && <Badge variant="secondary">Student Leader</Badge>}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section 3 - Documents */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Documents</CardTitle>
              {hasCompleteProfileDocs && (
                <Badge className="bg-green-600">
                  Profile Documents Linked
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Stage 1: Profile Documents from Document Vault */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-semibold">STAGE 1</span>
                General Profile Documents
              </h4>

              {isLoadingProfileDocs ? (
                <div className="flex items-center justify-center py-4">
                  <div className="size-4 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
                  <span className="text-sm text-gray-600">Loading profile documents...</span>
                </div>
              ) : profileDocuments.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm text-amber-700">
                    No profile documents found. Student has not uploaded documents to their Document Vault.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {profileDocuments.map((doc, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <FileText className="size-4 text-gray-500" />
                        <div>
                          <p className="text-sm font-medium">{doc.label}</p>
                          {doc.fileName ? (
                            <p className="text-xs text-gray-500">{doc.fileName}</p>
                          ) : (
                            <p className="text-xs text-amber-600">Not uploaded</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {doc.fileName ? (
                          <>
                            <Badge className="bg-green-100 text-green-700 text-xs">
                              <CheckCircle className="size-3 mr-1" />
                              Linked from Profile
                            </Badge>
                            {doc.uploadedAt && (
                              <span className="text-xs text-muted-foreground">
                                {new Date(doc.uploadedAt).toLocaleDateString()}
                              </span>
                            )}
                          </>
                        ) : (
                          <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                            Missing
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Workflow Indicator Note */}
              {hasCompleteProfileDocs && (
                <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <span className="text-blue-600">💡</span>
                    <p className="text-sm text-blue-700">
                      General profile documents verified. Scholarship-specific documents will be requested upon clicking "Qualify for Final Screening".
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Stage 2: Scholarship-Specific Documents (if any) */}
            {(app.specificDocuments && app.specificDocuments.length > 0) || (app.submittedDocuments && app.submittedDocuments.length > 0) ? (
              <div className="pt-4 border-t">
                <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-semibold">STAGE 2</span>
                  Scholarship-Specific Documents
                </h4>

                {/* Documents Status Banner */}
                <div className={`p-3 rounded-lg text-sm font-medium mb-3 ${
                  docsVerified ? "bg-green-50 text-green-700 border border-green-200" :
                  docsAnyRejected ? "bg-red-50 text-red-700 border border-red-200" :
                  "bg-amber-50 text-amber-700 border border-amber-200"
                }`}>
                  {docsVerified && "All Documents Verified ✓"}
                  {docsSomePending && !docsAnyRejected && "Documents Under Review ⏳"}
                  {docsAnyRejected && "Some Documents Rejected ✗"}
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Document Type</TableHead>
                      <TableHead>File</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(app.specificDocuments || app.submittedDocuments || []).map((doc, idx) => {
                      const docStatus = documentStatuses[String(idx)]?.status || doc.status || "pending_review";
                      const docReason = documentStatuses[String(idx)]?.reason || doc.rejectionReason || "";

                      return (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{doc.documentType}</TableCell>
                          <TableCell className="text-sm">
                            <div>{doc.fileName}</div>
                            <div className="text-xs text-muted-foreground">{formatFileSize(doc.fileSize)}</div>
                            {doc.extracted_gwa !== undefined && (
                              <Badge variant="outline" className="mt-1 text-xs bg-blue-50 text-blue-700 border-blue-200">
                                Extracted GWA: {doc.extracted_gwa}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{doc.uploadedAt ? formatDate(doc.uploadedAt) : ""}</TableCell>
                          <TableCell>
                            <Select
                              value={docStatus}
                              onValueChange={(v) => handleDocumentStatusChange(idx, v)}
                            >
                              <SelectTrigger className="w-[140px] h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending_review">⏳ Pending Review</SelectItem>
                                <SelectItem value="verified">✅ Verified</SelectItem>
                                <SelectItem value="rejected">❌ Rejected</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => window.open(getDocumentUrl(doc.filePath), "_blank")}
                              >
                                <Eye className="size-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const url = getDocumentUrl(doc.filePath);
                                  if (url) {
                                    const a = document.createElement("a");
                                    a.href = url;
                                    a.download = doc.fileName;
                                    a.click();
                                  }
                                }}
                              >
                                <Download className="size-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant={docStatus !== (doc.status || "pending_review") ? "default" : "outline"}
                                onClick={() => saveDocumentStatus(idx)}
                                disabled={isUpdating}
                              >
                                Save
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {/* Rejection reasons for Stage 2 documents */}
                {(app.specificDocuments || app.submittedDocuments || []).map((doc, idx) => {
                  const docStatus = documentStatuses[String(idx)]?.status || doc.status || "pending_review";
                  const docReason = documentStatuses[String(idx)]?.reason || doc.rejectionReason || "";
                  if (docStatus !== "rejected") return null;
                  return (
                    <div key={idx} className="flex items-start gap-2 pl-2 mt-2">
                      <Input
                        placeholder={`Reason for rejecting ${doc.documentType}...`}
                        className="flex-1 h-8 text-sm"
                        value={docReason}
                        onChange={(e) => handleDocumentReasonChange(idx, e.target.value)}
                      />
                      <Button size="sm" variant="outline" onClick={() => saveDocumentStatus(idx)} disabled={isUpdating}>
                        Save
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {/* Document Accuracy Summary - only for Stage 2 documents */}
            {(app.specificDocuments && app.specificDocuments.length > 0) || (app.submittedDocuments && app.submittedDocuments.length > 0) ? (
              <div className="mt-6 pt-6 border-t">
                <div className="flex items-center gap-2 mb-4">
                  <ShieldCheck className="size-5 text-primary" />
                  <h4 className="font-semibold text-lg">Document AI Accuracy</h4>
                </div>

                {(() => {
                  const totalDocs = app.submittedDocuments?.length || 0;
                  const docsWithScore = app.submittedDocuments?.filter(d => d.confidence_score !== undefined) || [];
                  const avgScore = docsWithScore.length > 0
                    ? Math.round(docsWithScore.reduce((sum, d) => sum + (d.confidence_score || 0), 0) / docsWithScore.length)
                    : null;
                  const passedThreshold = avgScore !== null && avgScore >= 70;

                  return (
                    <div className="space-y-4">
                      {/* Summary Notification */}
                      <div className={`p-4 rounded-lg border-l-4 ${
                        avgScore === null
                          ? "bg-gray-50 border-gray-400"
                          : passedThreshold
                            ? "bg-green-50 border-green-500"
                            : avgScore >= 40
                              ? "bg-amber-50 border-amber-400"
                              : "bg-red-50 border-red-500"
                      }`}>
                        <div className="flex items-start gap-3">
                          {avgScore === null ? (
                            <AlertCircle className="size-5 text-gray-500 flex-shrink-0 mt-0.5" />
                          ) : passedThreshold ? (
                            <CheckCircle className="size-5 text-green-600 flex-shrink-0 mt-0.5" />
                          ) : avgScore >= 40 ? (
                            <AlertTriangle className="size-5 text-amber-500 flex-shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="size-5 text-red-500 flex-shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1">
                            <p className="font-semibold text-sm">
                              {avgScore === null
                                ? `📄 ${totalDocs} document${totalDocs !== 1 ? 's' : ''} submitted — AI analysis pending`
                                : `📄 ${totalDocs} document${totalDocs !== 1 ? 's' : ''} submitted • Overall Accuracy: ${avgScore}%`
                              }
                            </p>
                            <p className={`text-xs mt-1 ${
                              avgScore === null
                                ? "text-gray-600"
                                : passedThreshold
                                  ? "text-green-700"
                                  : avgScore >= 40
                                    ? "text-amber-700"
                                    : "text-red-700"
                            }`}>
                              {avgScore === null
                                ? "Documents have not been analyzed by the AI system yet."
                                : passedThreshold
                                  ? "✓ Documents meet authenticity threshold. All appear genuine and complete."
                                  : avgScore >= 40
                                    ? "⚠ Some documents show medium confidence. Manual review recommended."
                                    : "✗ Low document confidence detected. Potential authenticity issues."
                              }
                            </p>
                            {/* Document List */}
                            <div className="mt-3 space-y-1.5">
                              {app.submittedDocuments?.map((doc, idx) => {
                                const hasScore = doc.confidence_score !== undefined;
                                const score = doc.confidence_score || 0;
                                const docStatusLocal = documentStatuses[String(idx)]?.status || doc.status;
                                return (
                                  <div key={idx} className="flex items-center gap-2 text-xs">
                                    <FileText className="size-3.5 text-muted-foreground flex-shrink-0" />
                                    <span className="font-medium truncate flex-1">{doc.documentType}</span>
                                    <span className={`whitespace-nowrap ${
                                      docStatusLocal === "verified" ? "text-green-600 font-medium" :
                                      docStatusLocal === "rejected" ? "text-red-500 font-medium" :
                                      "text-amber-600"
                                    }`}>
                                      {docStatusLocal === "verified" ? "✓ Verified" :
                                       docStatusLocal === "rejected" ? "✗ Rejected" :
                                       "⏳ Pending"}
                                    </span>
                                    {hasScore ? (
                                      <span className={`whitespace-nowrap font-medium ${
                                        score >= 70 ? "text-green-600" :
                                        score >= 40 ? "text-amber-500" :
                                        "text-red-500"
                                      }`}>
                                        {score}% accurate
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground whitespace-nowrap">Pending analysis</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Overall Score */}
                      {avgScore !== null ? (
                        <div className="p-4 rounded-lg bg-gray-50">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-muted-foreground">Overall Document Confidence</span>
                            <span className={`font-bold text-lg ${
                              avgScore >= 70 ? "text-green-600" :
                              avgScore >= 40 ? "text-amber-500" :
                              "text-red-500"
                            }`}>
                              {avgScore}%
                            </span>
                          </div>
                          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                avgScore >= 70 ? "bg-green-500" :
                                avgScore >= 40 ? "bg-amber-400" :
                                "bg-red-400"
                              }`}
                              style={{ width: `${avgScore}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            Based on AI analysis of {docsWithScore.length} document{docsWithScore.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      ) : (
                        <div className="p-4 rounded-lg bg-gray-50 text-center">
                          <p className="text-sm text-muted-foreground">
                            No AI analysis data available for these documents.
                          </p>
                        </div>
                      )}

                      {/* Individual Document Scores */}
                      {docsWithScore.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {docsWithScore.map((doc, idx) => (
                            <div key={idx} className="flex items-center gap-3 p-3 rounded-lg border">
                              <FileText className="size-4 text-muted-foreground flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{doc.documentType}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <div className="h-2 flex-1 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${
                                        (doc.confidence_score || 0) >= 70 ? "bg-green-500" :
                                        (doc.confidence_score || 0) >= 40 ? "bg-amber-400" :
                                        "bg-red-400"
                                      }`}
                                      style={{ width: `${doc.confidence_score}%` }}
                                    />
                                  </div>
                                  <span className={`text-xs font-medium whitespace-nowrap ${
                                    (doc.confidence_score || 0) >= 70 ? "text-green-600" :
                                    (doc.confidence_score || 0) >= 40 ? "text-amber-500" :
                                    "text-red-500"
                                  }`}>
                                    {doc.confidence_score}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* SHAP-style Keyword Explanations */}
                      {app.submittedDocuments?.some(d => d.match_scores && Object.keys(d.match_scores).length > 0) && (
                        <div className="mt-4 pt-4 border-t">
                          <div className="flex items-center gap-2 mb-3">
                            <Brain className="size-4 text-primary" />
                            <h5 className="font-medium text-sm">AI Explanation (Keyword Analysis)</h5>
                          </div>
                          <div className="space-y-3">
                            {app.submittedDocuments?.filter(d => d.match_scores && Object.keys(d.match_scores).length > 0).map((doc, idx) => {
                              const scores = doc.match_scores || {};
                              const matched = doc.matched_keywords || [];
                              const threshold = doc.fuzzy_threshold || 80;
                              const allTerms = doc.total_expected_terms || Object.keys(scores).length;

                              return (
                                <div key={idx} className="p-3 rounded-lg bg-gray-50">
                                  <p className="text-sm font-medium mb-2">{doc.documentType}</p>
                                  <p className="text-xs text-muted-foreground mb-2">
                                    Matched {matched.length} of {allTerms} expected keywords (threshold: {threshold}%)
                                  </p>
                                  <div className="space-y-1.5">
                                    {Object.entries(scores).sort(([,a], [,b]) => (b as number) - (a as number)).map(([keyword, score]) => {
                                      const isMatched = (score as number) >= threshold;
                                      const contribution = Math.min((score as number) / 100 * 15, 15); // Max 15% contribution per keyword
                                      return (
                                        <div key={keyword} className="flex items-center gap-2 text-xs">
                                          {(score as number) >= threshold ? (
                                            <TrendingUp className="size-3 text-green-600 flex-shrink-0" />
                                          ) : (score as number) >= 50 ? (
                                            <TrendingUp className="size-3 text-amber-500 flex-shrink-0" />
                                          ) : (
                                            <TrendingDown className="size-3 text-red-500 flex-shrink-0" />
                                          )}
                                          <span className="w-24 truncate flex-shrink-0" title={keyword}>{keyword}</span>
                                          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden min-w-[60px]">
                                            <div
                                              className={`h-full rounded-full ${
                                                (score as number) >= threshold ? "bg-green-500" :
                                                (score as number) >= 50 ? "bg-amber-400" :
                                                "bg-red-400"
                                              }`}
                                              style={{ width: `${Math.min((score as number) / 100 * 100, 100)}%` }}
                                            />
                                          </div>
                                          <span className={`w-10 text-right font-medium whitespace-nowrap ${
                                            (score as number) >= threshold ? "text-green-600" :
                                            (score as number) >= 50 ? "text-amber-500" :
                                            "text-red-500"
                                          }`}>
                                            {Math.round(score as number)}%
                                          </span>
                                          <span className="text-muted-foreground whitespace-nowrap">
                                            {isMatched ? "✓ matched" : "✗ not matched"}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Legend */}
                      <div className="flex items-center gap-4 text-xs">
                        <div className="flex items-center gap-1">
                          <div className="size-3 rounded-full bg-green-500" />
                          <span className="text-muted-foreground">High (≥70%)</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="size-3 rounded-full bg-amber-400" />
                          <span className="text-muted-foreground">Medium (≥40%)</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="size-3 rounded-full bg-red-400" />
                          <span className="text-muted-foreground">Low (&lt;40%)</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : null}

            {/* Save all document statuses */}
            {app.submittedDocuments && app.submittedDocuments.length > 0 && (
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    app.submittedDocuments?.forEach((_, idx) => saveDocumentStatus(idx));
                  }}
                  disabled={isUpdating}
                >
                  Save All Document Changes
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 4 - Admin Decision Panel */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Admin Decision Panel</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Admin Notes</Label>
              <Textarea
                placeholder="Internal notes about this application..."
                className="mt-1"
                rows={3}
              />
            </div>

            <div className="flex gap-3 flex-wrap">
              {/* Qualify - GREEN */}
              {(app.status === "System Qualified" || app.status === "Under Review") && (
                <Button className="bg-green-600 hover:bg-green-700" onClick={handleQualify} disabled={isUpdating}>
                  <CheckCircle className="size-4 mr-1" /> Qualify for Final Screening
                </Button>
              )}

              {/* Approve - BLUE */}
              {(app.status === "Qualified for Final Screening") && (
                <Button className="bg-blue-600 hover:bg-blue-700" onClick={async () => {
                  try {
                    setIsUpdating(true);
                    await approveApplication(app._id);
                    await fetchReview();
                    alert("Application approved successfully. Student notified.");
                  } catch (err) {
                    console.error(err);
                    alert("Failed to approve.");
                  } finally {
                    setIsUpdating(false);
                  }
                }} disabled={isUpdating}>
                  <CheckCircle className="size-4 mr-1" /> Approve Application
                </Button>
              )}

              {/* Reject - RED */}
              {(app.status !== "Approved" && app.status !== "Rejected") && (
                <Button variant="destructive" onClick={handleRejectClick} disabled={isUpdating}>
                  <XCircle className="size-4 mr-1" /> Reject Application
                </Button>
              )}

              {/* Resubmit - ORANGE */}
              {docsAnyRejected && (
                <Button
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                  onClick={handleResubmitClick}
                  disabled={isUpdating}
                >
                  <AlertTriangle className="size-4 mr-1" /> Request Resubmission
                </Button>
              )}
            </div>

            {/* Screening info if already scheduled */}
            {app.finalScreening?.scheduled && (
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 text-blue-700 font-medium">
                      <Video className="size-5" /> Video Interview Setup
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-blue-300 text-blue-800"
                      onClick={() => openScreeningScheduler(app.finalScreening)}
                      disabled={isUpdating}
                    >
                      <Calendar className="size-4 mr-1" /> Update details
                    </Button>
                  </div>
                  <div className="text-sm text-blue-800 space-y-1">
                    {app.finalScreening.googleDriveLink && (
                      <p>Google Drive Link: <a href={app.finalScreening.googleDriveLink} target="_blank" rel="noopener noreferrer" className="underline">{app.finalScreening.googleDriveLink}</a></p>
                    )}
                    <p>Submission Deadline: {app.finalScreening.submissionDeadline ? formatDate(app.finalScreening.submissionDeadline) : "TBD"}</p>
                    {app.finalScreening.notes && <p>Notes: {app.finalScreening.notes}</p>}
                  </div>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
        <Dialog open={showScheduler} onOpenChange={setShowScheduler}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Set up recorded video interview screening</DialogTitle>
              <DialogDescription>
                Provide the Google Drive upload link and submission deadline. The student will receive instructions via email.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label htmlFor="gdrive-link">Google Drive Upload Link *</Label>
                <Input
                  id="gdrive-link"
                  type="url"
                  placeholder="https://drive.google.com/..."
                  className="mt-1"
                  value={screeningForm.googleDriveLink}
                  onChange={(e) => setScreeningForm((f) => ({ ...f, googleDriveLink: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="submission-deadline">Video Submission Deadline *</Label>
                <Input
                  id="submission-deadline"
                  type="datetime-local"
                  className="mt-1"
                  value={screeningForm.submissionDeadline}
                  onChange={(e) => setScreeningForm((f) => ({ ...f, submissionDeadline: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="screening-notes">Message to student (optional)</Label>
                <Textarea
                  id="screening-notes"
                  placeholder="e.g., Please upload a 3-minute video introduction addressing the prompts sent to your dashboard."
                  className="mt-1"
                  rows={3}
                  value={screeningForm.notes}
                  onChange={(e) => setScreeningForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowScheduler(false)} disabled={isUpdating}>
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-green-600 hover:bg-green-700"
                onClick={handleScheduleScreening}
                disabled={isUpdating}
              >
                <CheckCircle className="size-4 mr-1" />
                {isUpdating ? "Saving..." : "Confirm & notify student"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Reject application</DialogTitle>
              <DialogDescription>Provide a reason. The student will be notified.</DialogDescription>
            </DialogHeader>
            <Textarea
              placeholder="Reason for rejection..."
              rows={4}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowRejectModal(false)} disabled={isUpdating}>
                Cancel
              </Button>
              <Button type="button" variant="destructive" onClick={handleConfirmReject} disabled={isUpdating || !rejectReason.trim()}>
                Reject application
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showResubmitModal} onOpenChange={setShowResubmitModal}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Request document resubmission</DialogTitle>
              <DialogDescription>The student will be asked to re-upload rejected documents.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {rejectedDocs.map((doc) => (
                <div key={doc.index} className="text-sm border rounded p-2">
                  <p className="font-medium">{doc.name}</p>
                  <Input
                    className="mt-1 h-8"
                    placeholder="Reason for this document..."
                    value={doc.reason}
                    onChange={(e) =>
                      setRejectedDocs((prev) =>
                        prev.map((d) => (d.index === doc.index ? { ...d, reason: e.target.value } : d))
                      )
                    }
                  />
                </div>
              ))}
              <div>
                <Label>Additional message (optional)</Label>
                <Textarea
                  className="mt-1"
                  rows={2}
                  value={resubmitReason}
                  onChange={(e) => setResubmitReason(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowResubmitModal(false)} disabled={isUpdating}>
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-orange-500 hover:bg-orange-600"
                onClick={handleConfirmResubmit}
                disabled={isUpdating}
              >
                Send resubmission request
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return null;
}

