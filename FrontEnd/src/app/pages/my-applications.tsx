import { useEffect, useState } from "react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/ui/tooltip";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { FileText, Calendar, ExternalLink, Award, AlertCircle, CheckCircle, Clock, XCircle, Trophy, Brain, TrendingUp, TrendingDown, Info, RefreshCw } from "lucide-react";
import {
  fetchMyApplications,
  fetchMyScore,
  fetchStudentScholarshipRenewals,
  submitScholarshipRenewal,
  type MyScoreResponse,
  type ScholarshipRenewal,
  type ShapContribution,
} from "../lib/api-client";
import { ApplicationStatusTracker } from "../components/ApplicationStatusTracker";
import { getStoredUser } from "../lib/user-storage";
import { useNavigate } from "react-router";

interface Application {
  _id: string;
  referenceNumber: string;
  studentEmail: string;
  scholarshipId: string;
  scholarshipName: string;
  status: string;
  submittedAt: string;
  matchScore: number;
  stage?: "initial" | "accepted" | "completed";
  submittedDocuments?: Array<{
    documentType: string;
    fileName: string;
    status: string;
    rejectionReason?: string;
  }>;
  finalScreening?: {
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
  };
  rejectionReason?: string;
  resubmissionReason?: string;
  scholarshipData?: {
    name: string;
    provider: string;
    imageUrl: string;
    type: string;
    amount: number;
    renewalPeriodOpen?: boolean;
    renewalPeriodNumber?: number;
  };
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  "System Qualified": { label: "System Qualified", color: "text-blue-700 dark:text-blue-300", bg: "bg-blue-100 dark:bg-blue-950/50" },
  "Pending": { label: "Pending", color: "text-yellow-700 dark:text-yellow-300", bg: "bg-yellow-100 dark:bg-yellow-950/50" },
  "Under Review": { label: "Under Review", color: "text-orange-700 dark:text-orange-300", bg: "bg-orange-100 dark:bg-orange-950/50" },
  "Qualified for Final Screening": { label: "Qualified for Final Screening", color: "text-green-700 dark:text-green-300", bg: "bg-green-100 dark:bg-green-950/50" },
  "Approved": { label: "Approved 🏆", color: "text-emerald-800 dark:text-emerald-300", bg: "bg-emerald-200 dark:bg-emerald-950/50" },
  "Rejected": { label: "Rejected", color: "text-red-700 dark:text-red-300", bg: "bg-red-100 dark:bg-red-950/50" },
  "Needs Resubmission": { label: "Needs Resubmission", color: "text-orange-700 dark:text-orange-300", bg: "bg-orange-100 dark:bg-orange-950/50" },
};

/**
 * Derives the display status badge directly from the application's progress
 * stage — so the badge always matches the active step in the timeline.
 *
 * Step mapping (mirrors ApplicationStatusTracker.getCurrentStep):
 *   -1 → Rejected
 *    1 → Application Submitted
 *    2 → Under Evaluation
 *    3 → Qualified for Final Screening
 *    4 → Slot Secured & Awarded
 */
function getProgressStatus(app: Application): { label: string; color: string; bg: string } {
  const { status, stage } = app;

  if (status === "Rejected") {
    return { label: "Rejected", color: "text-red-700 dark:text-red-300", bg: "bg-red-100 dark:bg-red-950/50" };
  }
  if (status === "Approved") {
    return { label: "Slot Secured & Awarded 🏆", color: "text-emerald-800 dark:text-emerald-300", bg: "bg-emerald-100 dark:bg-emerald-950/50" };
  }
  if (status === "Qualified for Final Screening") {
    return { label: "Qualified for Final Screening", color: "text-green-700 dark:text-green-300", bg: "bg-green-100 dark:bg-green-950/50" };
  }
  if (status === "Under Review" || status === "System Qualified") {
    return { label: "Under Evaluation", color: "text-blue-700 dark:text-blue-300", bg: "bg-blue-100 dark:bg-blue-950/50" };
  }
  if (status === "Needs Resubmission") {
    return { label: "Needs Resubmission", color: "text-orange-700 dark:text-orange-300", bg: "bg-orange-100 dark:bg-orange-950/50" };
  }
  if (status === "Action Required: Submit Specific Requirements" || (status === "Pending" && stage === "accepted")) {
    return { label: "Qualified for Final Screening", color: "text-green-700 dark:text-green-300", bg: "bg-green-100 dark:bg-green-950/50" };
  }
  // Default: step 1 — submitted, awaiting review
  return { label: "Application Submitted", color: "text-yellow-700 dark:text-yellow-300", bg: "bg-yellow-100 dark:bg-yellow-950/50" };
}

