import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
process.env.MONGODB_URI ||= "mongodb://127.0.0.1:27017/scholar-post-tests";
const { default: FeedPost } = await import("../models/feed-post.model.js");
const {
  getProviderStudentPosts,
  getStudentHomePosts,
  getStudentPostAttachment,
} = await import("../controller/feed.controller.js");

function mockResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    set() {
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test("student Home feed includes approved posts and only the current author's pending posts", async () => {
  const originalFind = FeedPost.find;
  let filter;
  FeedPost.find = (query) => {
    filter = query;
    return {
      sort() { return this; },
      async lean() { return []; },
    };
  };
  try {
    const res = mockResponse();
    const studentId = new mongoose.Types.ObjectId().toString();
    await getStudentHomePosts({
      currentUser: { role: "student" },
      userId: studentId,
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(filter.authorType, "student");
    assert.deepEqual(filter.$or, [
      { moderationStatus: "approved" },
      { authorId: studentId, moderationStatus: "pending" },
    ]);
  } finally {
    FeedPost.find = originalFind;
  }
});

test("provider Home feed query exposes only approved student posts", async () => {
  const originalFind = FeedPost.find;
  let filter;
  FeedPost.find = (query) => {
    filter = query;
    return {
      sort() { return this; },
      async lean() { return []; },
    };
  };
  try {
    const res = mockResponse();
    await getProviderStudentPosts({ currentUser: { role: "provider" } }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(filter, { authorType: "student", moderationStatus: "approved" });
  } finally {
    FeedPost.find = originalFind;
  }
});

test("students cannot access another author's pending post attachment", async () => {
  const originalFindOne = FeedPost.findOne;
  const authorId = new mongoose.Types.ObjectId();
  FeedPost.findOne = () => ({
    async lean() {
      return {
        _id: new mongoose.Types.ObjectId(),
        authorId,
        moderationStatus: "pending",
        attachments: [],
      };
    },
  });
  try {
    const res = mockResponse();
    await getStudentPostAttachment({
      params: {
        postId: new mongoose.Types.ObjectId().toString(),
        attachmentId: "private-attachment",
      },
      currentUser: { role: "student" },
      userId: new mongoose.Types.ObjectId().toString(),
    }, res);

    assert.equal(res.statusCode, 404);
    assert.equal(res.body.message, "Post attachment not found.");
  } finally {
    FeedPost.findOne = originalFindOne;
  }
});
