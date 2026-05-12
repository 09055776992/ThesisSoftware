import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import { Separator } from "../../components/ui/separator";
import { CheckCircle, XCircle, Clock, ShieldCheck, Filter, Eye, Download, FileText, AlertTriangle, CheckSquare, AlertCircle } from "lucide-react";
import { fetchAdminApplications, approveApplication, rejectApplication, reviewApplication, updateDocumentStatus } from "../../lib/api-client";

interface CriteriaCheck {
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
}

interface EligibilityCheck {
  passed: boolean;
  checkedAt: string;
  unmetCriteria: string[];
  metCriteria: string[];
  criteriaChecks?: Record<string, CriteriaCheck>;
}

interface SubmittedDocument {
  documentType: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
  status: "uploaded" | "pending_review" | "verified" | "rejected";
  rejectionReason?: string;
}

interface Application {
  _id: string;
  studentName: string;
  studentEmail: string;
  scholarshipName: string;
  scholarshipAmount?: number;
  submittedAt: string;
  status: string;
  matchScore: number;
  eligibilityCheck?: EligibilityCheck;
  submittedDocuments?: SubmittedDocument[];
  finalReview?: {
    reviewedBy?: string;
    reviewedAt?: string;
    notes?: string;
  };
}

interface Stats {
  pending: number;
  systemQualified: number;
  needsReview: number;
  underReview: number;
  approved: number;
  rejected: number;
}

type FilterTab = "all" | "needs-review" | "under-review" | "approved" | "rejected";

