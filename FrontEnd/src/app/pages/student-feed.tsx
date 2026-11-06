import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { Megaphone, Rss, RefreshCw } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { LinkifiedText } from "../components/linkified-text";
import {
  fetchStudentFeed,
  type FeedScholarship,
  type ProviderFeedPost,
  type StudentFeedItem,
} from "../lib/api-client";

function isProviderPost(item: StudentFeedItem): item is ProviderFeedPost {
  return item.feedType === "post";
}

function formatDate(value: string | undefined) {
  if (!value) return "Recently posted";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Recently posted" : date.toLocaleString();
}

export function StudentFeed() {
  const [items, setItems] = useState<StudentFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    fetchStudentFeed()
      .then((result) => setItems(result.data || []))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load feed."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="p-4 md:p-8 max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Discovery Feed</h1>
          <p className="text-muted-foreground">
            Scholarship opportunities, announcements, and updates from verified providers.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`size-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <p className="text-muted-foreground">Loading feed...</p>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Rss className="size-10 mx-auto mb-3 opacity-40" />
            No scholarships or provider announcements are available right now.
          </CardContent>
        </Card>
      ) : (
        items.map((item) =>
          isProviderPost(item) ? (
            <Card key={`post-${item._id}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <Megaphone className="size-5 mt-1 text-blue-600" />
                    <div>
                      <CardTitle>{item.title}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {item.providerName} · {formatDate(item.createdAt)}
                        {item.isEdited && <span className="ml-2 italic">· Edited</span>}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary">{item.type}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap break-words"><LinkifiedText>{item.content}</LinkifiedText></p>
              </CardContent>
            </Card>
          ) : (
            <ScholarshipCard key={`scholarship-${item._id}`} item={item} />
          ),
        )
      )}
    </div>
  );
}

function ScholarshipCard({ item }: { item: FeedScholarship }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>{item.name}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {item.providerName || item.provider || item.organization || "Verified provider"}
            </p>
          </div>
          <Badge>{item.type}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">
          {item.description || "Scholarship opportunity available for eligible students."}
        </p>
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span>Award: ₱{Number(item.amount || 0).toLocaleString()}</span>
          <span>Deadline: {formatDate(item.deadline)}</span>
        </div>
        <Link to="/dashboard/scholarships" className="text-sm text-blue-600 hover:underline">
          View scholarship details
        </Link>
      </CardContent>
    </Card>
  );
}