const defaultScholarshipImage = "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=600&q=80";

export function MyApplications() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [myScore, setMyScore] = useState<MyScoreResponse | null>(null);
  const [scoreLoading, setScoreLoading] = useState(false);
  const [matchScoreDialogOpen, setMatchScoreDialogOpen] = useState(false);
  const [renewals, setRenewals] = useState<ScholarshipRenewal[]>([]);
  const [renewalDialogApp, setRenewalDialogApp] = useState<Application | null>(null);
  const [registrationCard, setRegistrationCard] = useState<File | null>(null);
  const [previousSemesterGrades, setPreviousSemesterGrades] = useState<File | null>(null);
  const [renewalError, setRenewalError] = useState("");
  const [renewalLoadError, setRenewalLoadError] = useState("");
  const [renewalSubmitting, setRenewalSubmitting] = useState(false);
  const navigate = useNavigate();
  const user = getStoredUser();

  useEffect(() => {
    if (user?.email) {
      fetchMyApplications(user.email)
        .then((result: any) => {
          setApplications(result.data || []);
        })
        .catch((err) => {
          console.error("Failed to fetch applications:", err);
        })
        .finally(() => setLoading(false));
      fetchStudentScholarshipRenewals()
        .then((result) => setRenewals(result.data || []))
        .catch((err) => {
          setRenewalLoadError(err instanceof Error ? err.message : "Failed to load renewal status.");
        });
    }
  }, [user?.email]);

  const getRenewalForApplication = (app: Application) =>
    renewals.find((renewal) =>
      renewal.originalApplicationId === app._id &&
      renewal.renewalPeriodNumber === app.scholarshipData?.renewalPeriodNumber
    );

  const handleRenewalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewalDialogApp || !registrationCard || !previousSemesterGrades) {
      setRenewalError("Upload both required documents to continue.");
      return;
    }

    setRenewalSubmitting(true);
    setRenewalError("");
    try {
      const result = await submitScholarshipRenewal(
        renewalDialogApp._id,
        registrationCard,
        previousSemesterGrades,
      );
      setRenewals((current) => [result.data, ...current]);
      setRenewalDialogApp(null);
      setRegistrationCard(null);
      setPreviousSemesterGrades(null);
    } catch (error) {
      setRenewalError(error instanceof Error ? error.message : "Failed to submit renewal.");
    } finally {
      setRenewalSubmitting(false);
    }
  };

  // Fetch score when modal opens
  const handleOpenModal = async (app: Application) => {
    setSelectedApp(app);
    setMyScore(null);
    setScoreLoading(true);
    try {
      const score = await fetchMyScore(app._id);
      setMyScore(score);
    } catch {
      // Score not available yet — that's fine
    } finally {
      setScoreLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="py-8 px-4">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">My Applications</h1>
          <p className="text-muted-foreground mb-8">Loading your applications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">My Applications</h1>
          <p className="text-muted-foreground">
            Track and monitor your scholarship applications
          </p>
        </div>

        {renewalLoadError && (
          <p role="alert" className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Renewal status could not be loaded: {renewalLoadError}
          </p>
        )}

        {applications.length === 0 ? (
          <Card className="p-12 text-center">
            <FileText className="size-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold mb-2">You haven't applied to any scholarships yet</h3>
            <p className="text-muted-foreground mb-6">
              Browse scholarships to find ones you qualify for
            </p>
            <Button onClick={() => navigate("/dashboard/scholarships")}>
              Browse Scholarships
            </Button>
          </Card>
        ) : (
          <div className="grid gap-6">
            {applications.map((app) => (
              <Card key={app._id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex flex-col md:flex-row">
                    <div className="h-48 md:h-auto md:w-48 shrink-0">
                      <img
                        src={app.scholarshipData?.imageUrl || defaultScholarshipImage}
                        alt={app.scholarshipName}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = defaultScholarshipImage;
                        }}
                      />
                    </div>
                    <div className="flex-1 p-6">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="text-xl font-bold mb-1">{app.scholarshipName}</h3>
                          <p className="text-muted-foreground text-sm mb-3">
                            {app.scholarshipData?.provider || "Quezon City Youth Development Office"}
                          </p>
                          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="size-4" />
                              Applied: {formatDate(app.submittedAt)}
                            </span>
                            <span className="flex items-center gap-1">
                              <FileText className="size-4" />
                              Ref: {app.referenceNumber || app._id.slice(-8).toUpperCase()}
                            </span>
                          </div>
                          {/* Status Tracker - Compact View */}
                          <div className="mt-4 pt-4 border-t border-gray-100">
                            <ApplicationStatusTracker
                              applicationStatus={app.status}
                              submittedAt={app.submittedAt}
                              finalScreening={app.finalScreening}
                              stage={app.stage}
                            />
                          </div>
                        </div>
                        <div className="flex flex-col items-start sm:items-end gap-3 sm:pl-4">
                          {(() => { const s = getProgressStatus(app); return (
                            <Badge className={`${s.bg} ${s.color}`}>{s.label}</Badge>
                          ); })()}
                          {(() => {
                            const renewal = getRenewalForApplication(app);
                            const canRenew = app.status === "Approved" && app.scholarshipData?.renewalPeriodOpen;
                            if (renewal?.status === "Rejected" && canRenew) {
                              return (
                                <div className="space-y-2 text-right">
                                  <Badge variant="destructive">Renewal Rejected</Badge>
                                  {renewal.reviewNote && (
                                    <p className="max-w-52 text-xs text-destructive">{renewal.reviewNote}</p>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setRenewalError("");
                                      setRenewalDialogApp(app);
                                    }}
                                  >
                                    <RefreshCw className="mr-2 size-4" />
                                    Resubmit Renewal
                                  </Button>
                                </div>
                              );
                            }
                            if (renewal) {
                              return (
                                <div className="text-right">
                                  <Badge variant={renewal.status === "Approved" ? "default" : "secondary"}>
                                    Renewal {renewal.status}
                                  </Badge>
                                  {renewal.status === "Rejected" && renewal.reviewNote && (
                                    <p className="mt-1 max-w-52 text-xs text-destructive">{renewal.reviewNote}</p>
                                  )}
                                </div>
                              );
                            }
                            if (canRenew) {
                              return (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setRenewalError("");
                                    setRenewalDialogApp(app);
                                  }}
                                >
                                  <RefreshCw className="mr-2 size-4" />
                                    Submit Renewal
                                </Button>
                              );
                            }
                            return null;
                          })()}
                          <Button size="sm" onClick={() => handleOpenModal(app)}>
                            View Details
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Application Details Modal */}
      <Dialog open={!!selectedApp} onOpenChange={() => setSelectedApp(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedApp && (
            <>
              <DialogHeader>
                <DialogTitle>Application Details</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-6 mt-4">
                {/* Scholarship Info */}
                <div className="flex gap-4">
                  <img
                    src={selectedApp.scholarshipData?.imageUrl || defaultScholarshipImage}
                    alt={selectedApp.scholarshipName}
                    className="size-20 rounded-lg object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = defaultScholarshipImage;
                    }}
                  />
                  <div>
                    <h3 className="text-lg font-bold">{selectedApp.scholarshipName}</h3>
                    <p className="text-muted-foreground text-sm">
                      {selectedApp.scholarshipData?.provider || "Quezon City Youth Development Office"}
                    </p>
                    <p className="text-sm mt-1">
                      {selectedApp.scholarshipData?.type} • ₱{Number(selectedApp.scholarshipData?.amount || 0).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Application Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Reference Number</p>
                    <p className="font-medium">{selectedApp.referenceNumber || selectedApp._id.slice(-8).toUpperCase()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Date Applied</p>
                    <p className="font-medium">{formatDate(selectedApp.submittedAt)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Match Score</p>
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium">{selectedApp.matchScore || 0}%</p>
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="text-muted-foreground hover:text-blue-600 transition-colors"
                              onClick={() => setMatchScoreDialogOpen(true)}
                              aria-label="How is this score calculated?"
                            >
                              <Info className="size-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[200px] text-xs">
                            Click to learn how this score is calculated
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    {(() => { const s = getProgressStatus(selectedApp); return (
                      <Badge className={`${s.bg} ${s.color}`}>{s.label}</Badge>
                    ); })()}
                  </div>
                </div>

                {/* Application Status Tracker */}
                <div className="bg-gray-50 dark:bg-slate-800/60 p-4 rounded-lg border border-gray-200 dark:border-slate-700">
                  <h4 className="font-semibold text-gray-800 dark:text-slate-100 mb-4">Application Progress</h4>
                  <ApplicationStatusTracker
                    applicationStatus={selectedApp.status}
                    submittedAt={selectedApp.submittedAt}
                    finalScreening={selectedApp.finalScreening}
                    stage={selectedApp.stage}
                  />
                </div>

                {/* Final Screening Details */}
                {selectedApp.status === "Qualified for Final Screening" && selectedApp.finalScreening && (
                  <div className="bg-green-50 dark:bg-green-950/30 p-4 rounded-lg border border-green-200 dark:border-green-800">
                    <h4 className="font-semibold text-green-800 dark:text-green-300 flex items-center gap-2 mb-3">
                      <Award className="size-4" />
                      Video Interview Submission
                    </h4>
                    <div className="space-y-2 text-sm text-gray-800 dark:text-slate-200">
                      {selectedApp.finalScreening.googleDriveLink && (
                        <p>
                          <span className="font-medium">🔗 Google Drive Upload Link:</span>{" "}
                          <a
                            href={selectedApp.finalScreening.googleDriveLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                          >
                            Upload Your Video <ExternalLink className="size-3" />
                          </a>
                        </p>
                      )}
                      <p>
                        <span className="font-medium">📅 Submission Deadline:</span>{" "}
                        {selectedApp.finalScreening.submissionDeadline
                          ? formatDate(selectedApp.finalScreening.submissionDeadline)
                          : "TBD"}
                      </p>
                      {selectedApp.finalScreening.notes && (
                        <p><span className="font-medium">📝 Instructions:</span> {selectedApp.finalScreening.notes}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Rejection Reason */}
                {selectedApp.status === "Rejected" && selectedApp.rejectionReason && (
                  <div className="bg-red-50 dark:bg-red-950/30 p-4 rounded-lg border border-red-200 dark:border-red-800">
                    <h4 className="font-semibold text-red-800 dark:text-red-300 flex items-center gap-2 mb-2">
                      <XCircle className="size-4" />
                      Rejection Reason
                    </h4>
                    <p className="text-sm text-red-700 dark:text-red-400">{selectedApp.rejectionReason}</p>
                  </div>
                )}

                {/* Resubmission Reason */}
                {selectedApp.status === "Needs Resubmission" && selectedApp.resubmissionReason && (
                  <div className="bg-orange-50 dark:bg-orange-950/30 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
                    <h4 className="font-semibold text-orange-800 dark:text-orange-300 flex items-center gap-2 mb-2">
                      <AlertCircle className="size-4" />
                      Resubmission Required
                    </h4>
                    <p className="text-sm text-orange-700 dark:text-orange-400">{selectedApp.resubmissionReason}</p>
                  </div>
                )}

                {/* AI Score Section */}
                {scoreLoading && (
                  <div className="bg-gray-50 dark:bg-slate-800/60 rounded-lg p-4 text-center text-sm text-muted-foreground">
                    <Brain className="size-5 inline mr-2 animate-pulse" />
                    Loading your score...
                  </div>
                )}

                {!scoreLoading && myScore && myScore.has_score && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 font-semibold text-base text-gray-900 dark:text-white">
                      <Trophy className="size-5 text-primary" />
                      Your Application Score
                    </div>

                    {/* Rank + Total Score */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-primary/5 dark:bg-primary/10 rounded-lg p-3 text-center border border-transparent dark:border-slate-700">
                        <p className="text-2xl font-bold font-mono text-primary">
                          #{myScore.rank}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          out of {myScore.total_applicants} applicants
                        </p>
                      </div>
                      <div className="bg-primary/5 dark:bg-primary/10 rounded-lg p-3 text-center border border-transparent dark:border-slate-700">
                        <p className="text-2xl font-bold font-mono text-primary">
                          {myScore.total_score?.toFixed(1)}
                        </p>
                        <p className="text-xs text-muted-foreground">Total Score / 100</p>
                      </div>
                    </div>

                    {/* Score breakdown bars */}
                    {myScore.score_breakdown && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">Score Breakdown</p>
                        {[
                          { label: "GWA", key: "gpa_score", weight: 30 },
                          { label: "Financial Need", key: "financial_score", weight: 25 },
                          { label: "Document Completeness", key: "document_completeness", weight: 20 },
                          { label: "Document Authenticity", key: "document_authenticity", weight: 15 },
                          { label: "Special Category", key: "special_category_score", weight: 10 },
                        ].map(({ label, key, weight }) => {
                          const score = (myScore.score_breakdown as any)[key] ?? 0;
                          const color = score >= 75 ? "bg-green-500" : score >= 50 ? "bg-amber-400" : "bg-red-400";
                          const textColor = score >= 75 ? "text-green-700 dark:text-green-400" : score >= 50 ? "text-amber-700 dark:text-amber-400" : "text-red-600 dark:text-red-400";
                          return (
                            <div key={key} className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-600 dark:text-slate-400">
                                  {label} <span className="opacity-60">({weight}%)</span>
                                </span>
                                <span className={`font-mono font-semibold ${textColor}`}>
                                  {score.toFixed(0)}/100
                                </span>
                              </div>
                              <div className="h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${color}`}
                                  style={{ width: `${score}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* SHAP explanation */}
                    {myScore.shap_explanation && (
                      <div className="bg-blue-50 dark:bg-blue-950/40 rounded-lg border border-blue-100 dark:border-blue-800 p-4 space-y-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-blue-800 dark:text-blue-200">
                          <Brain className="size-4" />
                          Why you received this score
                        </div>
                        <p className="text-sm text-blue-700 dark:text-blue-300 italic">
                          "{myScore.shap_explanation.summary}"
                        </p>
                        <div className="space-y-2">
                          {myScore.shap_explanation.contributions.map((c: ShapContribution) => (
                            <div key={c.factor} className="flex items-start gap-2 text-sm">
                              {c.impact === "positive"
                                ? <TrendingUp className="size-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                                : <TrendingDown className="size-4 text-red-500 dark:text-red-400 mt-0.5 flex-shrink-0" />
                              }
                              <div>
                                <span className="font-medium text-gray-800 dark:text-slate-100">{c.factor}</span>
                                <p className="text-xs text-gray-600 dark:text-slate-400">{c.explanation}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {!scoreLoading && myScore && !myScore.has_score && (
                  <div className="bg-gray-50 dark:bg-slate-800/60 rounded-lg p-4 text-sm text-muted-foreground text-center">
                    <Trophy className="size-5 inline mr-2 opacity-40" />
                    Rankings have not been generated yet for this scholarship.
                  </div>
                )}

                {/* Submitted Documents */}
                {selectedApp.submittedDocuments && selectedApp.submittedDocuments.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-3 text-gray-900 dark:text-white">Submitted Documents</h4>
                    <div className="space-y-2">
                      {selectedApp.submittedDocuments.map((doc, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg border border-transparent dark:border-slate-700">
                          <div className="flex items-center gap-2">
                            <FileText className="size-4 text-gray-500 dark:text-slate-400" />
                            <span className="text-sm text-gray-900 dark:text-slate-100">{doc.documentType}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {doc.status === "verified" && <Badge className="bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300 text-xs">Verified</Badge>}
                            {doc.status === "rejected" && <Badge className="bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300 text-xs">Rejected</Badge>}
                            {doc.status === "uploaded" && <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-300 text-xs">Uploaded</Badge>}
                            {doc.status === "pending" && <Badge className="bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-200 text-xs">Pending</Badge>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!renewalDialogApp}
        onOpenChange={(open) => {
          if (!open && !renewalSubmitting) {
            setRenewalDialogApp(null);
            setRenewalError("");
            setRegistrationCard(null);
            setPreviousSemesterGrades(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Submit Scholarship Renewal</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRenewalSubmit} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload your current-semester registration card and grades from the previous semester for{" "}
              <span className="font-medium text-foreground">{renewalDialogApp?.scholarshipName}</span>.
            </p>
            <label className="block space-y-2 text-sm font-medium">
              Current-semester registration card
              <input
                type="file"
                required
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(event) => setRegistrationCard(event.target.files?.[0] || null)}
                className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground"
              />
            </label>
            <label className="block space-y-2 text-sm font-medium">
              Grades from the previous semester
              <input
                type="file"
                required
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(event) => setPreviousSemesterGrades(event.target.files?.[0] || null)}
                className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground"
              />
            </label>
            <p className="text-xs text-muted-foreground">PDF, JPG, or PNG files up to 5 MB each.</p>
            {renewalError && <p role="alert" className="text-sm text-destructive">{renewalError}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setRenewalDialogApp(null)} disabled={renewalSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={renewalSubmitting || !registrationCard || !previousSemesterGrades}>
                {renewalSubmitting ? "Submitting..." : "Submit Renewal"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Match Score Explanation Dialog ─────────────────────────── */}
      <Dialog open={matchScoreDialogOpen} onOpenChange={setMatchScoreDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="size-4 text-blue-600" />
              How is your Match Score calculated?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm text-muted-foreground">
            <p>
              Your <span className="font-semibold text-foreground">Match Score of {selectedApp?.matchScore || 0}%</span> is
              calculated by SCHOLAR's <span className="font-semibold text-blue-600">TOPSIS engine</span> — a
              multi-criteria decision analysis algorithm that ranks your profile
              against each scholarship's requirements.
            </p>
            <div className="rounded-lg bg-muted/50 p-4 space-y-2.5">
              <p className="font-semibold text-foreground text-xs uppercase tracking-wide">Factors considered:</p>
              <div className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">📚</span>
                <div>
                  <p className="font-medium text-foreground">Academic Performance</p>
                  <p className="text-xs">Your GWA/GPA relative to the scholarship's minimum requirement.</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">💰</span>
                <div>
                  <p className="font-medium text-foreground">Financial Need</p>
                  <p className="text-xs">Your household income and financial status category.</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">✅</span>
                <div>
                  <p className="font-medium text-foreground">Eligibility Requirements</p>
                  <p className="text-xs">Course, residency, school type, and special categories (athlete, PWD, etc.).</p>
                </div>
              </div>
            </div>
            <p className="text-xs">
              A higher score means your profile is a stronger match for this scholarship.
              Scores of <span className="font-semibold text-green-600">80% and above</span> indicate high eligibility.
            </p>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}