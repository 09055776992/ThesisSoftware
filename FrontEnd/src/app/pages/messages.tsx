import { useEffect, useMemo, useState } from "react";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { getInitials, getStoredUser } from "../lib/user-storage";
import { fetchConversations, saveConversations as saveConversationsApi } from "../lib/api-client";
import { countUnreadMessages } from "../lib/unread-messages";
import { format } from "date-fns";

const CONVERSATIONS_KEY = "scholarship-portal-conversations";

type Message = { id: string; sender: string; text: string; ts: number; readBy?: string[] };
type Conversation = { id: string; name: string; participantId: string; messages: Message[] };

function conversationsKey(email?: string): string {
  const normalizedEmail = String(email || "guest").trim().toLowerCase();
  return `${CONVERSATIONS_KEY}:${normalizedEmail}`;
}

function loadConversations(email?: string): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(conversationsKey(email));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveConversationsLocal(items: Conversation[], email?: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(conversationsKey(email), JSON.stringify(items));
}

function mergeConversations(local: Conversation[], remote: Conversation[]): Conversation[] {
  const remoteById = new Map(remote.map((conversation) => [conversation.id, conversation]));
  const merged = local.map((localConversation) => {
    const remoteConversation = remoteById.get(localConversation.id);
    if (!remoteConversation) return localConversation;

    const messagesById = new Map<string, Message>();
    for (const message of remoteConversation.messages) messagesById.set(message.id, message);
    for (const message of localConversation.messages) messagesById.set(message.id, message);
    for (const [messageId, localMessage] of messagesById) {
      const remoteMessage = remoteConversation.messages.find((message) => message.id === messageId);
      if (!remoteMessage) continue;
      messagesById.set(messageId, {
        ...localMessage,
        ...remoteMessage,
        readBy: Array.from(new Set([...(localMessage.readBy || []), ...(remoteMessage.readBy || [])])),
      });
    }
    const messages = Array.from(messagesById.values()).sort((left, right) => left.ts - right.ts);
    const unchanged = localConversation.name === remoteConversation.name
      && localConversation.participantId === remoteConversation.participantId
      && messages.length === localConversation.messages.length
      && messages.every((message, index) => {
        const localMessage = localConversation.messages[index];
        const readBy = (message.readBy || []).map((reader) => String(reader).toLowerCase()).sort();
        const localReadBy = (localMessage.readBy || []).map((reader) => String(reader).toLowerCase()).sort();
        return message.id === localMessage.id
          && readBy.length === localReadBy.length
          && readBy.every((reader, readerIndex) => reader === localReadBy[readerIndex]);
      });
    if (unchanged) return localConversation;

    return { ...remoteConversation, messages };
  });

  const localIds = new Set(local.map((conversation) => conversation.id));
  for (const conversation of remote) {
    if (!localIds.has(conversation.id)) merged.push(conversation);
  }
  return merged.length === local.length && merged.every((conversation, index) => conversation === local[index])
    ? local
    : merged;
}

async function loadConversationsWithFallback(email?: string): Promise<Conversation[]> {
  if (!email) {
    return loadConversations(email);
  }

  try {
    const result = await fetchConversations(email);
    const conversations = Array.isArray(result.data) ? result.data : [];
    saveConversationsLocal(conversations, email);
    return conversations;
  } catch {
    return loadConversations(email);
  }
}

async function persistConversationsWithFallback(email: string | undefined, conversations: Conversation[]): Promise<void> {
  saveConversationsLocal(conversations, email);

  if (!email) {
    return;
  }

  try {
    await saveConversationsApi(email, conversations);
  } catch {
    // Keep local persistence when backend is unavailable.
  }
}

