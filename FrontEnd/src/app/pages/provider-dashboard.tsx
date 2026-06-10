import { useState, useEffect } from "react";
import { Link } from "react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Award, Users, FileText, Clock, Plus, ChevronRight } from "lucide-react";
import { getStoredUser, getAuthToken } from "../lib/user-storage";
import { API_URL } from "../lib/api-client";

interface ProviderStats {
  totalScholarships: number;
  activeScholarships: number;
  totalApplicants: number;
  pendingApplications: number;
  approvedApplications: number;
}

interface RecentApplication {
  _id: string;
  studentName: string;
  scholarshipName: string;
  submittedAt: string;
  status: string;
}

const API_BASE = API_URL;

export function ProviderDashboard() {
  const user = getStoredUser();
  const [stats, setStats] = useState<ProviderStats>({
    totalScholarships: 0,
    activeScholarships: 0,
    totalApplicants: 0,
    pendingApplications: 0,
    approvedApplications: 0,
  });
  const [recentApplications, setRecentApplications] = useState<RecentApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const token = getAuthToken();
        const headers = { Authorization: `Bearer ${token}` };

        const [statsRes, appsRes] = await Promise.all([
          fetch(`${API_BASE}/api/provider/dashboard/stats`, { headers }),
          fetch(`${API_BASE}/api/provider/applications`, { headers }),
        ]);

        if (statsRes.ok) {
          const data = await statsRes.json();
          setStats(data.stats || stats);
        }

        if (appsRes.ok) {
          const data = await appsRes.json();
          const apps = (data.data || []) as RecentApplication[];
          setRecentApplications(apps.slice(0, 5));
        }

        setError("");
      } catch (err) {
        console.error("Error fetching provider data:", err);
        setError("Failed to load dashboard data.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const orgName = (user as any)?.organizationName || "QCYDO";
  const displayName = user?.fullName || user?.email?.split("@")[0] || "Provider";

  const statusColor: Record<string, string> = {
    Pending: "bg-amber-100 text-amber-800",
    "System Qualified": "bg-blue-100 text-blue-800",
    "Under Review": "bg-purple-100 text-purple-800",
    Approved: "bg-green-100 text-green-800",
    Rejected: "bg-red-100 text-red-800",
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full size-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-1">Welcome, {displayName}</h1>
          <p className="text-muted-foreground">{orgName} · Provider Dashboard</p>
          {error && <p className="text-sm text-destructive mt-1">{error}</p>}
        </div>
        <Link to="/provider/scholarships/create">
          <Button>
            <Plus className="size-4 mr-2" />
            Create Scholarship
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">My Scholarships</p>
                <p className="text-3xl font-bold font-mono">{stats.totalScholarships}</p>
                <p className="text-sm text-muted-foreground">{stats.activeScholarships} active</p>
              </div>
              <div className="p-3 rounded-lg bg-blue-50 text-blue-600">
                <Award className="size-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Applicants</p>
                <p className="text-3xl font-bold font-mono">{stats.totalApplicants}</p>
                <p className="text-sm text-muted-foreground">across all scholarships</p>
              </div>
              <div className="p-3 rounded-lg bg-green-50 text-green-600">
                <Users className="size-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Pending Review</p>
                <p className="text-3xl font-bold font-mono">{stats.pendingApplications}</p>
                <p className="text-sm text-muted-foreground">need your attention</p>
              </div>
              <div className="p-3 rounded-lg bg-amber-50 text-amber-600">
                <Clock className="size-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Approved</p>
                <p className="text-3xl font-bold font-mono">{stats.approvedApplications}</p>
                <p className="text-sm text-muted-foreground">scholars supported</p>
              </div>
              <div className="p-3 rounded-lg bg-purple-50 text-purple-600">
                <FileText className="size-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to="/provider/scholarships/create">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-dashed">
            <CardContent className="pt-6 pb-6 flex flex-col items-center text-center gap-2">
              <div className="p-3 rounded-full bg-blue-50">
                <Plus className="size-6 text-blue-600" />
              </div>
              <p className="font-semibold">Create Scholarship</p>
              <p className="text-xs text-muted-foreground">Post a new scholarship opportunity</p>
            </CardContent>
          </Card>
        </Link>
        <Link to="/provider/applications">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="pt-6 pb-6 flex flex-col items-center text-center gap-2">
              <div className="p-3 rounded-full bg-amber-50">
                <FileText className="size-6 text-amber-600" />
              </div>
              <p className="font-semibold">Review Applications</p>
              <p className="text-xs text-muted-foreground">
                {stats.pendingApplications > 0
                  ? `${stats.pendingApplications} pending review`
                  : "No pending applications"}
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link to="/provider/scholarships">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="pt-6 pb-6 flex flex-col items-center text-center gap-2">
              <div className="p-3 rounded-full bg-green-50">
                <Award className="size-6 text-green-600" />
              </div>
              <p className="font-semibold">Manage Scholarships</p>
              <p className="text-xs text-muted-foreground">
                {stats.totalScholarships > 0
                  ? `${stats.totalScholarships} scholarship(s)`
                  : "No scholarships yet"}
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Recent Applications */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Applications</CardTitle>
            <CardDescription>Latest submissions for your scholarships</CardDescription>
          </div>
          <Link to="/provider/applications">
            <Button variant="ghost" size="sm">
              View All <ChevronRight className="size-4 ml-1" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {recentApplications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="size-10 mx-auto mb-3 opacity-30" />
              <p>No applications yet. Create a scholarship to start receiving applications.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentApplications.map((app) => (
                <div key={app._id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                  <div>
                    <p className="font-medium text-sm">{app.studentName || app._id}</p>
                    <p className="text-xs text-muted-foreground">{app.scholarshipName}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {new Date(app.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[app.status] || "bg-gray-100 text-gray-600"}`}>
                      {app.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
