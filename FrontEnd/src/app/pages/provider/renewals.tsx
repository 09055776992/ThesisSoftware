import { useEffect, useMemo, useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { CheckCircle, Download, FileText, RefreshCw, XCircle } from "lucide-react";
import {
  API_URL,
  fetchProviderScholarshipRenewals,
  reviewScholarshipRenewal,
  type ScholarshipRenewal,
} from "../../lib/api-client";
import { getAuthToken } from "../../lib/user-storage";

type RenewalStatusFilter = "All" | ScholarshipRenewal["status"];

const statusFilters: RenewalStatusFilter[] = ["All", "Pending", "Approved", "Rejected"];

export function ProviderRenewals() {
  const [renewals, setRenewals] = useState<ScholarshipRenewal[]>([]);
  const [filter, setFilter] = useState<RenewalStatusFilter>("Pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<ScholarshipRenewal | null>(null);
  const [reviewNote, setReviewNote] = useState("");

  const loadRenewals = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchProviderScholarshipRenewals();
      setRenewals(result.data || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load scholarship renewals.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRenewals();
  }, []);

  const filteredRenewals = useMemo(
    () => filter === "All" ? renewals : renewals.filter((renewal) => renewal.status === filter),
    [filter, renewals],
  );

  const handleReview = async (renewal: ScholarshipRenewal, status: "Approved" | "Rejected", note = "") => {
    setActionId(renewal._id);
    setError("");
    try {
      const result = await reviewScholarshipRenewal(renewal._id, status, note);
      setRenewals((current) => current.map((item) => item._id === renewal._id ? result.data : item));
      setRejecting(null);
      setReviewNote("");
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Failed to review renewal.");
    } finally {
      setActionId(null);
    }
  };

  const downloadDocument = async (url: string, fileName: string) => {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_URL}${url}`, {
        headers: token ? { Authorization: "Bearer " + token } : {},
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || "Failed to download renewal document.");
      }
      const blobUrl = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Failed to download renewal document.");
    }
  };

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div>
        <h1 className="mb-2 text-3xl font-bold">Scholarship Renewals</h1>
        <p className="text-muted-foreground">Review continuing students’ renewal documents.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {statusFilters.map((status) => {
          const count = status === "All"
            ? renewals.length
            : renewals.filter((renewal) => renewal.status === status).length;
          return (
            <Button
              key={status}
              size="sm"
              variant={filter === status ? "default" : "outline"}
              onClick={() => setFilter(status)}
            >
              {status} ({count})
            </Button>
          );
        })}
        <Button size="sm" variant="ghost" onClick={() => void loadRenewals()} disabled={loading}>
          <RefreshCw className={`mr-2 size-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {loading ? (
        <div className="py-12 text-center text-muted-foreground">Loading renewal submissions...</div>
      ) : filteredRenewals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No {filter === "All" ? "" : filter.toLowerCase()} renewal submissions.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredRenewals.map((renewal) => (
            <Card key={renewal._id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div>
                  <CardTitle className="text-lg">{renewal.scholarshipName}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {renewal.studentName || renewal.studentEmail} · Period {renewal.renewalPeriodNumber} · Submitted {formatDate(renewal.submittedAt)}
                  </p>
                </div>
                <Badge variant={renewal.status === "Approved" ? "default" : "secondary"}>{renewal.status}</Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void downloadDocument(renewal.registrationCardUrl, renewal.registrationCard.fileName)}
                  >
                    <Download className="mr-2 size-4" /> Registration card
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void downloadDocument(renewal.previousSemesterGradesUrl, renewal.previousSemesterGrades.fileName)}
                  >
                    <FileText className="mr-2 size-4" /> Previous-semester grades
                  </Button>
                </div>
                {renewal.reviewNote && (
                  <p className="rounded bg-muted p-3 text-sm">
                    <span className="font-medium">Review note:</span> {renewal.reviewNote}
                  </p>
                )}
                {renewal.status === "Pending" && (
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      variant="outline"
                      className="text-destructive"
                      disabled={actionId === renewal._id}
                      onClick={() => {
                        setRejecting(renewal);
                        setReviewNote("");
                      }}
                    >
                      <XCircle className="mr-2 size-4" /> Reject
                    </Button>
                    <Button
                      disabled={actionId === renewal._id}
                      onClick={() => void handleReview(renewal, "Approved")}
                    >
                      <CheckCircle className="mr-2 size-4" />
                      {actionId === renewal._id ? "Saving..." : "Approve"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!rejecting} onOpenChange={(open) => { if (!open) setRejecting(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject scholarship renewal</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Provide a reason so the student understands the decision.
            </p>
            <div className="space-y-2">
              <Label htmlFor="renewal-review-note">Reason</Label>
              <Textarea
                id="renewal-review-note"
                rows={4}
                value={reviewNote}
                onChange={(event) => setReviewNote(event.target.value)}
                placeholder="Explain why this renewal cannot be approved."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRejecting(null)}>Cancel</Button>
              <Button
                variant="destructive"
                disabled={!reviewNote.trim() || !!actionId || !rejecting}
                onClick={() => rejecting && void handleReview(rejecting, "Rejected", reviewNote)}
              >
                Confirm rejection
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