export function Messages() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [messageText, setMessageText] = useState("");
  const user = getStoredUser();
  const currentUserEmail = String(user?.email || "").trim().toLowerCase();

  useEffect(() => {
    let active = true;
    loadConversationsWithFallback(user?.email).then((loaded) => {
      if (active) setConversations((current) => mergeConversations(current, loaded));
    });

    const intervalId = window.setInterval(async () => {
      if (!user?.email) return;
      try {
        const result = await fetchConversations(user.email);
        if (active && Array.isArray(result.data)) {
          setConversations((current) => mergeConversations(current, result.data));
        }
      } catch (error) {
        console.error("Failed to refresh conversations:", error);
      }
    }, 5000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [user?.email]);

  useEffect(() => {
    persistConversationsWithFallback(user?.email, conversations);
  }, [conversations, user?.email]);

  const activeConv = useMemo(() => conversations.find((c) => c.id === activeId) || null, [conversations, activeId]);

  useEffect(() => {
    if (!activeId || !currentUserEmail) return;
    setConversations((current) => current.map((conversation) => {
      if (conversation.id !== activeId) return conversation;
      let changed = false;
      const messages = conversation.messages.map((message) => {
        const sender = String(message.sender || "").trim().toLowerCase();
        const readBy = message.readBy || [];
        if (sender === currentUserEmail || sender === "me"
          || readBy.some((reader) => String(reader).trim().toLowerCase() === currentUserEmail)) {
          return message;
        }
        changed = true;
        return { ...message, readBy: [...readBy, currentUserEmail] };
      });
      return changed ? { ...conversation, messages } : conversation;
    }));
  }, [activeId, activeConv?.messages, currentUserEmail]);

  const startConversation = (name: string, participantId: string) => {
    if (!participantId) return;
    const existing = conversations.find((c) => c.participantId === participantId);
    if (existing) {
      setActiveId(existing.id);
      setShowMobileChat(true);
      setIsNewOpen(false);
      return;
    }

    const id = String(Date.now());
    const conv: Conversation = { id, name, participantId, messages: [] };
    const next = [conv, ...conversations];
    setConversations(next);
    setActiveId(id);
    setShowMobileChat(true);
    setIsNewOpen(false);
  };

  const sendMessage = () => {
    if (!activeConv || !messageText.trim()) return;
    const msg: Message = {
      id: String(Date.now()),
      sender: currentUserEmail || "me",
      text: messageText.trim(),
      ts: Date.now(),
      readBy: currentUserEmail ? [currentUserEmail] : [],
    };
    const next = conversations.map((c) => (c.id === activeConv.id ? { ...c, messages: [...c.messages, msg] } : c));
    setConversations(next);
    setMessageText("");
  };

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">Messages</h1>
            <p className="text-gray-600 dark:text-slate-400">View and manage your conversations</p>
          </div>
          <div>
            <Button onClick={() => setIsNewOpen(true)}>+ New Message</Button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-card-foreground">
          {/* Conversation List — hidden on mobile when chat is open */}
          <div className={`col-span-1 border-b md:border-b-0 md:border-r border-gray-200 dark:border-slate-800 pr-0 md:pr-4 pb-4 md:pb-0 ${showMobileChat ? "hidden md:block" : "block"}`}>
            <div className="mb-3">
              <input
                className="w-full border border-gray-200 dark:border-slate-700 rounded px-3 py-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500"
                placeholder="Search users or conversations"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>
            <div className="space-y-2 overflow-y-auto max-h-[60vh]">
              {conversations.length === 0 ? (
                <div className="text-sm text-gray-600 dark:text-slate-400">No conversations yet. Start a new message.</div>
              ) : (
                conversations
                  .filter((c) => c.name.toLowerCase().includes(searchText.toLowerCase()))
                  .map((c) => {
                    const unreadCount = countUnreadMessages([c], currentUserEmail);
                    return (
                      <div
                        key={c.id}
                        className={`flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer ${activeId === c.id ? "bg-gray-100 dark:bg-slate-800" : ""}`}
                        onClick={() => { setActiveId(c.id); setShowMobileChat(true); }}
                      >
                        <Avatar className="size-10">
                          <AvatarFallback className="bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">{getInitials({ fullName: c.name })}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-medium text-sm truncate text-gray-900 dark:text-slate-100">{c.name}</div>
                            <div className="text-xs text-gray-500 dark:text-slate-400 shrink-0">{c.messages.length ? format(new Date(c.messages[c.messages.length - 1].ts), "p") : ""}</div>
                          </div>
                          <div className="text-xs text-gray-500 dark:text-slate-400 truncate">{c.messages.length ? c.messages[c.messages.length - 1].text : "No messages yet"}</div>
                        </div>
                        {unreadCount > 0 && (
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-red-500 text-[11px] font-semibold text-white" aria-label={`${unreadCount} unread messages`}>
                            {unreadCount > 99 ? "99+" : unreadCount}
                          </span>
                        )}
                      </div>
                    );
                  })
              )}
            </div>
          </div>

          {/* Chat Pane — hidden on mobile when list is shown */}
          <div className={`col-span-1 md:col-span-2 ${showMobileChat ? "block" : "hidden md:block"}`}>
            {activeConv ? (
              <div className="flex flex-col h-[60vh]">
                {/* Mobile back button */}
                <div className="flex items-center gap-2 mb-3 md:hidden">
                  <button
                    onClick={() => setShowMobileChat(false)}
                    className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                    aria-label="Back to conversations"
                  >
                    <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                  </button>
                  <span className="font-medium text-sm truncate text-gray-900 dark:text-slate-100">{activeConv.name}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {activeConv.messages.map((m) => (
                    <div key={m.id} className={`flex ${m.sender === "me" || (currentUserEmail && m.sender === currentUserEmail) ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[70%] px-4 py-2 rounded ${m.sender === "me" || (currentUserEmail && m.sender === currentUserEmail) ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-900 dark:bg-slate-800 dark:text-slate-100"}`}>
                        <div className="text-sm">{m.text}</div>
                        <div className={`text-xs mt-1 ${m.sender === "me" || (currentUserEmail && m.sender === currentUserEmail) ? "text-blue-100" : "text-gray-500 dark:text-slate-400"}`}>{format(new Date(m.ts), "P p")}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-4 border-t border-gray-200 dark:border-slate-800">
                  <div className="flex gap-2">
                    <input
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder="Write a message..."
                      className="flex-1 border border-gray-200 dark:border-slate-700 rounded px-3 py-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500"
                    />
                    <Button onClick={sendMessage}>Send</Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-[60vh] flex items-center justify-center text-gray-600 dark:text-slate-400">Select a conversation or start a new message.</div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Conversation</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <input
              placeholder="Recipient name or email"
              className="w-full border border-gray-200 dark:border-slate-700 rounded px-3 py-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500"
              onChange={(e) => setSearchText(e.target.value)}
              value={searchText}
            />
            <div className="flex justify-end">
              <Button onClick={() => startConversation(searchText || "New Contact", searchText || String(Date.now()))}>Start</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
