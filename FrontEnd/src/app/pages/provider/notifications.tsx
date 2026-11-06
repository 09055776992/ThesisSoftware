import { useCallback, useEffect, useState } from "react";
import { Bell, Check, Clock } from "lucide-react";
import {
  fetchProviderNotifications,
  markProviderNotificationRead,
  type ProviderNotification,
} from "../../lib/api-client";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";

export function ProviderNotifications() {
  const [notifications, setNotifications] = useState<ProviderNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    setError("");
    try {
      const response = await fetchProviderNotifications();
      setNotifications(response.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const markRead = async (notificationId: string) => {
    setUpdatingId(notificationId);
    setError("");
    try {
      await markProviderNotificationRead(notificationId);
      setNotifications((current) => current.map((notification) =>
        notification._id === notificationId
          ? { ...notification, read: true, is_read: true }
          : notification
      ));
      window.dispatchEvent(new Event("provider-notifications-updated"));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to mark notification as read.");
    } finally {
      setUpdatingId(null);
    }
  };

  const unreadCount = notifications.filter((notification) =>
    notification.read !== true && notification.is_read !== true
  ).length;

  return (
    <main className="mx-auto w-full max-w-4xl p-4 md:p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Updates about applications and your provider account.
          </p>
        </div>
        {unreadCount > 0 && (
          <span className="rounded-full bg-red-500 px-2.5 py-1 text-sm font-semibold text-white">
            {unreadCount} unread
          </span>
        )}
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Loading notifications...</p>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-56 flex-col items-center justify-center py-10 text-center">
            <div className="mb-4 rounded-full bg-amber-50 p-4">
              <Bell className="size-9 text-amber-400" />
            </div>
            <h2 className="font-semibold">You’re all caught up</h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              New application and account updates will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => {
            const isRead = notification.read === true || notification.is_read === true;
            const date = notification.createdAt ? new Date(notification.createdAt) : null;
            return (
              <Card key={notification._id} className={isRead ? "" : "border-l-4 border-l-red-500"}>
                <CardContent className="flex items-start gap-3 p-4 md:p-5">
                  <div className={`mt-0.5 rounded-full p-2 ${isRead ? "bg-muted" : "bg-red-50"}`}>
                    <Bell className={`size-4 ${isRead ? "text-muted-foreground" : "text-red-500"}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-medium">{notification.title || "Notification"}</h2>
                      {!isRead && <span className="size-2 rounded-full bg-red-500" aria-label="Unread" />}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                      {notification.message || "You have a new update."}
                    </p>
                    {date && !Number.isNaN(date.getTime()) && (
                      <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="size-3" />
                        {date.toLocaleString()}
                      </p>
                    )}
                  </div>
                  {!isRead && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={updatingId === notification._id}
                      onClick={() => void markRead(notification._id)}
                      aria-label="Mark notification as read"
                    >
                      <Check className="mr-1 size-4" />
                      Mark read
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
