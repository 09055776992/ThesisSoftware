import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Badge } from "../../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Plus, Edit, Trash2, Eye } from "lucide-react";

const mockScholarships = [
  { id: 1, name: "NSF Merit Scholarship", amount: "$25,000", deadline: "May 15, 2026", status: "Active", applications: 245 },
  { id: 2, name: "Future Leaders Program", amount: "$15,000", deadline: "Jun 1, 2026", status: "Active", applications: 189 },
  { id: 3, name: "Innovation Award", amount: "$10,000", deadline: "Apr 30, 2026", status: "Active", applications: 156 },
  { id: 4, name: "Women in STEM", amount: "$20,000", deadline: "Jul 15, 2026", status: "Active", applications: 312 },
  { id: 5, name: "Community Service Award", amount: "$8,000", deadline: "Mar 31, 2026", status: "Closed", applications: 98 },
];

export function AdminScholarships() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Scholarship Management</h1>
          <p className="text-muted-foreground">Create and manage scholarship opportunities</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Scholarship
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Scholarship</DialogTitle>
            </DialogHeader>
            <form className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Scholarship Name</Label>
                <Input id="name" placeholder="e.g., Merit Excellence Award" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" rows={4} placeholder="Describe the scholarship..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Award Amount</Label>
                  <Input id="amount" type="number" placeholder="25000" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deadline">Deadline</Label>
                  <Input id="deadline" type="date" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Scholarship Type</Label>
                <Select>
                  <SelectTrigger id="type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="merit">Merit-Based</SelectItem>
                    <SelectItem value="need">Need-Based</SelectItem>
                    <SelectItem value="athletic">Athletic</SelectItem>
                    <SelectItem value="minority">Minority</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="requirements">Requirements</Label>
                <Textarea id="requirements" rows={3} placeholder="List requirements..." />
              </div>
              <div className="flex gap-3 pt-4">
                <Button type="submit" className="flex-1">Create Scholarship</Button>
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Scholarships ({mockScholarships.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Applications</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockScholarships.map((scholarship) => (
                <TableRow key={scholarship.id}>
                  <TableCell className="font-semibold">{scholarship.name}</TableCell>
                  <TableCell className="font-mono">{scholarship.amount}</TableCell>
                  <TableCell>{scholarship.deadline}</TableCell>
                  <TableCell>
                    <Badge variant={scholarship.status === "Active" ? "default" : "secondary"}>
                      {scholarship.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{scholarship.applications}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
