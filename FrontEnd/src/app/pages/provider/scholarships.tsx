import { useState, useEffect } from "react";
import { Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Plus, Edit, Trash2, Users } from "lucide-react";
import { getAuthToken } from "../../lib/user-storage";
import { API_URL } from "../../lib/api-client";

interface Scholarship {
  _id: string;
  name: string;
  amount: number;
  deadline: string;
  status: string;
  type: string;
  applicationsCount: number;
}

const API_BASE = API_URL;

export function ProviderScholarships() {
  const [scholarships, setScholarships] = useState<Scholarship[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  const formatAmount = (n: number) => `₱${n.toLocaleString()}`;
  const formatDate = (d: string) => new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
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
          <CardTitle>Scholarships ({scholarships.length})</CardTitle>
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
          ) : (
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
                {scholarships.map((s) => (
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
