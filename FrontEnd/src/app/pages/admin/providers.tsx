import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Textarea } from "../../components/ui/textarea";
import { Label } from "../../components/ui/label";
import { CheckCircle, XCircle, UserX, UserCheck, Clock, ShieldCheck, ShieldOff } from "lucide-react";
import { getAuthToken, getStoredUser } from "../../lib/user-storage";
import { API_URL } from "../../lib/api-client";

interface Provider {
  id: string;
  name: string;
  email: string;
  phone: string;
  organizationName: string;
  position: string;
  isApproved: boolean;
  isActive: boolean;
  statusLabel: "Pending" | "Active" | "Rejected" | "Deactivated";
  requestedAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  deactivatedAt: string | null;
}

const API_BASE = API_URL;

export function AdminProviders() {
  const navigate = useNavigate();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected" | "deactivated">("all");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  const user = getStoredUser();

  useEffect(() => {
    fetchProviders();
  }, [statusFilter]);

  const fetchProviders = async () => {
    setLoading(true);
    setError("");
    try {
      const token = getAuthToken();
      const isAdmin = user?.userType === "admin";
      if (!token) {
        setError(
          isAdmin
            ? "Admin session token missing. Sign out and log in again via Admin Login (email + verification code)."
            : "Please sign in as an administrator to manage provider accounts.",
        );
        setLoading(false);
        if (!isAdmin) {
          setTimeout(() => navigate("/"), 2000);
        }
        return;
      }
      const url = statusFilter === "all"
        ? `${API_BASE}/api/admin/providers`
        : `${API_BASE}/api/admin/providers?status=${statusFilter}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.status === 401 || res.status === 403) {
        setError(
          "Admin session expired or invalid. Use Admin Login from the home page (with the 6-digit code), not the student sign-in.",
        );
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error(data.message || "Failed to fetch providers");
      setProviders(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load providers. Make sure the backend server is running.");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE}/api/admin/providers/${id}/approve`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to approve");
      fetchProviders();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to approve provider");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectingId) return;
    setActionLoading(rejectingId);
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE}/api/admin/providers/${rejectingId}/reject`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: rejectReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to reject");
      setRejectingId(null);
      setRejectReason("");
      fetchProviders();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to reject provider");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm("Deactivate this provider? They will lose access immediately.")) return;
    setActionLoading(id);
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE}/api/admin/providers/${id}/deactivate`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to deactivate");
      fetchProviders();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to deactivate provider");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReactivate = async (id: string) => {
    setActionLoading(id);
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE}/api/admin/providers/${id}/reactivate`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to reactivate");
      fetchProviders();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to reactivate provider");
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric",
    });
  };

  const statusBadge = (label: Provider["statusLabel"]) => {
    const map: Record<Provider["statusLabel"], { className: string; icon: React.ReactNode }> = {
      Pending: { className: "bg-amber-100 text-amber-800 border-amber-200", icon: <Clock className="size-3" /> },
      Active: { className: "bg-green-100 text-green-800 border-green-200", icon: <CheckCircle className="size-3" /> },
      Rejected: { className: "bg-red-100 text-red-800 border-red-200", icon: <XCircle className="size-3" /> },
      Deactivated: { className: "bg-gray-100 text-gray-600 border-gray-200", icon: <ShieldOff className="size-3" /> },
    };
    const { className, icon } = map[label];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${className}`}>
        {icon} {label}
      </span>
    );
  };

  const counts = {
    all: providers.length,
    pending: providers.filter((p) => p.statusLabel === "Pending").length,
    active: providers.filter((p) => p.statusLabel === "Active").length,
    rejected: providers.filter((p) => p.statusLabel === "Rejected").length,
    deactivated: providers.filter((p) => p.statusLabel === "Deactivated").length,
  };

  const filterTabs = [
    { value: "all", label: "All" },
    { value: "pending", label: "Pending" },
    { value: "approved", label: "Active" },
    { value: "rejected", label: "Rejected" },
    { value: "deactivated", label: "Deactivated" },
  ] as const;

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Provider Accounts</h1>
        <p className="text-muted-foreground">Manage scholarship provider account requests and access</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Pending Review</p>
            <p className="text-2xl font-bold font-mono text-amber-600">{counts.pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Active Providers</p>
            <p className="text-2xl font-bold font-mono text-green-600">{counts.active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Rejected</p>
            <p className="text-2xl font-bold font-mono text-red-600">{counts.rejected}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Deactivated</p>
            <p className="text-2xl font-bold font-mono text-gray-500">{counts.deactivated}</p>
          </CardContent>
        </Card>
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
          </Button>
        ))}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            {statusFilter === "all" ? "All Providers" : `${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} Providers`}
            {" "}({providers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading providers...</div>
          ) : providers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ShieldCheck className="size-10 mx-auto mb-3 opacity-30" />
              <p>No providers found.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {providers.map((provider) => (
                  <TableRow key={provider.id}>
                    <TableCell className="font-medium">{provider.name}</TableCell>
                    <TableCell>{provider.organizationName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{provider.position}</TableCell>
                    <TableCell className="text-sm">{provider.email}</TableCell>
                    <TableCell className="text-sm">{formatDate(provider.requestedAt)}</TableCell>
                    <TableCell>{statusBadge(provider.statusLabel)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        {provider.statusLabel === "Pending" && (
                          <>
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white"
                              disabled={actionLoading === provider.id}
                              onClick={() => handleApprove(provider.id)}
                            >
                              <UserCheck className="size-3.5 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={actionLoading === provider.id}
                              onClick={() => { setRejectingId(provider.id); setRejectReason(""); }}
                            >
                              <UserX className="size-3.5 mr-1" />
                              Reject
                            </Button>
                          </>
                        )}
                        {provider.statusLabel === "Active" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-200 hover:bg-red-50"
                            disabled={actionLoading === provider.id}
                            onClick={() => handleDeactivate(provider.id)}
                          >
                            <ShieldOff className="size-3.5 mr-1" />
                            Deactivate
                          </Button>
                        )}
                        {provider.statusLabel === "Deactivated" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600 border-green-200 hover:bg-green-50"
                            disabled={actionLoading === provider.id}
                            onClick={() => handleReactivate(provider.id)}
                          >
                            <ShieldCheck className="size-3.5 mr-1" />
                            Reactivate
                          </Button>
                        )}
                        {provider.statusLabel === "Rejected" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600 border-green-200 hover:bg-green-50"
                            disabled={actionLoading === provider.id}
                            onClick={() => handleApprove(provider.id)}
                          >
                            <UserCheck className="size-3.5 mr-1" />
                            Approve
                          </Button>
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
          <DialogHeader>
            <DialogTitle>Reject Provider Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The provider will receive an email notification. You can optionally provide a reason.
            </p>
            <div className="space-y-2">
              <Label htmlFor="reject-reason">Reason (optional)</Label>
              <Textarea
                id="reject-reason"
                placeholder="e.g., Unable to verify organization credentials..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex gap-3">
              <Button
                variant="destructive"
                className="flex-1"
                disabled={!!actionLoading}
                onClick={handleRejectConfirm}
              >
                Confirm Rejection
              </Button>
              <Button variant="outline" onClick={() => setRejectingId(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
