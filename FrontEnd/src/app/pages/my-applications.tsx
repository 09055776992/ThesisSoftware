import { useEffect, useState } from "react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { FileText, Calendar, ExternalLink, Award, AlertCircle, CheckCircle, Clock, XCircle, Trophy, Brain, TrendingUp, TrendingDown } from "lucide-react";
import { fetchMyApplications, fetchMyScore, type MyScoreResponse, type ShapContribution } from "../lib/api-client";
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
  };
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  "System Qualified": { label: "System Qualified", color: "text-blue-700", bg: "bg-blue-100" },
  "Pending": { label: "Pending", color: "text-yellow-700", bg: "bg-yellow-100" },
  "Under Review": { label: "Under Review", color: "text-orange-700", bg: "bg-orange-100" },
  "Qualified for Final Screening": { label: "Qualified for Final Screening", color: "text-green-700", bg: "bg-green-100" },
  "Approved": { label: "Approved 🏆", color: "text-emerald-800", bg: "bg-emerald-200" },
  "Rejected": { label: "Rejected", color: "text-red-700", bg: "bg-red-100" },
  "Needs Resubmission": { label: "Needs Resubmission", color: "text-orange-700", bg: "bg-orange-100" },
};

const defaultScholarshipImage = "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=600&q=80";

