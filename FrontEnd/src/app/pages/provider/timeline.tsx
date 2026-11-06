import { useEffect, useState } from "react";
import { Link } from "react-router";
import type { FormEvent } from "react";
import { Megaphone, Plus, RefreshCw, Pencil, Trash2, X } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { LinkifiedText } from "../../components/linkified-text";
import {
  fetchProviderTimeline,
  createProviderFeedPost,
  updateProviderFeedPost,
  deleteProviderFeedPost,
  type FeedScholarship,
  type ProviderFeedPost,
} from "../../lib/api-client";

type TimelineItem = FeedScholarship | ProviderFeedPost;

export function ProviderTimeline() {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState<"announcement" | "update">("update");
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    fetchProviderTimeline().then((result) => setItems(result.data || [])).catch((err) => setError(err instanceof Error ? err.message : "Failed to load timeline.")).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const publish = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setPublishing(true);
    setError("");
    try {
      await createProviderFeedPost({ title, content, type });
      setTitle("");
      setContent("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish update.");
    } finally {
      setPublishing(false);
    }
  };

  const startEditing = (post: ProviderFeedPost) => {
    setEditingId(post._id);
    setTitle(post.title);
    setContent(post.content);
    setType(post.type);
    setError("");
  };

  const cancelEditing = () => {
    setEditingId(null);
    setTitle("");
    setContent("");
    setType("update");
  };

  const saveEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingId || !title.trim() || !content.trim()) return;
    setPublishing(true);
    setError("");
    try {
      await updateProviderFeedPost(editingId, { title, content, type });
      cancelEditing();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update post.");
    } finally {
      setPublishing(false);
    }
  };

  const removePost = async (post: ProviderFeedPost) => {
    if (!window.confirm(`Delete "${post.title}"? This cannot be undone.`)) return;
    setError("");
    try {
      await deleteProviderFeedPost(post._id);
      if (editingId === post._id) cancelEditing();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete post.");
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-4"><div><h1 className="text-3xl font-bold">Provider Timeline</h1><p className="text-muted-foreground">Share scholarship opportunities, announcements, and updates.</p></div><Button variant="outline" onClick={load}><RefreshCw className="size-4 mr-2" />Refresh</Button></div>
      <Card><CardHeader><CardTitle>{editingId ? "Edit post" : "Publish an update"}</CardTitle></CardHeader><CardContent><form onSubmit={editingId ? saveEdit : publish} className="space-y-3"><Input placeholder="Post title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} required /><Textarea placeholder="What would you like to share?" value={content} onChange={(e) => setContent(e.target.value)} maxLength={5000} required /><div className="flex flex-wrap items-center gap-3"><select className="h-9 rounded-md border bg-background px-3 text-sm" value={type} onChange={(e) => setType(e.target.value as "announcement" | "update")}><option value="update">Update</option><option value="announcement">Announcement</option></select><Button type="submit" disabled={publishing}>{editingId ? <Pencil className="size-4 mr-2" /> : <Plus className="size-4 mr-2" />}{publishing ? "Saving..." : editingId ? "Save changes" : "Publish"}</Button>{editingId && <Button type="button" variant="outline" onClick={cancelEditing}><X className="size-4 mr-2" />Cancel</Button>}</div></form></CardContent></Card>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading ? <p className="text-muted-foreground">Loading timeline...</p> : items.map((item) => item.feedType === "post" ? (
        <Card key={item._id}><CardHeader><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-2"><Megaphone className="size-4 text-blue-600" /><CardTitle>{item.title}</CardTitle><Badge variant="secondary">{item.type}</Badge>{item.isEdited && <Badge variant="outline">Edited</Badge>}</div><div className="flex gap-1"><Button type="button" variant="ghost" size="sm" aria-label={`Edit ${item.title}`} onClick={() => startEditing(item)}><Pencil className="size-4" /></Button><Button type="button" variant="ghost" size="sm" aria-label={`Delete ${item.title}`} onClick={() => removePost(item)}><Trash2 className="size-4 text-destructive" /></Button></div></div><p className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</p></CardHeader><CardContent><p className="whitespace-pre-wrap break-words"><LinkifiedText>{item.content}</LinkifiedText></p></CardContent></Card>
      ) : (
        <Card key={item._id}><CardHeader><CardTitle>{item.name}</CardTitle><p className="text-xs text-muted-foreground">Scholarship post · {new Date(item.createdAt || "").toLocaleString()}</p></CardHeader><CardContent><p className="text-sm">{item.description}</p><Link to={`/provider/scholarships/${item._id}/edit`} className="text-sm text-blue-600 hover:underline">Manage scholarship</Link></CardContent></Card>
      ))}
    </div>
  );
}
