import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { Loader2, MessageSquare, Plus, Search, Send } from "lucide-react";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { toast } from "sonner";
import {
  fetchAdminConversations,
  sendAdminConversationMessage,
  type ConversationPayload,
} from "../../lib/api-client";
import { getInitials, getStoredUser } from "../../lib/user-storage";

type Conversation = ConversationPayload;
type ConversationMessage = Conversation["messages"][number];

function lastMessageTimestamp(conversation: Conversation): number {
  return Math.max(0, ...conversation.messages.map((message) => Number(message.ts) || 0));
}

function displayTime(timestamp: number): string {
  return timestamp ? format(new Date(timestamp), "P p") : "";
}

export function AdminMessages() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [searchText, setSearchText] = useState("");
  const [newRecipient, setNewRecipient] = useState("");
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const adminEmail = String(getStoredUser()?.email || "").trim().toLowerCase();

  const loadConversations = useCallback(async (silent = false) => {
    try {
      const result = await fetchAdminConversations();
      const next = Array.isArray(result.data) ? result.data : [];
      setConversations((current) => {
        const drafts = current.filter((conversation) =>
          conversation.id.startsWith("draft-")
          && !next.some((item) => item.participantId.toLowerCase() === conversation.participantId.toLowerCase()),
        );
        return [...drafts, ...next];
      });
      setActiveId((current) => {
        const activeDraftEmail = current?.startsWith("draft-") ? current.slice("draft-".length) : "";
        if (activeDraftEmail) {
          const matchingConversation = next.find((conversation) =>
            conversation.participantId.toLowerCase() === activeDraftEmail.toLowerCase(),
          );
          return matchingConversation?.id || current;
        }
        return current && next.some((conversation) => conversation.id === current)
          ? current
          : next[0]?.id || null;
      });
    } catch (error) {
      if (!silent) {
        toast.error(error instanceof Error ? error.message : "Failed to load conversations.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConversations();
    const intervalId = window.setInterval(() => void loadConversations(true), 5000);
    return () => window.clearInterval(intervalId);
  }, [loadConversations]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const recipient = String(params.get("email") || "").trim();
    const initialMessage = params.get("message");
    if (initialMessage) setMessageText(initialMessage);
    if (!recipient) return;

    const draft: Conversation = {
      id: `draft-${recipient.toLowerCase()}`,
      name: recipient,
      participantId: recipient,
      messages: [],
    };
    setActiveId(draft.id);
    setConversations((current) => current.some(
      (conversation) => conversation.id === draft.id
        || conversation.participantId.toLowerCase() === recipient.toLowerCase(),
    ) ? current : [draft, ...current]);
  }, []);

  useEffect(() => {
    if (!activeId?.startsWith("draft-")) return;
    const draftEmail = activeId.slice("draft-".length).toLowerCase();
    const existing = conversations.find((conversation) =>
      conversation.id !== activeId && conversation.participantId.toLowerCase() === draftEmail,
    );
    if (existing) {
      setActiveId(existing.id);
      setConversations((current) => current.filter((conversation) => conversation.id !== activeId));
    }
  }, [activeId, conversations]);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeId) || null,
    [activeId, conversations],
  );
  const filteredConversations = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return conversations
      .filter((conversation) => !query
        || conversation.name.toLowerCase().includes(query)
        || conversation.participantId.toLowerCase().includes(query)
        || conversation.messages.some((message) => message.text.toLowerCase().includes(query)))
      .sort((left, right) => lastMessageTimestamp(right) - lastMessageTimestamp(left));
  }, [conversations, searchText]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConversation?.messages.length]);

  const startConversation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = newRecipient.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      toast.error("Enter a valid recipient email address.");
      return;
    }
    const existing = conversations.find(
      (conversation) => conversation.participantId.toLowerCase() === email,
    );
    if (existing) {
      setActiveId(existing.id);
    } else {
      const draft: Conversation = {
        id: `draft-${email}`,
        name: email,
        participantId: email,
        messages: [],
      };
      setConversations((current) => [draft, ...current]);
      setActiveId(draft.id);
    }
    setNewRecipient("");
    setIsNewOpen(false);
  };

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = messageText.trim();
    if (!activeConversation || !text || sending) return;

    try {
      setSending(true);
      const result = await sendAdminConversationMessage({
        recipientEmail: activeConversation.participantId,
        conversationId: activeConversation.id.startsWith("draft-")
          ? undefined
          : activeConversation.id,
        message: text,
      });
      setConversations((current) => [
        result.data,
        ...current.filter((conversation) => conversation.id !== activeConversation.id
          && conversation.id !== result.data.id),
      ]);
      setActiveId(result.data.id);
      setMessageText("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  const isOutgoing = (message: ConversationMessage) =>
    message.sender === "me" || message.sender.toLowerCase() === adminEmail || message.sender === "admin";

  return (
    <div className="p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="mb-1 text-3xl font-bold text-foreground">Messages</h1>
            <p className="text-muted-foreground">View and manage your conversations</p>
          </div>
          <Button onClick={() => setIsNewOpen(true)}>
            <Plus className="mr-2 size-4" />
            New Message
          </Button>
        </div>

        <div className="grid min-h-[560px] grid-cols-1 overflow-hidden rounded-xl border border-border bg-card md:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="border-b border-border p-4 md:border-b-0 md:border-r">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search conversations"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
              />
            </div>
            <div className="max-h-[65vh] space-y-2 overflow-y-auto">
              {loading ? (
                <div className="flex justify-center py-10"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
              ) : filteredConversations.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No conversations yet. Start a new message.
                </p>
              ) : filteredConversations.map((conversation) => {
                const latest = conversation.messages[conversation.messages.length - 1];
                return (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => setActiveId(conversation.id)}
                    className={`flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors hover:bg-muted ${activeId === conversation.id ? "bg-muted" : ""}`}
                  >
                    <Avatar className="size-10 shrink-0">
                      <AvatarFallback>{getInitials({ fullName: conversation.name })}</AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">{conversation.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {latest ? format(new Date(latest.ts), "p") : ""}
                        </span>
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {latest?.text || conversation.participantId}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="flex min-h-[480px] flex-col">
            {activeConversation ? (
              <>
                <header className="flex items-center gap-3 border-b border-border p-4">
                  <Avatar className="size-10">
                    <AvatarFallback>{getInitials({ fullName: activeConversation.name })}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold">{activeConversation.name}</h2>
                    <p className="truncate text-xs text-muted-foreground">{activeConversation.participantId}</p>
                  </div>
                </header>
                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                  {activeConversation.messages.map((message) => {
                    const outgoing = isOutgoing(message);
                    return (
                      <div key={message.id} className={`flex ${outgoing ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] rounded-lg px-4 py-2 ${outgoing ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                          <p className="whitespace-pre-wrap break-words text-sm">{message.text}</p>
                          <p className={`mt-1 text-xs ${outgoing ? "text-primary-foreground/75" : "text-muted-foreground"}`}>
                            {displayTime(Number(message.ts))}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
                <form onSubmit={sendMessage} className="flex gap-2 border-t border-border p-4">
                  <Input
                    value={messageText}
                    onChange={(event) => setMessageText(event.target.value)}
                    placeholder="Write a message..."
                    aria-label="Write a message"
                    autoComplete="off"
                  />
                  <Button type="submit" disabled={sending || !messageText.trim()}>
                    {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                    <span className="ml-2">Send</span>
                  </Button>
                </form>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
                <MessageSquare className="size-10" />
                <p>Select a conversation or start a new message.</p>
              </div>
            )}
          </section>
        </div>
      </div>

      <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Start a conversation</DialogTitle></DialogHeader>
          <form onSubmit={startConversation} className="space-y-4">
            <Input
              type="email"
              required
              placeholder="Recipient email address"
              value={newRecipient}
              onChange={(event) => setNewRecipient(event.target.value)}
            />
            <div className="flex justify-end">
              <Button type="submit">Continue</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
