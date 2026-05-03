import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Slider } from "../components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Separator } from "../components/ui/separator";
import { Search, Calendar, MapPin, Award, Bookmark, ExternalLink } from "lucide-react";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { fetchRecommendedScholarships } from "../lib/api-client";
import { getStoredUser } from "../lib/user-storage";

const SAVED_SCHOLARSHIPS_KEY = "scholarship-portal-saved-scholarships";

const fieldOfStudyOptions = [
  { value: "all", label: "All Fields" },
  { value: "computer-science", label: "Computer Science" },
  { value: "information-technology", label: "Information Technology" },
  { value: "nursing", label: "Nursing" },
  { value: "education", label: "Education" },
  { value: "engineering", label: "Engineering" },
  { value: "accountancy", label: "Accountancy" },
  { value: "business-administration", label: "Business Administration" },
  { value: "psychology", label: "Psychology" },
  { value: "architecture", label: "Architecture" },
  { value: "criminology", label: "Criminology" },
  { value: "medicine", label: "Medicine" },
];

const scholarshipTypeOptions = [
  { value: "all", label: "All Types" },
  { value: "qcydo-scholarship", label: "QCYDO Scholarship" },
  { value: "qc-academic-excellence-grant", label: "QC Academic Excellence Grant" },
  { value: "qc-barangay-scholarship", label: "QC Barangay Scholarship" },
  { value: "qc-pwd-scholarship", label: "QC PWD Scholarship" },
  { value: "qc-solo-parent-scholarship", label: "QC Solo Parent Scholarship" },
  { value: "qc-indigenous-peoples-grant", label: "QC Indigenous Peoples Grant" },
];

const gpaOptions = [
  { value: "all", label: "Any GPA" },
  { value: "1.50", label: "1.00–1.50 (Excellent)" },
  { value: "2.00", label: "1.51–2.00 (Very Good)" },
  { value: "2.50", label: "2.01–2.50 (Good)" },
  { value: "3.00", label: "2.51–3.00 (Satisfactory)" },
];

type Scholarship = typeof mockScholarships[number] & {
  fieldOfStudy?: string;
  minimumGpa?: number;
  saved?: boolean;
  isStableMatch?: boolean;
  amountValue?: number;
};

function loadSavedScholarships(): number[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(SAVED_SCHOLARSHIPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((value) => Number(value)).filter(Number.isFinite) : [];
  } catch {
    return [];
  }
}

function saveScholarships(ids: number[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SAVED_SCHOLARSHIPS_KEY, JSON.stringify(ids));
}

