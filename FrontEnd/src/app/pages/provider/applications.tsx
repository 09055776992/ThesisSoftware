import { useState, useEffect } from "react";
import { useSearchParams } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Textarea } from "../../components/ui/textarea";
import { Label } from "../../components/ui/label";
import { CheckCircle, XCircle, Star, FileText } from "lucide-react";
import { getAuthToken } from "../../lib/user-storage";
import { API_URL } from "../../lib/api-client";

interface Application {
  _id: string;
  studentName: string;
  studentEmail: string;
  scholarshipName: string;
  scholarshipId: string;
  submittedAt: string;
  status: string;
  matchScore: number;
}

interface Stats {
  pending: number;
  underReview: number;
  approved: number;
  rejected: number;
}

const API_BASE = API_URL;

export function ProviderApplications() {
  const [searchParams] = useSearchParams();
  const scholarshipIdFilter = searchParams.get("scholarshipId");

  const [applications, setApplications] = useState<Application[]>([]);
  const [stats, setStats] = useState<Stats>({ pending: 0, underReview: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState("");

  // Reject modal
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Qualify modal
  const [qualifyingId, setQualifyingId] = useState<string | null>(null);
  const [qualifyForm, setQualifyForm] = useState({ scheduledDate: "", scheduledTime: "", venue: "", notes: "" });

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => { fetchApplications(); }, [statusFilter, scholarshipIdFilter]);

  const fetchApplications = async () => {
    setLoading(true);
    setError("");
    try {
      const token = getAuthToken();
      let url = `${API_BASE}/api/provider/applications`;
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (scholarshipIdFilter) params.set("scholarshipId", scholarshipIdFilter);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch");
      setApplications(data.data || []);
      setStats(data.stats || { pending: 0, underReview: 0, approved: 0, rejected: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load applications");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE}/api/provider/applications/${id}/approve`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to approve");
      fetchApplications();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectingId) return;
    setActionLoading(rejectingId);
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE}/api/provider/applications/${rejectingId}/reject`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      });
      if (!res.ok) throw new Error("Failed to reject");
      setRejectingId(null);
      setRejectReason("");
      fetchApplications();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to reject");
    } finally {
      setActionLoading(null);
    }
  };

  const handleQualifyConfirm = async () => {
    if (!qualifyingId) return;
    setActionLoading(qualifyingId);
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE}/api/provider/applications/${qualifyingId}/qualify`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(qualifyForm),
      });
      if (!res.ok) throw new Error("Failed to qualify");
      setQualifyingId(null);
      setQualifyForm({ scheduledDate: "", scheduledTime: "", venue: "", notes: "" });
      fetchApplications();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to qualify");
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

  const statusColor: Record<string, string> = {
    Pending: "bg-amber-100 text-amber-800",
    "System Qualified": "bg-blue-100 text-blue-800",
    "Under Review": "bg-purple-100 text-purple-800",
    Approved: "bg-green-100 text-green-800",
    Rejected: "bg-red-100 text-red-800",
  };

  const filterTabs = [
    { value: "all", label: "All", count: applications.length },
    { value: "Pending", label: "Pending", count: stats.pending },
    { value: "Approved", label: "Approved", count: stats.approved },
    { value: "Rejected", label: "Rejected", count: stats.rejected },
  ];

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Applications</h1>
        <p className="text-muted-foreground">Review and manage applicants for your scholarships</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Pending", value: stats.pending, color: "text-amber-600" },
          { label: "Under Review", value: stats.underReview, color: "text-purple-600" },
          { label: "Approved", value: stats.approved, color: "text-green-600" },
          { label: "Rejected", value: stats.rejected, color: "text-red-600" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{s.label}</p>
              <p className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {filterTabs.map((tab) => (
          <Button
            key={tab.value}
            variant={statusFilter === tab.value ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter(tab.value)}
          >
            {tab.label}
            {tab.count > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">{tab.count}</Badge>
            )}
          </Button>
        ))}
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>}

      <Card>
        <CardHeader>
          <CardTitle>Applications ({applications.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : applications.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="size-10 mx-auto mb-3 opacity-30" />
              <p>No applications found.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Scholarship</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Match Score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((app) => (
                  <TableRow key={app._id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{app.studentName || "—"}</p>
                        <p className="text-xs text-muted-foreground">{app.studentEmail}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{app.scholarshipName}</TableCell>
                    <TableCell className="text-sm">{formatDate(app.submittedAt)}</TableCell>
                    <TableCell>
                      <span className="font-mono text-sm font-semibold">{app.matchScore}%</span>
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[app.status] || "bg-gray-100 text-gray-600"}`}>
                        {app.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        {(app.status === "Pending" || app.status === "Under Review" || app.status === "System Qualified") && (
                          <>
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white h-7 px-2"
                              disabled={actionLoading === app._id}
                              onClick={() => handleApprove(app._id)}
                              title="Approve"
                            >
                              <CheckCircle className="size-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-blue-600 border-blue-200 h-7 px-2"
                              disabled={actionLoading === app._id}
                              onClick={() => { setQualifyingId(app._id); setQualifyForm({ scheduledDate: "", scheduledTime: "", venue: "", notes: "" }); }}
                              title="Qualify for screening"
                            >
                              <Star className="size-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 border-red-200 h-7 px-2"
                              disabled={actionLoading === app._id}
                              onClick={() => { setRejectingId(app._id); setRejectReason(""); }}
                              title="Reject"
                            >
                              <XCircle className="size-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={!!rejectingId} onOpenChange={() => setRejectingId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Application</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Optionally provide a reason for rejection.</p>
            <div className="space-y-2">
              <Label htmlFor="reject-reason">Reason (optional)</Label>
              <Textarea id="reject-reason" rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="e.g., Does not meet GWA requirement..." />
            </div>
            <div className="flex gap-3">
              <Button variant="destructive" className="flex-1" disabled={!!actionLoading} onClick={handleRejectConfirm}>Confirm Rejection</Button>
              <Button variant="outline" onClick={() => setRejectingId(null)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Qualify / Schedule Dialog */}
      <Dialog open={!!qualifyingId} onOpenChange={() => setQualifyingId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Qualify for Final Screening</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Qualify this applicant for final screening. Optionally schedule a virtual meeting.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="q-date">Screening Date</Label>
                <input id="q-date" type="date" className="w-full border rounded px-3 py-2 text-sm" value={qualifyForm.scheduledDate} onChange={(e) => setQualifyForm((p) => ({ ...p, scheduledDate: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="q-time">Time</Label>
                <input id="q-time" type="time" className="w-full border rounded px-3 py-2 text-sm" value={qualifyForm.scheduledTime} onChange={(e) => setQualifyForm((p) => ({ ...p, scheduledTime: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="q-venue">Venue / Meeting Link</Label>
              <input id="q-venue" type="text" className="w-full border rounded px-3 py-2 text-sm" placeholder="e.g., Google Meet link or QCYDO Office" value={qualifyForm.venue} onChange={(e) => setQualifyForm((p) => ({ ...p, venue: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="q-notes">Notes (optional)</Label>
              <Textarea id="q-notes" rows={2} value={qualifyForm.notes} onChange={(e) => setQualifyForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Additional instructions..." />
            </div>
            <div className="flex gap-3">
              <Button className="flex-1" disabled={!!actionLoading} onClick={handleQualifyConfirm}>Qualify Applicant</Button>
              <Button variant="outline" onClick={() => setQualifyingId(null)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
