import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Download, TrendingUp, Users, Award, DollarSign } from "lucide-react";
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const engagementData = [
  { month: "Jan", posts: 450, comments: 890, likes: 2340 },
  { month: "Feb", posts: 520, comments: 1020, likes: 2890 },
  { month: "Mar", posts: 680, comments: 1240, likes: 3560 },
  { month: "Apr", posts: 790, comments: 1450, likes: 4120 },
];

const scholarshipData = [
  { month: "Jan", awarded: 45000, applied: 120000 },
  { month: "Feb", awarded: 67000, applied: 145000 },
  { month: "Mar", awarded: 89000, applied: 178000 },
  { month: "Apr", awarded: 102000, applied: 205000 },
];

export function AdminAnalytics() {
  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Analytics & Reports</h1>
          <p className="text-muted-foreground">Detailed platform insights and metrics</p>
        </div>
        <div className="flex gap-3">
          <Select defaultValue="30days">
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7days">Last 7 Days</SelectItem>
              <SelectItem value="30days">Last 30 Days</SelectItem>
              <SelectItem value="90days">Last 90 Days</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
          <Button>
            <Download className="size-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Users</p>
                <p className="text-3xl font-bold font-mono mb-1">12,458</p>
                <p className="text-sm text-accent flex items-center gap-1">
                  <TrendingUp className="size-3" /> +12.5% from last month
                </p>
              </div>
              <Users className="size-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Active Scholarships</p>
                <p className="text-3xl font-bold font-mono mb-1">156</p>
                <p className="text-sm text-accent flex items-center gap-1">
                  <TrendingUp className="size-3" /> +8 new this month
                </p>
              </div>
              <Award className="size-8 text-accent" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Applications</p>
                <p className="text-3xl font-bold font-mono mb-1">3,247</p>
                <p className="text-sm text-accent flex items-center gap-1">
                  <TrendingUp className="size-3" /> +23.1% from last month
                </p>
              </div>
              <Award className="size-8 text-secondary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Funds Awarded</p>
                <p className="text-3xl font-bold font-mono mb-1">$2.4M</p>
                <p className="text-sm text-accent flex items-center gap-1">
                  <TrendingUp className="size-3" /> +15.3% from last month
                </p>
              </div>
              <DollarSign className="size-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Platform Engagement</CardTitle>
            <CardDescription>User activity over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={engagementData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="posts" stackId="1" stroke="#2563EB" fill="#2563EB" />
                <Area type="monotone" dataKey="comments" stackId="1" stroke="#10B981" fill="#10B981" />
                <Area type="monotone" dataKey="likes" stackId="1" stroke="#F59E0B" fill="#F59E0B" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scholarship Funding</CardTitle>
            <CardDescription>Applied vs. awarded amounts</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={scholarshipData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="applied" fill="#2563EB" name="Applied ($)" />
                <Bar dataKey="awarded" fill="#10B981" name="Awarded ($)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Key Metrics</CardTitle>
          <CardDescription>Important performance indicators</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Average Application Success Rate</p>
              <p className="text-4xl font-bold font-mono mb-2">26.7%</p>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-accent" style={{ width: "26.7%" }} />
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">User Retention Rate</p>
              <p className="text-4xl font-bold font-mono mb-2">84.3%</p>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: "84.3%" }} />
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">Profile Completion Rate</p>
              <p className="text-4xl font-bold font-mono mb-2">71.2%</p>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-secondary" style={{ width: "71.2%" }} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