const mockScholarships = [
  {
    id: 1,
    name: "National Science Foundation Merit Scholarship",
    provider: "National Science Foundation",
    image: "https://images.unsplash.com/photo-1766226083712-be8e02074247?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx1bml2ZXJzaXR5JTIwZWR1Y2F0aW9uJTIwYWNhZGVtaWMlMjBidWlsZGluZ3xlbnwxfHx8fDE3NzYzNjExNjJ8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    amount: "₱25,000",
    deadline: "May 15, 2026",
    type: "QCYDO Scholarship",
    matchScore: 95,
    location: "Quezon City",
    fieldOfStudy: "computer-science",
    minimumGpa: 1.5,
    eligibility: "Undergraduate students in STEM fields with GPA 3.5+",
    requirements: ["Transcript", "Letters of Recommendation", "Essay"],
    description: "The NSF Merit Scholarship supports outstanding undergraduate students pursuing degrees in science, technology, engineering, and mathematics. Recipients receive ₱25,000 per year, renewable for up to four years.",
  },
  {
    id: 2,
    name: "Future Leaders Scholarship Program",
    provider: "Global Education Foundation",
    image: "https://images.unsplash.com/photo-1604594849809-dfedbc827105?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzY2hvbGFyc2hpcCUyMG1vbmV5JTIwZWR1Y2F0aW9uJTIwZnVuZGluZ3xlbnwxfHx8fDE3NzYzNjExNjN8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    amount: "₱15,000",
    deadline: "June 1, 2026",
    type: "QC Academic Excellence Grant",
    matchScore: 88,
    location: "Quezon City",
    fieldOfStudy: "business-administration",
    minimumGpa: 2.5,
    eligibility: "Students demonstrating financial need and academic excellence",
    requirements: ["Financial Documents", "Transcript", "Personal Statement"],
    description: "This scholarship aims to support students from underrepresented backgrounds who demonstrate both financial need and academic potential.",
  },
  {
    id: 3,
    name: "Innovation in Technology Award",
    provider: "Tech Leaders Association",
    image: "https://images.unsplash.com/photo-1760493828288-d2dbb70d18c9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzY2llbmNlJTIwdGVjaG5vbG9neSUyMHJlc2VhcmNoJTIwbGFib3JhdG9yeXxlbnwxfHx8fDE3NzYzNjExNjN8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    amount: "₱10,000",
    deadline: "April 30, 2026",
    type: "QC Barangay Scholarship",
    matchScore: 82,
    location: "Quezon City",
    fieldOfStudy: "information-technology",
    minimumGpa: 2,
    eligibility: "Computer Science or Engineering students with innovative projects",
    requirements: ["Project Portfolio", "Transcript", "Recommendation Letter"],
    description: "Recognizes students who have demonstrated exceptional innovation in technology through projects, research, or entrepreneurial ventures.",
  },
  {
    id: 4,
    name: "Women in STEM Excellence Scholarship",
    provider: "STEM Diversity Initiative",
    image: "https://images.unsplash.com/photo-1766226083712-be8e02074247?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx1bml2ZXJzaXR5JTIwZWR1Y2F0aW9uJTIwYWNhZGVtaWMlMjBidWlsZGluZ3xlbnwxfHx8fDE3NzYzNjExNjJ8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    amount: "₱20,000",
    deadline: "July 15, 2026",
    type: "QC PWD Scholarship",
    matchScore: 78,
    location: "Quezon City",
    fieldOfStudy: "nursing",
    minimumGpa: 2.5,
    eligibility: "Female students pursuing STEM degrees",
    requirements: ["Transcript", "Essay on STEM Impact", "References"],
    description: "Supporting women pursuing careers in science, technology, engineering, and mathematics fields.",
  },
  {
    id: 5,
    name: "Community Service Leadership Award",
    provider: "Civic Engagement Foundation",
    image: "https://images.unsplash.com/photo-1604594849809-dfedbc827105?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzY2hvbGFyc2hpcCUyMG1vbmV5JTIwZWR1Y2F0aW9uJTIwZnVuZGluZ3xlbnwxfHx8fDE3NzYzNjExNjN8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    amount: "₱8,000",
    deadline: "March 31, 2026",
    type: "QC Solo Parent Scholarship",
    matchScore: 75,
    location: "Quezon City",
    fieldOfStudy: "psychology",
    minimumGpa: 3,
    eligibility: "Students with documented community service experience",
    requirements: ["Service Documentation", "Recommendation Letters", "Essay"],
    description: "Rewards students who have made significant contributions to their communities through volunteer work and leadership.",
  },
  {
    id: 6,
    name: "First-Generation College Student Grant",
    provider: "Education Access Coalition",
    image: "https://images.unsplash.com/photo-1760493828288-d2dbb70d18c9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzY2llbmNlJTIwdGVjaG5vbG9neSUyMHJlc2VhcmNoJTIwbGFib3JhdG9yeXxlbnwxfHx8fDE3NzYzNjExNjN8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    amount: "₱12,000",
    deadline: "May 30, 2026",
    type: "QC Indigenous Peoples Grant",
    matchScore: 72,
    location: "Quezon City",
    fieldOfStudy: "education",
    minimumGpa: 3,
    eligibility: "First-generation college students with financial need",
    requirements: ["FAFSA", "Transcript", "Personal Statement"],
    description: "Designed to support students who are the first in their families to attend college.",
  },
];

