import { MessageSquare } from "lucide-react";

export function ProviderMessages() {
  return (
    <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="p-4 rounded-full bg-blue-50 mb-4">
        <MessageSquare className="size-10 text-blue-400" />
      </div>
      <h2 className="text-xl font-semibold mb-2">Messages</h2>
      <p className="text-muted-foreground max-w-sm">
        Messaging with applicants will be available here. This feature is coming soon.
      </p>
    </div>
  );
}
