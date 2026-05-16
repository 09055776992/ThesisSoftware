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
import { CheckCircle, XCircle, Clock, ShieldCheck, Eye, Download, FileText, AlertTriangle, CheckSquare, AlertCircle, ArrowLeft, ChevronRight, Calendar, ExternalLink, Search, FileSpreadsheet, Video } from "lucide-react";
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
}

interface ScreeningData {
  scheduled: boolean;
  scheduledDate?: string;
  scheduledTime?: string;
  meetingPlatform?: string;
  meetingLink?: string;
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
  submittedDocuments?: SubmittedDocument[];
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

  // Review page
  const [reviewApplication, setReviewApplication] = useState<Application | null>(null);
  const [documentStatuses, setDocumentStatuses] = useState<Record<string, { status: string; reason: string }>>({});

  // Modals
  const [showScheduler, setShowScheduler] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showResubmitModal, setShowResubmitModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [resubmitReason, setResubmitReason] = useState("");
  const [rejectedDocs, setRejectedDocs] = useState<Array<{ index: number; name: string; reason: string }>>([]);
  const [isUpdating, setIsUpdating] = useState(false);

  // Screening form
  const [screeningForm, setScreeningForm] = useState({
    scheduledDate: "",
    scheduledTime: "",
    meetingPlatform: "Google Meet",
    meetingLink: "",
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

      // Init document statuses
      const statuses: Record<string, { status: string; reason: string }> = {};
      if (data.submittedDocuments) {
        data.submittedDocuments.forEach((doc: any, idx: number) => {
          statuses[String(idx)] = {
            status: doc.status || "pending_review",
            reason: doc.rejectionReason || "",
          };
        });
      }
      setDocumentStatuses(statuses);
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
      scheduledDate: existing?.scheduledDate
        ? new Date(existing.scheduledDate).toISOString().slice(0, 10)
        : "",
      scheduledTime: existing?.scheduledTime || "",
      meetingPlatform: existing?.meetingPlatform || "Google Meet",
      meetingLink: existing?.meetingLink || "",
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
    if (!screeningForm.scheduledDate || !screeningForm.scheduledTime || !screeningForm.meetingLink.trim()) {
      alert("Please enter the screening date, time, and virtual meeting link.");
      return;
    }
    const link = screeningForm.meetingLink.trim();
    if (!/^https?:\/\//i.test(link)) {
      alert("Meeting link must start with http:// or https://");
      return;
    }
    try {
      setIsUpdating(true);
      await qualifyApplication(reviewApplication._id, {
        ...screeningForm,
        meetingLink: link,
        notes: screeningForm.notes.trim(),
      });
      setShowScheduler(false);
      await fetchReview();
      alert("Student qualified for final screening. Virtual meeting details were sent to the student.");
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

  const docsVerified = reviewApplication?.submittedDocuments?.every((d) => d.status === "verified") ?? false;
  const docsSomePending = reviewApplication?.submittedDocuments?.some((d) => d.status === "pending_review" || d.status === "uploaded") ?? false;
  const docsAnyRejected = reviewApplication?.submittedDocuments?.some((d) => d.status === "rejected") ?? false;

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
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
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
                          View Applicants <ChevronRight className="h-4 w-4 ml-1" />
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
        <div className="flex items-center gap-4 mb-2">
          <Button variant="ghost" size="sm" onClick={() => setViewMode("scholarships")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{selectedScholarshipName}</h1>
            <p className="text-muted-foreground">{applicants.length} total applicants</p>
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <FileSpreadsheet className="h-4 w-4 mr-1" /> Export to Excel
            </Button>
          </div>
        </div>

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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
                            <Avatar className="h-8 w-8">
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
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Applicants
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
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
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
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
                  <div><span className="text-muted-foreground">GPA:</span> <span className="font-medium">{student.gwa || student.GWA}</span></div>
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

        {/* Section 3 - Submitted Documents */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Submitted Documents</CardTitle>
              {app.submittedDocuments && app.submittedDocuments.length > 0 && (
                <Badge variant={docsVerified ? "default" : docsAnyRejected ? "destructive" : "secondary"} className={docsVerified ? "bg-green-600" : docsAnyRejected ? "" : "bg-amber-500"}>
                  {docsVerified ? "All Verified" : docsAnyRejected ? "Rejected" : "Pending"}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Documents Status Banner */}
            {app.submittedDocuments && app.submittedDocuments.length > 0 && (
              <div className={`p-3 rounded-lg text-sm font-medium ${
                docsVerified ? "bg-green-50 text-green-700 border border-green-200" :
                docsAnyRejected ? "bg-red-50 text-red-700 border border-red-200" :
                "bg-amber-50 text-amber-700 border border-amber-200"
              }`}>
                {docsVerified && "All Documents Verified ✓"}
                {docsSomePending && !docsAnyRejected && "Documents Under Review ⏳"}
                {docsAnyRejected && "Some Documents Rejected ✗"}
              </div>
            )}

            {(!app.submittedDocuments || app.submittedDocuments.length === 0) ? (
              <p className="text-muted-foreground text-sm py-4">No documents submitted.</p>
            ) : (
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
                  {app.submittedDocuments.map((doc, idx) => {
                    const docStatus = documentStatuses[String(idx)]?.status || doc.status;
                    const docReason = documentStatuses[String(idx)]?.reason || doc.rejectionReason || "";

                    return (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{doc.documentType}</TableCell>
                        <TableCell className="text-sm">
                          <div>{doc.fileName}</div>
                          <div className="text-xs text-muted-foreground">{formatFileSize(doc.fileSize)}</div>
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
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(getDocumentUrl(doc.filePath), "_blank")}
                            >
                              <Eye className="h-4 w-4" />
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
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}

            {/* Rejection reasons and save buttons */}
            {app.submittedDocuments?.map((doc, idx) => {
              const docStatus = documentStatuses[String(idx)]?.status || doc.status;
              const docReason = documentStatuses[String(idx)]?.reason || doc.rejectionReason || "";
              if (docStatus !== "rejected") return null;
              return (
                <div key={idx} className="flex items-start gap-2 pl-2">
                  <Input
                    placeholder="Reason for rejection..."
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

            {/* Save all document statuses */}
            {app.submittedDocuments && app.submittedDocuments.length > 0 && (
              <div className="flex gap-2 pt-2">
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
                  <CheckCircle className="h-4 w-4 mr-1" /> Qualify for Final Screening
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
                  <CheckCircle className="h-4 w-4 mr-1" /> Approve Application
                </Button>
              )}

              {/* Reject - RED */}
              {(app.status !== "Approved" && app.status !== "Rejected") && (
                <Button variant="destructive" onClick={handleRejectClick} disabled={isUpdating}>
                  <XCircle className="h-4 w-4 mr-1" /> Reject Application
                </Button>
              )}

              {/* Resubmit - ORANGE */}
              {docsAnyRejected && (
                <Button
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                  onClick={handleResubmitClick}
                  disabled={isUpdating}
                >
                  <AlertTriangle className="h-4 w-4 mr-1" /> Request Resubmission
                </Button>
              )}
            </div>

            {/* Screening info if already scheduled */}
            {app.finalScreening?.scheduled && (
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 text-blue-700 font-medium">
                      <Video className="h-5 w-5" /> Virtual Screening Scheduled
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-blue-300 text-blue-800"
                      onClick={() => openScreeningScheduler(app.finalScreening)}
                      disabled={isUpdating}
                    >
                      <Calendar className="h-4 w-4 mr-1" /> Update meeting details
                    </Button>
                  </div>
                  <div className="text-sm text-blue-800 space-y-1">
                    <p>Date: {app.finalScreening.scheduledDate ? formatDate(app.finalScreening.scheduledDate) : "TBD"}</p>
                    <p>Time: {app.finalScreening.scheduledTime || "TBD"}</p>
                    <p>Platform: {app.finalScreening.meetingPlatform || "TBD"}</p>
                    {app.finalScreening.meetingLink && (
                      <p>Link: <a href={app.finalScreening.meetingLink} target="_blank" rel="noopener noreferrer" className="underline">{app.finalScreening.meetingLink}</a></p>
                    )}
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
              <DialogTitle>Schedule final virtual screening</DialogTitle>
              <DialogDescription>
                Enter the exact date, time, and meeting link. The student will receive these details by notification.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="screening-date">Screening date *</Label>
                  <Input
                    id="screening-date"
                    type="date"
                    className="mt-1"
                    value={screeningForm.scheduledDate}
                    onChange={(e) => setScreeningForm((f) => ({ ...f, scheduledDate: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="screening-time">Screening time *</Label>
                  <Input
                    id="screening-time"
                    type="time"
                    className="mt-1"
                    value={screeningForm.scheduledTime}
                    onChange={(e) => setScreeningForm((f) => ({ ...f, scheduledTime: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="screening-platform">Platform</Label>
                <Select
                  value={screeningForm.meetingPlatform}
                  onValueChange={(v) => setScreeningForm((f) => ({ ...f, meetingPlatform: v }))}
                >
                  <SelectTrigger id="screening-platform" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Google Meet">Google Meet</SelectItem>
                    <SelectItem value="Zoom">Zoom</SelectItem>
                    <SelectItem value="Microsoft Teams">Microsoft Teams</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="screening-link">Virtual meeting link *</Label>
                <Input
                  id="screening-link"
                  type="url"
                  placeholder="https://meet.google.com/..."
                  className="mt-1"
                  value={screeningForm.meetingLink}
                  onChange={(e) => setScreeningForm((f) => ({ ...f, meetingLink: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="screening-notes">Message to student (optional)</Label>
                <Textarea
                  id="screening-notes"
                  placeholder="e.g. Please join 5 minutes early with your original documents ready."
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
                <CheckCircle className="h-4 w-4 mr-1" />
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
