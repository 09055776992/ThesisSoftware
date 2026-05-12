import mongoose from "mongoose";

const customOrderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    requestDetails: {
      type: String,
      required: true,
      trim: true,
    },
    aiPrompt: {
      type: String,
      trim: true,
    },
    aiResult: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed", "cancelled"],
      default: "pending",
    },
    attachments: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

const CustomOrder = mongoose.model("CustomOrder", customOrderSchema);
export default CustomOrder;
