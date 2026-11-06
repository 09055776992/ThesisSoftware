import mongoose from "mongoose";

const feedPostSchema = new mongoose.Schema(
  {
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    authorType: { type: String, enum: ["provider", "student"], default: "provider" },
    authorName: { type: String, trim: true, default: "" },
    authorHeadline: { type: String, trim: true, default: "" },
    category: { type: String, enum: ["academic", "achievements", "updates", "appreciation"], default: "updates" },
    attachments: {
      type: [{
        id: { type: String, required: true },
        storedName: { type: String, required: true },
        originalName: { type: String, required: true },
        mimeType: { type: String, required: true },
        size: { type: Number, required: true },
        kind: { type: String, enum: ["photo", "document"], required: true },
      }],
      default: [],
    },
    moderationStatus: { type: String, enum: ["pending", "approved", "removed"], default: "approved" },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    moderationReason: { type: String, trim: true, default: "" },
    warningReason: { type: String, trim: true, default: "" },
    warnedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    warnedAt: { type: Date, default: null },
    providerName: { type: String, required: true, trim: true },
    type: { type: String, enum: ["announcement", "update"], default: "update" },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    content: { type: String, required: true, trim: true, maxlength: 5000 },
    visibility: { type: String, enum: ["public"], default: "public" },
    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },
    notifiedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "feedPosts" },
);

feedPostSchema.index({ authorId: 1, createdAt: -1 });
feedPostSchema.index({ visibility: 1, createdAt: -1 });
feedPostSchema.index({ authorType: 1, moderationStatus: 1, createdAt: -1 });

const FeedPost = mongoose.models.FeedPost || mongoose.model("FeedPost", feedPostSchema);

export default FeedPost;
