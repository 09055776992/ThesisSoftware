import { FormEvent, useCallback, useEffect, useState } from "react";
import { Bell, Loader2, Send } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Label } from "../../components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { fetchAdminNotifications, createAdminNotification, type AdminNotificationInput } from "../../lib/api-client";
import { toast } from "sonner";

type AdminNotification = {
  _id?: string;
  title: string;
  message: string;
  type?: string;
  priority?: string;
  recipientGroup?: string;
  createdAt?: string;
  recipientCount?: number;
};

const initialForm: AdminNotificationInput = {
  recipientGroup: "all",
  title: "",
  message: "",
  type: "announcement",
  priority: "normal",
};

const recipientLabels: Record<AdminNotificationInput["recipientGroup"], string> = {
  all: "All Users",
  students: "Students Only",
  providers: "Providers Only",
  specific: "Specific User ID",
};

function formatDate(value?: string) {
  if (!value) return "Unknown date";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown date" : date.toLocaleString();
}

export function AdminNotifications() {
  const [composeOpen, setComposeOpen] = useState(false);
  const [form, setForm] = useState<AdminNotificationInput>(initialForm);
  const [specificUserId, setSpecificUserId] = useState("");
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const result = await fetchAdminNotifications();
      setNotifications((result.data || []) as AdminNotification[]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const updateForm = <K extends keyof AdminNotificationInput>(key: K, value: AdminNotificationInput[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (form.recipientGroup === "specific" && !specificUserId.trim()) {
      toast.error("Enter a specific user ID.");
      return;
    }

    try {
      setSending(true);
      const result = await createAdminNotification({
        ...form,
        ...(form.recipientGroup === "specific" ? { specificUserId: specificUserId.trim() } : {}),
      });
      toast.success(`${result.message} ${result.count} recipient(s) notified.`);
      setForm(initialForm);
      setSpecificUserId("");
      setComposeOpen(false);
      await loadNotifications();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send notification.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 md:mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Notifications</h1>
            <p className="text-muted-foreground">System alerts and announcements</p>
          </div>
          <Button onClick={() => setComposeOpen(true)}>
            <Send className="size-4 mr-2" /> Send Notification
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="size-5 animate-spin mr-2" /> Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-10 text-center text-muted-foreground">
            <Bell className="size-8 mx-auto mb-3 opacity-60" />
            No notifications have been sent yet.
          </div>
        ) : (
          <div className="space-y-4">
            {notifications.map((notification, index) => (
              <div key={notification._id || `${notification.title}-${notification.createdAt}-${index}`} className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-start gap-4">
                  <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    <Bell className="size-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <h3 className="font-semibold">{notification.title}</h3>
                      <span className="text-sm text-muted-foreground">{formatDate(notification.createdAt)}</span>
                    </div>
                    <p className="text-muted-foreground text-sm whitespace-pre-wrap">{notification.message}</p>
                    <p className="text-xs text-muted-foreground mt-3">
                      {recipientLabels[(notification.recipientGroup as AdminNotificationInput["recipientGroup"]) || "all"] || "Recipients"} · {notification.recipientCount || 1} recipient(s) · {notification.type || "info"} · {notification.priority || "normal"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Notification</DialogTitle>
            <DialogDescription>Send an in-app notification to selected users.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Recipients</Label>
              <Select value={form.recipientGroup} onValueChange={(value: AdminNotificationInput["recipientGroup"]) => updateForm("recipientGroup", value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="students">Students Only</SelectItem>
                  <SelectItem value="providers">Providers Only</SelectItem>
                  <SelectItem value="specific">Specific User ID</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.recipientGroup === "specific" && (
              <div className="space-y-2">
                <Label htmlFor="specific-user-id">User ID</Label>
                <Input id="specific-user-id" value={specificUserId} onChange={(event) => setSpecificUserId(event.target.value)} placeholder="MongoDB user ID" />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="notification-title">Title</Label>
              <Input id="notification-title" value={form.title} maxLength={160} onChange={(event) => updateForm("title", event.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notification-message">Message</Label>
              <Textarea id="notification-message" value={form.message} maxLength={5000} onChange={(event) => updateForm("message", event.target.value)} rows={5} required />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(value: AdminNotificationInput["type"]) => updateForm("type", value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="system_alert">System Alert</SelectItem>
                    <SelectItem value="announcement">Announcement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(value: AdminNotificationInput["priority"]) => updateForm("priority", value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" disabled={sending || !form.title.trim() || !form.message.trim()}>
              {sending ? <><Loader2 className="size-4 mr-2 animate-spin" /> Sending...</> : <><Send className="size-4 mr-2" /> Send Notification</>}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
