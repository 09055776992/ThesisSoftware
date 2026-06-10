import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Input } from "../../components/ui/input";
import { Eye, Search, Info } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { fetchScholarshipsAdmin } from "../../lib/api-client";

interface Scholarship {
  _id: string;
  name: string;
  provider: string;
  providerName?: string;
  amount: number;
  deadline: string;
  status: string;
  type: string;
  fieldOfStudy?: string;
  location?: string;
  description: string;
  applicationsCount: number;
  createdBy?: string | null;
}

export function AdminScholarships() {
  const [scholarships, setScholarships] = useState<Scholarship[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viewingScholarship, setViewingScholarship] = useState<Scholarship | null>(null);

  useEffect(() => {
    fetchScholarships();
  }, []);

  const fetchScholarships = async () => {
    try {
      const result = await fetchScholarshipsAdmin();
      setScholarships((result.data as Scholarship[] | undefined) || []);
    } catch (error) {
      console.error("Error fetching scholarships:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (amount: number) => `₱${amount.toLocaleString()}`;

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  const filtered = scholarships.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.provider.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <div className="p-8">Loading scholarships...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Scholarships</h1>
          <p className="text-muted-foreground">View all scholarships across the platform</p>
        </div>
        {/* READ-ONLY notice */}
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          <Info className="size-4 flex-shrink-0" />
          <span>Scholarships are managed by Scholarship Providers. Admin view is read-only.</span>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or provider..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Total Scholarships</p>
            <p className="text-2xl font-bold font-mono">{scholarships.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Active</p>
            <p className="text-2xl font-bold font-mono text-green-600">
              {scholarships.filter((s) => s.status === "Active").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Total Applications</p>
            <p className="text-2xl font-bold font-mono">
              {scholarships.reduce((sum, s) => sum + (s.applicationsCount || 0), 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Scholarships ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Applications</TableHead>
                <TableHead className="text-right">View</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No scholarships found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((scholarship) => (
                  <TableRow key={scholarship._id}>
                    <TableCell className="font-semibold">{scholarship.name}</TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">{scholarship.providerName || scholarship.provider}</p>
                        {!scholarship.createdBy && (
                          <Badge variant="outline" className="text-xs mt-0.5">Legacy</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">{formatAmount(scholarship.amount)}</TableCell>
                    <TableCell>{formatDate(scholarship.deadline)}</TableCell>
                    <TableCell>{scholarship.type}</TableCell>
                    <TableCell>
                      <Badge variant={scholarship.status === "Active" ? "default" : "secondary"}>
                        {scholarship.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{scholarship.applicationsCount}</TableCell>
                    <TableCell className="text-right">
                      <button
                        onClick={() => setViewingScholarship(scholarship)}
                        className="p-1.5 rounded hover:bg-gray-100 text-muted-foreground hover:text-foreground transition-colors"
                        title="View details"
                      >
                        <Eye className="size-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* View Details Dialog */}
      <Dialog open={!!viewingScholarship} onOpenChange={() => setViewingScholarship(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{viewingScholarship?.name}</DialogTitle>
          </DialogHeader>
          {viewingScholarship && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Provider</p>
                  <p className="font-medium">{viewingScholarship.providerName || viewingScholarship.provider}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Amount</p>
                  <p className="font-medium font-mono">{formatAmount(viewingScholarship.amount)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Deadline</p>
                  <p className="font-medium">{formatDate(viewingScholarship.deadline)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Type</p>
                  <p className="font-medium">{viewingScholarship.type}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Status</p>
                  <Badge variant={viewingScholarship.status === "Active" ? "default" : "secondary"}>
                    {viewingScholarship.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Applications</p>
                  <p className="font-medium">{viewingScholarship.applicationsCount}</p>
                </div>
              </div>
              {viewingScholarship.fieldOfStudy && (
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Field of Study</p>
                  <p>{viewingScholarship.fieldOfStudy}</p>
                </div>
              )}
              {viewingScholarship.location && (
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Location</p>
                  <p>{viewingScholarship.location}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wide">Description</p>
                <p className="text-sm leading-relaxed">{viewingScholarship.description}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