export function Scholarships() {
  const [selectedScholarship, setSelectedScholarship] = useState<typeof mockScholarships[0] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [amountRange, setAmountRange] = useState([0, 50000]);
  const [scholarshipsData, setScholarshipsData] = useState<Scholarship[]>(mockScholarships);
  const [selectedType, setSelectedType] = useState("all");
  const [selectedField, setSelectedField] = useState("all");
  const [selectedLocation, setSelectedLocation] = useState("all");
  const [selectedGpa, setSelectedGpa] = useState("all");
  const [savedScholarships, setSavedScholarships] = useState<number[]>([]);

  useEffect(() => {
    setSavedScholarships(loadSavedScholarships());
  }, []);

  useEffect(() => {
    fetchRecommendedScholarships(getStoredUser())
      .then((result) => {
        const normalized = (result.data || [])
          .map((item, idx) => {
            const id = Number(item.id) || idx + 1;
            const amount = typeof item.amount === "string" ? item.amount : "₱0";
            return {
              id,
              name: String(item.name || ""),
              provider: String(item.provider || ""),
              image: String(item.image || ""),
              amount,
              deadline: String(item.deadline || "December 31, 2030"),
              type: String(item.type || "Merit-Based"),
              matchScore: Number(item.matchScore || 0),
              location: String(item.location || "International"),
              fieldOfStudy: String(item.fieldOfStudy || ""),
              minimumGpa: Number(item.minimumGpa || 0) || undefined,
              eligibility: String(item.eligibility || ""),
              requirements: Array.isArray(item.requirements) ? item.requirements.map((v) => String(v)) : [],
              description: String(item.description || ""),
            };
          })
          .filter((item) => item.name);

        if (normalized.length > 0) {
          setScholarshipsData(normalized);
        }
      })
      .catch(() => {
        // Keep fallback mock scholarships if backend is unavailable.
      });
  }, []);

  const recommendedScholarships = useMemo(() => {
    return scholarshipsData
      .map((scholarship) => ({
        ...scholarship,
        amountValue: Number(scholarship.amount.replace(/[₱$,]/g, "")) || 0,
      }))
      .filter((scholarship) => scholarship.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .filter((scholarship) => scholarship.amountValue >= amountRange[0] && scholarship.amountValue <= amountRange[1])
      .filter((scholarship) => selectedType === "all" || scholarship.type.toLowerCase().includes(selectedType.replace(/-/g, " ")))
      .filter((scholarship) => selectedLocation === "all" || scholarship.location.toLowerCase() === "quezon city")
      .filter((scholarship) => selectedField === "all" || scholarship.fieldOfStudy === selectedField)
      .filter((scholarship) => {
        if (selectedGpa === "all") return true;
        const scholarshipGpa = scholarship.minimumGpa ?? 0;
        return scholarshipGpa <= Number(selectedGpa);
      });
  }, [amountRange, scholarshipsData, searchQuery, selectedField, selectedGpa, selectedLocation, selectedType]);

  const toggleSavedScholarship = (scholarshipId: number) => {
    setSavedScholarships((current) => {
      const next = current.includes(scholarshipId)
        ? current.filter((id) => id !== scholarshipId)
        : [...current, scholarshipId];

      saveScholarships(next);
      return next;
    });
  };

  return (
    <div className="py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Discover Scholarships</h1>
          <p className="text-muted-foreground">
            Find and apply for scholarships that match your profile
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Filters Panel */}
          <aside className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>Filters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Search */}
                <div className="space-y-2">
                  <Label htmlFor="search">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search"
                      placeholder="Search scholarships..."
                      className="pl-9"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>

                <Separator />

                {/* Scholarship Type */}
                <div className="space-y-2">
                  <Label htmlFor="type">Scholarship Type</Label>
                  <Select value={selectedType} onValueChange={setSelectedType}>
                    <SelectTrigger id="type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {scholarshipTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Amount Range */}
                <div className="space-y-3">
                  <Label>Amount Range</Label>
                  <Slider
                    value={amountRange}
                    onValueChange={setAmountRange}
                    max={50000}
                    step={1000}
                    className="mb-2"
                  />
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>₱{amountRange[0].toLocaleString()}</span>
                    <span>₱{amountRange[1].toLocaleString()}</span>
                  </div>
                </div>

                {/* Field of Study */}
                <div className="space-y-2">
                  <Label htmlFor="field">Field of Study</Label>
                  <Select value={selectedField} onValueChange={setSelectedField}>
                    <SelectTrigger id="field">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fieldOfStudyOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Location */}
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                    <SelectTrigger id="location">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Locations</SelectItem>
                      <SelectItem value="quezon-city">Quezon City</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* GPA Requirement */}
                <div className="space-y-2">
                  <Label htmlFor="gpa">Minimum GPA</Label>
                  <Select value={selectedGpa} onValueChange={setSelectedGpa}>
                    <SelectTrigger id="gpa">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {gpaOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Button className="w-full">Apply Filters</Button>
                  <Button variant="ghost" className="w-full">Clear All</Button>
                </div>
              </CardContent>
            </Card>
          </aside>

          {/* Scholarships Grid */}
          <div className="lg:col-span-3">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {recommendedScholarships.length} scholarships
              </p>
              <Select defaultValue="match">
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="match">Best Match</SelectItem>
                  <SelectItem value="amount">Highest Amount</SelectItem>
                  <SelectItem value="deadline">Deadline Soon</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {recommendedScholarships.map((scholarship) => (
                <Card
                  key={scholarship.id}
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => setSelectedScholarship(scholarship)}
                >
                  <div className="relative">
                    <ImageWithFallback
                      src={scholarship.image}
                      alt={scholarship.name}
                      className="w-full h-40 object-cover rounded-t-lg"
                    />
                    <div className="absolute top-2 right-2 flex gap-2">
                      {scholarship.isStableMatch && <Badge variant="secondary">Stable Match</Badge>}
                      <Badge className="bg-accent">{scholarship.matchScore}% Match</Badge>
                    </div>
                  </div>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base line-clamp-2">
                        {scholarship.type}
                      </CardTitle>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={savedScholarships.includes(scholarship.id)
                          ? "text-green-600 hover:text-green-700 hover:bg-green-50"
                          : "text-muted-foreground hover:text-green-600 hover:bg-green-50"}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSavedScholarship(scholarship.id);
                        }}
                        aria-pressed={savedScholarships.includes(scholarship.id)}
                        aria-label={savedScholarships.includes(scholarship.id) ? "Unsave scholarship" : "Save scholarship"}
                      >
                        <Bookmark className={`h-4 w-4 ${savedScholarships.includes(scholarship.id) ? "fill-current" : ""}`} />
                      </Button>
                    </div>
                    <CardDescription className="line-clamp-1">
                      {scholarship.provider}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-2xl font-bold text-primary font-mono">
                          {scholarship.amount}
                        </span>
                      </div>
                      <Separator />
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span>Due: {scholarship.deadline}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          <span>{scholarship.location}</span>
                        </div>
                      </div>
                      <Button className="w-full" size="sm">
                        View Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Scholarship Detail Modal */}
      <Dialog open={!!selectedScholarship} onOpenChange={() => setSelectedScholarship(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
          {selectedScholarship && (
            <>
              <DialogHeader>
                <div className="mb-4">
                  <ImageWithFallback
                    src={selectedScholarship.image}
                    alt={selectedScholarship.name}
                    className="w-full h-48 object-cover rounded-lg"
                  />
                </div>
                <DialogTitle className="text-2xl">{selectedScholarship.name}</DialogTitle>
                <DialogDescription>{selectedScholarship.provider}</DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="min-w-0">
                    <p className="text-3xl font-bold text-primary font-mono">
                      {selectedScholarship.amount}
                    </p>
                    <p className="text-sm text-muted-foreground">Award Amount</p>
                  </div>
                  <Separator orientation="vertical" className="hidden h-12 sm:block" />
                  <div className="min-w-0">
                    <p className="text-xl font-semibold">{selectedScholarship.deadline}</p>
                    <p className="text-sm text-muted-foreground">Application Deadline</p>
                  </div>
                  <Separator orientation="vertical" className="hidden h-12 sm:block" />
                  <div className="min-w-0">
                    <Badge className="bg-accent text-lg px-3 py-1">
                      {selectedScholarship.matchScore}% Match
                    </Badge>
                    <p className="text-sm text-muted-foreground mt-1">Your Match Score</p>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold mb-2">Description</h3>
                  <p className="text-muted-foreground">{selectedScholarship.description}</p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Eligibility Requirements</h3>
                  <p className="text-muted-foreground">{selectedScholarship.eligibility}</p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Required Documents</h3>
                  <ul className="space-y-2">
                    {selectedScholarship.requirements.map((req, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <Award className="h-4 w-4 text-accent" />
                        <span>{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button className="flex-1 min-w-0">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Apply Now
                  </Button>
                  <Button
                    variant="outline"
                    className={`flex-1 min-w-0 ${savedScholarships.includes(selectedScholarship.id) ? "border-green-500 text-green-700 bg-green-50 hover:bg-green-100" : ""}`}
                    onClick={() => toggleSavedScholarship(selectedScholarship.id)}
                  >
                    <Bookmark className={`h-4 w-4 mr-2 ${savedScholarships.includes(selectedScholarship.id) ? "fill-current" : ""}`} />
                    {savedScholarships.includes(selectedScholarship.id) ? "Saved" : "Save for Later"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
