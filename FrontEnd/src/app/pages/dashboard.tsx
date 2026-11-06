import { useCallback, useEffect, useRef, useState } from "react";
import { ImageIcon, Paperclip, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Textarea } from "../components/ui/textarea";
import { StudentPostCard } from "../components/student-post-card";
import {
  createStudentPost,
  fetchStudentHomePosts,
  pickProfileImageUrl,
  resolvePublicAssetUrl,
  type StudentPost,
} from "../lib/api-client";
import { getInitials, getStoredUser } from "../lib/user-storage";

type PostFilter = "all" | StudentPost["category"];

const categories: Array<{ value: StudentPost["category"]; label: string }> = [
  { value: "academic", label: "Academic" },
  { value: "achievements", label: "Achievements" },
  { value: "updates", label: "Updates" },
  { value: "appreciation", label: "Appreciation" },
];

export function Dashboard() {
  const [posts, setPosts] = useState<StudentPost[]>([]);
  const [postContent, setPostContent] = useState("");
  const [category, setCategory] = useState<StudentPost["category"]>("updates");
  const [activeFilter, setActiveFilter] = useState<PostFilter>("all");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const photoInput = useRef<HTMLInputElement>(null);
  const documentInput = useRef<HTMLInputElement>(null);
  const user = getStoredUser();

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchStudentHomePosts();
      setPosts(result.data || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load scholar posts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  const addAttachments = (files: FileList | null) => {
    if (!files?.length) return;
    const added = Array.from(files);
    if (attachments.length + added.length > 5) {
      setError("You can attach up to five photos or documents to a post.");
      return;
    }
    if (added.some((file) => file.size > 5 * 1024 * 1024)) {
      setError("Each attachment must be 5 MB or smaller.");
      return;
    }
    setError("");
    setAttachments((current) => [...current, ...added]);
  };

  const publish = async () => {
    if (!postContent.trim()) {
      setError("Write something before submitting your post.");
      return;
    }
    setPublishing(true);
    setError("");
    setNotice("");
    try {
      const result = await createStudentPost({
        content: postContent.trim(),
        category,
        attachments,
      });
      setPostContent("");
      setAttachments([]);
      setNotice(result.message || "Your post was submitted for admin review.");
      await loadPosts();
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "Failed to submit your post.");
    } finally {
      setPublishing(false);
    }
  };

  const visiblePosts = posts.filter((post) =>
    post.moderationStatus === "pending" || activeFilter === "all" || post.category === activeFilter,
  );
  const profileImage = pickProfileImageUrl(user as Record<string, unknown>) || user?.profileImage;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Avatar>
              <AvatarImage
                key={profileImage}
                src={resolvePublicAssetUrl(profileImage, true)}
              />
              <AvatarFallback>{getInitials(user)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 space-y-3">
              <Textarea
                placeholder="What's on your mind?"
                value={postContent}
                onChange={(event) => setPostContent(event.target.value)}
                className="min-h-[110px] resize-y"
                maxLength={5000}
                aria-label="Write a scholar post"
              />
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="student-post-category" className="text-sm text-muted-foreground">Category</label>
                <select
                  id="student-post-category"
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  value={category}
                  onChange={(event) => setCategory(event.target.value as StudentPost["category"])}
                >
                  {categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                <span className="ml-auto text-xs text-muted-foreground">{postContent.length}/5000</span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                <div className="flex gap-1">
                  <input
                    ref={photoInput}
                    type="file"
                    accept="image/jpeg,image/png"
                    multiple
                    className="hidden"
                    onChange={(event) => {
                      addAttachments(event.target.files);
                      event.currentTarget.value = "";
                    }}
                  />
                  <input
                    ref={documentInput}
                    type="file"
                    accept="application/pdf"
                    multiple
                    className="hidden"
                    onChange={(event) => {
                      addAttachments(event.target.files);
                      event.currentTarget.value = "";
                    }}
                  />
                  <Button type="button" variant="ghost" size="sm" onClick={() => photoInput.current?.click()}>
                    <ImageIcon className="mr-2 size-4" /> Photo
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => documentInput.current?.click()}>
                    <Paperclip className="mr-2 size-4" /> Document
                  </Button>
                </div>
                <Button type="button" size="sm" onClick={publish} disabled={publishing || !postContent.trim()}>
                  {publishing ? "Submitting..." : "Post"}
                </Button>
              </div>
              {attachments.length > 0 && (
                <ul className="space-y-1">
                  {attachments.map((file, index) => (
                    <li key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center gap-2 text-sm">
                      <span className="min-w-0 flex-1 truncate">{file.name}</span>
                      <Badge variant="outline">{file.type === "application/pdf" ? "Document" : "Photo"}</Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${file.name}`}
                        onClick={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                      >
                        <X className="size-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              {notice && <p role="status" className="text-sm text-green-700">{notice}</p>}
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <p className="text-xs text-muted-foreground">Posts appear to others after admin approval. Up to 5 PDF/JPEG/PNG files, 5 MB each.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeFilter} onValueChange={(value) => setActiveFilter(value as PostFilter)}>
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="all">All</TabsTrigger>
          {categories.map((item) => <TabsTrigger key={item.value} value={item.value}>{item.label}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      <div className="space-y-5">
        {loading ? (
          <p className="py-8 text-center text-muted-foreground">Loading scholar posts...</p>
        ) : visiblePosts.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">No approved posts yet. Share an update with the scholar community.</CardContent></Card>
        ) : visiblePosts.map((post) => (
          <StudentPostCard key={post._id} post={post} showModerationStatus />
        ))}
      </div>
    </div>
  );
}