export function AdminApplications() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [stats, setStats] = useState<Stats>({
    pending: 0,
    systemQualified: 0,
    needsReview: 0,
    underReview: 0,
    approved: 0,
    rejected: 0,
  });
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("needs-review");
  
  // Selected application for detailed view
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [documentStatuses, setDocumentStatuses] = useState<Record<string, { status: string; reason: string }>>({});
  const [reviewNotes, setReviewNotes] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    fetchApplications();
  }, [activeFilter]);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const filter = activeFilter === "needs-review" ? { filter: "needs-review" } :
                      activeFilter === "under-review" ? { status: "Under Review" } :
                      activeFilter === "approved" ? { status: "Approved" } :
                      activeFilter === "rejected" ? { status: "Rejected" } :
                      {};

      const result = await fetchAdminApplications(filter);
      setApplications((result.data as unknown as Application[] | undefined) || []);
      setStats({
        pending: result.stats?.pending || 0,
        systemQualified: result.stats?.systemQualified || 0,
        needsReview: result.stats?.needsReview || 0,
        underReview: result.stats?.underReview || 0,
        approved: result.stats?.approved || 0,
        rejected: result.stats?.rejected || 0,
      });
    } catch (error) {
      console.error("Error fetching applications:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await approveApplication(id);
      fetchApplications();
    } catch (error) {
      console.error("Error approving application:", error);
    }
  };

  const handleReject = async (id: string) => {
    if (!confirm("Are you sure you want to reject this application?")) return;
    try {
      await rejectApplication(id);
      fetchApplications();
    } catch (error) {
      console.error("Error rejecting application:", error);
    }
  };

  const handleReview = async (id: string) => {
    try {
      await reviewApplication(id);
      fetchApplications();
    } catch (error) {
      console.error("Error moving application to review:", error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getInitials = (name: string) => {
    if (!name || typeof name !== 'string') return '??'
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "Approved":
        return "default";
      case "Under Review":
        return "secondary";
      case "System Qualified":
        return "outline";
      case "Pending":
        return "outline";
      case "Rejected":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case "System Qualified":
        return "Pre-Screened";
      case "Pending":
        return "Awaiting System Check";
      default:
        return status;
    }
  };

  const FilterButton = ({ value, label, count, icon: Icon }: { value: FilterTab; label: string; count: number; icon: React.ElementType }) => (
    <Button
      variant={activeFilter === value ? "default" : "outline"}
      className="flex items-center gap-2"
      onClick={() => setActiveFilter(value)}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
      <Badge variant={activeFilter === value ? "secondary" : "outline"} className="ml-1">
        {count}
      </Badge>
    </Button>
  );

  // Open application detail modal
  const openApplicationDetail = (application: Application) => {
    setSelectedApplication(application);
    
    // Initialize document statuses from application data
    const initialStatuses: Record<string, { status: string; reason: string }> = {};
    application.submittedDocuments?.forEach((doc) => {
      initialStatuses[doc.documentType] = {
        status: doc.status || "pending_review",
        reason: doc.rejectionReason || "",
      };
    });
    setDocumentStatuses(initialStatuses);
    setReviewNotes(application.finalReview?.notes || "");
    setIsDetailModalOpen(true);
  };

  // Close application detail modal
  const closeApplicationDetail = () => {
    setSelectedApplication(null);
    setIsDetailModalOpen(false);
    setDocumentStatuses({});
    setReviewNotes("");
  };

  // Update document status locally
  const handleDocumentStatusChange = (documentType: string, status: string) => {
    setDocumentStatuses((prev) => ({
      ...prev,
      [documentType]: {
        ...prev[documentType],
        status,
        reason: status === "rejected" ? prev[documentType]?.reason || "" : "",
      },
    }));
  };

  // Update document rejection reason
  const handleDocumentReasonChange = (documentType: string, reason: string) => {
    setDocumentStatuses((prev) => ({
      ...prev,
      [documentType]: {
        ...prev[documentType],
        reason,
      },
    }));
  };

  // Save document status changes
  const saveDocumentChanges = async () => {
    if (!selectedApplication) return;
    
    setIsUpdating(true);
    try {
      // Update each document status
      for (const [docType, statusInfo] of Object.entries(documentStatuses)) {
        await updateDocumentStatus(selectedApplication._id, docType, statusInfo.status, statusInfo.reason);
      }
      
      // Refresh applications
      await fetchApplications();
      
      // Update selected application with new statuses
      setSelectedApplication((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          submittedDocuments: prev.submittedDocuments?.map((doc) => ({
            ...doc,
            status: (documentStatuses[doc.documentType]?.status as SubmittedDocument["status"]) || doc.status,
            rejectionReason: documentStatuses[doc.documentType]?.reason || doc.rejectionReason,
          })),
        };
      });
    } catch (error) {
      console.error("Error updating document statuses:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  // Get document status summary
  const getDocumentStatusSummary = () => {
    if (!selectedApplication?.submittedDocuments?.length) {
      return { allVerified: false, anyRejected: false, total: 0, verified: 0, rejected: 0, pending: 0 };
    }

    const statuses = selectedApplication.submittedDocuments.map((doc) =>
      documentStatuses[doc.documentType]?.status || doc.status || "pending_review"
    );

    const verified = statuses.filter((s) => s === "verified").length;
    const rejected = statuses.filter((s) => s === "rejected").length;
    const pending = statuses.filter((s) => s === "pending_review" || s === "uploaded").length;

    return {
      allVerified: verified === statuses.length && statuses.length > 0,
      anyRejected: rejected > 0,
      total: statuses.length,
      verified,
      rejected,
      pending,
    };
  };

  // Check if can approve (all required documents verified)
  const canApprove = () => {
    const summary = getDocumentStatusSummary();
    return summary.allVerified && !summary.anyRejected;
  };

  // Handle view file
  const handleViewFile = (filePath: string) => {
    // Open file in new tab
    window.open(`/uploads/${filePath.replace(/^.*uploads[\\/]/, "")}`, "_blank");
  };

  // Handle download file
  const handleDownloadFile = (filePath: string, fileName: string) => {
    const link = document.createElement("a");
    link.href = `/uploads/${filePath.replace(/^.*uploads[\\/]/, "")}`;
    link.download = fileName;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Handle approve with document check
  const handleApproveWithCheck = async () => {
    if (!selectedApplication) return;
    
    if (!canApprove()) {
      alert("Cannot approve: All required documents must be verified first.");
      return;
    }
    
    await handleApprove(selectedApplication._id);
    closeApplicationDetail();
  };

  // Handle reject with document check
  const handleRejectWithCheck = async () => {
    if (!selectedApplication) return;
    
    const summary = getDocumentStatusSummary();
    if (summary.anyRejected && confirm("This application has rejected documents and will be marked as 'Needs Resubmission'. Continue?")) {
      // Update application status to Needs Resubmission
      await rejectApplication(selectedApplication._id);
      closeApplicationDetail();
    } else if (!summary.anyRejected) {
      if (confirm("Are you sure you want to reject this application?")) {
        await rejectApplication(selectedApplication._id);
        closeApplicationDetail();
      }
    }
  };

  if (loading) {
    return <div className="p-8">Loading applications...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Application Review</h1>
        <p className="text-muted-foreground">Review and process scholarship applications</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Needs Review</p>
                <p className="text-3xl font-bold font-mono">{stats.needsReview}</p>
              </div>
              <ShieldCheck className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Under Review</p>
                <p className="text-3xl font-bold font-mono">{stats.underReview}</p>
              </div>
              <Clock className="h-8 w-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-3xl font-bold font-mono">{stats.approved}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Rejected</p>
                <p className="text-3xl font-bold font-mono">{stats.rejected}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-3xl font-bold font-mono">{stats.pending}</p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        <FilterButton value="all" label="All" count={stats.pending + stats.needsReview + stats.underReview + stats.approved + stats.rejected} icon={Filter} />
        <FilterButton value="needs-review" label="Needs Review" count={stats.needsReview} icon={ShieldCheck} />
        <FilterButton value="under-review" label="Under Review" count={stats.underReview} icon={Clock} />
        <FilterButton value="approved" label="Approved" count={stats.approved} icon={CheckCircle} />
        <FilterButton value="rejected" label="Rejected" count={stats.rejected} icon={XCircle} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              {activeFilter === "needs-review" && "Applications Waiting for Staff Review"}
              {activeFilter === "under-review" && "Applications Under Staff Review"}
              {activeFilter === "approved" && "Approved Applications"}
              {activeFilter === "rejected" && "Rejected Applications"}
              {activeFilter === "all" && "All Applications"}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Scholarship</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Pre-Screened</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No applications found for this filter.
                  </TableCell>
                </TableRow>
              ) : (
                applications.map((app) => (
                  <TableRow key={app._id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>{getInitials(app.studentName)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <span className="font-semibold">{app?.studentName || 'Unknown Student'}</span>
                          <p className="text-sm text-muted-foreground">{app?.studentEmail || 'No email'}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{app.scholarshipName}</TableCell>
                    <TableCell>{formatDate(app.submittedAt)}</TableCell>
                    <TableCell>
                      {app.eligibilityCheck?.checkedAt ? (
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            <ShieldCheck className="h-3 w-3 mr-1" />
                            Passed
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(app.eligibilityCheck.checkedAt)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(app.status)}>
                        {getStatusDisplay(app.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="outline" onClick={() => openApplicationDetail(app)}>View</Button>
                        {app.status === "System Qualified" && (
                          <Button size="sm" variant="outline" onClick={() => handleReview(app._id)}>
                            Start Review
                          </Button>
                        )}
                        {(app.status === "System Qualified" || app.status === "Under Review") ? (
                          <>
                            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleApprove(app._id)}>
                              Approve
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleReject(app._id)}>
                              Reject
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Application Detail Modal */}
      <Dialog open={isDetailModalOpen} onOpenChange={(open) => !open && closeApplicationDetail()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedApplication && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <DialogTitle className="text-xl">Application Details</DialogTitle>
                    <DialogDescription>
                      Review eligibility and submitted documents
                    </DialogDescription>
                  </div>
                  <Badge variant={getStatusBadgeVariant(selectedApplication.status)} className="text-base px-3 py-1">
                    {getStatusDisplay(selectedApplication.status)}
                  </Badge>
                </div>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* Student Info */}
                <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                  <Avatar className="h-16 w-16">
                    <AvatarFallback className="text-lg">{getInitials(selectedApplication.studentName)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold text-lg">{selectedApplication?.studentName || 'Unknown Student'}</h3>
                    <p className="text-sm text-gray-500">{selectedApplication?.studentEmail || 'No email'}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Submitted: {formatDateTime(selectedApplication.submittedAt)}
                    </p>
                    <p className="text-sm text-gray-500">
                      Match Score: <span className="font-semibold">{selectedApplication.matchScore}%</span>
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Scholarship Info */}
                <div>
                  <h4 className="font-semibold mb-2">Scholarship</h4>
                  <p className="text-lg">{selectedApplication.scholarshipName}</p>
                  {selectedApplication.scholarshipAmount && (
                    <p className="text-2xl font-bold text-primary">
                      ₱{Number(selectedApplication.scholarshipAmount).toLocaleString()}
                    </p>
                  )}
                </div>

                <Separator />

                {/* Eligibility Pre-screening Panel */}
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-blue-600" />
                    Eligibility Pre-Screening Results
                  </h4>
                  <div className="space-y-2">
                    {selectedApplication.eligibilityCheck?.criteriaChecks ? (
                      Object.entries(selectedApplication.eligibilityCheck.criteriaChecks).map(([key, check]) => (
                        <div key={key} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                          {check.passed ? (
                            <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                          )}
                          <div>
                            <p className="font-medium text-sm">{check.label}</p>
                            <p className="text-xs text-gray-500">{check.message}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500 italic">No detailed eligibility checks available</p>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Document Status Summary */}
                {selectedApplication.submittedDocuments && selectedApplication.submittedDocuments.length > 0 && (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    {(() => {
                      const summary = getDocumentStatusSummary();
                      return (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-gray-600" />
                            <span className="font-medium">Document Status</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {summary.allVerified ? (
                              <Badge className="bg-green-100 text-green-700">
                                <CheckSquare className="h-3 w-3 mr-1" />
                                Documents Complete
                              </Badge>
                            ) : summary.anyRejected ? (
                              <Badge className="bg-red-100 text-red-700">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Action Required
                              </Badge>
                            ) : (
                              <Badge className="bg-yellow-100 text-yellow-700">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Incomplete ({summary.verified}/{summary.total})
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                <Separator />

                {/* Submitted Documents Panel */}
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    Submitted Documents
                  </h4>
                  {selectedApplication.submittedDocuments && selectedApplication.submittedDocuments.length > 0 ? (
                    <div className="space-y-3">
                      {selectedApplication.submittedDocuments.map((doc, idx) => (
                        <div key={idx} className="border rounded-lg p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <p className="font-medium">{doc.documentType}</p>
                              <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                                <span>{doc.fileName}</span>
                                <span>{formatFileSize(doc.fileSize)}</span>
                                <span>Uploaded: {formatDateTime(doc.uploadedAt)}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewFile(doc.filePath)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                View
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownloadFile(doc.filePath, doc.fileName)}
                              >
                                <Download className="h-4 w-4 mr-1" />
                                Download
                              </Button>
                            </div>
                          </div>
                          
                          {/* Document Status Dropdown */}
                          <div className="mt-3 flex items-start gap-4">
                            <div className="flex-1">
                              <label className="text-sm font-medium block mb-1">Status</label>
                              <Select
                                value={documentStatuses[doc.documentType]?.status || doc.status || "pending_review"}
                                onValueChange={(value) => handleDocumentStatusChange(doc.documentType, value)}
                              >
                                <SelectTrigger className="w-48">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending_review">Pending Review</SelectItem>
                                  <SelectItem value="verified">Verified ✓</SelectItem>
                                  <SelectItem value="rejected">Rejected ✗</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            
                            {/* Rejection Reason (only shown when rejected) */}
                            {(documentStatuses[doc.documentType]?.status || doc.status) === "rejected" && (
                              <div className="flex-1">
                                <label className="text-sm font-medium block mb-1">Rejection Reason</label>
                                <Textarea
                                  placeholder="Enter reason for rejection..."
                                  value={documentStatuses[doc.documentType]?.reason || doc.rejectionReason || ""}
                                  onChange={(e) => handleDocumentReasonChange(doc.documentType, e.target.value)}
                                  className="min-h-[80px]"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      
                      {/* Save Document Changes Button */}
                      <Button 
                        onClick={saveDocumentChanges} 
                        disabled={isUpdating}
                        className="w-full"
                      >
                        {isUpdating ? "Saving..." : "Save Document Status Changes"}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">No documents submitted</p>
                  )}
                </div>

                <Separator />

                {/* Review Notes */}
                <div>
                  <h4 className="font-semibold mb-2">Review Notes</h4>
                  <Textarea
                    placeholder="Add your review notes here..."
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    className="min-h-[100px]"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex justify-between items-center pt-4">
                  <Button variant="outline" onClick={closeApplicationDetail}>
                    Close
                  </Button>
                  <div className="flex gap-2">
                    {selectedApplication.status !== "Approved" && selectedApplication.status !== "Rejected" && (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => handleReview(selectedApplication._id)}
                          disabled={selectedApplication.status === "Under Review"}
                        >
                          <Clock className="h-4 w-4 mr-1" />
                          Mark Under Review
                        </Button>
                        <Button
                          className="bg-green-600 hover:bg-green-700"
                          onClick={handleApproveWithCheck}
                          disabled={!canApprove()}
                          title={!canApprove() ? "All documents must be verified before approval" : ""}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={handleRejectWithCheck}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
