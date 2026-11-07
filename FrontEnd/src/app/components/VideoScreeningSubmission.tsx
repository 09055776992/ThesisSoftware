import { ExternalLink, Video } from "lucide-react";
import { Button } from "./ui/button";

interface VideoScreeningSubmissionProps {
  googleDriveLink?: string;
  submissionDeadline?: string;
  notes?: string;
  compact?: boolean;
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "TBD";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function VideoScreeningSubmission({
  googleDriveLink,
  submissionDeadline,
  notes,
  compact = false,
}: VideoScreeningSubmissionProps) {
  const driveLink = String(googleDriveLink || "").trim();

  return (
    <div
      className={`rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 ${
        compact ? "p-3" : "p-4"
      }`}
    >
      <div className="flex items-start gap-2 mb-3">
        <div className="mt-0.5 size-8 rounded-full flex items-center justify-center shrink-0 bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
          <Video className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="font-semibold text-sm text-blue-800 dark:text-blue-300">
            Submit Video Screening
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Open the provider&apos;s Google Drive folder below and upload your recorded video there.
            Deadline: {formatDate(submissionDeadline)}
          </p>
        </div>
      </div>

      {notes && (
        <p className="mb-3 text-xs text-blue-900/80 dark:text-blue-200/80">
          <span className="font-medium">Instructions:</span> {notes}
        </p>
      )}

      {driveLink ? (
        <div className="space-y-2">
          <Button asChild className="w-full sm:w-auto">
            <a href={driveLink} target="_blank" rel="noopener noreferrer">
              Open Google Drive Folder
              <ExternalLink className="size-4 ml-2" />
            </a>
          </Button>
          <a
            href={driveLink}
            target="_blank"
            rel="noopener noreferrer"
            className="block break-all text-xs font-medium text-blue-700 hover:underline dark:text-blue-400"
          >
            {driveLink}
          </a>
        </div>
      ) : (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Waiting for the provider to share a Google Drive upload link.
        </p>
      )}
    </div>
  );
}
