import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { CheckCircle, XCircle, Clock } from "lucide-react";

const mockApplications = [
  {
    id: 1,
    student: "John Doe",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=user1",
    scholarship: "NSF Merit Scholarship",
    submittedDate: "Apr 10, 2026",
    status: "Under Review",
    matchScore: 95,
  },
  {
    id: 2,
    student: "Sarah Johnson",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=sarah",
    scholarship: "Future Leaders Program",
    submittedDate: "Apr 12, 2026",
    status: "Pending",
    matchScore: 88,
  },
  {
    id: 3,
    student: "Michael Chen",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=michael",
    scholarship: "Innovation Award",
    submittedDate: "Apr 8, 2026",
    status: "Approved",
    matchScore: 92,
  },
  {
    id: 4,
    student: "Emily Rodriguez",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=emily",
    scholarship: "Women in STEM",
    submittedDate: "Apr 15, 2026",
    status: "Under Review",
    matchScore: 90,
  },
];

export function AdminApplications() {
  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Application Review</h1>
        <p className="text-muted-foreground">Review and process scholarship applications</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">New</p>
                <p className="text-3xl font-bold font-mono">890</p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Under Review</p>
                <p className="text-3xl font-bold font-mono">1,240</p>
              </div>
              <Clock className="h-8 w-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-3xl font-bold font-mono">867</p>
              </div>
              <CheckCircle className="h-8 w-8 text-accent" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Rejected</p>
                <p className="text-3xl font-bold font-mono">250</p>
              </div>
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Applications</CardTitle>
            <Select defaultValue="all">
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="review">Under Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Scholarship</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Match Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockApplications.map((app) => (
                <TableRow key={app.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={app.avatar} />
                        <AvatarFallback>{app.student[0]}</AvatarFallback>
                      </Avatar>
                      <span className="font-semibold">{app.student}</span>
                    </div>
                  </TableCell>
                  <TableCell>{app.scholarship}</TableCell>
                  <TableCell>{app.submittedDate}</TableCell>
                  <TableCell>
                    <Badge className="bg-accent font-mono">{app.matchScore}%</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        app.status === "Approved"
                          ? "default"
                          : app.status === "Under Review"
                          ? "secondary"
                          : "outline"
                      }
                      className={app.status === "Approved" ? "bg-accent" : ""}
                    >
                      {app.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="outline">View</Button>
                      {app.status === "Pending" || app.status === "Under Review" ? (
                        <>
                          <Button size="sm" className="bg-accent">Approve</Button>
                          <Button size="sm" variant="destructive">Reject</Button>
                        </>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
