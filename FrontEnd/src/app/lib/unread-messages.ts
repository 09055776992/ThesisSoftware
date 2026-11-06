export type UnreadMessage = {
  sender: string;
  readBy?: string[];
};

export type UnreadConversation = {
  messages?: UnreadMessage[];
};

export function countUnreadMessages(conversations: UnreadConversation[], email: string): number {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) return 0;

  return conversations.reduce((total, conversation) => total + (conversation.messages || []).filter((message) => {
    const sender = String(message.sender || "").trim().toLowerCase();
    return sender !== normalizedEmail && sender !== "me"
      && !(message.readBy || []).some((reader) => String(reader).trim().toLowerCase() === normalizedEmail);
  }).length, 0);
}
