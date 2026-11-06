import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Label } from "../../components/ui/label";
import { Search, MoreVertical, Eye, Edit, UserX, UserCheck, Download, Loader2, Send } from "lucide-react";
import { fetchAdminUserActivity, fetchAdminUserApplications, resolvePublicAssetUrl } from "../../lib/api-client";
import { getAuthToken } from "../../lib/user-storage";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../components/ui/dropdown-menu";
import { toast } from "sonner";
import { API_URL } from "../../lib/api-client";
import { Textarea } from "../../components/ui/textarea";

interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  type: string;
  status: string;
  joinedDate: string;
  createdAt?: string | null;
  profileCompleteness: number;
}

function initialsFromName(name: string) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  // Edit modal state
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", role: "" });
  const [editSaving, setEditSaving] = useState(false);

  // Action loading
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [messageUser, setMessageUser] = useState<User | null>(null);
  const [messageBody, setMessageBody] = useState("");
  const [userActivity, setUserActivity] = useState<Array<{ action: string; detail: string; createdAt?: string }>>([]);
  const [userApplications, setUserApplications] = useState<Array<Record<string, unknown>>>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const exportUsers = () => {
    const header = ["ID", "Name", "Email", "Role", "Status", "Created At"];
    const rows = filteredUsers.map((user) => [
      user.id,
      user.name,
      user.email,
      user.type,
      user.status,
      user.createdAt || user.joinedDate,
    ]);
    const csv = [header, ...rows].map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `admin-users-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} users.`);
  };

  const sendMessage = () => {
    if (!messageUser || !messageBody.trim()) return;
    const params = new URLSearchParams({
      userId: messageUser.id,
      email: messageUser.email,
      message: messageBody.trim(),
    });
    window.location.href = `/admin/messages?${params.toString()}`;
    setMessageUser(null);
    setMessageBody("");
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = getAuthToken();
      const response = await fetch(`${API_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`Failed to fetch users: ${response.statusText}`);
      const data = await response.json();
      setUsers(Array.isArray(data) ? data : (data.data || []));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const openEdit = (user: User) => {
    setEditForm({ name: user.name, email: user.email, role: user.type.toLowerCase() });
    setEditingUser(user);
  };

  useEffect(() => {
    if (!selectedUser) return;
    setDetailLoading(true);
    Promise.all([fetchAdminUserActivity(selectedUser.id), fetchAdminUserApplications(selectedUser.id)])
      .then(([activity, applications]) => {
        setUserActivity(activity.data || []);
        setUserApplications(applications.data || []);
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load user details."))
      .finally(() => setDetailLoading(false));
  }, [selectedUser]);

  const handleEditSave = async () => {
    if (!editingUser) return;
    setEditSaving(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_URL}/api/admin/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: editForm.name, email: editForm.email, role: editForm.role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update user");
      toast.success("User updated successfully.");
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setEditSaving(false);
    }
  };

  const handleToggleSuspend = async (user: User) => {
    const isSuspended = user.status === "Suspended";
    const action = isSuspended ? "reactivate" : "suspend";
    if (!confirm(`Are you sure you want to ${action} ${user.name}?`)) return;
    setActionLoading(user.id);
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_URL}/api/admin/users/${user.id}/suspend`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ suspended: !isSuspended }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${action} user`);
      toast.success(data.message || `User ${action}d successfully.`);
      fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to ${action} user`);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === "all" || user.type.toLowerCase() === filterType.toLowerCase();
    const matchesStatus = filterStatus === "all" || user.status.toLowerCase() === filterStatus.toLowerCase();
    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div className="p-4 md:p-8 space-y-4 md:space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">User Management</h1>
        <p className="text-muted-foreground">Manage and monitor all platform users</p>
      </div>

      {error && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="pt-6">
            <p className="text-destructive font-semibold">Error loading users: {error}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle>
              All Users ({filteredUsers.length})
              {loading && <Loader2 className="inline size-4 ml-2 animate-spin" />}
            </CardTitle>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 sm:w-[300px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={loading}
                />
              </div>
              <Select value={filterType} onValueChange={setFilterType} disabled={loading}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="student">Students</SelectItem>
                  <SelectItem value="provider">Providers</SelectItem>
                  <SelectItem value="mentor">Mentors</SelectItem>
                  <SelectItem value="admin">Admins</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus} disabled={loading}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
              <Button disabled={loading || filteredUsers.length === 0} onClick={exportUsers}>
                <Download className="size-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No users found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
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
                          <AvatarImage src={resolvePublicAssetUrl(user.avatar)} />
                          <AvatarFallback>{initialsFromName(user.name)}</AvatarFallback>
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
                        <progress
                          className="h-2 w-[100px] overflow-hidden rounded-full"
                          value={user.profileCompleteness}
                          max={100}
                        />
                        <span className="text-sm font-mono">{user.profileCompleteness}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" disabled={actionLoading === user.id}>
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setSelectedUser(user)}>
                            <Eye className="size-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(user)}>
                            <Edit className="size-4 mr-2" />
                            Edit User
                          </DropdownMenuItem>
                          {user.status === "Suspended" ? (
                            <DropdownMenuItem onClick={() => handleToggleSuspend(user)}>
                              <UserCheck className="size-4 mr-2" />
                              Reactivate User
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem className="text-destructive" onClick={() => handleToggleSuspend(user)}>
                              <UserX className="size-4 mr-2" />
                              Suspend User
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Detail Modal */}
      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedUser && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-4 mb-4">
                  <Avatar className="size-20">
                    <AvatarImage src={resolvePublicAssetUrl(selectedUser.avatar)} />
                    <AvatarFallback>{initialsFromName(selectedUser.name)}</AvatarFallback>
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
                          <p className="font-semibold">{selectedUser.profileCompleteness}%</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="activity">
                  <Card>
                    <CardContent className="pt-6">
                      {detailLoading ? <div className="flex justify-center py-8"><Loader2 className="size-5 animate-spin" /></div> : userActivity.length ? <div className="space-y-3">{userActivity.map((item, index) => <div key={`${item.createdAt}-${index}`} className="border-b border-border pb-3 last:border-0"><p className="font-medium">{item.action}</p><p className="text-sm text-muted-foreground">{item.detail}</p><p className="text-xs text-muted-foreground">{item.createdAt ? new Date(item.createdAt).toLocaleString() : "Unknown date"}</p></div>)}</div> : <p className="text-center text-muted-foreground py-8">No recent activity</p>}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="applications">
                  <Card>
                    <CardContent className="pt-6">
                      {detailLoading ? <div className="flex justify-center py-8"><Loader2 className="size-5 animate-spin" /></div> : userApplications.length ? <div className="space-y-3">{userApplications.map((item, index) => <div key={String(item._id || index)} className="border-b border-border pb-3 last:border-0"><p className="font-medium">{String(item.scholarshipName || item.scholarshipTitle || item.scholarshipId || "Scholarship application")}</p><p className="text-sm text-muted-foreground">Status: {String(item.status || "Unknown")}</p><p className="text-xs text-muted-foreground">{item.updatedAt || item.createdAt ? new Date(String(item.updatedAt || item.createdAt)).toLocaleString() : "Unknown date"}</p></div>)}</div> : <p className="text-center text-muted-foreground py-8">No applications found</p>}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              <div className="flex flex-wrap gap-3 pt-4">
                <Button className="flex-1" onClick={() => { setSelectedUser(null); openEdit(selectedUser!); }}>
                  <Edit className="size-4 mr-2" />Edit User
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => setMessageUser(selectedUser)}>
                  <Send className="size-4 mr-2" />Send Message
                </Button>
                <Button
                  variant={selectedUser.status === "Suspended" ? "default" : "destructive"}
                  onClick={() => { setSelectedUser(null); handleToggleSuspend(selectedUser!); }}
                >
                  {selectedUser.status === "Suspended" ? (
                    <><UserCheck className="size-4 mr-1" />Reactivate</>
                  ) : (
                    <><UserX className="size-4 mr-1" />Suspend</>
                  )}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!messageUser} onOpenChange={(open) => { if (!open) setMessageUser(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Message {messageUser?.name}</DialogTitle>
            <DialogDescription>Compose a message addressed to {messageUser?.email}.</DialogDescription>
          </DialogHeader>
          <Textarea value={messageBody} onChange={(event) => setMessageBody(event.target.value)} placeholder="Write your message..." rows={6} />
          <Button onClick={sendMessage} disabled={!messageBody.trim()}><Send className="size-4 mr-2" />Open Email</Button>
        </DialogContent>
      </Dialog>
      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update this user's name, email, or role.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Full Name</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email Address</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select value={editForm.role} onValueChange={(v) => setEditForm((p) => ({ ...p, role: v }))}>
                <SelectTrigger id="edit-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="provider">Provider</SelectItem>
                  <SelectItem value="mentor">Mentor</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3 pt-2">
              <Button className="flex-1" disabled={editSaving} onClick={handleEditSave}>
                {editSaving ? <><Loader2 className="size-4 mr-2 animate-spin" />Saving…</> : "Save Changes"}
              </Button>
              <Button variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
