import { useState, useEffect } from "react";
import { Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Plus, Edit, Trash2, Users, Search, RefreshCw, Repeat } from "lucide-react";
import { Input } from "../../components/ui/input";
import { getAuthToken } from "../../lib/user-storage";
import { API_URL, setScholarshipRenewalPeriod } from "../../lib/api-client";

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

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE}/api/provider/scholarships/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete");
      fetchScholarships();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete scholarship");
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
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(s._id, s.name)}>
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
    </div>
  );
}
