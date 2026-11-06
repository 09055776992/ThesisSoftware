import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import FeedPost from "../models/feed-post.model.js";

test("student posts validate pending moderation and photo/document attachments", async () => {
  const post = new FeedPost({
    authorId: new mongoose.Types.ObjectId(),
    authorType: "student",
    authorName: "Scholar Test",
    providerName: "Scholar",
    title: "Thank you for the scholarship",
    content: "Thank you for supporting my studies.",
    category: "appreciation",
    moderationStatus: "pending",
    attachments: [{
      id: "attachment-1",
      storedName: "private-file.pdf",
      originalName: "award.pdf",
      mimeType: "application/pdf",
      size: 1024,
      kind: "document",
    }, {
      id: "attachment-2",
      storedName: "private-photo.jpg",
      originalName: "award.jpg",
      mimeType: "image/jpeg",
      size: 2048,
      kind: "photo",
    }],
  });

  assert.equal(new FeedPost({
    authorId: new mongoose.Types.ObjectId(),
    providerName: "Provider",
    title: "Existing provider post",
    content: "Provider update",
  }).moderationStatus, "approved");
  await post.validate();
  assert.equal(post.moderationStatus, "pending");
  assert.equal(post.authorType, "student");
  assert.equal(post.attachments[0].kind, "document");
  assert.equal(post.attachments[1].kind, "photo");
});

test("student posts reject unknown moderation states and categories", async () => {
  const post = new FeedPost({
    authorId: new mongoose.Types.ObjectId(),
    authorType: "student",
    providerName: "Scholar",
    title: "Post",
    content: "Post content",
    category: "unlisted",
    moderationStatus: "visible",
  });

  await assert.rejects(post.validate());
});
