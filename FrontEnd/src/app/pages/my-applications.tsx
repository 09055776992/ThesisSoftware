import { useEffect, useState } from "react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { FileText, Calendar, ExternalLink, Award, AlertCircle, CheckCircle, Clock, XCircle } from "lucide-react";
import { fetchMyApplications } from "../lib/api-client";
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
  submittedDocuments?: Array<{
    documentType: string;
    fileName: string;
    status: string;
    rejectionReason?: string;
  }>;
  finalScreening?: {
    scheduledDate: string;
    scheduledTime: string;
    meetingPlatform: string;
    meetingLink: string;
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
                        <div>
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
                        </div>
                        <div className="flex flex-col items-start sm:items-end gap-3">
                          <Badge className={`${statusConfig[app.status]?.bg || "bg-gray-100"} ${statusConfig[app.status]?.color || "text-gray-700"}`}>
                            {statusConfig[app.status]?.label || app.status}
                          </Badge>
                          <Button size="sm" onClick={() => setSelectedApp(app)}>
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

                {/* Final Screening Details */}
                {selectedApp.status === "Qualified for Final Screening" && selectedApp.finalScreening && (
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <h4 className="font-semibold text-green-800 flex items-center gap-2 mb-3">
                      <Award className="h-4 w-4" />
                      Final Screening Scheduled
                    </h4>
                    <div className="space-y-2 text-sm">
                      <p><span className="font-medium">📅 Date:</span> {formatDate(selectedApp.finalScreening.scheduledDate)}</p>
                      <p><span className="font-medium">⏰ Time:</span> {selectedApp.finalScreening.scheduledTime}</p>
                      <p><span className="font-medium">💻 Platform:</span> {selectedApp.finalScreening.meetingPlatform || "Google Meet"}</p>
                      {selectedApp.finalScreening.meetingLink && (
                        <p>
                          <span className="font-medium">🔗 Meeting Link:</span>{" "}
                          <a
                            href={selectedApp.finalScreening.meetingLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline inline-flex items-center gap-1"
                          >
                            Join Meeting <ExternalLink className="h-3 w-3" />
                          </a>
                        </p>
                      )}
                      {selectedApp.finalScreening.notes && (
                        <p><span className="font-medium">📝 Notes:</span> {selectedApp.finalScreening.notes}</p>
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