import mongoose from "mongoose";

const screeningScheduleSchema = new mongoose.Schema(
  {
    date: { type: Date, default: null },
    time: { type: String, default: "" },
    venue: { type: String, default: "" },
    notes: { type: String, default: "" },
  },
  { _id: false }
);

const applicationSchema = new mongoose.Schema(
  {
    studentId: { type: String, default: "" },
    studentName: { type: String, default: "" },
    studentEmail: { type: String, default: "" },
    scholarshipId: { type: mongoose.Schema.Types.ObjectId, ref: "Scholarship", required: true },
    scholarshipName: { type: String, default: "" },
    matchScore: { type: Number, default: 0 },
    status: { type: String, default: "Pending" },
    submittedAt: { type: Date, default: Date.now },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    approvedByRole: { type: String, default: null },
    approvedAt: { type: Date, default: null },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    rejectedByRole: { type: String, default: null },
    rejectedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null },
    screeningSchedule: { type: screeningScheduleSchema, default: null },
    documents: { type: [mongoose.Schema.Types.Mixed], default: [] },
    notes: { type: String, default: "" },
  },
  {
    timestamps: true,
    collection: "applications",
    strict: false,
  }
);

applicationSchema.index({ studentId: 1, scholarshipId: 1 });

const Application = mongoose.models.Application || mongoose.model("Application", applicationSchema);

export default Application;