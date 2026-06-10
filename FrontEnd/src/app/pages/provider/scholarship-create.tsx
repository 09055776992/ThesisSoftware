import { useState } from "react";
import { useNavigate, Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { ArrowLeft } from "lucide-react";
import { getAuthToken } from "../../lib/user-storage";
import { API_URL } from "../../lib/api-client";

const API_BASE = API_URL;

export function ProviderScholarshipCreate() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    amount: "",
    deadline: "",
    openingDate: "",
    status: "Active",
    type: "Merit-Based",
    fieldOfStudy: "",
    location: "",
    description: "",
    minimumGPA: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.id]: e.target.value }));
  };

  const handleSelect = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE}/api/provider/scholarships`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          amount: Number(formData.amount),
          minimumGPA: formData.minimumGPA ? Number(formData.minimumGPA) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create scholarship");
      navigate("/provider/scholarships");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create scholarship");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/provider/scholarships">
          <Button variant="ghost" size="sm"><ArrowLeft className="size-4 mr-1" /> Back</Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Create Scholarship</h1>
          <p className="text-muted-foreground text-sm">Post a new scholarship opportunity</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Scholarship Details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Scholarship Name *</Label>
              <Input id="name" placeholder="e.g., QCYDO Merit Excellence Award" value={formData.name} onChange={handleChange} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea id="description" rows={4} placeholder="Describe the scholarship, its purpose, and who it's for..." value={formData.description} onChange={handleChange} required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Award Amount (₱) *</Label>
                <Input id="amount" type="number" min="1" placeholder="25000" value={formData.amount} onChange={handleChange} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minimumGPA">Minimum GWA (optional)</Label>
                <Input id="minimumGPA" type="number" step="0.01" min="1" max="5" placeholder="e.g., 1.75" value={formData.minimumGPA} onChange={handleChange} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="openingDate">Opening Date</Label>
                <Input id="openingDate" type="date" value={formData.openingDate} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deadline">Application Deadline *</Label>
                <Input id="deadline" type="date" value={formData.deadline} onChange={handleChange} required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Scholarship Type *</Label>
                <Select value={formData.type} onValueChange={(v) => handleSelect("type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Merit-Based">Merit-Based</SelectItem>
                    <SelectItem value="Need-Based">Need-Based</SelectItem>
                    <SelectItem value="Athletic">Athletic</SelectItem>
                    <SelectItem value="Minority">Minority</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => handleSelect("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fieldOfStudy">Field of Study</Label>
                <Input id="fieldOfStudy" placeholder="e.g., Computer Science" value={formData.fieldOfStudy} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input id="location" placeholder="e.g., Quezon City" value={formData.location} onChange={handleChange} />
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-3 pt-2">
              <Button type="submit" className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Scholarship"}
              </Button>
              <Link to="/provider/scholarships">
                <Button type="button" variant="outline">Cancel</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
