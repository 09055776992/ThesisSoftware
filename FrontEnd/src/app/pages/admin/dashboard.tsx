import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Users, Award, FileText, TrendingUp, DollarSign, CheckCircle } from "lucide-react";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const statsCards = [
  {
    title: "Total Users",
    value: "12,458",
    change: "+12.5%",
    icon: Users,
    color: "text-blue-600",
  },
  {
    title: "Active Scholarships",
    value: "156",
    change: "+8 new",
    icon: Award,
    color: "text-green-600",
  },
  {
    title: "Applications Submitted",
    value: "3,247",
    change: "+23.1%",
    icon: FileText,
    color: "text-purple-600",
  },
  {
    title: "Total Awards Distributed",
    value: "$2.4M",
    change: "+15.3%",
    icon: DollarSign,
    color: "text-amber-600",
  },
];

const userGrowthData = [
  { month: "Jan", users: 1200 },
  { month: "Feb", users: 1890 },
  { month: "Mar", users: 2400 },
  { month: "Apr", users: 3200 },
  { month: "May", users: 4100 },
  { month: "Jun", users: 5200 },
  { month: "Jul", users: 6800 },
  { month: "Aug", users: 8200 },
  { month: "Sep", users: 9600 },
  { month: "Oct", users: 10800 },
  { month: "Nov", users: 11900 },
  { month: "Dec", users: 12458 },
];

const scholarshipDistribution = [
  { name: "Merit-Based", value: 45 },
  { name: "Need-Based", value: 30 },
  { name: "Athletic", value: 15 },
  { name: "Minority", value: 10 },
];

const applicationsByStatus = [
  { status: "Pending", count: 890 },
  { status: "Under Review", count: 1240 },
  { status: "Approved", count: 867 },
  { status: "Rejected", count: 250 },
];

const COLORS = ["#2563EB", "#10B981", "#F59E0B", "#EF4444"];

const recentActivity = [
  {
    user: "John Smith",
    action: "Applied for NSF Merit Scholarship",
    time: "2 minutes ago",
  },
  {
    user: "Admin Team",
    action: "Approved 15 scholarship applications",
    time: "1 hour ago",
  },
  {
    user: "Sarah Johnson",
    action: "Created new scholarship: Tech Leaders Award",
    time: "3 hours ago",
  },
  {
    user: "Michael Chen",
    action: "Updated profile with academic documents",
    time: "5 hours ago",
  },
  {
    user: "System",
    action: "Generated monthly analytics report",
    time: "1 day ago",
  },
];

export function AdminDashboard() {
  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground">Overview of platform performance and metrics</p>
      </div>

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
                    <Icon className="h-6 w-6" />
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
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={userGrowthData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="users" stroke="#2563EB" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Scholarship Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Scholarship Distribution</CardTitle>
            <CardDescription>Scholarships by type</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={scholarshipDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {scholarshipDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Applications by Status */}
        <Card>
          <CardHeader>
            <CardTitle>Applications by Status</CardTitle>
            <CardDescription>Current application pipeline</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={applicationsByStatus}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="status" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#2563EB" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest platform updates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="h-2 w-2 rounded-full bg-primary mt-2" />
                  <div className="flex-1">
                    <p className="text-sm">
                      <span className="font-semibold">{activity.user}</span> {activity.action}
                    </p>
                    <p className="text-xs text-muted-foreground">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
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
            <button className="p-4 border border-border rounded-lg hover:bg-muted transition-colors text-left">
              <Users className="h-8 w-8 text-primary mb-2" />
              <p className="font-semibold">Manage Users</p>
              <p className="text-xs text-muted-foreground">View and edit user accounts</p>
            </button>
            <button className="p-4 border border-border rounded-lg hover:bg-muted transition-colors text-left">
              <Award className="h-8 w-8 text-accent mb-2" />
              <p className="font-semibold">Add Scholarship</p>
              <p className="text-xs text-muted-foreground">Create new scholarship</p>
            </button>
            <button className="p-4 border border-border rounded-lg hover:bg-muted transition-colors text-left">
              <CheckCircle className="h-8 w-8 text-green-600 mb-2" />
              <p className="font-semibold">Review Applications</p>
              <p className="text-xs text-muted-foreground">Process pending applications</p>
            </button>
            <button className="p-4 border border-border rounded-lg hover:bg-muted transition-colors text-left">
              <TrendingUp className="h-8 w-8 text-purple-600 mb-2" />
              <p className="font-semibold">View Analytics</p>
              <p className="text-xs text-muted-foreground">Detailed reports</p>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
