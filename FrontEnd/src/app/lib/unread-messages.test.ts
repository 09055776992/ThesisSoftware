import { describe, expect, it } from "vitest";
import { countUnreadMessages } from "./unread-messages";

describe("countUnreadMessages", () => {
  it("counts incoming messages that the current user has not read", () => {
    const conversations = [
      { messages: [
        { sender: "sender@example.com" },
        { sender: "sender@example.com", readBy: ["other@example.com"] },
      ] },
      { messages: [{ sender: "another@example.com" }] },
    ];

    expect(countUnreadMessages(conversations, "READER@example.com")).toBe(3);
  });

  it("excludes messages sent by the current user and messages already read", () => {
    const conversations = [
      { messages: [
        { sender: "reader@example.com" },
        { sender: "me" },
        { sender: "sender@example.com", readBy: ["READER@example.com"] },
      ] },
    ];

    expect(countUnreadMessages(conversations, "reader@example.com")).toBe(0);
  });

  it("handles absent email and conversations without message arrays", () => {
    expect(countUnreadMessages([{ }, { messages: [{ sender: "sender@example.com" }] }], "")).toBe(0);
    expect(countUnreadMessages([{ }, { messages: [{ sender: "sender@example.com" }] }], "reader@example.com")).toBe(1);
  });
});
