import { useCallback, useEffect, useState } from "react";
import { Check, RefreshCw, ShieldAlert, Trash2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { StudentPostCard } from "../../components/student-post-card";
import { fetchAdminStudentPosts, moderateStudentPost, type StudentPost } from "../../lib/api-client";

export function AdminStudentPostModeration() {
  const [posts, setPosts] = useState<StudentPost[]>([]);
  const [reviewFilter, setReviewFilter] = useState<"pending" | "approved">("pending");
  const [loading, setLoading] = useState(true);
  const [busyPostId, setBusyPostId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchAdminStudentPosts(reviewFilter);
      setPosts(result.data || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load posts for review.");
    } finally {
      setLoading(false);
    }
  }, [reviewFilter]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  const review = async (post: StudentPost, action: "approve" | "remove" | "warn") => {
    let reason = "";
    if (action === "remove" || action === "warn") {
      const prompt = action === "warn" ? "Enter the warning reason to send to this scholar:" : "Enter the reason for removing this post:";
      const answer = window.prompt(prompt);
      if (answer === null) return;
      reason = answer.trim();
      if (!reason) {
        setError("A reason is required for a warning or removal.");
        return;
      }
    } else if (!window.confirm("Approve this post so it becomes visible to students and providers?")) {
      return;
    }

    setBusyPostId(post._id);
    setError("");
    setNotice("");
    try {
      const result = await moderateStudentPost(post._id, action, reason);
      setNotice(result.message);
      await loadPosts();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Failed to update post moderation.");
    } finally {
      setBusyPostId("");
    }
  };

  return (
    <div className="p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Scholar Post Review</h1>
            <p className="text-muted-foreground">Review pending posts and manage content already shared with students and providers.</p>
          </div>
          <Button type="button" variant="outline" onClick={() => void loadPosts()} disabled={loading}>
            <RefreshCw className={`mr-2 size-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        {notice && <p role="status" className="text-sm text-green-700">{notice}</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-2">
          <Button type="button" variant={reviewFilter === "pending" ? "default" : "outline"} onClick={() => setReviewFilter("pending")}>
            Pending review
          </Button>
          <Button type="button" variant={reviewFilter === "approved" ? "default" : "outline"} onClick={() => setReviewFilter("approved")}>
            Published posts
          </Button>
        </div>

        {loading ? (
          <p className="py-10 text-center text-muted-foreground">Loading posts for review...</p>
        ) : posts.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">There are no posts awaiting review.</CardContent></Card>
        ) : (
          posts.map((post) => (
            <section key={post._id} className="space-y-3">
              <StudentPostCard post={post} showModerationStatus />
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" disabled={busyPostId === post._id} onClick={() => void review(post, "warn")}>
                  <ShieldAlert className="mr-2 size-4" /> Warn author
                </Button>
                <Button type="button" variant="destructive" disabled={busyPostId === post._id} onClick={() => void review(post, "remove")}>
                  <Trash2 className="mr-2 size-4" /> Remove
                </Button>
                {reviewFilter === "pending" && (
                  <Button type="button" disabled={busyPostId === post._id} onClick={() => void review(post, "approve")}>
                    <Check className="mr-2 size-4" /> Approve
                  </Button>
                )}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
