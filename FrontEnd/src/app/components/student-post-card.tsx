import { useEffect, useState } from "react";
import { Download, FileText, Image as ImageIcon } from "lucide-react";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader } from "./ui/card";
import { fetchStudentPostAttachment, type StudentPost, type StudentPostAttachment } from "../lib/api-client";

function categoryLabel(category: StudentPost["category"]) {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "S";
}

function PostAttachment({ postId, attachment }: { postId: string; attachment: StudentPostAttachment }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let objectUrl = "";
    fetchStudentPostAttachment(postId, attachment.id)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Attachment could not be loaded.");
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [postId, attachment.id]);

  if (error) return <p className="text-xs text-destructive">{error}</p>;
  if (!url) return <p className="text-xs text-muted-foreground">Loading {attachment.originalName}...</p>;
  if (attachment.kind === "photo") {
    return <img src={url} alt={attachment.originalName} className="max-h-[520px] w-full rounded-lg object-contain bg-muted" />;
  }
  return (
    <a
      href={url}
      download={attachment.originalName}
      className="flex items-center gap-3 rounded-lg border p-3 text-sm hover:bg-muted"
    >
      <FileText className="size-5 shrink-0 text-primary" />
      <span className="min-w-0 flex-1 truncate">{attachment.originalName}</span>
      <Download className="size-4 shrink-0" />
    </a>
  );
}

export function StudentPostCard({
  post,
  showModerationStatus = false,
}: {
  post: StudentPost;
  showModerationStatus?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-3 space-y-0">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
          {initials(post.authorName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{post.authorName}</p>
            <Badge variant="secondary">{categoryLabel(post.category)}</Badge>
            {showModerationStatus && post.moderationStatus === "pending" && (
              <Badge variant="outline">Pending admin review</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{post.authorHeadline} · {new Date(post.createdAt).toLocaleString()}</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="whitespace-pre-wrap break-words">{post.content}</p>
        {post.warningReason && showModerationStatus && (
          <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            Admin warning: {post.warningReason}
          </p>
        )}
        {post.attachments.length > 0 && (
          <div className="space-y-3">
            {post.attachments.map((attachment) => (
              <div key={attachment.id}>
                {attachment.kind === "photo" ? (
                  <div className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <ImageIcon className="size-3" /> Photo
                  </div>
                ) : null}
                <PostAttachment postId={post._id} attachment={attachment} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
