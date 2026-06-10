import { Bell } from "lucide-react";

export function ProviderNotifications() {
  return (
    <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="p-4 rounded-full bg-amber-50 mb-4">
        <Bell className="size-10 text-amber-400" />
      </div>
      <h2 className="text-xl font-semibold mb-2">Notifications</h2>
      <p className="text-muted-foreground max-w-sm">
        You'll receive notifications here when students apply to your scholarships or when your account status changes.
      </p>
    </div>
  );
}
