import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Search, MoreVertical, Eye, Edit, UserX, Download } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../components/ui/dropdown-menu";

const mockUsers = [
  {
    id: 1,
    name: "John Doe",
    email: "john.doe@university.edu",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=user1",
    type: "Student",
    status: "Active",
    joinedDate: "Jan 15, 2024",
    profileComplete: 100,
  },
  {
    id: 2,
    name: "Sarah Johnson",
    email: "sarah.j@mit.edu",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=sarah",
    type: "Student",
    status: "Active",
    joinedDate: "Feb 20, 2024",
    profileComplete: 95,
  },
  {
    id: 3,
    name: "Michael Chen",
    email: "m.chen@stanford.edu",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=michael",
    type: "Student",
    status: "Active",
    joinedDate: "Mar 5, 2024",
    profileComplete: 80,
  },
  {
    id: 4,
    name: "Emily Rodriguez",
    email: "emily.r@jhu.edu",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=emily",
    type: "Student",
    status: "Active",
    joinedDate: "Jan 28, 2024",
    profileComplete: 100,
  },
  {
    id: 5,
    name: "Tech Foundation",
    email: "info@techfoundation.org",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=org1",
    type: "Provider",
    status: "Active",
    joinedDate: "Dec 10, 2023",
    profileComplete: 100,
  },
  {
    id: 6,
    name: "Dr. Amanda Williams",
    email: "a.williams@mentor.edu",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=mentor1",
    type: "Mentor",
    status: "Active",
    joinedDate: "Nov 5, 2023",
    profileComplete: 90,
  },
  {
    id: 7,
    name: "David Lee",
    email: "david.lee@harvard.edu",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=david",
    type: "Student",
    status: "Suspended",
    joinedDate: "Apr 12, 2024",
    profileComplete: 60,
  },
  {
    id: 8,
    name: "Global Scholarship Fund",
    email: "contact@globalscholarship.org",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=org2",
    type: "Provider",
    status: "Active",
    joinedDate: "Oct 1, 2023",
    profileComplete: 100,
  },
];

export function AdminUsers() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<typeof mockUsers[0] | null>(null);
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const filteredUsers = mockUsers.filter((user) => {
    const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === "all" || user.type.toLowerCase() === filterType.toLowerCase();
    const matchesStatus = filterStatus === "all" || user.status.toLowerCase() === filterStatus.toLowerCase();
    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">User Management</h1>
        <p className="text-muted-foreground">Manage and monitor all platform users</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle>All Users ({filteredUsers.length})</CardTitle>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 sm:w-[300px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="student">Students</SelectItem>
                  <SelectItem value="provider">Providers</SelectItem>
                  <SelectItem value="mentor">Mentors</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
              <Button>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined Date</TableHead>
                <TableHead>Profile</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={user.avatar} />
                        <AvatarFallback>{user.name[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold">{user.name}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{user.type}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={user.status === "Active" ? "default" : "destructive"}
                      className={user.status === "Active" ? "bg-accent" : ""}
                    >
                      {user.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{user.joinedDate}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden max-w-[100px]">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${user.profileComplete}%` }}
                        />
                      </div>
                      <span className="text-sm font-mono">{user.profileComplete}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setSelectedUser(user)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit User
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">
                          <UserX className="h-4 w-4 mr-2" />
                          Suspend User
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* User Detail Modal */}
      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedUser && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-4 mb-4">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={selectedUser.avatar} />
                    <AvatarFallback>{selectedUser.name[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <DialogTitle className="text-2xl">{selectedUser.name}</DialogTitle>
                    <DialogDescription>{selectedUser.email}</DialogDescription>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline">{selectedUser.type}</Badge>
                      <Badge className={selectedUser.status === "Active" ? "bg-accent" : "bg-destructive"}>
                        {selectedUser.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <Tabs defaultValue="overview">
                <TabsList className="w-full">
                  <TabsTrigger value="overview" className="flex-1">Overview</TabsTrigger>
                  <TabsTrigger value="activity" className="flex-1">Activity</TabsTrigger>
                  <TabsTrigger value="applications" className="flex-1">Applications</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>User Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">User Type</p>
                          <p className="font-semibold">{selectedUser.type}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Status</p>
                          <p className="font-semibold">{selectedUser.status}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Joined Date</p>
                          <p className="font-semibold">{selectedUser.joinedDate}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Profile Completion</p>
                          <p className="font-semibold">{selectedUser.profileComplete}%</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="activity">
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-center text-muted-foreground py-8">
                        No recent activity
                      </p>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="applications">
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-center text-muted-foreground py-8">
                        No applications found
                      </p>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              <div className="flex gap-3 pt-4">
                <Button className="flex-1">Edit User</Button>
                <Button variant="outline" className="flex-1">Send Message</Button>
                <Button variant="destructive">Suspend</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