export function MyApplications() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [myScore, setMyScore] = useState<MyScoreResponse | null>(null);
  const [scoreLoading, setScoreLoading] = useState(false);
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
    }
  }, [user?.email]);

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
          <h1 className="text-3xl font-bold mb-2">My Applications</h1>
          <p className="text-muted-foreground mb-8">Loading your applications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">My Applications</h1>
          <p className="text-muted-foreground">
            Track and monitor your scholarship applications
          </p>
        </div>

        {applications.length === 0 ? (
          <Card className="p-12 text-center">
            <FileText className="h-16 w-16 mx-auto mb-4 text-gray-300" />
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
                    <div className="md:w-48 h-48 shrink-0">
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
                              <Calendar className="h-4 w-4" />
                              Applied: {formatDate(app.submittedAt)}
                            </span>
                            <span className="flex items-center gap-1">
                              <FileText className="h-4 w-4" />
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
                          <Badge className={`${statusConfig[app.status]?.bg || "bg-gray-100"} ${statusConfig[app.status]?.color || "text-gray-700"}`}>
                            {statusConfig[app.status]?.label || app.status}
                          </Badge>
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
                    className="w-20 h-20 rounded-lg object-cover"
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
                <div className="grid grid-cols-2 gap-4 text-sm">
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
                    <p className="font-medium">{selectedApp.matchScore || 0}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <Badge className={`${statusConfig[selectedApp.status]?.bg || "bg-gray-100"} ${statusConfig[selectedApp.status]?.color || "text-gray-700"}`}>
                      {statusConfig[selectedApp.status]?.label || selectedApp.status}
                    </Badge>
                  </div>
                </div>

                {/* Application Status Tracker */}
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <h4 className="font-semibold text-gray-800 mb-4">Application Progress</h4>
                  <ApplicationStatusTracker
                    applicationStatus={selectedApp.status}
                    submittedAt={selectedApp.submittedAt}
                    finalScreening={selectedApp.finalScreening}
                    stage={selectedApp.stage}
                  />
                </div>

                {/* Final Screening Details */}
                {selectedApp.status === "Qualified for Final Screening" && selectedApp.finalScreening && (
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <h4 className="font-semibold text-green-800 flex items-center gap-2 mb-3">
                      <Award className="h-4 w-4" />
                      Video Interview Submission
                    </h4>
                    <div className="space-y-2 text-sm">
                      {selectedApp.finalScreening.googleDriveLink && (
                        <p>
                          <span className="font-medium">🔗 Google Drive Upload Link:</span>{" "}
                          <a
                            href={selectedApp.finalScreening.googleDriveLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline inline-flex items-center gap-1"
                          >
                            Upload Your Video <ExternalLink className="h-3 w-3" />
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
                  <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                    <h4 className="font-semibold text-red-800 flex items-center gap-2 mb-2">
                      <XCircle className="h-4 w-4" />
                      Rejection Reason
                    </h4>
                    <p className="text-sm text-red-700">{selectedApp.rejectionReason}</p>
                  </div>
                )}

                {/* Resubmission Reason */}
                {selectedApp.status === "Needs Resubmission" && selectedApp.resubmissionReason && (
                  <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                    <h4 className="font-semibold text-orange-800 flex items-center gap-2 mb-2">
                      <AlertCircle className="h-4 w-4" />
                      Resubmission Required
                    </h4>
                    <p className="text-sm text-orange-700">{selectedApp.resubmissionReason}</p>
                  </div>
                )}

                {/* AI Score Section */}
                {scoreLoading && (
                  <div className="bg-gray-50 rounded-lg p-4 text-center text-sm text-muted-foreground">
                    <Brain className="h-5 w-5 inline mr-2 animate-pulse" />
                    Loading your score...
                  </div>
                )}

                {!scoreLoading && myScore && myScore.has_score && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 font-semibold text-base">
                      <Trophy className="h-5 w-5 text-primary" />
                      Your Application Score
                    </div>

                    {/* Rank + Total Score */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-primary/5 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold font-mono text-primary">
                          #{myScore.rank}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          out of {myScore.total_applicants} applicants
                        </p>
                      </div>
                      <div className="bg-primary/5 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold font-mono text-primary">
                          {myScore.total_score?.toFixed(1)}
                        </p>
                        <p className="text-xs text-muted-foreground">Total Score / 100</p>
                      </div>
                    </div>

                    {/* Score breakdown bars */}
                    {myScore.score_breakdown && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Score Breakdown</p>
                        {[
                          { label: "GWA", key: "gpa_score", weight: 30 },
                          { label: "Financial Need", key: "financial_score", weight: 25 },
                          { label: "Document Completeness", key: "document_completeness", weight: 20 },
                          { label: "Document Authenticity", key: "document_authenticity", weight: 15 },
                          { label: "Special Category", key: "special_category_score", weight: 10 },
                        ].map(({ label, key, weight }) => {
                          const score = (myScore.score_breakdown as any)[key] ?? 0;
                          const color = score >= 75 ? "bg-green-500" : score >= 50 ? "bg-amber-400" : "bg-red-400";
                          const textColor = score >= 75 ? "text-green-700" : score >= 50 ? "text-amber-700" : "text-red-600";
                          return (
                            <div key={key} className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">
                                  {label} <span className="opacity-60">({weight}%)</span>
                                </span>
                                <span className={`font-mono font-semibold ${textColor}`}>
                                  {score.toFixed(0)}/100
                                </span>
                              </div>
                              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
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
                      <div className="bg-blue-50 rounded-lg p-4 space-y-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-blue-800">
                          <Brain className="h-4 w-4" />
                          Why you received this score
                        </div>
                        <p className="text-sm text-blue-700 italic">
                          "{myScore.shap_explanation.summary}"
                        </p>
                        <div className="space-y-2">
                          {myScore.shap_explanation.contributions.map((c: ShapContribution) => (
                            <div key={c.factor} className="flex items-start gap-2 text-sm">
                              {c.impact === "positive"
                                ? <TrendingUp className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                                : <TrendingDown className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                              }
                              <div>
                                <span className="font-medium text-gray-800">{c.factor}</span>
                                <p className="text-xs text-muted-foreground">{c.explanation}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {!scoreLoading && myScore && !myScore.has_score && (
                  <div className="bg-gray-50 rounded-lg p-4 text-sm text-muted-foreground text-center">
                    <Trophy className="h-5 w-5 inline mr-2 opacity-40" />
                    Rankings have not been generated yet for this scholarship.
                  </div>
                )}

                {/* Submitted Documents */}
                {selectedApp.submittedDocuments && selectedApp.submittedDocuments.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-3">Submitted Documents</h4>
                    <div className="space-y-2">
                      {selectedApp.submittedDocuments.map((doc, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{doc.documentType}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {doc.status === "verified" && <Badge className="bg-green-100 text-green-700 text-xs">Verified</Badge>}
                            {doc.status === "rejected" && <Badge className="bg-red-100 text-red-700 text-xs">Rejected</Badge>}
                            {doc.status === "uploaded" && <Badge className="bg-yellow-100 text-yellow-700 text-xs">Uploaded</Badge>}
                            {doc.status === "pending" && <Badge className="bg-gray-100 text-gray-700 text-xs">Pending</Badge>}
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
    </div>
  );
}