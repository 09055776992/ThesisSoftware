import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Award, Users, FileText, TrendingUp } from "lucide-react";
import { getStoredUser } from "../lib/user-storage";
import { Redirect } from "./redirect";

interface ProviderStats {
  activeScholarships: number;
  totalApplications: number;
  awardedAmount: number;
  scholarsSupported: number;
}

export function ProviderDashboard() {
  const user = getStoredUser();
  if (user?.userType !== "provider") {
    return <Redirect to="/auth/signin" />;
  }

  const [stats, setStats] = useState<ProviderStats>({
    activeScholarships: 0,
    totalApplications: 0,
    awardedAmount: 0,
    scholarsSupported: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchProviderData = async () => {
      try {
        setLoading(true);
        const user = getStoredUser();
        const email = user?.email;

        if (!email) {
          setError("Provider email not found");
          return;
        }

        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

        // Fetch scholarships
        const scholarsResponse = await fetch(
          `${API_BASE_URL}/api/provider/scholarships?email=${encodeURIComponent(email)}`
        ).catch((err) => {
          console.error("Failed to fetch scholarships:", err);
          return null;
        });

        // Fetch applications
        const applicationsResponse = await fetch(
          `${API_BASE_URL}/api/provider/applications?email=${encodeURIComponent(email)}`
        ).catch((err) => {
          console.error("Failed to fetch applications:", err);
          return null;
        });

        let activeScholarships = 0;
        let totalApplications = 0;

        if (scholarsResponse?.ok) {
          const data = await scholarsResponse.json().catch(() => ({ data: [] }));
          activeScholarships = (data.data || []).length;
        }

        if (applicationsResponse?.ok) {
          const data = await applicationsResponse.json().catch(() => ({ data: [] }));
          totalApplications = (data.data || []).length;
        }

        setStats({
          activeScholarships,
          totalApplications,
          awardedAmount: 485000,
          scholarsSupported: 156,
        });
        setError("");
      } catch (err) {
        console.error("Error fetching provider data:", err);
        setError("Failed to load provider data. Please try refreshing.");
      } finally {
        setLoading(false);
      }
    };

    fetchProviderData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading provider dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Provider Dashboard</h1>
          <p className="text-muted-foreground">Manage your scholarships and applications</p>
          {error && <p className="text-sm text-destructive mt-2">{error}</p>}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Active Scholarships</p>
                  <p className="text-3xl font-bold font-mono">{stats.activeScholarships}</p>
                  <p className="text-sm text-accent">+2 this month</p>
                </div>
                <div className="p-3 rounded-lg bg-muted text-blue-600">
                  <Award className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Applications</p>
                  <p className="text-3xl font-bold font-mono">{stats.totalApplications}</p>
                  <p className="text-sm text-accent">+45 pending</p>
                </div>
                <div className="p-3 rounded-lg bg-muted text-green-600">
                  <FileText className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Awarded Amount</p>
                  <p className="text-3xl font-bold font-mono">₱{(stats.awardedAmount / 1000).toFixed(0)}K</p>
                  <p className="text-sm text-accent">Total distributed</p>
                </div>
                <div className="p-3 rounded-lg bg-muted text-amber-600">
                  <TrendingUp className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Scholars Supported</p>
                  <p className="text-3xl font-bold font-mono">{stats.scholarsSupported}</p>
                  <p className="text-sm text-accent">Active recipients</p>
                </div>
                <div className="p-3 rounded-lg bg-muted text-purple-600">
                  <Users className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Button className="h-24 flex flex-col items-center justify-center">
                <Award className="h-6 w-6 mb-2" />
                <span className="text-xs text-center">Create New Scholarship</span>
              </Button>
              <Button variant="outline" className="h-24 flex flex-col items-center justify-center">
                <FileText className="h-6 w-6 mb-2" />
                <span className="text-xs text-center">Review Applications</span>
              </Button>
              <Button variant="outline" className="h-24 flex flex-col items-center justify-center">
                <Users className="h-6 w-6 mb-2" />
                <span className="text-xs text-center">View Recipients</span>
              </Button>
              <Button variant="outline" className="h-24 flex flex-col items-center justify-center">
                <TrendingUp className="h-6 w-6 mb-2" />
                <span className="text-xs text-center">View Analytics</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Applications */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Applications</CardTitle>
            <CardDescription>Latest submissions for your scholarships</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3].map((item) => (
                <div key={item} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-semibold">Applicant {item}</p>
                    <p className="text-sm text-muted-foreground">Submitted 2 days ago</p>
                  </div>
                  <Badge>Pending Review</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
