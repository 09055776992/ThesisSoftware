import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Users, Award, FileText, TrendingUp, CheckCircle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { API_URL } from "../../lib/api-client";
import { getAuthToken } from "../../lib/user-storage";

interface Stats {
  totalUsers: number;
  totalStudents: number;
  totalProviders: number;
  totalMentors: number;
  totalAdmins: number;
  activeUsers: number;
  newUsersThisMonth: number;
  activeScholarships: number;
  userGrowthByMonth: Array<{ month: string; users: number }>;
  scholarshipDistribution: Array<{ category: string; count: number }>;
  applicationsByStatus: Array<{ status: string; count: number }>;
}

type Activity = { actor: string; action: string; subject: string; createdAt?: string };

export function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`${API_URL}/api/admin/stats`, {
          headers: { Authorization: `Bearer ${getAuthToken()}` },
        });
        
        if (!response.ok) {
          throw new Error("Failed to fetch statistics");
        }
        
        const data = await response.json();
        setStats({
          totalUsers: data.totalUsers ?? data.stats?.totalUsers ?? 0,
          totalStudents: data.totalStudents ?? data.stats?.totalStudents ?? 0,
          totalProviders: data.totalProviders ?? data.stats?.totalProviders ?? 0,
          totalMentors: data.totalMentors ?? data.stats?.totalMentors ?? 0,
          totalAdmins: data.totalAdmins ?? data.stats?.totalAdmins ?? 0,
          activeUsers: data.activeUsers ?? data.stats?.activeUsers ?? 0,
          newUsersThisMonth: data.newThisMonth ?? data.stats?.newUsersThisMonth ?? 0,
          activeScholarships: data.activeScholarships ?? data.stats?.activeScholarships ?? 0,
          userGrowthByMonth: data.userGrowthByMonth ?? data.stats?.userGrowthByMonth ?? [],
          scholarshipDistribution: data.scholarshipDistribution ?? [],
          applicationsByStatus: data.applicationsByStatus ?? [],
        });
        const activityResponse = await fetch(`${API_URL}/api/admin/activity`, {
          headers: { Authorization: `Bearer ${getAuthToken()}` },
        });
        if (!activityResponse.ok) throw new Error("Failed to fetch recent activity");
        setActivity((await activityResponse.json()).data || []);
      } catch (err) {
        console.error("Error fetching stats:", err);
        setError(err instanceof Error ? err.message : "Failed to load stats");
        setStats(null);
        setActivity([]);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statsCards = stats
    ? [
        {
          title: "Total Users",
          value: stats.totalUsers.toLocaleString(),
          change: `+${stats.newUsersThisMonth} this month`,
          icon: Users,
          color: "text-blue-600",
        },
        {
          title: "Total Students",
          value: stats.totalStudents.toLocaleString(),
          change: `${stats.totalUsers > 0 ? ((stats.totalStudents / stats.totalUsers) * 100).toFixed(1) : "0"}% of users`,
          icon: FileText,
          color: "text-purple-600",
        },
        {
          title: "Active Scholarships",
          value: stats.activeScholarships.toLocaleString(),
          change: "Live DB count",
          icon: Award,
          color: "text-green-600",
        },
        {
          title: "Total Mentors",
          value: stats.totalMentors.toLocaleString(),
          change: `${stats.totalUsers > 0 ? ((stats.totalMentors / stats.totalUsers) * 100).toFixed(1) : "0"}% of users`,
          icon: TrendingUp,
          color: "text-amber-600",
        },
      ]
    : [];
  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground">Overview of platform performance and metrics</p>
      </div>

      {error && (
        <Card className="border-yellow-600 bg-yellow-50 dark:bg-yellow-950/30">
          <CardContent className="pt-6">
            <p className="text-yellow-800 text-sm">Could not load real-time dashboard data. ({error})</p>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{stat.title}</p>
                    <p className="text-3xl font-bold font-mono mb-1">{stat.value}</p>
                    <p className="text-sm text-accent">{stat.change}</p>
                  </div>
                  <div className={`p-3 rounded-lg bg-muted ${stat.color}`}>
                    <Icon className="size-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Growth Chart */}
        <Card>
          <CardHeader>
            <CardTitle>User Growth</CardTitle>
            <CardDescription>Monthly user registration trend</CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.userGrowthByMonth?.length ? <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stats.userGrowthByMonth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="users" stroke="#2563EB" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer> : <p className="py-24 text-center text-muted-foreground">No user growth data available.</p>}
          </CardContent>
        </Card>

        {/* Scholarship Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Scholarship Distribution</CardTitle>
            <CardDescription>Scholarships by type</CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.scholarshipDistribution?.length ? (
              <div className="space-y-4 py-4">
                {stats.scholarshipDistribution.map((item) => {
                  const total = stats.scholarshipDistribution.reduce((sum, entry) => sum + entry.count, 0);
                  return <div key={item.category}><div className="flex justify-between text-sm mb-1"><span>{item.category}</span><span>{item.count}</span></div><div className="h-2 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: `${total ? (item.count / total) * 100 : 0}%` }} /></div></div>;
                })}
              </div>
            ) : <p className="py-24 text-center text-muted-foreground">No active scholarship data available.</p>}
          </CardContent>
        </Card>

        {/* Applications by Status */}
        <Card>
          <CardHeader>
            <CardTitle>Applications by Status</CardTitle>
            <CardDescription>Current application pipeline</CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.applicationsByStatus?.length ? (
              <div className="grid grid-cols-2 gap-3 py-8">
                {stats.applicationsByStatus.map((item) => <div key={item.status} className="rounded-lg border border-border p-4"><p className="text-sm text-muted-foreground">{item.status}</p><p className="text-2xl font-bold">{item.count.toLocaleString()}</p></div>)}
              </div>
            ) : <p className="py-24 text-center text-muted-foreground">No application data available.</p>}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest platform updates</CardDescription>
          </CardHeader>
          <CardContent>
            {activity.length ? <div className="space-y-4 py-2">{activity.map((item, index) => <div key={`${item.createdAt}-${index}`} className="border-b border-border pb-3 last:border-0"><p className="text-sm"><strong>{item.actor}</strong> {item.action} {item.subject}</p><p className="text-xs text-muted-foreground">{item.createdAt ? new Date(item.createdAt).toLocaleString() : "Unknown date"}</p></div>)}</div> : <p className="py-24 text-center text-muted-foreground">No recent activity available.</p>}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button onClick={() => navigate("/admin/users")} className="p-4 border border-border rounded-lg hover:bg-muted transition-colors text-left">
              <Users className="size-8 text-primary mb-2" />
              <p className="font-semibold">Manage Users</p>
              <p className="text-xs text-muted-foreground">View and edit user accounts</p>
            </button>
            <button onClick={() => navigate("/admin/scholarships")} className="p-4 border border-border rounded-lg hover:bg-muted transition-colors text-left">
              <Award className="size-8 text-accent mb-2" />
              <p className="font-semibold">Add Scholarship</p>
              <p className="text-xs text-muted-foreground">Create new scholarship</p>
            </button>
            <button onClick={() => navigate("/admin/applications")} className="p-4 border border-border rounded-lg hover:bg-muted transition-colors text-left">
              <CheckCircle className="size-8 text-green-600 mb-2" />
              <p className="font-semibold">Review Applications</p>
              <p className="text-xs text-muted-foreground">Process pending applications</p>
            </button>
            <button onClick={() => navigate("/admin/reports")} className="p-4 border border-border rounded-lg hover:bg-muted transition-colors text-left">
              <TrendingUp className="size-8 text-purple-600 mb-2" />
              <p className="font-semibold">View Analytics</p>
              <p className="text-xs text-muted-foreground">Detailed reports</p>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
