import { useState, useEffect } from "react";
import { Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Plus, Edit, Trash2, Users, Search, RefreshCw, Repeat, Lock, AlertTriangle } from "lucide-react";
import { Input } from "../../components/ui/input";
import { getAuthToken } from "../../lib/user-storage";
import { API_URL, setScholarshipRenewalPeriod } from "../../lib/api-client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";

interface Scholarship {
  _id: string;
  name: string;
  amount: number;
  deadline: string;
  status: string;
  type: string;
  applicationsCount: number;
  renewalPeriodOpen?: boolean;
  renewalPeriodNumber?: number;
}

const API_BASE = API_URL;

export function ProviderScholarships() {
  const [scholarships, setScholarships] = useState<Scholarship[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [renewalUpdating, setRenewalUpdating] = useState<string | null>(null);

  // Password-confirmed deletion state
  const [deleteTarget, setDeleteTarget] = useState<Scholarship | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => { fetchScholarships(); }, []);

  const fetchScholarships = async () => {
    setLoading(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE}/api/provider/scholarships`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch");
      setScholarships(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load scholarships");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDeleteModal = (scholarship: Scholarship) => {
    setDeleteTarget(scholarship);
    setDeletePassword("");
    setDeleteError("");
  };

  const handleConfirmDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deleteTarget) return;

    if (!deletePassword.trim()) {
      setDeleteError("Password is required to confirm deletion.");
      return;
    }

    setIsDeleting(true);
    setDeleteError("");

    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE}/api/provider/scholarships/${deleteTarget._id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: deletePassword }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to delete scholarship");
      }

      toast.success(`"${deleteTarget.name}" was deleted successfully.`);
      setDeleteTarget(null);
      setDeletePassword("");
      fetchScholarships();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete scholarship";
      setDeleteError(msg);
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRenew = async (id: string, name: string) => {
    const extensionDays = 90; // default 90-day extension
    if (!confirm(`Extend the deadline for "${name}" by ${extensionDays} days?`)) return;
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE}/api/provider/scholarships/${id}/renew`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ extensionDays }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to renew");
      alert(`Deadline extended! New deadline: ${new Date(data.newDeadline).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`);
      fetchScholarships();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to renew scholarship");
    }
  };

  const handleRenewalPeriodToggle = async (scholarship: Scholarship) => {
    const open = !scholarship.renewalPeriodOpen;
    setRenewalUpdating(scholarship._id);
    setError("");
    try {
      await setScholarshipRenewalPeriod(scholarship._id, open);
      setScholarships((current) => current.map((item) =>
        item._id === scholarship._id
          ? {
              ...item,
              renewalPeriodOpen: open,
              renewalPeriodNumber: open
                ? (item.renewalPeriodNumber || 0) + 1
                : item.renewalPeriodNumber,
            }
          : item
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update renewal period");
    } finally {
      setRenewalUpdating(null);
    }
  };

  const formatAmount = (n: number) => `₱${n.toLocaleString()}`;
  const formatDate = (d: string) => new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

  const filtered = scholarships.filter((s) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) ||
      s.type.toLowerCase().includes(q) ||
      s.status.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-4 md:p-8 space-y-4 md:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">My Scholarships</h1>
          <p className="text-muted-foreground">Manage the scholarships you have created</p>
        </div>
        <Link to="/provider/scholarships/create">
          <Button>
            <Plus className="size-4 mr-2" />
            Create Scholarship
          </Button>
        </Link>
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>}

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle>
              Scholarships ({filtered.length}{filtered.length !== scholarships.length && ` of ${scholarships.length}`})
            </CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search scholarships..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : scholarships.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="mb-4">You haven't created any scholarships yet.</p>
              <Link to="/provider/scholarships/create">
                <Button><Plus className="size-4 mr-2" />Create your first scholarship</Button>
              </Link>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Search className="size-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No scholarships match <span className="font-medium">"{searchQuery}"</span>.</p>
              <button
                onClick={() => setSearchQuery("")}
                className="text-xs text-blue-600 hover:underline mt-1"
              >
                Clear search
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Applicants</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s._id}>
                    <TableCell className="font-semibold">{s.name}</TableCell>
                    <TableCell className="font-mono">{formatAmount(s.amount)}</TableCell>
                    <TableCell>{formatDate(s.deadline)}</TableCell>
                    <TableCell>{s.type}</TableCell>
                    <TableCell>
                      <Badge variant={s.status === "Active" ? "default" : "secondary"}>{s.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Link to={`/provider/applications?scholarshipId=${s._id}`} className="flex items-center gap-1 text-sm hover:underline">
                        <Users className="size-3.5" />
                        {s.applicationsCount}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant={s.renewalPeriodOpen ? "default" : "outline"}
                          size="sm"
                          className="h-8"
                          disabled={renewalUpdating === s._id}
                          onClick={() => handleRenewalPeriodToggle(s)}
                          title={s.renewalPeriodOpen ? "Close award renewal submissions" : "Open award renewal submissions"}
                        >
                          <Repeat className="mr-1.5 size-3.5" />
                          {renewalUpdating === s._id
                            ? "Saving..."
                            : s.renewalPeriodOpen ? "Close renewals" : "Open renewals"}
                        </Button>
                        {/* Renew — show when deadline is within 30 days or past */}
                        {(() => {
                          const daysLeft = Math.ceil((new Date(s.deadline).getTime() - Date.now()) / 86400000);
                          return daysLeft <= 30 ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                              title="Extend deadline"
                              onClick={() => handleRenew(s._id, s.name)}
                            >
                              <RefreshCw className="size-4" />
                            </Button>
                          ) : null;
                        })()}
                        <Link to={`/provider/scholarships/${s._id}/edit`}>
                          <Button variant="ghost" size="sm"><Edit className="size-4" /></Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10"
                          title="Delete scholarship"
                          onClick={() => handleOpenDeleteModal(s)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Password Confirmation Modal for Deletion */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setDeleteTarget(null);
            setDeletePassword("");
            setDeleteError("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleConfirmDelete}>
            <DialogHeader>
              <DialogTitle className="text-destructive flex items-center gap-2">
                <AlertTriangle className="size-5" />
                Confirm Scholarship Deletion
              </DialogTitle>
              <DialogDescription className="pt-2 text-foreground/80">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-foreground">
                  "{deleteTarget?.name}"
                </span>
                ? This action is permanent and cannot be undone.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-3">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <Lock className="size-4 text-muted-foreground" />
                Enter your account password to confirm:
              </label>
              <Input
                type="password"
                placeholder="Enter your password"
                value={deletePassword}
                onChange={(e) => {
                  setDeletePassword(e.target.value);
                  setDeleteError("");
                }}
                disabled={isDeleting}
                autoFocus
                required
              />
              {deleteError && (
                <div className="text-xs text-destructive font-medium bg-destructive/10 border border-destructive/20 p-2.5 rounded-md">
                  {deleteError}
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                disabled={isDeleting}
                onClick={() => {
                  setDeleteTarget(null);
                  setDeletePassword("");
                  setDeleteError("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={isDeleting || !deletePassword.trim()}
              >
                {isDeleting ? "Verifying..." : "Delete Scholarship"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
