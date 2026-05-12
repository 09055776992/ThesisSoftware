import { useEffect, useMemo, useState } from "react";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { getInitials, getStoredUser } from "../lib/user-storage";
import { fetchConversations, saveConversations as saveConversationsApi } from "../lib/api-client";
import { format } from "date-fns";

const CONVERSATIONS_KEY = "scholarship-portal-conversations";

type Message = { id: string; sender: string; text: string; ts: number };
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
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [messageText, setMessageText] = useState("");
  const user = getStoredUser();
  const currentUserEmail = String(user?.email || "").trim().toLowerCase();

  useEffect(() => {
    loadConversationsWithFallback(user?.email).then(setConversations);
  }, [user?.email]);

  useEffect(() => {
    persistConversationsWithFallback(user?.email, conversations);
  }, [conversations, user?.email]);

  const activeConv = useMemo(() => conversations.find((c) => c.id === activeId) || null, [conversations, activeId]);

  const startConversation = (name: string, participantId: string) => {
    if (!participantId) return;
    const existing = conversations.find((c) => c.participantId === participantId);
    if (existing) {
      setActiveId(existing.id);
      setIsNewOpen(false);
      return;
    }

    const id = String(Date.now());
    const conv: Conversation = { id, name, participantId, messages: [] };
    const next = [conv, ...conversations];
    setConversations(next);
    setActiveId(id);
    setIsNewOpen(false);
  };

  const sendMessage = () => {
    if (!activeConv || !messageText.trim()) return;
    const msg: Message = { id: String(Date.now()), sender: currentUserEmail || "me", text: messageText.trim(), ts: Date.now() };
    const next = conversations.map((c) => (c.id === activeConv.id ? { ...c, messages: [...c.messages, msg] } : c));
    setConversations(next);
    setMessageText("");
  };

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Messages</h1>
            <p className="text-gray-600">View and manage your conversations</p>
          </div>
          <div>
            <Button onClick={() => setIsNewOpen(true)}>+ New Message</Button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 grid grid-cols-3 gap-4">
          <div className="col-span-1 border-r pr-4">
            <div className="mb-3">
              <input
                className="w-full border rounded px-3 py-2"
                placeholder="Search users or conversations"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>
            <div className="space-y-2 overflow-y-auto max-h-[60vh]">
              {conversations.length === 0 ? (
                <div className="text-sm text-gray-600">No conversations yet. Start a new message.</div>
              ) : (
                conversations
                  .filter((c) => c.name.toLowerCase().includes(searchText.toLowerCase()))
                  .map((c) => (
                    <div
                      key={c.id}
                      className={`flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer ${activeId === c.id ? "bg-gray-100" : ""}`}
                      onClick={() => setActiveId(c.id)}
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-blue-100 text-blue-700">{getInitials({ fullName: c.name })}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-sm truncate">{c.name}</div>
                          <div className="text-xs text-muted-foreground">{c.messages.length ? format(new Date(c.messages[c.messages.length - 1].ts), "p") : ""}</div>
                        </div>
                        <div className="text-xs text-muted-foreground truncate">{c.messages.length ? c.messages[c.messages.length - 1].text : "No messages yet"}</div>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>

          <div className="col-span-2">
            {activeConv ? (
              <div className="flex flex-col h-[60vh]">
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {activeConv.messages.map((m) => (
                    <div key={m.id} className={`flex ${m.sender === "me" || (currentUserEmail && m.sender === currentUserEmail) ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[70%] px-4 py-2 rounded ${m.sender === "me" || (currentUserEmail && m.sender === currentUserEmail) ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-900"}`}>
                        <div className="text-sm">{m.text}</div>
                        <div className="text-xs text-muted-foreground mt-1">{format(new Date(m.ts), "P p")}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-4 border-t">
                  <div className="flex gap-2">
                    <input
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder="Write a message..."
                      className="flex-1 border rounded px-3 py-2"
                    />
                    <Button onClick={sendMessage}>Send</Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-[60vh] flex items-center justify-center text-gray-600">Select a conversation or start a new message.</div>
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
            <input placeholder="Recipient name or email" className="w-full border rounded px-3 py-2" onChange={(e) => setSearchText(e.target.value)} value={searchText} />
            <div className="flex justify-end">
              <Button onClick={() => startConversation(searchText || "New Contact", searchText || String(Date.now()))}>Start</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
