import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Download, TrendingUp, TrendingDown, Users, FileText, Award, CheckCircle, Clock, Loader2 } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface AnalyticsData {
  stats: {
    userGrowth: {
      value: number;
      percentChange: number;
      isPositive: boolean;
    };
    applications: {
      value: number;
      label: string;
    };
    successRate: {
      value: number;
      label: string;
    };
  };
  charts: {
    applicationsOverTime: Array<{ month: string; count: number }>;
    scholarshipDistribution: Array<{ name: string; value: number }>;
    topScholarshipsByApplications: Array<{ name: string; count: number }>;
    userRegistrationTrend: Array<{ month: string; count: number }>;
  };
  quickStats: {
    totalScholars: number;
    pendingApplications: number;
    activeScholarships: number;
  };
  breakdown: {
    applicationsByStatus: Record<string, number>;
    totalUsers: number;
    totalApplications: number;
    totalScholarships: number;
  };
}

const COLORS = ["#2563EB", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];

export function AdminReports() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0],
    to: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/admin/analytics");
      if (!response.ok) {
        throw new Error("Failed to fetch analytics");
      }
      const analyticsData = await response.json();
      setData(analyticsData);
    } catch (err) {
      console.error("Error fetching analytics:", err);
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async () => {
    try {
      setGeneratingReport(true);
      const response = await fetch("/api/admin/reports/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: dateRange.from,
          to: dateRange.to,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate report");
      }

      // Download the CSV
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `scholarship-report-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Error generating report:", err);
      alert("Failed to generate report. Please try again.");
    } finally {
      setGeneratingReport(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-2 text-gray-600">
          <Loader2 className="size-5 animate-spin" />
          <span>Loading analytics...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Reports</h1>
          <p className="text-gray-600 mb-8">Analytics and data exports</p>
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-red-800">Error loading analytics: {error || "Unknown error"}</p>
              <Button onClick={fetchAnalytics} variant="outline" className="mt-4">
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const { stats, charts, quickStats, breakdown } = data;

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Reports</h1>
          <p className="text-gray-600">Analytics and data exports</p>
        </div>

        {/* Quick Stats Sidebar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Total Scholars</p>
                  <p className="text-3xl font-bold text-gray-900">{quickStats.totalScholars.toLocaleString()}</p>
                </div>
                <div className="size-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="size-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Pending Applications</p>
                  <p className="text-3xl font-bold text-gray-900">{quickStats.pendingApplications.toLocaleString()}</p>
                </div>
                <div className="size-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <Clock className="size-6 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Active Scholarships</p>
                  <p className="text-3xl font-bold text-gray-900">{quickStats.activeScholarships.toLocaleString()}</p>
                </div>
                <div className="size-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Award className="size-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">User Growth</h3>
                <div
                  className={`size-10 rounded-lg flex items-center justify-center ${
                    stats.userGrowth.isPositive ? "bg-green-100" : "bg-red-100"
                  }`}
                >
                  {stats.userGrowth.isPositive ? (
                    <TrendingUp className="size-5 text-green-600" />
                  ) : (
                    <TrendingDown className="size-5 text-red-600" />
                  )}
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                {stats.userGrowth.isPositive ? "+" : ""}
                {stats.userGrowth.percentChange}%
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {stats.userGrowth.value} new users this month vs last month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Applications</h3>
                <div className="size-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileText className="size-5 text-blue-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900">{stats.applications.value.toLocaleString()}</p>
              <p className="text-sm text-gray-600 mt-1">{stats.applications.label}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Success Rate</h3>
                <div className="size-10 bg-amber-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="size-5 text-amber-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900">{stats.successRate.value}%</p>
              <p className="text-sm text-gray-600 mt-1">{stats.successRate.label}</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Applications Over Time */}
          <Card>
            <CardHeader>
              <CardTitle>Applications Over Time</CardTitle>
              <CardDescription>Application volume trend (last 6 months)</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={charts.applicationsOverTime}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="count" stroke="#2563EB" strokeWidth={2} name="Applications" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Scholarship Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Scholarship Distribution</CardTitle>
              <CardDescription>Active scholarships by type</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={charts.scholarshipDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {charts.scholarshipDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Top Scholarships by Applications */}
          <Card>
            <CardHeader>
              <CardTitle>Top Scholarships by Applications</CardTitle>
              <CardDescription>Most popular scholarships</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={charts.topScholarshipsByApplications} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={150} style={{ fontSize: "12px" }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#10B981" name="Applications" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* User Registration Trend */}
          <Card>
            <CardHeader>
              <CardTitle>User Registration Trend</CardTitle>
              <CardDescription>New user signups (last 6 months)</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={charts.userRegistrationTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#8B5CF6" name="New Users" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Applications Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Applications Breakdown by Status</CardTitle>
            <CardDescription>Current application pipeline</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(breakdown.applicationsByStatus).map(([status, count]) => (
                <div key={status} className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500 mb-1">{status}</p>
                  <p className="text-2xl font-bold text-gray-900">{count}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Generate Report Section */}
        <Card>
          <CardHeader>
            <CardTitle>Generate Report</CardTitle>
            <CardDescription>Export comprehensive analytics as CSV</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 space-y-2">
                <Label htmlFor="from">From Date</Label>
                <Input
                  id="from"
                  type="date"
                  value={dateRange.from}
                  onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                />
              </div>
              <div className="flex-1 space-y-2">
                <Label htmlFor="to">To Date</Label>
                <Input
                  id="to"
                  type="date"
                  value={dateRange.to}
                  onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                />
              </div>
              <Button
                onClick={generateReport}
                disabled={generatingReport}
                className="bg-[#1E3A5F] hover:bg-[#152e4a]"
              >
                {generatingReport ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="size-4 mr-2" />
                    Generate Report
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

